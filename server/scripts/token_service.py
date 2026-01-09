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

            await page.click('button[type="submit"]')
            await page.wait_for_load_state("networkidle", timeout=15000)
            await asyncio.sleep(2)

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
    """Extract Bearer token from RPR login."""
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
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            viewport={"width": 1920, "height": 1080}
        )

        page = await context.new_page()

        async def handle_request(request):
            nonlocal captured_token
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer ") and "webapi.narrpr.com" in request.url:
                captured_token = auth.replace("Bearer ", "")
                print(f"[RPR] Captured token from {request.url}", file=sys.stderr)

        page.on("request", handle_request)

        try:
            print("[RPR] Navigating to login...", file=sys.stderr)
            await page.goto("https://www.narrpr.com/", wait_until="networkidle", timeout=30000)

            login_btn = await page.query_selector('a[href*="login"], button:has-text("Log In")')
            if login_btn:
                await login_btn.click()
                await page.wait_for_load_state("networkidle", timeout=15000)

            await page.wait_for_selector('input[type="email"], input[name="email"]', timeout=15000)

            print("[RPR] Entering credentials...", file=sys.stderr)
            email_input = await page.query_selector('input[type="email"], input[name="email"]')
            if email_input:
                await email_input.fill(email)

            next_btn = await page.query_selector('button:has-text("Next"), button[type="submit"]')
            if next_btn:
                await next_btn.click()
                await asyncio.sleep(2)

            password_input = await page.query_selector('input[type="password"]')
            if password_input:
                await password_input.fill(password)

            submit_btn = await page.query_selector('button[type="submit"], button:has-text("Sign In")')
            if submit_btn:
                await submit_btn.click()

            await page.wait_for_load_state("networkidle", timeout=30000)
            await asyncio.sleep(5)

            if not captured_token:
                # Try to trigger API calls
                try:
                    await page.goto("https://www.narrpr.com/search", wait_until="networkidle", timeout=15000)
                    await asyncio.sleep(3)
                except:
                    pass

            if not captured_token:
                # Try storage
                token_from_storage = await page.evaluate("""
                    () => {
                        const locs = [
                            localStorage.getItem('token'),
                            localStorage.getItem('accessToken'),
                            sessionStorage.getItem('token'),
                        ];
                        for (const t of locs) if (t && t.length > 20) return t;
                        return null;
                    }
                """)
                if token_from_storage:
                    captured_token = token_from_storage

            if not captured_token:
                return {"error": f"Could not capture token. URL: {page.url}"}

            expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)
            print("[RPR] Token extracted successfully", file=sys.stderr)
            return {"success": True, "token": captured_token, "expiresAt": expires_at}

        except Exception as e:
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
