#!/usr/bin/env python3
"""
Token Caching Service for MMI and RPR APIs
Runs as an HTTP server that provides cached auth tokens.
Automatically refreshes tokens before expiry.

Usage:
    python token_service.py

Environment Variables:
    MMI_EMAIL - MMI login email
    MMI_PASSWORD - MMI login password
    RPR_EMAIL - RPR login email
    RPR_PASSWORD - RPR login password
    TOKEN_SERVICE_PORT - Port to run on (default: 8899)
    TOKEN_SERVICE_SECRET - Secret key for API authentication

Endpoints:
    GET /health - Health check
    GET /tokens/mmi - Get MMI Bearer token
    GET /tokens/rpr - Get RPR Bearer token
    POST /tokens/refresh - Force refresh all tokens
    POST /tokens/mmi/2fa - Submit 2FA code for pending MMI session
"""

import asyncio
import json
import os
import sys
import time
import threading
import uuid
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, parse_qs
import traceback

# Token storage
tokens = {
    "mmi": {"token": None, "expiresAt": 0, "lastError": None, "lastRefresh": None},
    "rpr": {"token": None, "expiresAt": 0, "lastError": None, "lastRefresh": None},
}

# Pending 2FA sessions - stores browser context waiting for 2FA
pending_2fa_sessions = {}

# Lock for thread safety
token_lock = threading.Lock()

# Configuration
SERVICE_SECRET = os.environ.get("TOKEN_SERVICE_SECRET", "tcds_token_service_2025")
REFRESH_BUFFER_SECONDS = 300  # Refresh 5 min before expiry

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("[TokenService] WARNING: Playwright not installed", file=sys.stderr)


async def detect_2fa_challenge(page):
    """Check if page shows 2FA/verification code input"""
    # Log page state for debugging
    page_text = ""
    try:
        page_text = await page.inner_text("body")
        page_lower = page_text.lower()
        print(f"[2FA-Detect] Page text length: {len(page_text)}", file=sys.stderr)
        print(f"[2FA-Detect] First 500 chars: {page_text[:500]}", file=sys.stderr)
    except Exception as e:
        print(f"[2FA-Detect] Could not get page text: {e}", file=sys.stderr)
        page_lower = ""

    # Common 2FA input selectors
    twofa_selectors = [
        'input[name="code"]',
        'input[name="otp"]',
        'input[name="totp"]',
        'input[name="2fa"]',
        'input[name="mfaCode"]',
        'input[name="mfa_code"]',
        'input[name="verificationCode"]',
        'input[name="verification_code"]',
        'input[name="twoFactorCode"]',
        'input[placeholder*="code" i]',
        'input[placeholder*="verification" i]',
        'input[placeholder*="digit" i]',
        'input[aria-label*="code" i]',
        'input[aria-label*="verification" i]',
        'input[aria-label*="digit" i]',
        'input[type="tel"][maxlength="6"]',
        'input[type="tel"][maxlength="1"]',  # Individual digit boxes
        'input[type="number"][maxlength="1"]',
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"][maxlength="6"]',
        'input[inputmode="numeric"][maxlength="1"]',
        # Common CSS class patterns
        'input.otp-input',
        'input.code-input',
        'input.verification-input',
        'input.digit-input',
        '[data-testid*="otp"]',
        '[data-testid*="code"]',
        '[data-testid*="2fa"]',
    ]

    for selector in twofa_selectors:
        try:
            el = await page.query_selector(selector)
            if el and await el.is_visible():
                # Make sure it's not an email or password field
                input_type = await el.get_attribute("type")
                input_name = await el.get_attribute("name") or ""
                if input_type not in ["email", "password"] and "email" not in input_name.lower() and "password" not in input_name.lower():
                    print(f"[2FA-Detect] Found 2FA input: {selector}", file=sys.stderr)
                    return True
        except:
            continue

    # Check for multiple digit input boxes (common 2FA pattern)
    try:
        digit_inputs = await page.query_selector_all('input[maxlength="1"]')
        visible_digit_inputs = 0
        for inp in digit_inputs:
            if await inp.is_visible():
                inp_type = await inp.get_attribute("type")
                if inp_type not in ["email", "password"]:
                    visible_digit_inputs += 1
        if visible_digit_inputs >= 4:  # At least 4 single-digit inputs suggests OTP
            print(f"[2FA-Detect] Found {visible_digit_inputs} digit input boxes", file=sys.stderr)
            return True
    except:
        pass

    # Check for 2FA-related text on page
    twofa_keywords = [
        "verification code",
        "two-factor",
        "2fa",
        "two factor",
        "enter code",
        "security code",
        "authentication code",
        "one-time password",
        "one-time code",
        "mfa",
        "multi-factor",
        "sent to your email",
        "sent to your phone",
        "sent a code",
        "6-digit",
        "6 digit",
        "enter the code",
        "verify your identity",
        "additional verification",
        "confirm it's you",
        "we need to verify",
    ]

    for keyword in twofa_keywords:
        if keyword in page_lower:
            print(f"[2FA-Detect] Found keyword: '{keyword}'", file=sys.stderr)
            return True

    print("[2FA-Detect] No 2FA challenge detected", file=sys.stderr)
    return False


