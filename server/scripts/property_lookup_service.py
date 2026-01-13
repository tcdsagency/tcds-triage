#!/usr/bin/env python3
"""
Property Lookup Service - RPR and MMI scraping endpoints
Adds browser-based property lookup to the token service.

This script adds lookup endpoints to token_service.py
"""

import asyncio
import json
import re
from urllib.parse import unquote, parse_qs, urlparse


async def lookup_rpr_property(page, address, token):
    """
    Look up property details from RPR using browser scraping.
    Returns property data (beds, baths, sqft, year built, status).
    """
    result = {
        "success": False,
        "data": None,
        "error": None,
    }

    try:
        print(f"[RPR-Lookup] Searching for: {address}", file=__import__('sys').stderr)

        # Navigate to RPR with auth
        await page.goto("https://www.narrpr.com/home", wait_until="networkidle", timeout=45000)

        # Check if logged in - look for search box
        search_input = await page.query_selector('input[placeholder*="address" i], input[placeholder*="search" i], input[type="search"]')

        if not search_input:
            # May need to click on search link first
            search_link = await page.query_selector('a[href*="search"], button:has-text("Search")')
            if search_link:
                await search_link.click()
                await page.wait_for_load_state("networkidle", timeout=15000)
                search_input = await page.query_selector('input[placeholder*="address" i], input[placeholder*="search" i], input[type="search"]')

        if not search_input:
            result["error"] = "Could not find search input on RPR"
            return result

        # Enter address and search
        await search_input.click()
        await search_input.fill("")
        await page.keyboard.type(address, delay=30)
        await asyncio.sleep(1)

        # Wait for autocomplete suggestions
        await asyncio.sleep(2)

        # Try to click first suggestion or press Enter
        suggestion = await page.query_selector('[class*="suggestion"], [class*="autocomplete"] li, [class*="dropdown"] a')
        if suggestion and await suggestion.is_visible():
            await suggestion.click()
        else:
            await page.keyboard.press("Enter")

        await page.wait_for_load_state("networkidle", timeout=30000)
        await asyncio.sleep(3)

        print(f"[RPR-Lookup] Property page URL: {page.url}", file=__import__('sys').stderr)

        # Extract property data from page
        data = {
            "bedrooms": 0,
            "bathrooms": 0,
            "sqft": 0,
            "yearBuilt": 0,
            "stories": 1,
            "currentStatus": "off_market",
            "_propertyId": None,
        }

        # Try to extract data from page content
        page_text = await page.inner_text("body")
        page_lower = page_text.lower()

        # Extract beds
        bed_patterns = [
            r'(\d+)\s*(?:bed|bedroom|br)',
            r'beds?:\s*(\d+)',
            r'bedroom[s]?:\s*(\d+)',
        ]
        for pattern in bed_patterns:
            match = re.search(pattern, page_lower)
            if match:
                data["bedrooms"] = int(match.group(1))
                break

        # Extract baths
        bath_patterns = [
            r'(\d+(?:\.\d+)?)\s*(?:bath|bathroom|ba)',
            r'baths?:\s*(\d+(?:\.\d+)?)',
            r'bathroom[s]?:\s*(\d+(?:\.\d+)?)',
        ]
        for pattern in bath_patterns:
            match = re.search(pattern, page_lower)
            if match:
                data["bathrooms"] = float(match.group(1))
                break

        # Extract sqft
        sqft_patterns = [
            r'([\d,]+)\s*(?:sq\.?\s*ft|sqft|square feet)',
            r'living\s*area:\s*([\d,]+)',
            r'size:\s*([\d,]+)\s*(?:sq|sf)',
        ]
        for pattern in sqft_patterns:
            match = re.search(pattern, page_lower)
            if match:
                data["sqft"] = int(match.group(1).replace(",", ""))
                break

        # Extract year built
        year_patterns = [
            r'(?:year\s*built|built\s*in|constructed):\s*(\d{4})',
            r'built:\s*(\d{4})',
            r'year:\s*(\d{4})',
        ]
        for pattern in year_patterns:
            match = re.search(pattern, page_lower)
            if match:
                year = int(match.group(1))
                if 1800 <= year <= 2030:
                    data["yearBuilt"] = year
                    break

        # Check listing status
        if "active" in page_lower and ("listing" in page_lower or "for sale" in page_lower):
            data["currentStatus"] = "active"
        elif "pending" in page_lower:
            data["currentStatus"] = "pending"
        elif "sold" in page_lower:
            data["currentStatus"] = "sold"

        # Extract property ID from URL if present
        if "property" in page.url:
            id_match = re.search(r'/property/(\d+)', page.url)
            if id_match:
                data["_propertyId"] = id_match.group(1)

        print(f"[RPR-Lookup] Extracted: beds={data['bedrooms']}, baths={data['bathrooms']}, sqft={data['sqft']}, year={data['yearBuilt']}", file=__import__('sys').stderr)

        result["success"] = True
        result["data"] = data

    except Exception as e:
        import traceback
        traceback.print_exc()
        result["error"] = str(e)

    return result


