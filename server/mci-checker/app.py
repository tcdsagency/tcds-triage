"""
MCI (MyCoverageInfo) Payment Checker Microservice v3.1.0
========================================================
Automated lookup service for mortgagee payment status.

Endpoints:
- GET /health - Health check
- POST /api/v1/check - Check payment status for a loan

Environment Variables:
- TWOCAPTCHA_API_KEY - 2Captcha API key for CAPTCHA solving
- API_KEY - API key for authenticating requests
- PORT - Server port (default: 8080)
- BASE_URL - Base URL for screenshot serving
"""

import os
import re
import time
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass, asdict, field
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from playwright.async_api import async_playwright, Page, Browser
from twocaptcha import TwoCaptcha
from tenacity import retry, stop_after_attempt, wait_exponential
import structlog

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)
logger = structlog.get_logger()

app = Flask(__name__)

# Configuration
API_KEY = os.environ.get("API_KEY", "")
TWOCAPTCHA_API_KEY = os.environ.get("TWOCAPTCHA_API_KEY", "")
MCI_BASE_URL = "https://www.mycoverageinfo.com"
SCREENSHOTS_DIR = Path("/home/todd/services/mci-checker/screenshots")
BASE_URL = os.environ.get("BASE_URL", "https://realtime.tcdsagency.com/mci")

# Ensure screenshots directory exists
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

# Browser instance (reused for efficiency)
browser: Optional[Browser] = None

MAX_CAPTCHA_ATTEMPTS = 3


@dataclass
class PaymentCheckResult:
    """Result of a payment status check"""
    success: bool
    loan_number: str
    payment_status: Optional[str] = None  # current, late, grace_period, lapsed
    paid_through_date: Optional[str] = None
    next_due_date: Optional[str] = None
    amount_due: Optional[float] = None
    premium_amount: Optional[float] = None
    policy_number: Optional[str] = None
    carrier: Optional[str] = None
    effective_date: Optional[str] = None
    expiration_date: Optional[str] = None
    cancellation_date: Optional[str] = None
    cancellation_reason: Optional[str] = None
    coverage_amount: Optional[float] = None
    deductible: Optional[str] = None
    payment_date: Optional[str] = None
    payment_amount: Optional[float] = None
    homeowner: Optional[str] = None
    additional_homeowner: Optional[str] = None
    property_address: Optional[str] = None
    mortgagee: Optional[str] = None
    mortgagee_address: Optional[str] = None
    mortgagee_clause: Optional[str] = None
    error_message: Optional[str] = None
    error_code: Optional[str] = None
    screenshot_url: Optional[str] = None
    payment_screenshot_url: Optional[str] = None
    raw_data: Optional[dict] = field(default=None)
    duration_ms: int = 0


async def get_browser() -> Browser:
    """Get or create browser instance"""
    global browser
    if browser is None:
        playwright = await async_playwright().start()
        browser = await playwright.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ]
        )
    return browser


async def solve_captcha(page: Page, site_key: str) -> Optional[str]:
    """Solve reCAPTCHA using 2Captcha service"""
    if not TWOCAPTCHA_API_KEY:
        logger.warning("2Captcha API key not configured")
        return None

    try:
        solver = TwoCaptcha(TWOCAPTCHA_API_KEY)

        # Get the page URL for reCAPTCHA
        page_url = page.url

        logger.info("Solving CAPTCHA", site_key=site_key[:20], page_url=page_url)

        # Solve the reCAPTCHA
        result = solver.recaptcha(
            sitekey=site_key,
            url=page_url,
        )

        if result and "code" in result:
            logger.info("CAPTCHA solved successfully")
            return result["code"]

        return None
    except Exception as e:
        logger.error("CAPTCHA solving failed", error=str(e))
        return None