async def extract_mmi_token(session_id=None, twofa_code=None):
    """
    Extract Bearer token from MMI login by capturing API request headers.

    If session_id and twofa_code provided, resume a pending 2FA session.
    Otherwise, start fresh login.
    """
    global pending_2fa_sessions

    if not PLAYWRIGHT_AVAILABLE:
        return {"error": "Playwright not installed"}

    # If resuming 2FA session
    if session_id and twofa_code:
        return await complete_2fa_session(session_id, twofa_code)

    email = os.environ.get("MMI_EMAIL", "")
    password = os.environ.get("MMI_PASSWORD", "")

    if not email or not password:
        return {"error": "MMI_EMAIL and MMI_PASSWORD required"}

    captured_token = None
    playwright_instance = None
    browser = None
    context = None
    page = None

    try:
        playwright_instance = await async_playwright().start()
        browser = await playwright_instance.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )

        page = await context.new_page()

        # Capture Bearer tokens from API requests
        async def handle_request(request):
            nonlocal captured_token
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer ") and "mmi.run" in request.url:
                token = auth.replace("Bearer ", "")
                # Only capture tokens that look like API tokens (not cookies)
                if len(token) > 20:
                    captured_token = token
                    print(f"[MMI] Captured token from {request.url}", file=sys.stderr)

        page.on("request", handle_request)

        print("[MMI] Navigating to login...", file=sys.stderr)
        await page.goto("https://new.mmi.run/login", wait_until="networkidle", timeout=30000)

        await page.wait_for_selector('input[type="email"], input[name="email"]', timeout=10000)

        print("[MMI] Entering credentials...", file=sys.stderr)
        await page.fill('input[type="email"], input[name="email"]', email)
        await page.fill('input[type="password"], input[name="password"]', password)

        # Try multiple submit button selectors
        submit_selectors = [
            'button[type="submit"]',
            'button:has-text("Sign In")',
            'button:has-text("Log In")',
            'button:has-text("Login")',
            'input[type="submit"]',
            'button.login-button',
            'button.submit-btn',
            'form button',
        ]

        clicked = False
        for selector in submit_selectors:
            try:
                btn = await page.query_selector(selector)
                if btn:
                    await btn.click()
                    clicked = True
                    print(f"[MMI] Clicked button with selector: {selector}", file=sys.stderr)
                    break
            except:
                continue

        if not clicked:
            # Try pressing Enter in password field
            await page.press('input[type="password"]', 'Enter')
            print("[MMI] Pressed Enter to submit", file=sys.stderr)

        await page.wait_for_load_state("networkidle", timeout=15000)
        await asyncio.sleep(3)

        print(f"[MMI] After login URL: {page.url}", file=sys.stderr)

        # Check for error messages on the login page
        if "/login" in page.url:
            print("[MMI] Still on login page - checking for errors...", file=sys.stderr)
            error_selectors = ['.error', '.alert-error', '.text-red', '[role="alert"]', '.error-message', '.login-error']
            for selector in error_selectors:
                try:
                    err = await page.query_selector(selector)
                    if err and await err.is_visible():
                        err_text = await err.inner_text()
                        print(f"[MMI] Error found: {err_text}", file=sys.stderr)
                except:
                    continue

            # Take a screenshot for debugging
            try:
                screenshot_path = "/tmp/mmi_login_debug.png"
                await page.screenshot(path=screenshot_path)
                print(f"[MMI] Debug screenshot saved to {screenshot_path}", file=sys.stderr)
            except Exception as e:
                print(f"[MMI] Could not save screenshot: {e}", file=sys.stderr)

        # Check for 2FA challenge
        if await detect_2fa_challenge(page):
            print("[MMI] 2FA challenge detected", file=sys.stderr)

            # Check if we need to click "Send Verification Code" button first
            send_code_selectors = [
                'button:has-text("Send Verification Code")',
                'button:has-text("Send Code")',
                'button:has-text("Send OTP")',
                'button:has-text("Get Code")',
                'a:has-text("Send Verification Code")',
            ]

            for selector in send_code_selectors:
                try:
                    btn = await page.query_selector(selector)
                    if btn and await btn.is_visible():
                        print(f"[MMI] Clicking send code button: {selector}", file=sys.stderr)
                        await btn.click()
                        await page.wait_for_load_state("networkidle", timeout=10000)
                        await asyncio.sleep(2)
                        print("[MMI] Verification code sent, waiting for code entry...", file=sys.stderr)
                        break
                except Exception as e:
                    print(f"[MMI] Send button {selector} failed: {e}", file=sys.stderr)
                    continue

            # Check if we captured a token from the send_2fa API call
            if captured_token:
                print(f"[MMI] Token was captured during 2FA send! Using it directly.", file=sys.stderr)
                expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
                await browser.close()
                await playwright_instance.stop()
                return {"success": True, "token": captured_token, "expiresAt": expires_at}

            print("[MMI] Storing session for 2FA code entry", file=sys.stderr)

            # Generate session ID
            new_session_id = str(uuid.uuid4())

            # Store the browser context for later
            pending_2fa_sessions[new_session_id] = {
                "playwright": playwright_instance,
                "browser": browser,
                "context": context,
                "page": page,
                "created_at": datetime.now(),
                "captured_token": None,
            }

            # Set up request handler for this session
            async def session_request_handler(request):
                auth = request.headers.get("authorization", "")
                if auth.startswith("Bearer ") and "mmi.run" in request.url:
                    token = auth.replace("Bearer ", "")
                    if len(token) > 20:
                        pending_2fa_sessions[new_session_id]["captured_token"] = token
                        print(f"[MMI-2FA] Captured token from {request.url}", file=sys.stderr)

            page.on("request", session_request_handler)

            return {
                "requires_2fa": True,
                "session_id": new_session_id,
                "message": "2FA verification required. Submit code via /tokens/mmi/2fa",
            }

        # If token not captured yet, navigate to dashboard to trigger API calls
        if not captured_token:
            print("[MMI] Token not captured from login, navigating to dashboard...", file=sys.stderr)
            try:
                await page.goto("https://new.mmi.run/dashboard", wait_until="networkidle", timeout=20000)
                await asyncio.sleep(3)
            except Exception as e:
                print(f"[MMI] Dashboard navigation failed: {e}", file=sys.stderr)

        # If still not captured, try property search page
        if not captured_token:
            print("[MMI] Trying property search page...", file=sys.stderr)
            try:
                await page.goto("https://new.mmi.run/property-search", wait_until="networkidle", timeout=20000)
                await asyncio.sleep(3)
            except Exception as e:
                print(f"[MMI] Property search navigation failed: {e}", file=sys.stderr)

        # Check localStorage/sessionStorage for token
        if not captured_token:
            print("[MMI] Checking storage for token...", file=sys.stderr)
            token_from_storage = await page.evaluate("""
                () => {
                    const keys = ['token', 'accessToken', 'access_token', 'jwt', 'bearerToken', 'authToken', 'api_key'];
                    for (const key of keys) {
                        let t = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (t && t.length > 20) return t;
                    }
                    // Check all localStorage for JWT-like tokens
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const val = localStorage.getItem(key);
                        if (val && val.startsWith('eyJ') && val.length > 50) return val;
                    }
                    return null;
                }
            """)
            if token_from_storage:
                captured_token = token_from_storage
                print("[MMI] Found token in storage", file=sys.stderr)

        # Fall back to api_key cookie if no Bearer token captured
        if not captured_token:
            print("[MMI] Checking cookies for api_key...", file=sys.stderr)
            cookies = await context.cookies()
            api_key_cookie = next((c for c in cookies if c["name"] == "api_key"), None)
            if api_key_cookie:
                captured_token = unquote(api_key_cookie["value"])
                print("[MMI] Found api_key cookie", file=sys.stderr)

        if not captured_token:
            print(f"[MMI] Could not capture token. Final URL: {page.url}", file=sys.stderr)
            await browser.close()
            await playwright_instance.stop()
            return {"error": f"Could not capture token. URL: {page.url}"}

        # Default 1 hour expiry
        expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)

        print("[MMI] Token extracted successfully", file=sys.stderr)
        await browser.close()
        await playwright_instance.stop()
        return {"success": True, "token": captured_token, "expiresAt": expires_at}

    except Exception as e:
        traceback.print_exc()
        if browser:
            try:
                await browser.close()
            except:
                pass
        if playwright_instance:
            try:
                await playwright_instance.stop()
            except:
                pass
        return {"error": f"MMI extraction failed: {str(e)}"}


