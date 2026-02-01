#!/usr/bin/env python3
"""
Token Caching Service for MMI and RPR APIs
Runs as an HTTP server that provides cached auth tokens.
Automatically refreshes tokens before expiry.

Features:
    - Persistent browser sessions (storageState) to avoid re-login/2FA
    - Twilio SMS auto-read for MMI 2FA codes
    - Proactive background token refresh
    - Retry with exponential backoff
    - Email alerting via Microsoft Graph (Outlook) on failures
    - Enhanced health endpoint

Usage:
    python token_service.py

Environment Variables:
    MMI_EMAIL - MMI login email
    MMI_PASSWORD - MMI login password
    RPR_EMAIL - RPR login email
    RPR_PASSWORD - RPR login password
    TOKEN_SERVICE_PORT - Port to run on (default: 8899)
    TOKEN_SERVICE_SECRET - Secret key for API authentication
    TWILIO_ACCOUNT_SID - Twilio account SID (for 2FA auto-read)
    TWILIO_AUTH_TOKEN - Twilio auth token
    TWILIO_2FA_PHONE_NUMBER - Phone number receiving 2FA SMS (Twilio number)
    OUTLOOK_TENANT_ID - Microsoft tenant ID (for alert emails)
    OUTLOOK_CLIENT_ID - Microsoft app client ID
    OUTLOOK_CLIENT_SECRET - Microsoft app client secret
    OUTLOOK_SENDER_EMAIL - Email address to send alerts from

Endpoints:
    GET /health - Enhanced health check with token expiry countdown
    GET /tokens/mmi - Get MMI Bearer token
    GET /tokens/rpr - Get RPR Bearer token
    POST /tokens/refresh - Force refresh all tokens
    POST /tokens/mmi/2fa - Submit 2FA code for pending MMI session
"""

import asyncio
import json
import os
import re
import sys
import time
import threading
import uuid
import traceback
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, parse_qs, urlencode
from pathlib import Path

try:
    import urllib.request
    import urllib.error
    import base64
except ImportError:
    pass

# Token storage
tokens = {
    "mmi": {"token": None, "expiresAt": 0, "lastError": None, "lastRefresh": None, "retryCount": 0},
    "rpr": {"token": None, "expiresAt": 0, "lastError": None, "lastRefresh": None, "retryCount": 0},
}

# Pending 2FA sessions - stores browser context waiting for 2FA
pending_2fa_sessions = {}

# Lock for thread safety
token_lock = threading.Lock()

# Service start time
SERVICE_START_TIME = datetime.now()

# Configuration
SERVICE_SECRET = os.environ.get("TOKEN_SERVICE_SECRET", "tcds_token_service_2025")
REFRESH_BUFFER_SECONDS = 600  # Refresh 10 min before expiry
PROACTIVE_CHECK_INTERVAL = 300  # Check every 5 minutes

# Browser state directory for persistent sessions
BROWSER_STATE_DIR = Path(os.environ.get("BROWSER_STATE_DIR", "browser_state"))
BROWSER_STATE_DIR.mkdir(parents=True, exist_ok=True)

# Twilio config
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_2FA_PHONE_NUMBER = os.environ.get("TWILIO_2FA_PHONE_NUMBER", "")

# Outlook/Microsoft Graph config for alerts
OUTLOOK_TENANT_ID = os.environ.get("OUTLOOK_TENANT_ID", "")
OUTLOOK_CLIENT_ID = os.environ.get("OUTLOOK_CLIENT_ID", "")
OUTLOOK_CLIENT_SECRET = os.environ.get("OUTLOOK_CLIENT_SECRET", "")
OUTLOOK_SENDER_EMAIL = os.environ.get("OUTLOOK_SENDER_EMAIL", "")

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    print("[TokenService] WARNING: Playwright not installed", file=sys.stderr)


# =============================================================================
# TWILIO SMS HELPER
# =============================================================================