async def inject_captcha_and_submit(page: Page, site_key: str) -> bool:
    """Solve CAPTCHA, inject response, and submit. Returns True if successful."""
    captcha_response = await solve_captcha(page, site_key)
    if not captcha_response:
        return False

    logger.info("Got CAPTCHA solution, injecting")

    # Inject the CAPTCHA response
    escaped_response = json.dumps(captcha_response)
    await page.evaluate(f'''
        var responseEl = document.getElementById("g-recaptcha-response");
        var captchaVal = {escaped_response};
        if (responseEl) {{
            responseEl.innerHTML = captchaVal;
            responseEl.value = captchaVal;
            responseEl.style.display = "block";
        }}
        var altResponse = document.querySelector('[name="g-recaptcha-response"]');
        if (altResponse) {{
            altResponse.value = captchaVal;
        }}
    ''')
    logger.info("CAPTCHA response injected into textarea")
    await page.wait_for_timeout(500)

    # Try to trigger the callback function
    await page.evaluate(f'''
        (function() {{
            var captchaVal = {escaped_response};
            if (typeof ___grecaptcha_cfg !== 'undefined' && ___grecaptcha_cfg.clients) {{
                Object.keys(___grecaptcha_cfg.clients).forEach(key => {{
                    var client = ___grecaptcha_cfg.clients[key];
                    if (client && client.callback) {{
                        try {{ client.callback(captchaVal); }} catch(e) {{}}
                    }}
                    for (var prop in client) {{
                        if (client[prop] && typeof client[prop].callback === 'function') {{
                            try {{ client[prop].callback(captchaVal); }} catch(e) {{}}
                        }}
                    }}
                }});
            }}
            try {{
                if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {{
                    for (var i in window.___grecaptcha_cfg.clients) {{
                        var c = window.___grecaptcha_cfg.clients[i];
                        for (var j in c) {{
                            if (c[j] && c[j].callback) {{
                                c[j].callback(captchaVal);
                            }}
                        }}
                    }}
                }}
            }} catch(e) {{}}
            if (typeof grecaptcha !== 'undefined' && grecaptcha.execute) {{
                try {{ grecaptcha.execute(); }} catch(e) {{}}
            }}
        }})()
    ''')

    await page.wait_for_timeout(2000)

    # Try clicking submit again after CAPTCHA is solved
    submit_selectors = [
        'button:has-text("Search")',
        'button[type="submit"]',
        'input[type="submit"]',
        'button.btn-primary',
        'button:has-text("Submit")',
    ]

    for selector in submit_selectors:
        try:
            submit_btn = await page.query_selector(selector)
            if submit_btn:
                is_visible = await submit_btn.is_visible()
                is_enabled = await submit_btn.is_enabled()
                if is_visible and is_enabled:
                    await submit_btn.click()
                    logger.info("Clicked submit after CAPTCHA", selector=selector)
                    return True
        except Exception:
            continue

    # Fallback: press Enter
    logger.info("No submit found, trying Enter key")
    await page.keyboard.press('Enter')
    return True