async def lookup_mmi_property(page, address, token):
    """
    Look up property listing/deed history from MMI using browser scraping.
    Returns listing history and deed history arrays.
    """
    result = {
        "success": False,
        "data": None,
        "error": None,
    }

    try:
        print(f"[MMI-Lookup] Searching for: {address}", file=__import__('sys').stderr)

        # Navigate to MMI property search
        await page.goto("https://new.mmi.run/property-search", wait_until="networkidle", timeout=30000)

        # Find and fill search input
        search_input = await page.query_selector('input[placeholder*="address" i], input[placeholder*="search" i], input[type="search"], input[name="address"]')

        if not search_input:
            result["error"] = "Could not find search input on MMI"
            return result

        await search_input.click()
        await search_input.fill("")
        await page.keyboard.type(address, delay=30)
        await asyncio.sleep(2)

        # Click search button or press Enter
        search_btn = await page.query_selector('button[type="submit"], button:has-text("Search")')
        if search_btn:
            await search_btn.click()
        else:
            await page.keyboard.press("Enter")

        await page.wait_for_load_state("networkidle", timeout=30000)
        await asyncio.sleep(3)

        print(f"[MMI-Lookup] Results page URL: {page.url}", file=__import__('sys').stderr)

        # Click on first result if there's a list
        result_link = await page.query_selector('a[href*="property"], tr[data-id], [class*="result"] a')
        if result_link:
            await result_link.click()
            await page.wait_for_load_state("networkidle", timeout=20000)
            await asyncio.sleep(2)

        # Extract data from page
        data = {
            "propertyId": None,
            "listingHistory": [],
            "deedHistory": [],
            "currentStatus": "unknown",
            "lastUpdated": __import__('datetime').datetime.now().isoformat(),
        }

        page_text = await page.inner_text("body")
        page_lower = page_text.lower()

        # Check for listing status
        if "active listing" in page_lower or "for sale" in page_lower:
            data["currentStatus"] = "active"
        elif "pending" in page_lower or "under contract" in page_lower:
            data["currentStatus"] = "pending"
        elif "sold" in page_lower or "closed" in page_lower:
            data["currentStatus"] = "sold"
        else:
            data["currentStatus"] = "off_market"

        # Try to find and parse listing history table
        tables = await page.query_selector_all('table')
        for table in tables:
            table_text = await table.inner_text()
            table_lower = table_text.lower()

            # Check if this looks like listing history
            if "listing" in table_lower or "list price" in table_lower:
                rows = await table.query_selector_all('tr')
                for row in rows[1:]:  # Skip header
                    cells = await row.query_selector_all('td')
                    if len(cells) >= 3:
                        listing = {
                            "LISTING_DATE": await cells[0].inner_text() if len(cells) > 0 else "",
                            "LIST_PRICE": 0,
                            "STATUS": await cells[-1].inner_text() if len(cells) > 2 else "",
                            "LISTING_AGENT": "",
                            "LISTING_BROKER": "",
                        }
                        # Try to parse price
                        for cell in cells:
                            cell_text = await cell.inner_text()
                            price_match = re.search(r'\$?([\d,]+)', cell_text)
                            if price_match and int(price_match.group(1).replace(",", "")) > 10000:
                                listing["LIST_PRICE"] = int(price_match.group(1).replace(",", ""))
                                break
                        if listing["LISTING_DATE"]:
                            data["listingHistory"].append(listing)

            # Check if this looks like deed/transaction history
            elif "deed" in table_lower or "transaction" in table_lower or "sale" in table_lower:
                rows = await table.query_selector_all('tr')
                for row in rows[1:]:  # Skip header
                    cells = await row.query_selector_all('td')
                    if len(cells) >= 2:
                        deed = {
                            "DATE": await cells[0].inner_text() if len(cells) > 0 else "",
                            "TRANSACTION_TYPE": "Sale",
                            "SALE_PRICE": 0,
                            "LOAN_AMOUNT": 0,
                            "LENDER": "",
                        }
                        # Try to parse amounts
                        for cell in cells:
                            cell_text = await cell.inner_text()
                            price_match = re.search(r'\$?([\d,]+)', cell_text)
                            if price_match:
                                amount = int(price_match.group(1).replace(",", ""))
                                if amount > 10000:
                                    if deed["SALE_PRICE"] == 0:
                                        deed["SALE_PRICE"] = amount
                                    else:
                                        deed["LOAN_AMOUNT"] = amount
                        if deed["DATE"]:
                            data["deedHistory"].append(deed)

        print(f"[MMI-Lookup] Found {len(data['listingHistory'])} listings, {len(data['deedHistory'])} deeds, status={data['currentStatus']}", file=__import__('sys').stderr)

        result["success"] = True
        result["data"] = data

    except Exception as e:
        import traceback
        traceback.print_exc()
        result["error"] = str(e)

    return result