async def complete_2fa_session(session_id: str, twofa_code: str):
    """Complete a pending 2FA session by submitting the verification code"""
    global pending_2fa_sessions

    if session_id not in pending_2fa_sessions:
        return {"error": "2FA session not found or expired"}

    session = pending_2fa_sessions[session_id]
    page = session["page"]
    browser = session["browser"]
    playwright_instance = session["playwright"]

    try:
        print(f"[MMI-2FA] Submitting 2FA code for session {session_id}", file=sys.stderr)

        # Debug: Log current page state
        print(f"[MMI-2FA] Current URL: {page.url}", file=sys.stderr)
        try:
            await page.screenshot(path="/tmp/mmi_2fa_submit_start.png")
            print("[MMI-2FA] Screenshot saved to /tmp/mmi_2fa_submit_start.png", file=sys.stderr)
        except Exception as e:
            print(f"[MMI-2FA] Screenshot failed: {e}", file=sys.stderr)

        # Get page text for debugging
        try:
            page_text = await page.inner_text("body")
            print(f"[MMI-2FA] Page text preview: {page_text[:300]}", file=sys.stderr)
        except Exception as e:
            print(f"[MMI-2FA] Could not get page text: {e}", file=sys.stderr)

        # List all input elements on the page
        try:
            inputs = await page.query_selector_all("input")
            print(f"[MMI-2FA] Found {len(inputs)} input elements", file=sys.stderr)
            for i, inp in enumerate(inputs[:10]):  # Log first 10
                inp_type = await inp.get_attribute("type")
                inp_name = await inp.get_attribute("name")
                inp_placeholder = await inp.get_attribute("placeholder")
                inp_visible = await inp.is_visible()
                print(f"[MMI-2FA]   Input {i}: type={inp_type}, name={inp_name}, placeholder={inp_placeholder}, visible={inp_visible}", file=sys.stderr)
        except Exception as e:
            print(f"[MMI-2FA] Could not list inputs: {e}", file=sys.stderr)

        # Find and fill 2FA input
        twofa_selectors = [
            'input[name="code"]',
            'input[name="otp"]',
            'input[name="totp"]',
            'input[name="2fa"]',
            'input[name="mfaCode"]',
            'input[name="mfa_code"]',
            'input[name="verificationCode"]',
            'input[name="verification_code"]',
            'input[name="twoFactorCode"]',
            'input[placeholder*="code" i]',
            'input[placeholder*="verification" i]',
            'input[placeholder*="digit" i]',
            'input[aria-label*="code" i]',
            'input[aria-label*="verification" i]',
            'input[type="tel"][maxlength="6"]',
            'input[type="tel"][maxlength="1"]',
            'input[autocomplete="one-time-code"]',
            'input[inputmode="numeric"][maxlength="6"]',
            'input.otp-input',
            'input.code-input',
        ]

        filled = False
        for selector in twofa_selectors:
            try:
                el = await page.query_selector(selector)
                if el and await el.is_visible():
                    # Skip email/password fields
                    input_type = await el.get_attribute("type")
                    input_name = await el.get_attribute("name") or ""
                    if input_type in ["email", "password"] or "email" in input_name.lower() or "password" in input_name.lower():
                        continue
                    await el.fill(twofa_code)
                    print(f"[MMI-2FA] Filled code with selector: {selector}", file=sys.stderr)
                    filled = True
                    break
            except:
                continue

        # Try filling individual digit boxes if single input not found
        if not filled:
            try:
                digit_inputs = await page.query_selector_all('input[maxlength="1"]')
                visible_inputs = []
                for inp in digit_inputs:
                    if await inp.is_visible():
                        inp_type = await inp.get_attribute("type")
                        if inp_type not in ["email", "password"]:
                            visible_inputs.append(inp)
                if len(visible_inputs) >= 4 and len(twofa_code) >= len(visible_inputs):
                    for i, inp in enumerate(visible_inputs):
                        await inp.fill(twofa_code[i])
                    print(f"[MMI-2FA] Filled {len(visible_inputs)} digit boxes", file=sys.stderr)
                    filled = True
            except Exception as e:
                print(f"[MMI-2FA] Digit box fill failed: {e}", file=sys.stderr)

        if not filled:
            return {"error": "Could not find 2FA input field"}

        # Submit the form
        submit_selectors = [
            'button[type="submit"]',
            'button:has-text("Verify")',
            'button:has-text("Submit")',
            'button:has-text("Continue")',
            'button:has-text("Confirm")',
            'input[type="submit"]',
        ]

        submitted = False
        for selector in submit_selectors:
            try:
                btn = await page.query_selector(selector)
                if btn and await btn.is_visible():
                    await btn.click()
                    print(f"[MMI-2FA] Clicked submit: {selector}", file=sys.stderr)
                    submitted = True
                    break
            except:
                continue

        if not submitted:
            # Try pressing Enter
            await page.keyboard.press("Enter")
            print("[MMI-2FA] Pressed Enter to submit", file=sys.stderr)

        # Wait for response
        await page.wait_for_load_state("networkidle", timeout=30000)
        await asyncio.sleep(3)

        print(f"[MMI-2FA] After submit URL: {page.url}", file=sys.stderr)

        # Check for error messages
        error_selectors = ['.error', '.alert-error', '.text-red', '[role="alert"]']
        for selector in error_selectors:
            try:
                err = await page.query_selector(selector)
                if err and await err.is_visible():
                    err_text = await err.inner_text()
                    if "invalid" in err_text.lower() or "incorrect" in err_text.lower():
                        return {"error": f"2FA code rejected: {err_text}"}
            except:
                continue

        # Check if still on 2FA page
        if await detect_2fa_challenge(page):
            return {"error": "2FA code was not accepted - still on verification page"}

        # Check for captured token
        captured_token = session.get("captured_token")

        # If not captured yet, navigate to trigger API calls
        if not captured_token:
            print("[MMI-2FA] Navigating to dashboard to capture token...", file=sys.stderr)
            try:
                await page.goto("https://new.mmi.run/dashboard", wait_until="networkidle", timeout=20000)
                await asyncio.sleep(3)
                captured_token = session.get("captured_token")
            except Exception as e:
                print(f"[MMI-2FA] Dashboard navigation failed: {e}", file=sys.stderr)

        if not captured_token:
            print("[MMI-2FA] Trying property search page...", file=sys.stderr)
            try:
                await page.goto("https://new.mmi.run/property-search", wait_until="networkidle", timeout=20000)
                await asyncio.sleep(3)
                captured_token = session.get("captured_token")
            except Exception as e:
                print(f"[MMI-2FA] Property search failed: {e}", file=sys.stderr)

        # Check storage
        if not captured_token:
            print("[MMI-2FA] Checking storage for token...", file=sys.stderr)
            token_from_storage = await page.evaluate("""
                () => {
                    const keys = ['token', 'accessToken', 'access_token', 'jwt', 'bearerToken', 'authToken', 'api_key'];
                    for (const key of keys) {
                        let t = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (t && t.length > 20) return t;
                    }
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const val = localStorage.getItem(key);
                        if (val && val.startsWith('eyJ') && val.length > 50) return val;
                    }
                    return null;
                }
            """)
            if token_from_storage:
                captured_token = token_from_storage
                print("[MMI-2FA] Found token in storage", file=sys.stderr)

        # Check cookies
        if not captured_token:
            cookies = await session["context"].cookies()
            api_key_cookie = next((c for c in cookies if c["name"] == "api_key"), None)
            if api_key_cookie:
                captured_token = unquote(api_key_cookie["value"])
                print("[MMI-2FA] Found api_key cookie", file=sys.stderr)

        # Cleanup session
        del pending_2fa_sessions[session_id]
        await browser.close()
        await playwright_instance.stop()

        if not captured_token:
            return {"error": "2FA completed but could not capture token"}

        expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
        print("[MMI-2FA] Token extracted successfully after 2FA", file=sys.stderr)

        return {"success": True, "token": captured_token, "expiresAt": expires_at}

    except Exception as e:
        traceback.print_exc()
        # Cleanup on error
        try:
            del pending_2fa_sessions[session_id]
            await browser.close()
            await playwright_instance.stop()
        except:
            pass
        return {"error": f"2FA completion failed: {str(e)}"}