def fetch_latest_2fa_code(since_seconds=120):
    """Poll Twilio Messages API for the most recent SMS containing a 2FA code."""
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_2FA_PHONE_NUMBER:
        print("[Twilio] Not configured, skipping SMS auto-read", file=sys.stderr)
        return None

    try:
        since_time = datetime.utcnow() - timedelta(seconds=since_seconds)
        date_sent = since_time.strftime("%Y-%m-%d")

        url = (
            f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_ACCOUNT_SID}"
            f"/Messages.json?To={TWILIO_2FA_PHONE_NUMBER}&DateSent>={date_sent}&PageSize=5"
        )

        credentials = base64.b64encode(
            f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode()
        ).decode()

        req = urllib.request.Request(url, headers={"Authorization": f"Basic {credentials}"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())

        messages = data.get("messages", [])
        # Sort by date_sent descending
        messages.sort(key=lambda m: m.get("date_sent", ""), reverse=True)

        for msg in messages:
            body = msg.get("body", "")
            # Look for 4-8 digit codes
            match = re.search(r'\b(\d{4,8})\b', body)
            if match:
                code = match.group(1)
                print(f"[Twilio] Found 2FA code: {code} from message: {body[:80]}", file=sys.stderr)
                return code

        print("[Twilio] No 2FA code found in recent messages", file=sys.stderr)
        return None

    except Exception as e:
        print(f"[Twilio] Error fetching SMS: {e}", file=sys.stderr)
        return None


# =============================================================================
# EMAIL ALERTING (Microsoft Graph)
# =============================================================================

def send_alert_email(subject, body_text):
    """Send alert email via Microsoft Graph API using client credentials."""
    if not OUTLOOK_TENANT_ID or not OUTLOOK_CLIENT_ID or not OUTLOOK_CLIENT_SECRET or not OUTLOOK_SENDER_EMAIL:
        print(f"[Alert] Email not configured, would have sent: {subject}", file=sys.stderr)
        return False

    try:
        # Step 1: Get access token
        token_url = f"https://login.microsoftonline.com/{OUTLOOK_TENANT_ID}/oauth2/v2.0/token"
        token_data = urlencode({
            "client_id": OUTLOOK_CLIENT_ID,
            "client_secret": OUTLOOK_CLIENT_SECRET,
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        }).encode()

        req = urllib.request.Request(token_url, data=token_data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=10) as resp:
            token_result = json.loads(resp.read().decode())

        access_token = token_result.get("access_token")
        if not access_token:
            print(f"[Alert] Failed to get Graph token: {token_result}", file=sys.stderr)
            return False

        # Step 2: Send email
        send_url = f"https://graph.microsoft.com/v1.0/users/{OUTLOOK_SENDER_EMAIL}/sendMail"
        email_payload = json.dumps({
            "message": {
                "subject": subject,
                "body": {"contentType": "Text", "content": body_text},
                "toRecipients": [
                    {"emailAddress": {"address": OUTLOOK_SENDER_EMAIL}}
                ],
            }
        }).encode()

        req = urllib.request.Request(send_url, data=email_payload, method="POST")
        req.add_header("Authorization", f"Bearer {access_token}")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=10) as resp:
            pass  # 202 Accepted

        print(f"[Alert] Email sent: {subject}", file=sys.stderr)
        return True

    except Exception as e:
        print(f"[Alert] Failed to send email: {e}", file=sys.stderr)
        return False


# =============================================================================
# 2FA DETECTION
# =============================================================================