# HTTP handler additions for do_GET method
LOOKUP_HANDLER_CODE = '''
        # Property lookup endpoints
        elif self.path.startswith("/lookup/rpr"):
            query = parse_qs(urlparse(self.path).query)
            address = query.get("address", [""])[0]
            if not address:
                self.send_json({"error": "address parameter required"}, 400)
                return

            # Get RPR token first
            rpr_token = get_token("rpr")
            if not rpr_token.get("success"):
                self.send_json({"error": "RPR authentication failed"}, 500)
                return

            # Run async lookup
            result = asyncio.get_event_loop().run_until_complete(
                run_rpr_lookup(address, rpr_token["token"])
            )
            self.send_json(result, 200 if result.get("success") else 404)

        elif self.path.startswith("/lookup/mmi"):
            query = parse_qs(urlparse(self.path).query)
            address = query.get("address", [""])[0]
            if not address:
                self.send_json({"error": "address parameter required"}, 400)
                return

            # Get MMI token first
            mmi_token = get_token("mmi")
            if not mmi_token.get("success"):
                self.send_json({"error": "MMI authentication failed"}, 500)
                return

            # Run async lookup
            result = asyncio.get_event_loop().run_until_complete(
                run_mmi_lookup(address, mmi_token["token"])
            )
            self.send_json(result, 200 if result.get("success") else 404)
'''


async def run_rpr_lookup(address, token):
    """Run RPR lookup with fresh browser instance"""
    from playwright.async_api import async_playwright

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

        # Set auth cookie/header if needed
        await context.add_cookies([{
            "name": "auth_token",
            "value": token,
            "domain": ".narrpr.com",
            "path": "/",
        }])

        result = await lookup_rpr_property(page, address, token)

        await browser.close()
        return result


async def run_mmi_lookup(address, token):
    """Run MMI lookup with fresh browser instance"""
    from playwright.async_api import async_playwright

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

        # Set auth token
        await context.add_cookies([{
            "name": "api_key",
            "value": token,
            "domain": ".mmi.run",
            "path": "/",
        }])

        result = await lookup_mmi_property(page, address, token)

        await browser.close()
        return result


if __name__ == "__main__":
    print("Property Lookup Service - Import into token_service.py")
    print("Add the lookup endpoints to the do_GET method")
