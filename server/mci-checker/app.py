"""
MCI (MyCoverageInfo) Payment Checker Microservice
==================================================
Automated lookup service for mortgagee payment status.

Endpoints:
- GET /health - Health check
- POST /api/v1/check - Check payment status for a loan

Environment Variables:
- TWOCAPTCHA_API_KEY - 2Captcha API key for CAPTCHA solving
- API_KEY - API key for authenticating requests
- PORT - Server port (default: 8080)
"""

import os
import time
import asyncio
import logging
from datetime import datetime, date
from typing import Optional
from dataclasses import dataclass, asdict

from flask import Flask, request, jsonify
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

# Browser instance (reused for efficiency)
browser: Optional[Browser] = None


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
    error_message: Optional[str] = None
    error_code: Optional[str] = None
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


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
async def check_mci_payment(
    loan_number: str,
    zip_code: str,
    last_name: Optional[str] = None
) -> PaymentCheckResult:
    """
    Check payment status on MyCoverageInfo.com

    This performs the following steps:
    1. Navigate to MCI lookup page
    2. Enter loan number and ZIP code
    3. Solve CAPTCHA if present
    4. Extract payment status from results
    """
    start_time = time.time()

    try:
        browser = await get_browser()
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        logger.info("Starting MCI lookup", loan_number=loan_number[:4] + "****")

        # Navigate to MCI
        await page.goto(f"{MCI_BASE_URL}/verify", timeout=30000)

        # Wait for form to load
        await page.wait_for_selector('input[name="loanNumber"], input[id="loanNumber"]', timeout=10000)

        # Fill in the form
        loan_input = await page.query_selector('input[name="loanNumber"], input[id="loanNumber"]')
        if loan_input:
            await loan_input.fill(loan_number)

        zip_input = await page.query_selector('input[name="zipCode"], input[id="zipCode"]')
        if zip_input:
            await zip_input.fill(zip_code)

        if last_name:
            name_input = await page.query_selector('input[name="lastName"], input[id="lastName"]')
            if name_input:
                await name_input.fill(last_name)

        # Check for reCAPTCHA
        recaptcha_frame = await page.query_selector('iframe[src*="recaptcha"]')
        if recaptcha_frame:
            # Extract site key
            site_key = None
            recaptcha_div = await page.query_selector('.g-recaptcha')
            if recaptcha_div:
                site_key = await recaptcha_div.get_attribute('data-sitekey')

            if site_key:
                captcha_response = await solve_captcha(page, site_key)
                if captcha_response:
                    # Inject the CAPTCHA response
                    await page.evaluate(f'''
                        document.getElementById("g-recaptcha-response").innerHTML = "{captcha_response}";
                    ''')

        # Submit the form
        submit_btn = await page.query_selector('button[type="submit"], input[type="submit"]')
        if submit_btn:
            await submit_btn.click()

        # Wait for results
        await page.wait_for_load_state("networkidle", timeout=30000)

        # Check for errors
        error_el = await page.query_selector('.error-message, .alert-danger, [class*="error"]')
        if error_el:
            error_text = await error_el.inner_text()
            if "not found" in error_text.lower() or "no record" in error_text.lower():
                return PaymentCheckResult(
                    success=False,
                    loan_number=loan_number,
                    error_message="Loan not found in MCI",
                    error_code="NOT_FOUND",
                    duration_ms=int((time.time() - start_time) * 1000)
                )

        # Extract payment status
        result = await extract_payment_data(page, loan_number, start_time)

        await context.close()
        return result

    except Exception as e:
        logger.error("MCI lookup failed", error=str(e), loan_number=loan_number[:4] + "****")
        return PaymentCheckResult(
            success=False,
            loan_number=loan_number,
            error_message=str(e),
            error_code="LOOKUP_ERROR",
            duration_ms=int((time.time() - start_time) * 1000)
        )


async def extract_payment_data(
    page: Page,
    loan_number: str,
    start_time: float
) -> PaymentCheckResult:
    """Extract payment data from MCI results page"""

    # Try to find payment status indicators
    payment_status = "unknown"
    paid_through = None
    next_due = None
    amount_due = None
    policy_number = None
    carrier = None
    effective = None
    expiration = None
    cancellation = None
    cancel_reason = None

    # Look for common status indicators
    page_text = await page.inner_text("body")
    page_lower = page_text.lower()

    if "current" in page_lower and "status" in page_lower:
        payment_status = "current"
    elif "past due" in page_lower or "late" in page_lower:
        payment_status = "late"
    elif "grace period" in page_lower:
        payment_status = "grace_period"
    elif "lapsed" in page_lower or "cancelled" in page_lower or "canceled" in page_lower:
        payment_status = "lapsed"

    # Try to extract dates and amounts
    # These selectors are examples - actual MCI page structure may differ
    try:
        # Paid through date
        paid_el = await page.query_selector('[class*="paid-through"], [data-field="paidThrough"]')
        if paid_el:
            paid_through = await paid_el.inner_text()

        # Next due date
        due_el = await page.query_selector('[class*="next-due"], [data-field="nextDue"]')
        if due_el:
            next_due = await due_el.inner_text()

        # Amount due
        amount_el = await page.query_selector('[class*="amount-due"], [data-field="amountDue"]')
        if amount_el:
            amount_text = await amount_el.inner_text()
            # Parse amount (remove $ and commas)
            amount_due = float(amount_text.replace("$", "").replace(",", "").strip())

        # Policy number
        policy_el = await page.query_selector('[class*="policy-number"], [data-field="policyNumber"]')
        if policy_el:
            policy_number = await policy_el.inner_text()

        # Carrier
        carrier_el = await page.query_selector('[class*="carrier"], [data-field="carrier"]')
        if carrier_el:
            carrier = await carrier_el.inner_text()

        # Effective date
        eff_el = await page.query_selector('[class*="effective"], [data-field="effectiveDate"]')
        if eff_el:
            effective = await eff_el.inner_text()

        # Expiration date
        exp_el = await page.query_selector('[class*="expiration"], [data-field="expirationDate"]')
        if exp_el:
            expiration = await exp_el.inner_text()

        # Cancellation info
        cancel_el = await page.query_selector('[class*="cancellation"], [data-field="cancellationDate"]')
        if cancel_el:
            cancellation = await cancel_el.inner_text()
            payment_status = "lapsed"

        reason_el = await page.query_selector('[class*="cancel-reason"], [data-field="cancelReason"]')
        if reason_el:
            cancel_reason = await reason_el.inner_text()

    except Exception as e:
        logger.warning("Error extracting some fields", error=str(e))

    return PaymentCheckResult(
        success=True,
        loan_number=loan_number,
        payment_status=payment_status,
        paid_through_date=paid_through,
        next_due_date=next_due,
        amount_due=amount_due,
        policy_number=policy_number,
        carrier=carrier,
        effective_date=effective,
        expiration_date=expiration,
        cancellation_date=cancellation,
        cancellation_reason=cancel_reason,
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
        "version": "1.0.0",
        "captcha_configured": bool(TWOCAPTCHA_API_KEY),
        "timestamp": datetime.utcnow().isoformat()
    })


@app.route("/api/v1/check", methods=["POST"])
def check_payment():
    """
    Check payment status for a loan

    Request body:
    {
        "loan_number": "123456789",
        "zip_code": "12345",
        "last_name": "Smith"  // optional
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

    if not loan_number:
        return jsonify({"error": "loan_number is required"}), 400
    if not zip_code:
        return jsonify({"error": "zip_code is required"}), 400

    # Run async check
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = loop.run_until_complete(
            check_mci_payment(loan_number, zip_code, last_name)
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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