def get_captcha_site_key_from_page(page_source: str) -> Optional[str]:
    """Extract reCAPTCHA site key from page source."""
    match = re.search(r'data-sitekey="([^"]+)"', page_source)
    if match:
        return match.group(1)
    return None


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def check_mci_payment(
    loan_number: str,
    zip_code: str,
    last_name: str,
    servicer: Optional[str] = None
) -> PaymentCheckResult:
    """
    Check payment status on MyCoverageInfo.com

    This performs the following steps:
    1. Navigate to MCI lookup page
    2. Enter loan number, ZIP code, and last name
    3. Solve CAPTCHA if present (up to 3 attempts)
    4. Extract payment status from results using regex-based text parsing
    """
    start_time = time.time()
    context = None

    try:
        browser = await get_browser()
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        logger.info("Starting MCI lookup", loan_number=loan_number[:4] + "****", zip_code=zip_code)

        # Navigate to MCI Agent Portal
        url = f"{MCI_BASE_URL}/agent"
        if servicer:
            url = f"{MCI_BASE_URL}/{servicer}"

        logger.info("Navigating to MCI Agent Portal", url=url)
        await page.goto(url, timeout=45000)

        # Wait for Angular app to bootstrap
        logger.info("Waiting for page to load...")
        await page.wait_for_load_state("networkidle", timeout=30000)
        await page.wait_for_timeout(3000)

        # Find all visible inputs
        inputs = await page.query_selector_all('input:not([type="hidden"])')
        logger.info("Found input fields", count=len(inputs))

        # MCI Agent Portal has 3 fields: Loan Number, ZIP Code, Last Name
        if len(inputs) >= 3:
            logger.info("Filling Agent Portal form", input_count=len(inputs))

            # First input: Loan Number
            try:
                await inputs[0].click()
                await page.wait_for_timeout(100)
                await inputs[0].type(loan_number, delay=30)
                logger.info("Filled loan number field")
            except Exception as e:
                logger.warning("Failed to fill loan number", error=str(e))

            # Second input: ZIP Code
            try:
                await inputs[1].click()
                await page.wait_for_timeout(100)
                await inputs[1].type(zip_code, delay=30)
                logger.info("Filled ZIP code field")
            except Exception as e:
                logger.warning("Failed to fill ZIP code", error=str(e))

            # Third input: Last Name
            try:
                await inputs[2].click()
                await page.wait_for_timeout(100)
                await inputs[2].type(last_name, delay=30)
                logger.info("Filled last name field")
            except Exception as e:
                logger.warning("Failed to fill last name", error=str(e))

            await page.wait_for_timeout(500)
        else:
            # Fallback: Try selector-based approach
            logger.info(f"Only found {len(inputs)} inputs, trying selector-based approach")

            loan_selectors = [
                'input[formcontrolname="loanNumber"]',
                'input[name="loanNumber"]',
                'input[id="loanNumber"]',
            ]
            for selector in loan_selectors:
                try:
                    loan_input = await page.query_selector(selector)
                    if loan_input:
                        await loan_input.fill(loan_number)
                        logger.info(f"Filled loan with selector: {selector}")
                        break
                except Exception:
                    continue

            zip_selectors = [
                'input[formcontrolname="zipCode"]',
                'input[name="zipCode"]',
            ]
            for selector in zip_selectors:
                try:
                    zip_input = await page.query_selector(selector)
                    if zip_input:
                        await zip_input.fill(zip_code)
                        logger.info(f"Filled ZIP with selector: {selector}")
                        break
                except Exception:
                    continue

        # Submit the form
        logger.info("Looking for submit button")
        submit_selectors = [
            'button:has-text("Search")',
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button.btn-primary',
        ]

        submit_clicked = False
        for selector in submit_selectors:
            try:
                submit_btn = await page.query_selector(selector)
                if submit_btn:
                    logger.info("Found submit button", selector=selector)
                    await submit_btn.click()
                    logger.info("Clicked submit button")
                    submit_clicked = True
                    break
            except Exception:
                continue

        if not submit_clicked:
            logger.info("No submit button found, pressing Enter")
            await page.keyboard.press('Enter')

        # Wait for response
        logger.info("Waiting for response")
        await page.wait_for_timeout(3000)

        # Handle CAPTCHA with retry (up to MAX_CAPTCHA_ATTEMPTS)
        for captcha_attempt in range(MAX_CAPTCHA_ATTEMPTS):
            recaptcha_frame = await page.query_selector('iframe[src*="recaptcha"]')
            if not recaptcha_frame:
                logger.info("No reCAPTCHA detected")
                break

            logger.info("reCAPTCHA detected", attempt=captcha_attempt + 1, max_attempts=MAX_CAPTCHA_ATTEMPTS)

            # Extract site key
            site_key = None
            frame_src = await recaptcha_frame.get_attribute('src')
            if frame_src and 'k=' in frame_src:
                match = re.search(r'k=([^&]+)', frame_src)
                if match:
                    site_key = match.group(1)

            if not site_key:
                recaptcha_div = await page.query_selector('.g-recaptcha, [data-sitekey]')
                if recaptcha_div:
                    site_key = await recaptcha_div.get_attribute('data-sitekey')

            if not site_key or not TWOCAPTCHA_API_KEY:
                logger.warning("Cannot solve CAPTCHA: missing site key or 2Captcha key")
                break

            solved = await inject_captcha_and_submit(page, site_key)
            if not solved:
                logger.warning("CAPTCHA solve failed", attempt=captcha_attempt + 1)
                if captcha_attempt == MAX_CAPTCHA_ATTEMPTS - 1:
                    return PaymentCheckResult(
                        success=False,
                        loan_number=loan_number,
                        error_message=f"Failed to solve CAPTCHA after {MAX_CAPTCHA_ATTEMPTS} attempts",
                        error_code="CAPTCHA_FAILED",
                        duration_ms=int((time.time() - start_time) * 1000)
                    )
                continue

            await page.wait_for_timeout(3000)

            # Check if CAPTCHA is still present (need to retry)
            still_captcha = await page.query_selector('iframe[src*="recaptcha"]')
            if not still_captcha:
                logger.info("CAPTCHA solved, proceeding to results")
                break

            logger.info("CAPTCHA still present, retrying", attempt=captcha_attempt + 1)

        # Wait for final results
        logger.info("Waiting for results page to load")
        await page.wait_for_load_state("networkidle", timeout=60000)
        await page.wait_for_timeout(3000)  # Extra wait for Angular
        logger.info("Results page loaded, extracting data")

        # Check for errors
        error_selectors = [
            '.error-message',
            '.alert-danger',
            '.mat-error',
            '[class*="error"]',
            '.snack-bar-error',
        ]

        for selector in error_selectors:
            try:
                error_el = await page.query_selector(selector)
                if error_el:
                    error_text = await error_el.inner_text()
                    if error_text and ("not found" in error_text.lower() or "no record" in error_text.lower() or "no results" in error_text.lower()):
                        return PaymentCheckResult(
                            success=False,
                            loan_number=loan_number,
                            error_message=f"Loan not found in MCI: {error_text}",
                            error_code="NOT_FOUND",
                            duration_ms=int((time.time() - start_time) * 1000)
                        )
            except Exception:
                continue

        # Extract payment status
        result = await extract_payment_data(page, loan_number, start_time)

        await context.close()
        return result

    except Exception as e:
        logger.error("MCI lookup failed", error=str(e), loan_number=loan_number[:4] + "****")
        if context:
            try:
                await context.close()
            except Exception:
                pass
        return PaymentCheckResult(
            success=False,
            loan_number=loan_number,
            error_message=str(e),
            error_code="LOOKUP_ERROR",
            duration_ms=int((time.time() - start_time) * 1000)
        )


