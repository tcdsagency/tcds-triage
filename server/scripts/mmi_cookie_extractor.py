#!/usr/bin/env python3
"""
MMI Cookie Extractor
Extracts the api_key cookie from MMI login using Playwright.
The cookie value is URL-decoded and used as Bearer token for API calls.

Usage:
    python mmi_cookie_extractor.py

Environment Variables:
    MMI_EMAIL - MMI login email
    MMI_PASSWORD - MMI login password

Output:
    JSON with token and expiry to stdout
"""

import asyncio
import json
import os
import sys
from urllib.parse import unquote
from datetime import datetime, timedelta

try:
    from playwright.async_api import async_playwright
except ImportError:
    print(json.dumps({"error": "playwright not installed. Run: pip install playwright && playwright install chromium"}), file=sys.stdout)
    sys.exit(1)


async def extract_mmi_token():
    """Extract Bearer token from MMI login."""
    email = os.environ.get("MMI_EMAIL", "")
    password = os.environ.get("MMI_PASSWORD", "")

    if not email or not password:
        return {"error": "MMI_EMAIL and MMI_PASSWORD environment variables required"}

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

        try:
            # Navigate to login page
            print("[MMI] Navigating to login page...", file=sys.stderr)
            await page.goto("https://new.mmi.run/login", wait_until="networkidle", timeout=30000)

            # Wait for login form
            await page.wait_for_selector('input[type="email"], input[name="email"]', timeout=10000)

            # Fill credentials
            print("[MMI] Entering credentials...", file=sys.stderr)
            await page.fill('input[type="email"], input[name="email"]', email)
            await page.fill('input[type="password"], input[name="password"]', password)

            # Submit login
            await page.click('button[type="submit"]')

            # Wait for navigation/redirect
            await page.wait_for_load_state("networkidle", timeout=15000)

            # Give extra time for cookies to be set
            await asyncio.sleep(2)

            # Extract cookies
            cookies = await context.cookies()

            # Find api_key cookie
            api_key_cookie = None
            for cookie in cookies:
                if cookie["name"] == "api_key":
                    api_key_cookie = cookie
                    break

            if not api_key_cookie:
                # Check if login failed
                current_url = page.url
                if "login" in current_url.lower():
                    return {"error": "Login failed - still on login page. Check credentials."}
                return {"error": f"api_key cookie not found. Current URL: {current_url}"}

            # URL decode the cookie value to get the Bearer token
            bearer_token = unquote(api_key_cookie["value"])

            # Calculate expiry (cookie expiry or default 1 hour)
            if api_key_cookie.get("expires"):
                expires_at = int(api_key_cookie["expires"] * 1000)  # Convert to ms
            else:
                # Default 1 hour expiry, refresh 5 min early
                expires_at = int((datetime.now() + timedelta(hours=1, minutes=-5)).timestamp() * 1000)

            print("[MMI] Token extracted successfully", file=sys.stderr)

            return {
                "success": True,
                "token": bearer_token,
                "expiresAt": expires_at,
                "source": "browser"
            }

        except Exception as e:
            return {"error": f"Extraction failed: {str(e)}"}

        finally:
            await browser.close()


def main():
    result = asyncio.run(extract_mmi_token())
    print(json.dumps(result))


if __name__ == "__main__":
    main()