async def detect_2fa_challenge(page):
    """Check if page shows 2FA/verification code input"""
    page_lower = ""
    try:
        page_text = await page.inner_text("body")
        page_lower = page_text.lower()
        print(f"[2FA-Detect] Page text length: {len(page_text)}", file=sys.stderr)
        print(f"[2FA-Detect] First 500 chars: {page_text[:500]}", file=sys.stderr)
    except Exception as e:
        print(f"[2FA-Detect] Could not get page text: {e}", file=sys.stderr)

    twofa_selectors = [
        'input[name="code"]', 'input[name="otp"]', 'input[name="totp"]',
        'input[name="2fa"]', 'input[name="mfaCode"]', 'input[name="mfa_code"]',
        'input[name="verificationCode"]', 'input[name="verification_code"]',
        'input[name="twoFactorCode"]',
        'input[placeholder*="code" i]', 'input[placeholder*="verification" i]',
        'input[placeholder*="digit" i]',
        'input[aria-label*="code" i]', 'input[aria-label*="verification" i]',
        'input[aria-label*="digit" i]',
        'input[type="tel"][maxlength="6"]', 'input[type="tel"][maxlength="1"]',
        'input[type="number"][maxlength="1"]',
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"][maxlength="6"]',
        'input[inputmode="numeric"][maxlength="1"]',
        'input.otp-input', 'input.code-input', 'input.verification-input',
        'input.digit-input',
        '[data-testid*="otp"]', '[data-testid*="code"]', '[data-testid*="2fa"]',
    ]

    for selector in twofa_selectors:
        try:
            el = await page.query_selector(selector)
            if el and await el.is_visible():
                input_type = await el.get_attribute("type")
                input_name = await el.get_attribute("name") or ""
                if input_type not in ["email", "password"] and "email" not in input_name.lower() and "password" not in input_name.lower():
                    print(f"[2FA-Detect] Found 2FA input: {selector}", file=sys.stderr)
                    return True
        except:
            continue

    # Check for multiple digit input boxes
    try:
        digit_inputs = await page.query_selector_all('input[maxlength="1"]')
        visible_digit_inputs = 0
        for inp in digit_inputs:
            if await inp.is_visible():
                inp_type = await inp.get_attribute("type")
                if inp_type not in ["email", "password"]:
                    visible_digit_inputs += 1
        if visible_digit_inputs >= 4:
            print(f"[2FA-Detect] Found {visible_digit_inputs} digit input boxes", file=sys.stderr)
            return True
    except:
        pass

    twofa_keywords = [
        "verification code", "two-factor", "2fa", "two factor",
        "enter code", "security code", "authentication code",
        "one-time password", "one-time code", "mfa", "multi-factor",
        "sent to your email", "sent to your phone", "sent a code",
        "6-digit", "6 digit", "enter the code", "verify your identity",
        "additional verification", "confirm it's you", "we need to verify",
    ]

    for keyword in twofa_keywords:
        if keyword in page_lower:
            print(f"[2FA-Detect] Found keyword: '{keyword}'", file=sys.stderr)
            return True

    print("[2FA-Detect] No 2FA challenge detected", file=sys.stderr)
    return False


# =============================================================================
# PERSISTENT BROWSER SESSION HELPERS
# =============================================================================

def get_storage_state_path(provider):
    """Get path to persistent storage state file for a provider."""
    return BROWSER_STATE_DIR / f"{provider}_storage_state.json"


async def create_context_with_state(browser, provider):
    """Create a browser context, restoring persistent storage state if available."""
    state_path = get_storage_state_path(provider)
    context_opts = {
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "viewport": {"width": 1920, "height": 1080},
    }

    if state_path.exists():
        try:
            context_opts["storage_state"] = str(state_path)
            print(f"[{provider.upper()}] Restoring storage state from {state_path}", file=sys.stderr)
        except Exception as e:
            print(f"[{provider.upper()}] Failed to load storage state: {e}", file=sys.stderr)

    return await browser.new_context(**context_opts)


async def save_storage_state(context, provider):
    """Save browser storage state for future sessions."""
    state_path = get_storage_state_path(provider)
    try:
        await context.storage_state(path=str(state_path))
        print(f"[{provider.upper()}] Storage state saved to {state_path}", file=sys.stderr)
    except Exception as e:
        print(f"[{provider.upper()}] Failed to save storage state: {e}", file=sys.stderr)