async def extract_rpr_token():
    """Extract Bearer token from RPR login via NAR SSO."""
    if not PLAYWRIGHT_AVAILABLE:
        return {"error": "Playwright not installed"}

    email = os.environ.get("RPR_EMAIL", "")
    password = os.environ.get("RPR_PASSWORD", "")

    if not email or not password:
        return {"error": "RPR_EMAIL and RPR_PASSWORD required"}

    captured_token = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )

        page = await context.new_page()

        async def handle_request(request):
            nonlocal captured_token
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer ") and ("narrpr.com" in request.url or "rpr" in request.url.lower()):
                captured_token = auth.replace("Bearer ", "")
                print(f"[RPR] Captured token from {request.url}", file=sys.stderr)

        page.on("request", handle_request)

        try:
            # Go directly to RPR login which redirects to NAR SSO
            print("[RPR] Navigating to RPR login...", file=sys.stderr)
            await page.goto("https://www.narrpr.com/home", wait_until="networkidle", timeout=45000)

            print(f"[RPR] Current URL: {page.url}", file=sys.stderr)

            # Check if we need to click login button
            if "narrpr.com" in page.url and "login" not in page.url.lower():
                login_btn = await page.query_selector('a[href*="login"], button:has-text("Log In"), a:has-text("Log In"), a:has-text("Sign In")')
                if login_btn:
                    print("[RPR] Clicking login button...", file=sys.stderr)
                    await login_btn.click()
                    await page.wait_for_load_state("networkidle", timeout=30000)
                    print(f"[RPR] After login click URL: {page.url}", file=sys.stderr)

            # Wait for email input (NAR SSO uses standard email field)
            print("[RPR] Waiting for email input...", file=sys.stderr)
            await page.wait_for_selector('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]', timeout=20000)

            # Fill email - use type() instead of fill() for better compatibility
            print("[RPR] Entering email...", file=sys.stderr)
            email_selectors = ['input[type="email"]', 'input[name="email"]', 'input[id*="email"]', 'input[placeholder*="email" i]']
            for selector in email_selectors:
                email_input = await page.query_selector(selector)
                if email_input:
                    await email_input.click()
                    await email_input.fill("")  # Clear first
                    await page.keyboard.type(email, delay=50)  # Type slowly like a human
                    print(f"[RPR] Email entered using {selector}", file=sys.stderr)
                    break

            # Wait a moment for validation
            await asyncio.sleep(1)

            # Try to click Next/Continue button - wait for it to be enabled
            print("[RPR] Looking for Next/Continue button...", file=sys.stderr)
            next_selectors = [
                'button:has-text("Next")',
                'button:has-text("Continue")',
                'button[type="submit"]',
                'input[type="submit"]',
                'button:has-text("Sign In")',
            ]

            for selector in next_selectors:
                try:
                    btn = await page.query_selector(selector)
                    if btn:
                        # Wait for button to be enabled (up to 10 seconds)
                        for _ in range(20):
                            is_disabled = await btn.get_attribute("disabled")
                            if not is_disabled:
                                break
                            await asyncio.sleep(0.5)

                        await btn.click()
                        print(f"[RPR] Clicked button: {selector}", file=sys.stderr)
                        break
                except Exception as e:
                    print(f"[RPR] Button {selector} failed: {e}", file=sys.stderr)
                    continue

            # Wait for password field or page transition
            await asyncio.sleep(2)
            print(f"[RPR] After next click URL: {page.url}", file=sys.stderr)

            # Check for password field
            password_input = await page.query_selector('input[type="password"]')
            if password_input:
                print("[RPR] Entering password...", file=sys.stderr)
                await password_input.click()
                await password_input.fill("")
                await page.keyboard.type(password, delay=50)
                await asyncio.sleep(1)

                # Click sign in/submit
                submit_selectors = [
                    'button:has-text("Sign In")',
                    'button:has-text("Log In")',
                    'button[type="submit"]',
                    'input[type="submit"]',
                ]

                for selector in submit_selectors:
                    try:
                        btn = await page.query_selector(selector)
                        if btn:
                            for _ in range(20):
                                is_disabled = await btn.get_attribute("disabled")
                                if not is_disabled:
                                    break
                                await asyncio.sleep(0.5)
                            await btn.click()
                            print(f"[RPR] Clicked submit: {selector}", file=sys.stderr)
                            break
                    except:
                        continue
            else:
                # Single page login - try pressing Enter
                print("[RPR] No password field found, trying Enter...", file=sys.stderr)
                await page.keyboard.press("Enter")

            # Wait for redirect back to RPR
            print("[RPR] Waiting for login completion...", file=sys.stderr)
            await page.wait_for_load_state("networkidle", timeout=45000)
            await asyncio.sleep(5)

            print(f"[RPR] Final URL: {page.url}", file=sys.stderr)

            # If not captured yet, try navigating to trigger API calls
            if not captured_token:
                print("[RPR] Token not captured, trying to trigger API...", file=sys.stderr)
                try:
                    await page.goto("https://www.narrpr.com/search", wait_until="networkidle", timeout=20000)
                    await asyncio.sleep(3)
                except Exception as e:
                    print(f"[RPR] Search navigation failed: {e}", file=sys.stderr)

            # Check localStorage/sessionStorage
            if not captured_token:
                print("[RPR] Checking storage for token...", file=sys.stderr)
                token_from_storage = await page.evaluate("""
                    () => {
                        const keys = ['token', 'accessToken', 'access_token', 'jwt', 'bearerToken', 'authToken'];
                        for (const key of keys) {
                            let t = localStorage.getItem(key) || sessionStorage.getItem(key);
                            if (t && t.length > 20) return t;
                        }
                        // Check all localStorage for JWT-like tokens
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            const val = localStorage.getItem(key);
                            if (val && val.startsWith('eyJ') && val.length > 50) return val;
                        }
                        return null;
                    }
                """)
                if token_from_storage:
                    captured_token = token_from_storage
                    print("[RPR] Found token in storage", file=sys.stderr)

            # Check cookies
            if not captured_token:
                print("[RPR] Checking cookies for token...", file=sys.stderr)
                cookies = await context.cookies()
                for cookie in cookies:
                    if 'token' in cookie['name'].lower() or 'jwt' in cookie['name'].lower():
                        if len(cookie['value']) > 50:
                            captured_token = unquote(cookie['value'])
                            print(f"[RPR] Found token in cookie: {cookie['name']}", file=sys.stderr)
                            break

            if not captured_token:
                # Take screenshot for debugging
                print(f"[RPR] Could not capture token. Final URL: {page.url}", file=sys.stderr)
                return {"error": f"Could not capture token. URL: {page.url}"}

            expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
            print("[RPR] Token extracted successfully", file=sys.stderr)
            return {"success": True, "token": captured_token, "expiresAt": expires_at}

        except Exception as e:
            traceback.print_exc()
            return {"error": f"RPR extraction failed: {str(e)}"}
        finally:
            await browser.close()


