#!/usr/bin/env python3
"""
RPR Token Extractor
Extracts the Bearer token from RPR login using Playwright.
Intercepts network requests to capture the authorization header.

Usage:
    python rpr_token_extractor.py

Environment Variables:
    RPR_EMAIL - RPR login email
    RPR_PASSWORD - RPR login password

Output:
    JSON with token and expiry to stdout
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timedelta

try:
    from playwright.async_api import async_playwright
except ImportError:
    print(json.dumps({"error": "playwright not installed. Run: pip install playwright && playwright install chromium"}), file=sys.stdout)
    sys.exit(1)


async def extract_rpr_token():
    """Extract Bearer token from RPR login via network interception."""
    email = os.environ.get("RPR_EMAIL", "")
    password = os.environ.get("RPR_PASSWORD", "")

    if not email or not password:
        return {"error": "RPR_EMAIL and RPR_PASSWORD environment variables required"}

    captured_token = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox"]
        )

        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080}
        )

        page = await context.new_page()

        # Set up request interception to capture Bearer token
        async def handle_request(request):
            nonlocal captured_token
            auth_header = request.headers.get("authorization", "")
            if auth_header.startswith("Bearer ") and "webapi.narrpr.com" in request.url:
                captured_token = auth_header.replace("Bearer ", "")
                print(f"[RPR] Captured token from request to {request.url}", file=sys.stderr)

        page.on("request", handle_request)

        try:
            # Navigate to RPR login
            print("[RPR] Navigating to login page...", file=sys.stderr)
            await page.goto("https://www.narrpr.com/", wait_until="networkidle", timeout=30000)

            # Look for login button/link
            login_button = await page.query_selector('a[href*="login"], button:has-text("Log In"), a:has-text("Log In")')
            if login_button:
                await login_button.click()
                await page.wait_for_load_state("networkidle", timeout=15000)

            # RPR uses NAR SSO - look for email input
            await page.wait_for_selector('input[type="email"], input[name="email"], input[id*="email"]', timeout=15000)

            # Fill credentials
            print("[RPR] Entering credentials...", file=sys.stderr)
            email_input = await page.query_selector('input[type="email"], input[name="email"], input[id*="email"]')
            if email_input:
                await email_input.fill(email)

            # Look for next/continue button or password field
            next_button = await page.query_selector('button:has-text("Next"), button:has-text("Continue"), button[type="submit"]')
            if next_button:
                await next_button.click()
                await asyncio.sleep(2)

            # Fill password
            password_input = await page.query_selector('input[type="password"], input[name="password"]')
            if password_input:
                await password_input.fill(password)

            # Submit login
            submit_button = await page.query_selector('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")')
            if submit_button:
                await submit_button.click()

            # Wait for redirect and API calls
            await page.wait_for_load_state("networkidle", timeout=30000)

            # Give extra time for API calls to happen
            await asyncio.sleep(5)

            # If we haven't captured token yet, try navigating to trigger API calls
            if not captured_token:
                print("[RPR] No token captured yet, trying to trigger API calls...", file=sys.stderr)
                # Try to navigate to a page that would make API calls
                try:
                    await page.goto("https://www.narrpr.com/search", wait_until="networkidle", timeout=15000)
                    await asyncio.sleep(3)
                except:
                    pass

            if not captured_token:
                # Check if login failed
                current_url = page.url
                if "login" in current_url.lower() or "signin" in current_url.lower():
                    return {"error": "Login failed - still on login page. Check credentials."}

                # Try to get token from localStorage or sessionStorage
                token_from_storage = await page.evaluate("""
                    () => {
                        // Check various storage locations
                        const locations = [
                            localStorage.getItem('token'),
                            localStorage.getItem('accessToken'),
                            localStorage.getItem('auth_token'),
                            sessionStorage.getItem('token'),
                            sessionStorage.getItem('accessToken'),
                        ];
                        for (const t of locations) {
                            if (t && t.length > 20) return t;
                        }
                        return null;
                    }
                """)

                if token_from_storage:
                    captured_token = token_from_storage
                    print("[RPR] Token found in storage", file=sys.stderr)

            if not captured_token:
                return {"error": f"Could not capture Bearer token. Current URL: {page.url}"}

            # Calculate expiry (default 1 hour, refresh 5 min early)
            expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)

            print("[RPR] Token extracted successfully", file=sys.stderr)

            return {
                "success": True,
                "token": captured_token,
                "expiresAt": expires_at,
                "source": "browser"
            }

        except Exception as e:
            return {"error": f"Extraction failed: {str(e)}"}

        finally:
            await browser.close()


def main():
    result = asyncio.run(extract_rpr_token())
    print(json.dumps(result))


if __name__ == "__main__":
    main()
