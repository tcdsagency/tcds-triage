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
"""

import asyncio
import json
import os
import sys
import time
import threading
from datetime import datetime, timedelta
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote
import traceback

# Token storage
tokens = {
    "mmi": {"token": None, "expiresAt": 0, "lastError": None, "lastRefresh": None},
    "rpr": {"token": None, "expiresAt": 0, "lastError": None, "lastRefresh": None},
}

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


async def extract_mmi_token():
    """Extract Bearer token from MMI login."""
    if not PLAYWRIGHT_AVAILABLE:
        return {"error": "Playwright not installed"}

    email = os.environ.get("MMI_EMAIL", "")
    password = os.environ.get("MMI_PASSWORD", "")

    if not email or not password:
        return {"error": "MMI_EMAIL and MMI_PASSWORD required"}

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
        )

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080}
        )

        page = await context.new_page()

        try:
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

            cookies = await context.cookies()
            api_key_cookie = next((c for c in cookies if c["name"] == "api_key"), None)

            if not api_key_cookie:
                return {"error": f"api_key cookie not found. URL: {page.url}"}

            bearer_token = unquote(api_key_cookie["value"])

            # Default 1 hour expiry
            expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)

            print("[MMI] Token extracted successfully", file=sys.stderr)
            return {"success": True, "token": bearer_token, "expiresAt": expires_at}

        except Exception as e:
            return {"error": f"MMI extraction failed: {str(e)}"}
        finally:
            await browser.close()


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