def refresh_token(provider):
    """Refresh a specific token."""
    global tokens

    print(f"[TokenService] Refreshing {provider} token...", file=sys.stderr)

    try:
        if provider == "mmi":
            result = asyncio.run(extract_mmi_token())
        elif provider == "rpr":
            result = asyncio.run(extract_rpr_token())
        else:
            return {"error": f"Unknown provider: {provider}"}

        with token_lock:
            if result.get("success"):
                tokens[provider] = {
                    "token": result["token"],
                    "expiresAt": result["expiresAt"],
                    "lastError": None,
                    "lastRefresh": datetime.now().isoformat(),
                }
                print(f"[TokenService] {provider} token refreshed successfully", file=sys.stderr)
            else:
                tokens[provider]["lastError"] = result.get("error")
                print(f"[TokenService] {provider} token refresh failed: {result.get('error')}", file=sys.stderr)

        return result

    except Exception as e:
        error_msg = f"Exception: {str(e)}"
        with token_lock:
            tokens[provider]["lastError"] = error_msg
        print(f"[TokenService] {provider} exception: {error_msg}", file=sys.stderr)
        traceback.print_exc()
        return {"error": error_msg}


def get_token(provider):
    """Get a valid token, refreshing if needed."""
    with token_lock:
        token_data = tokens.get(provider)
        if not token_data:
            return {"error": f"Unknown provider: {provider}"}

        # Check if token is valid
        now_ms = int(time.time() * 1000)
        buffer_ms = REFRESH_BUFFER_SECONDS * 1000

        if token_data["token"] and token_data["expiresAt"] > (now_ms + buffer_ms):
            return {
                "success": True,
                "token": token_data["token"],
                "expiresAt": token_data["expiresAt"],
                "cached": True,
            }

    # Need to refresh
    result = refresh_token(provider)
    if result.get("success"):
        return {
            "success": True,
            "token": result["token"],
            "expiresAt": result["expiresAt"],
            "cached": False,
        }
    return result