async def check_already_authenticated(page, provider):
    """Check if we're already logged in (session still valid from storageState).
    Uses domcontentloaded instead of networkidle because sites like narrpr.com
    have long-polling requests that prevent networkidle from ever firing."""
    try:
        if provider == "mmi":
            await page.goto("https://new.mmi.run/dashboard", wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(3)
            if "/login" not in page.url.lower():
                print(f"[MMI] Already authenticated at {page.url}", file=sys.stderr)
                return True
        elif provider == "rpr":
            await page.goto("https://www.narrpr.com/home", wait_until="domcontentloaded", timeout=20000)
            await asyncio.sleep(3)
            current = page.url.lower()
            if "login" not in current and "sso" not in current and "signin" not in current:
                print(f"[RPR] Already authenticated at {page.url}", file=sys.stderr)
                return True
    except Exception as e:
        print(f"[{provider.upper()}] Auth check failed: {e}", file=sys.stderr)

    return False


# =============================================================================
# MMI TOKEN EXTRACTION
# =============================================================================

async def extract_mmi_token(session_id=None, twofa_code=None):
    """
    Extract Bearer token from MMI login by capturing API request headers.
    Uses persistent browser session to skip 2FA when possible.
    Falls back to Twilio SMS auto-read for 2FA.
    """
    global pending_2fa_sessions

    if not PLAYWRIGHT_AVAILABLE:
        return {"error": "Playwright not installed"}

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

        context = await create_context_with_state(browser, "mmi")
        page = await context.new_page()

        # Capture Bearer tokens from API requests
        async def handle_request(request):
            nonlocal captured_token
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer ") and "mmi.run" in request.url:
                token = auth.replace("Bearer ", "")
                if len(token) > 20:
                    captured_token = token
                    print(f"[MMI] Captured token from {request.url}", file=sys.stderr)

        page.on("request", handle_request)

        # Check if already authenticated via persistent session
        if await check_already_authenticated(page, "mmi"):
            await asyncio.sleep(2)
            if captured_token:
                await save_storage_state(context, "mmi")
                expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
                await browser.close()
                await playwright_instance.stop()
                return {"success": True, "token": captured_token, "expiresAt": expires_at}

            # Navigate to trigger API calls
            try:
                await page.goto("https://new.mmi.run/property-search", wait_until="networkidle", timeout=20000)
                await asyncio.sleep(3)
            except:
                pass

            if captured_token:
                await save_storage_state(context, "mmi")
                expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
                await browser.close()
                await playwright_instance.stop()
                return {"success": True, "token": captured_token, "expiresAt": expires_at}

        # Not authenticated — do full login
        print("[MMI] Navigating to login...", file=sys.stderr)
        await page.goto("https://new.mmi.run/login", wait_until="networkidle", timeout=30000)

        await page.wait_for_selector('input[type="email"], input[name="email"]', timeout=10000)

        print("[MMI] Entering credentials...", file=sys.stderr)
        await page.fill('input[type="email"], input[name="email"]', email)
        await page.fill('input[type="password"], input[name="password"]', password)

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

        # Check for 2FA challenge
        if await detect_2fa_challenge(page):
            print("[MMI] 2FA challenge detected", file=sys.stderr)

            # Click "Send Verification Code" if present
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
                        print("[MMI] Verification code sent", file=sys.stderr)
                        break
                except Exception as e:
                    print(f"[MMI] Send button {selector} failed: {e}", file=sys.stderr)
                    continue

            if captured_token:
                print("[MMI] Token captured during 2FA send flow", file=sys.stderr)
                await save_storage_state(context, "mmi")
                expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
                await browser.close()
                await playwright_instance.stop()
                return {"success": True, "token": captured_token, "expiresAt": expires_at}

            # Try Twilio SMS auto-read for 2FA code
            print("[MMI] Attempting Twilio SMS auto-read for 2FA...", file=sys.stderr)
            twilio_code = None
            # Poll Twilio a few times with short delays
            for poll in range(6):  # Try for ~30 seconds
                await asyncio.sleep(5)
                twilio_code = fetch_latest_2fa_code(since_seconds=60)
                if twilio_code:
                    break

            if twilio_code:
                print(f"[MMI] Auto-filling 2FA code from Twilio: {twilio_code}", file=sys.stderr)
                # Fill in the 2FA code
                twofa_result = await _fill_and_submit_2fa(page, context, twilio_code)
                if twofa_result:
                    await save_storage_state(context, "mmi")
                    await browser.close()
                    await playwright_instance.stop()
                    return twofa_result

            # No Twilio code — fall back to manual 2FA session
            print("[MMI] Storing session for manual 2FA code entry", file=sys.stderr)
            new_session_id = str(uuid.uuid4())
            pending_2fa_sessions[new_session_id] = {
                "playwright": playwright_instance,
                "browser": browser,
                "context": context,
                "page": page,
                "created_at": datetime.now(),
                "captured_token": None,
            }

            async def session_request_handler(request):
                auth = request.headers.get("authorization", "")
                if auth.startswith("Bearer ") and "mmi.run" in request.url:
                    token = auth.replace("Bearer ", "")
                    if len(token) > 20:
                        pending_2fa_sessions[new_session_id]["captured_token"] = token

            page.on("request", session_request_handler)

            return {
                "requires_2fa": True,
                "session_id": new_session_id,
                "message": "2FA verification required. Submit code via /tokens/mmi/2fa",
            }

        # Token not captured yet — navigate to trigger API calls
        if not captured_token:
            print("[MMI] Token not captured from login, navigating to dashboard...", file=sys.stderr)
            try:
                await page.goto("https://new.mmi.run/dashboard", wait_until="networkidle", timeout=20000)
                await asyncio.sleep(3)
            except Exception as e:
                print(f"[MMI] Dashboard navigation failed: {e}", file=sys.stderr)

        if not captured_token:
            print("[MMI] Trying property search page...", file=sys.stderr)
            try:
                await page.goto("https://new.mmi.run/property-search", wait_until="networkidle", timeout=20000)
                await asyncio.sleep(3)
            except Exception as e:
                print(f"[MMI] Property search navigation failed: {e}", file=sys.stderr)

        # Check localStorage/sessionStorage
        if not captured_token:
            print("[MMI] Checking storage for token...", file=sys.stderr)
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
                print("[MMI] Found token in storage", file=sys.stderr)

        # Check cookies
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

        # Save storage state for next time (persistent session / trusted device)
        await save_storage_state(context, "mmi")

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


async def _fill_and_submit_2fa(page, context, code):
    """Fill 2FA code and submit, return token result or None."""
    captured_token = None

    async def capture_handler(request):
        nonlocal captured_token
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer ") and "mmi.run" in request.url:
            token = auth.replace("Bearer ", "")
            if len(token) > 20:
                captured_token = token

    page.on("request", capture_handler)

    twofa_selectors = [
        'input[name="code"]', 'input[name="otp"]', 'input[name="totp"]',
        'input[name="2fa"]', 'input[name="mfaCode"]', 'input[name="mfa_code"]',
        'input[name="verificationCode"]', 'input[name="verification_code"]',
        'input[name="twoFactorCode"]',
        'input[placeholder*="code" i]', 'input[placeholder*="verification" i]',
        'input[placeholder*="digit" i]',
        'input[aria-label*="code" i]', 'input[aria-label*="verification" i]',
        'input[type="tel"][maxlength="6"]', 'input[type="tel"][maxlength="1"]',
        'input[autocomplete="one-time-code"]',
        'input[inputmode="numeric"][maxlength="6"]',
        'input.otp-input', 'input.code-input',
    ]

    filled = False
    for selector in twofa_selectors:
        try:
            el = await page.query_selector(selector)
            if el and await el.is_visible():
                input_type = await el.get_attribute("type")
                input_name = await el.get_attribute("name") or ""
                if input_type in ["email", "password"] or "email" in input_name.lower() or "password" in input_name.lower():
                    continue
                await el.fill(code)
                print(f"[MMI-2FA] Filled code with selector: {selector}", file=sys.stderr)
                filled = True
                break
        except:
            continue

    if not filled:
        try:
            digit_inputs = await page.query_selector_all('input[maxlength="1"]')
            visible_inputs = []
            for inp in digit_inputs:
                if await inp.is_visible():
                    inp_type = await inp.get_attribute("type")
                    if inp_type not in ["email", "password"]:
                        visible_inputs.append(inp)
            if len(visible_inputs) >= 4 and len(code) >= len(visible_inputs):
                for i, inp in enumerate(visible_inputs):
                    await inp.fill(code[i])
                filled = True
        except:
            pass

    if not filled:
        print("[MMI-2FA] Could not find 2FA input field", file=sys.stderr)
        return None

    # Submit
    submit_selectors = [
        'button[type="submit"]', 'button:has-text("Verify")',
        'button:has-text("Submit")', 'button:has-text("Continue")',
        'button:has-text("Confirm")', 'input[type="submit"]',
    ]

    submitted = False
    for selector in submit_selectors:
        try:
            btn = await page.query_selector(selector)
            if btn and await btn.is_visible():
                await btn.click()
                submitted = True
                break
        except:
            continue

    if not submitted:
        await page.keyboard.press("Enter")

    await page.wait_for_load_state("networkidle", timeout=30000)
    await asyncio.sleep(3)

    # Check if 2FA was accepted
    if await detect_2fa_challenge(page):
        print("[MMI-2FA] Code was not accepted", file=sys.stderr)
        return None

    # Try to capture token from post-2FA navigation
    if not captured_token:
        try:
            await page.goto("https://new.mmi.run/dashboard", wait_until="networkidle", timeout=20000)
            await asyncio.sleep(3)
        except:
            pass

    if not captured_token:
        # Check storage
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

    if not captured_token:
        cookies = await context.cookies()
        api_key_cookie = next((c for c in cookies if c["name"] == "api_key"), None)
        if api_key_cookie:
            captured_token = unquote(api_key_cookie["value"])

    if not captured_token:
        return None

    expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
    print("[MMI-2FA] Token extracted after 2FA", file=sys.stderr)
    return {"success": True, "token": captured_token, "expiresAt": expires_at}


async def complete_2fa_session(session_id: str, twofa_code: str):
    """Complete a pending 2FA session by submitting the verification code"""
    global pending_2fa_sessions

    if session_id not in pending_2fa_sessions:
        return {"error": "2FA session not found or expired"}

    session = pending_2fa_sessions[session_id]
    page = session["page"]
    browser = session["browser"]
    context = session["context"]
    playwright_instance = session["playwright"]

    try:
        result = await _fill_and_submit_2fa(page, context, twofa_code)

        # Cleanup session
        del pending_2fa_sessions[session_id]

        if result and result.get("success"):
            await save_storage_state(context, "mmi")
            await browser.close()
            await playwright_instance.stop()
            return result

        await browser.close()
        await playwright_instance.stop()
        return result or {"error": "2FA completed but could not capture token"}

    except Exception as e:
        traceback.print_exc()
        try:
            del pending_2fa_sessions[session_id]
            await browser.close()
            await playwright_instance.stop()
        except:
            pass
        return {"error": f"2FA completion failed: {str(e)}"}


# =============================================================================
# RPR TOKEN EXTRACTION
# =============================================================================

async def extract_rpr_token():
    """Extract Bearer token from RPR login via NAR SSO. Uses persistent sessions."""
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

        context = await create_context_with_state(browser, "rpr")
        page = await context.new_page()

        async def handle_request(request):
            nonlocal captured_token
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer ") and ("narrpr.com" in request.url or "rpr" in request.url.lower()):
                captured_token = auth.replace("Bearer ", "")
                print(f"[RPR] Captured token from {request.url}", file=sys.stderr)

        page.on("request", handle_request)

        try:
            # Check if already authenticated
            if await check_already_authenticated(page, "rpr"):
                await asyncio.sleep(2)
                if captured_token:
                    await save_storage_state(context, "rpr")
                    expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
                    return {"success": True, "token": captured_token, "expiresAt": expires_at}

                # Navigate to trigger API calls
                try:
                    await page.goto("https://www.narrpr.com/search", wait_until="domcontentloaded", timeout=20000)
                    await asyncio.sleep(3)
                except:
                    pass

                if captured_token:
                    await save_storage_state(context, "rpr")
                    expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
                    return {"success": True, "token": captured_token, "expiresAt": expires_at}

            # Full login flow
            print("[RPR] Navigating to RPR login...", file=sys.stderr)
            await page.goto("https://www.narrpr.com/home", wait_until="domcontentloaded", timeout=30000)
            print(f"[RPR] Current URL: {page.url}", file=sys.stderr)

            # Check if we need to click login button
            if "narrpr.com" in page.url and "login" not in page.url.lower():
                login_btn = await page.query_selector('a[href*="login"], button:has-text("Log In"), a:has-text("Log In"), a:has-text("Sign In")')
                if login_btn:
                    print("[RPR] Clicking login button...", file=sys.stderr)
                    await login_btn.click()
                    await page.wait_for_load_state("domcontentloaded", timeout=30000)

            # Wait for email input
            print("[RPR] Waiting for email input...", file=sys.stderr)
            await page.wait_for_selector('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]', timeout=20000)

            print("[RPR] Entering email...", file=sys.stderr)
            email_selectors = ['input[type="email"]', 'input[name="email"]', 'input[id*="email"]', 'input[placeholder*="email" i]']
            for selector in email_selectors:
                email_input = await page.query_selector(selector)
                if email_input:
                    await email_input.click()
                    await email_input.fill("")
                    await page.keyboard.type(email, delay=50)
                    break

            await asyncio.sleep(1)

            next_selectors = [
                'button:has-text("Next")', 'button:has-text("Continue")',
                'button[type="submit"]', 'input[type="submit"]',
                'button:has-text("Sign In")',
            ]

            for selector in next_selectors:
                try:
                    btn = await page.query_selector(selector)
                    if btn:
                        for _ in range(20):
                            is_disabled = await btn.get_attribute("disabled")
                            if not is_disabled:
                                break
                            await asyncio.sleep(0.5)
                        await btn.click()
                        break
                except:
                    continue

            await asyncio.sleep(2)

            password_input = await page.query_selector('input[type="password"]')
            if password_input:
                print("[RPR] Entering password...", file=sys.stderr)
                await password_input.click()
                await password_input.fill("")
                await page.keyboard.type(password, delay=50)
                await asyncio.sleep(1)

                submit_selectors = [
                    'button:has-text("Sign In")', 'button:has-text("Log In")',
                    'button[type="submit"]', 'input[type="submit"]',
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
                            break
                    except:
                        continue
            else:
                await page.keyboard.press("Enter")

            print("[RPR] Waiting for login completion...", file=sys.stderr)
            await page.wait_for_load_state("domcontentloaded", timeout=30000)
            await asyncio.sleep(5)

            print(f"[RPR] Final URL: {page.url}", file=sys.stderr)

            if not captured_token:
                try:
                    await page.goto("https://www.narrpr.com/search", wait_until="domcontentloaded", timeout=20000)
                    await asyncio.sleep(3)
                except:
                    pass

            if not captured_token:
                token_from_storage = await page.evaluate("""
                    () => {
                        const keys = ['token', 'accessToken', 'access_token', 'jwt', 'bearerToken', 'authToken'];
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

            if not captured_token:
                cookies = await context.cookies()
                for cookie in cookies:
                    if 'token' in cookie['name'].lower() or 'jwt' in cookie['name'].lower():
                        if len(cookie['value']) > 50:
                            captured_token = unquote(cookie['value'])
                            break

            if not captured_token:
                return {"error": f"Could not capture token. URL: {page.url}"}

            # Save persistent session
            await save_storage_state(context, "rpr")

            expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
            print("[RPR] Token extracted successfully", file=sys.stderr)
            return {"success": True, "token": captured_token, "expiresAt": expires_at}

        except Exception as e:
            traceback.print_exc()
            return {"error": f"RPR extraction failed: {str(e)}"}
        finally:
            await browser.close()


# =============================================================================
# TOKEN MANAGEMENT WITH RETRY
# =============================================================================

def refresh_token(provider):
    """Refresh a specific token with retry and exponential backoff."""
    global tokens

    delays = [5, 15, 45]  # seconds between retries

    for attempt in range(len(delays)):
        print(f"[TokenService] Refreshing {provider} token (attempt {attempt + 1}/{len(delays)})...", file=sys.stderr)

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
                        "retryCount": 0,
                    }
                    print(f"[TokenService] {provider} token refreshed successfully", file=sys.stderr)
                    return result
                elif result.get("requires_2fa"):
                    # 2FA pending — don't retry, return immediately
                    tokens[provider]["lastError"] = "Waiting for 2FA"
                    return result
                else:
                    tokens[provider]["lastError"] = result.get("error")
                    tokens[provider]["retryCount"] = attempt + 1
                    print(f"[TokenService] {provider} token refresh failed: {result.get('error')}", file=sys.stderr)

        except Exception as e:
            error_msg = f"Exception: {str(e)}"
            with token_lock:
                tokens[provider]["lastError"] = error_msg
                tokens[provider]["retryCount"] = attempt + 1
            print(f"[TokenService] {provider} exception: {error_msg}", file=sys.stderr)
            traceback.print_exc()

        if attempt < len(delays) - 1:
            print(f"[TokenService] Retrying {provider} in {delays[attempt]}s...", file=sys.stderr)
            time.sleep(delays[attempt])

    # All retries failed — send alert email
    error_msg = tokens[provider].get("lastError", "Unknown error")
    send_alert_email(
        f"[TCDS Token Service] {provider.upper()} token refresh FAILED",
        f"All {len(delays)} attempts to refresh the {provider.upper()} token have failed.\n\n"
        f"Last error: {error_msg}\n"
        f"Time: {datetime.now().isoformat()}\n"
        f"Server: 75.37.55.209:8899\n\n"
        f"Manual intervention may be required."
    )

    return {"error": f"All {len(delays)} refresh attempts failed. Last error: {error_msg}"}


def get_token(provider):
    """Get a valid token, refreshing if needed."""
    with token_lock:
        token_data = tokens.get(provider)
        if not token_data:
            return {"error": f"Unknown provider: {provider}"}

        now_ms = int(time.time() * 1000)
        buffer_ms = REFRESH_BUFFER_SECONDS * 1000

        if token_data["token"] and token_data["expiresAt"] > (now_ms + buffer_ms):
            return {
                "success": True,
                "token": token_data["token"],
                "expiresAt": token_data["expiresAt"],
                "cached": True,
            }

    result = refresh_token(provider)
    if result.get("success"):
        return {
            "success": True,
            "token": result["token"],
            "expiresAt": result["expiresAt"],
            "cached": False,
        }
    return result


# =============================================================================
# PROACTIVE TOKEN REFRESH DAEMON
# =============================================================================

def proactive_refresh_daemon():
    """Background thread that proactively refreshes tokens before expiry."""
    print("[Daemon] Proactive token refresh daemon started", file=sys.stderr)

    while True:
        try:
            time.sleep(PROACTIVE_CHECK_INTERVAL)

            now_ms = int(time.time() * 1000)
            buffer_ms = REFRESH_BUFFER_SECONDS * 1000

            for provider in ["rpr", "mmi"]:
                with token_lock:
                    token_data = tokens[provider]
                    has_token = bool(token_data["token"])
                    expires_at = token_data["expiresAt"]

                if has_token and expires_at > 0:
                    remaining_ms = expires_at - now_ms
                    remaining_min = remaining_ms / 60000

                    if remaining_ms <= buffer_ms:
                        print(f"[Daemon] {provider.upper()} token expiring in {remaining_min:.1f} min, refreshing...", file=sys.stderr)
                        refresh_token(provider)
                    else:
                        print(f"[Daemon] {provider.upper()} token OK, {remaining_min:.1f} min remaining", file=sys.stderr)

        except Exception as e:
            print(f"[Daemon] Error: {e}", file=sys.stderr)
            traceback.print_exc()


# =============================================================================
# HTTP SERVER
# =============================================================================

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
            now_ms = int(time.time() * 1000)
            uptime_seconds = (datetime.now() - SERVICE_START_TIME).total_seconds()

            def token_info(provider):
                td = tokens[provider]
                remaining_ms = td["expiresAt"] - now_ms if td["expiresAt"] > 0 else 0
                remaining_min = max(0, remaining_ms / 60000)
                state_path = get_storage_state_path(provider)
                return {
                    "hasToken": bool(td["token"]),
                    "expiresInMinutes": round(remaining_min, 1),
                    "lastRefresh": td["lastRefresh"],
                    "lastError": td["lastError"],
                    "retryCount": td.get("retryCount", 0),
                    "hasStorageState": state_path.exists(),
                }

            self.send_json({
                "status": "ok",
                "uptime_seconds": round(uptime_seconds),
                "uptime_human": str(timedelta(seconds=int(uptime_seconds))),
                "playwright": PLAYWRIGHT_AVAILABLE,
                "twilio_configured": bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_2FA_PHONE_NUMBER),
                "email_alerts_configured": bool(OUTLOOK_TENANT_ID and OUTLOOK_CLIENT_ID),
                "tokens": {
                    "mmi": token_info("mmi"),
                    "rpr": token_info("rpr"),
                },
                "pending_2fa_sessions": len(pending_2fa_sessions),
            })
            return

        if not self.check_auth():
            return

        if self.path == "/tokens/mmi":
            result = get_token("mmi")
            self.send_json(result, 200 if result.get("success") or result.get("requires_2fa") else 500)
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
                    with token_lock:
                        tokens["mmi"] = {
                            "token": result["token"],
                            "expiresAt": result["expiresAt"],
                            "lastError": None,
                            "lastRefresh": datetime.now().isoformat(),
                            "retryCount": 0,
                        }
                    self.send_json(result)
                else:
                    self.send_json(result, 400 if "error" in result else 200)
            except json.JSONDecodeError:
                self.send_json({"error": "Invalid JSON"}, 400)
            except Exception as e:
                self.send_json({"error": str(e)}, 500)
        elif self.path == "/tokens/mmi/2fa/status":
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
    print(f"[TokenService] Twilio configured: {bool(TWILIO_ACCOUNT_SID)}", file=sys.stderr)
    print(f"[TokenService] Email alerts configured: {bool(OUTLOOK_TENANT_ID)}", file=sys.stderr)
    print(f"[TokenService] Browser state dir: {BROWSER_STATE_DIR.absolute()}", file=sys.stderr)

    # Check for existing storage states
    for provider in ["mmi", "rpr"]:
        sp = get_storage_state_path(provider)
        if sp.exists():
            print(f"[TokenService] Found existing {provider} storage state: {sp}", file=sys.stderr)

    # Start proactive refresh daemon
    daemon_thread = threading.Thread(target=proactive_refresh_daemon, daemon=True)
    daemon_thread.start()
    print("[TokenService] Proactive refresh daemon started", file=sys.stderr)

    server = HTTPServer(("0.0.0.0", port), TokenHandler)
    print(f"[TokenService] Listening on http://0.0.0.0:{port}", file=sys.stderr)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[TokenService] Shutting down...", file=sys.stderr)
        server.shutdown()


if __name__ == "__main__":
    main()