def parse_currency(value: str) -> Optional[float]:
    """Parse a currency string like '$2,623.79' into a float."""
    if not value:
        return None
    cleaned = re.sub(r'[^\d.]', '', value)
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def parse_date(text: str) -> Optional[str]:
    """Extract a date pattern (MM/DD/YYYY) from text."""
    match = re.search(r'\d{1,2}/\d{1,2}/\d{4}', text)
    return match.group(0) if match else None


async def extract_payment_data(
    page: Page,
    loan_number: str,
    start_time: float
) -> PaymentCheckResult:
    """Extract payment data from MCI results page using regex-based text parsing"""

    screenshot_url = None
    payment_screenshot_url = None
    raw_data: dict = {}

    # Take screenshot of results page
    try:
        screenshot_id = str(uuid.uuid4())
        screenshot_filename = f"{screenshot_id}.png"
        screenshot_path = SCREENSHOTS_DIR / screenshot_filename
        await page.screenshot(path=str(screenshot_path), full_page=True)
        screenshot_url = f"{BASE_URL}/screenshots/{screenshot_filename}"
        logger.info("Screenshot saved", path=str(screenshot_path), url=screenshot_url)
    except Exception as e:
        logger.warning("Failed to save screenshot", error=str(e))

    # Get full page text for regex parsing
    page_text = await page.inner_text("body")
    raw_data["page_text"] = page_text

    # --- Parse homeowner info ---
    homeowner = None
    additional_homeowner = None
    match = re.search(r'(?:Homeowner|Insured|Named Insured)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        homeowner = match.group(1).strip()
    match = re.search(r'(?:Additional (?:Homeowner|Insured)|Co-Insured)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        additional_homeowner = match.group(1).strip()

    # --- Parse property address ---
    property_address = None
    match = re.search(r'(?:Property Address|Property Location|Risk Address)[:\s]*([^\n]+(?:\n[^\n]+)?)', page_text, re.IGNORECASE)
    if match:
        property_address = re.sub(r'\s+', ' ', match.group(1)).strip()

    # --- Parse policy info ---
    policy_number = None
    carrier = None
    policy_type = None
    policy_status = None

    match = re.search(r'(?:Policy\s*(?:#|Number|No\.?))[:\s]*([A-Z0-9-]+)', page_text, re.IGNORECASE)
    if match:
        policy_number = match.group(1).strip()

    match = re.search(r'(?:Carrier|Insurance Company|Company)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        carrier = match.group(1).strip()

    match = re.search(r'(?:Policy Type|Type of Policy|Coverage Type)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        policy_type = match.group(1).strip()
        raw_data["policy_type"] = policy_type

    match = re.search(r'(?:Policy Status|Status)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        policy_status = match.group(1).strip()
        raw_data["policy_status"] = policy_status

    # --- Parse dates ---
    effective_date = None
    expiration_date = None
    cancellation_date = None
    cancellation_reason = None

    match = re.search(r'(?:Effective\s*Date|Eff\.?\s*Date)[:\s]*(\d{1,2}/\d{1,2}/\d{4})', page_text, re.IGNORECASE)
    if match:
        effective_date = match.group(1)

    match = re.search(r'(?:Expiration\s*Date|Exp\.?\s*Date)[:\s]*(\d{1,2}/\d{1,2}/\d{4})', page_text, re.IGNORECASE)
    if match:
        expiration_date = match.group(1)

    match = re.search(r'(?:Cancellation\s*Date|Cancel\.?\s*Date)[:\s]*(\d{1,2}/\d{1,2}/\d{4})', page_text, re.IGNORECASE)
    if match:
        cancellation_date = match.group(1)

    match = re.search(r'(?:Cancellation\s*Reason|Cancel\s*Reason|Reason)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        reason = match.group(1).strip()
        if reason and reason.lower() not in ('n/a', 'none', ''):
            cancellation_reason = reason

    # --- Parse financials ---
    premium_amount = None
    coverage_amount = None
    deductible = None
    amount_due = None

    match = re.search(r'(?:Annual\s*Premium|Premium\s*Amount|Premium)[:\s]*\$?([\d,]+\.?\d*)', page_text, re.IGNORECASE)
    if match:
        premium_amount = parse_currency(match.group(1))

    match = re.search(r'(?:Coverage\s*Amount|Dwelling\s*Coverage|Coverage\s*A)[:\s]*\$?([\d,]+\.?\d*)', page_text, re.IGNORECASE)
    if match:
        coverage_amount = parse_currency(match.group(1))

    match = re.search(r'(?:Deductible)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        deductible = match.group(1).strip()

    match = re.search(r'(?:Amount\s*Due|Balance\s*Due)[:\s]*\$?([\d,]+\.?\d*)', page_text, re.IGNORECASE)
    if match:
        amount_due = parse_currency(match.group(1))

    # --- Parse payment status ---
    payment_status = "unknown"
    paid_through_date = None
    next_due_date = None
    payment_date = None
    payment_amount = None
    page_lower = page_text.lower()

    if cancellation_date:
        payment_status = "lapsed"
    elif "current" in page_lower and ("status" in page_lower or "payment" in page_lower):
        payment_status = "current"
    elif "past due" in page_lower or "late" in page_lower:
        payment_status = "late"
    elif "grace period" in page_lower:
        payment_status = "grace_period"
    elif "lapsed" in page_lower or "cancelled" in page_lower or "canceled" in page_lower:
        payment_status = "lapsed"

    match = re.search(r'(?:Paid\s*Through|Paid\s*Thru)[:\s]*(\d{1,2}/\d{1,2}/\d{4})', page_text, re.IGNORECASE)
    if match:
        paid_through_date = match.group(1)

    match = re.search(r'(?:Next\s*Due|Due\s*Date|Next\s*Payment)[:\s]*(\d{1,2}/\d{1,2}/\d{4})', page_text, re.IGNORECASE)
    if match:
        next_due_date = match.group(1)

    # --- Parse last payment info ---
    match = re.search(r'(?:Last\s*Payment\s*Date|Payment\s*Date|Date\s*Paid)[:\s]*(\d{1,2}/\d{1,2}/\d{4})', page_text, re.IGNORECASE)
    if match:
        payment_date = match.group(1)

    match = re.search(r'(?:Last\s*Payment\s*Amount|Payment\s*Amount|Amount\s*Paid)[:\s]*\$?([\d,]+\.?\d*)', page_text, re.IGNORECASE)
    if match:
        payment_amount = parse_currency(match.group(1))

    # --- Parse mortgagee info ---
    mortgagee_name = None
    mortgagee_address = None
    mortgagee_clause = None

    match = re.search(r'(?:Mortgagee|Lender|Loss Payee)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        mortgagee_name = match.group(1).strip()

    match = re.search(r'(?:Mortgagee Address|Lender Address)[:\s]*([^\n]+(?:\n[^\n]+)?)', page_text, re.IGNORECASE)
    if match:
        mortgagee_address = re.sub(r'\s+', ' ', match.group(1)).strip()

    match = re.search(r'(?:Mortgagee Clause|Mortgage Clause)[:\s]*([^\n]+)', page_text, re.IGNORECASE)
    if match:
        mortgagee_clause = match.group(1).strip()

    # --- Try to capture payment activity tab screenshot ---
    try:
        # Look for payment activity / payment history tab
        tab_selectors = [
            'a:has-text("Payment Activity")',
            'a:has-text("Payment History")',
            'mat-tab:has-text("Payment")',
            '[role="tab"]:has-text("Payment")',
            'button:has-text("Payment Activity")',
        ]

        for selector in tab_selectors:
            try:
                tab = await page.query_selector(selector)
                if tab:
                    await tab.click()
                    await page.wait_for_timeout(2000)
                    logger.info("Clicked payment activity tab", selector=selector)

                    payment_screenshot_id = str(uuid.uuid4())
                    payment_screenshot_filename = f"{payment_screenshot_id}-payment.png"
                    payment_screenshot_path = SCREENSHOTS_DIR / payment_screenshot_filename
                    await page.screenshot(path=str(payment_screenshot_path), full_page=True)
                    payment_screenshot_url = f"{BASE_URL}/screenshots/{payment_screenshot_filename}"
                    logger.info("Payment activity screenshot saved", url=payment_screenshot_url)
                    break
            except Exception:
                continue
    except Exception as e:
        logger.warning("Failed to capture payment activity screenshot", error=str(e))

    return PaymentCheckResult(
        success=True,
        loan_number=loan_number,
        payment_status=payment_status,
        paid_through_date=paid_through_date,
        next_due_date=next_due_date,
        amount_due=amount_due,
        premium_amount=premium_amount,
        policy_number=policy_number,
        carrier=carrier,
        effective_date=effective_date,
        expiration_date=expiration_date,
        cancellation_date=cancellation_date,
        cancellation_reason=cancellation_reason,
        coverage_amount=coverage_amount,
        deductible=deductible,
        payment_date=payment_date,
        payment_amount=payment_amount,
        homeowner=homeowner,
        additional_homeowner=additional_homeowner,
        property_address=property_address,
        mortgagee=mortgagee_name,
        mortgagee_address=mortgagee_address,
        mortgagee_clause=mortgagee_clause,
        screenshot_url=screenshot_url,
        payment_screenshot_url=payment_screenshot_url,
        raw_data=raw_data,
        duration_ms=int((time.time() - start_time) * 1000)
    )


# ============================================================================
# API ROUTES
# ============================================================================

@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "mci-checker",
        "version": "3.1.0",
        "captcha_configured": bool(TWOCAPTCHA_API_KEY),
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


@app.route("/api/v1/check", methods=["POST"])
def check_payment():
    """
    Check payment status for a loan

    Request body:
    {
        "loan_number": "123456789",
        "zip_code": "12345",
        "last_name": "Smith"  // required
    }
    """
    # Verify API key
    api_key = request.headers.get("X-API-Key", "")
    if API_KEY and api_key != API_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    # Parse request
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    loan_number = data.get("loan_number")
    zip_code = data.get("zip_code")
    last_name = data.get("last_name")
    servicer = data.get("servicer")

    if not loan_number:
        return jsonify({"error": "loan_number is required"}), 400
    if not zip_code:
        return jsonify({"error": "zip_code is required"}), 400
    if not last_name:
        return jsonify({"error": "last_name is required"}), 400

    # Run async check
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = loop.run_until_complete(
            check_mci_payment(loan_number, zip_code, last_name, servicer=servicer)
        )
        return jsonify(asdict(result))
    except Exception as e:
        logger.error("Check failed", error=str(e))
        return jsonify({
            "success": False,
            "loan_number": loan_number,
            "error_message": str(e),
            "error_code": "INTERNAL_ERROR"
        }), 500
    finally:
        loop.close()


@app.route("/api/v1/balance", methods=["GET"])
def get_captcha_balance():
    """Get 2Captcha balance"""
    if not TWOCAPTCHA_API_KEY:
        return jsonify({"error": "2Captcha not configured"}), 400

    try:
        solver = TwoCaptcha(TWOCAPTCHA_API_KEY)
        balance = solver.balance()
        return jsonify({"balance": balance})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/screenshots/<filename>", methods=["GET"])
def serve_screenshot(filename):
    """Serve saved screenshots"""
    # Validate filename to prevent directory traversal
    if ".." in filename or "/" in filename:
        return jsonify({"error": "Invalid filename"}), 400

    screenshot_path = SCREENSHOTS_DIR / filename
    if not screenshot_path.exists():
        return jsonify({"error": "Screenshot not found"}), 404

    return send_from_directory(SCREENSHOTS_DIR, filename, mimetype="image/png")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