class TokenHandler(BaseHTTPRequestHandler):
    """HTTP request handler for token service."""

    def log_message(self, format, *args):
        print(f"[HTTP] {args[0]}", file=sys.stderr)

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def check_auth(self):
        auth = self.headers.get("Authorization", "")
        expected = f"Bearer {SERVICE_SECRET}"
        if auth != expected:
            self.send_json({"error": "Unauthorized"}, 401)
            return False
        return True

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_json({
                "status": "ok",
                "playwright": PLAYWRIGHT_AVAILABLE,
                "tokens": {
                    "mmi": {
                        "hasToken": bool(tokens["mmi"]["token"]),
                        "lastRefresh": tokens["mmi"]["lastRefresh"],
                        "lastError": tokens["mmi"]["lastError"],
                    },
                    "rpr": {
                        "hasToken": bool(tokens["rpr"]["token"]),
                        "lastRefresh": tokens["rpr"]["lastRefresh"],
                        "lastError": tokens["rpr"]["lastError"],
                    },
                }
            })
            return

        if not self.check_auth():
            return

        if self.path == "/tokens/mmi":
            result = get_token("mmi")
            self.send_json(result, 200 if result.get("success") else 500)
        elif self.path == "/tokens/rpr":
            result = get_token("rpr")
            self.send_json(result, 200 if result.get("success") else 500)
        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        if not self.check_auth():
            return

        if self.path == "/tokens/refresh":
            mmi_result = refresh_token("mmi")
            rpr_result = refresh_token("rpr")
            self.send_json({
                "mmi": mmi_result,
                "rpr": rpr_result,
            })
        elif self.path == "/tokens/mmi/2fa":
            # Handle 2FA code submission
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')

            try:
                data = json.loads(body)
                session_id = data.get("session_id")
                code = data.get("code")

                if not session_id or not code:
                    self.send_json({"error": "session_id and code required"}, 400)
                    return

                result = asyncio.run(extract_mmi_token(session_id=session_id, twofa_code=code))

                if result.get("success"):
                    # Update stored token
                    with token_lock:
                        tokens["mmi"] = {
                            "token": result["token"],
                            "expiresAt": result["expiresAt"],
                            "lastError": None,
                            "lastRefresh": datetime.now().isoformat(),
                        }
                    self.send_json(result)
                else:
                    self.send_json(result, 400 if "error" in result else 200)
            except json.JSONDecodeError:
                self.send_json({"error": "Invalid JSON"}, 400)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
        elif self.path == "/tokens/mmi/2fa/status":
            # Check pending 2FA sessions
            pending = list(pending_2fa_sessions.keys())
            self.send_json({
                "pending_sessions": len(pending),
                "session_ids": pending,
            })
        else:
            self.send_json({"error": "Not found"}, 404)


def main():
    port = int(os.environ.get("TOKEN_SERVICE_PORT", "8899"))

    if not PLAYWRIGHT_AVAILABLE:
        print("[TokenService] ERROR: Playwright not installed!", file=sys.stderr)
        print("[TokenService] Run: pip3 install playwright && playwright install chromium", file=sys.stderr)
        sys.exit(1)

    print(f"[TokenService] Starting on port {port}...", file=sys.stderr)
    print(f"[TokenService] MMI configured: {bool(os.environ.get('MMI_EMAIL'))}", file=sys.stderr)
    print(f"[TokenService] RPR configured: {bool(os.environ.get('RPR_EMAIL'))}", file=sys.stderr)

    server = HTTPServer(("0.0.0.0", port), TokenHandler)
    print(f"[TokenService] Listening on http://0.0.0.0:{port}", file=sys.stderr)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[TokenService] Shutting down...", file=sys.stderr)
        server.shutdown()


if __name__ == "__main__":
    main()
