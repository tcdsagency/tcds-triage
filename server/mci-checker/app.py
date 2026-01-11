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
import re
import time
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from dataclasses import dataclass, asdict
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
SCREENSHOTS_DIR = Path("/home/manus_temp/mci-checker/screenshots")
BASE_URL = os.environ.get("BASE_URL", "https://realtime.tcdsagency.com/mci")

# Ensure screenshots directory exists
SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)

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
    screenshot_url: Optional[str] = None
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


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=2, max=10))
async def check_mci_payment(
    loan_number: str,
    zip_code: str,
    last_name: Optional[str] = None,
    _ssn_last4: Optional[str] = None,  # Reserved for future use
    servicer: Optional[str] = None
) -> PaymentCheckResult:
    """
    Check payment status on MyCoverageInfo.com

    This performs the following steps:
    1. Navigate to MCI lookup page
    2. Enter loan number and ZIP code
    3. Solve CAPTCHA if present
    4. Extract payment status from results

    Note: _ssn_last4 is accepted but not currently used (reserved for future MCI lookup methods).
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

        # Navigate to MCI Agent Portal (only requires loan number, zip, last name)
        url = f"{MCI_BASE_URL}/agent"
        if servicer:
            url = f"{MCI_BASE_URL}/{servicer}"

        print(f"DEBUG: Navigating to MCI Agent Portal: {url}", flush=True)
        await page.goto(url, timeout=45000)

        # Wait for Angular app to bootstrap - look for any input field
        logger.info("Waiting for page to load...")
        await page.wait_for_load_state("networkidle", timeout=30000)

        # Give Angular extra time to render
        await page.wait_for_timeout(3000)

        # Debug: capture page structure and find all inputs
        inputs = await page.query_selector_all('input:not([type="hidden"])')
        print(f"DEBUG: Found {len(inputs)} visible input fields on page", flush=True)
        logger.warning(f"Found {len(inputs)} visible input fields on page")

        for i, inp in enumerate(inputs[:6]):  # Log first 6 inputs
            try:
                inp_id = await inp.get_attribute('id') or ''
                inp_name = await inp.get_attribute('name') or ''
                inp_placeholder = await inp.get_attribute('placeholder') or ''
                inp_type = await inp.get_attribute('type') or ''
                inp_formcontrol = await inp.get_attribute('formcontrolname') or ''
                logger.info(f"Input {i}: id={inp_id}, name={inp_name}, formcontrolname={inp_formcontrol}, placeholder={inp_placeholder}, type={inp_type}")
            except Exception as e:
                logger.warning(f"Could not inspect input {i}: {e}")

        # MCI Agent Portal has 3 fields: Loan Number, ZIP Code, Last Name
        # Fill by position since selectors may vary
        if len(inputs) >= 3:
            print(f"DEBUG: Filling Agent Portal form ({len(inputs)} inputs found)", flush=True)

            # First input: Loan Number
            try:
                print(f"DEBUG: Clicking input[0] for loan number...", flush=True)
                await inputs[0].click()
                await page.wait_for_timeout(100)
                await inputs[0].type(loan_number, delay=30)
                print(f"DEBUG: Typed loan number: {loan_number}", flush=True)
            except Exception as e:
                print(f"DEBUG: Failed to fill loan number: {e}", flush=True)

            # Second input: ZIP Code
            try:
                print(f"DEBUG: Clicking input[1] for ZIP...", flush=True)
                await inputs[1].click()
                await page.wait_for_timeout(100)
                await inputs[1].type(zip_code, delay=30)
                print(f"DEBUG: Typed ZIP code: {zip_code}", flush=True)
            except Exception as e:
                print(f"DEBUG: Failed to fill ZIP code: {e}", flush=True)

            # Third input: Last Name
            if last_name:
                try:
                    print(f"DEBUG: Clicking input[2] for last name...", flush=True)
                    await inputs[2].click()
                    await page.wait_for_timeout(100)
                    await inputs[2].type(last_name, delay=30)
                    print(f"DEBUG: Typed last name: {last_name}", flush=True)
                except Exception as e:
                    print(f"DEBUG: Failed to fill last name: {e}", flush=True)
            else:
                print("DEBUG: No last name provided - may fail validation", flush=True)

            # Wait a moment for Angular to process
            await page.wait_for_timeout(500)

        else:
            # Fallback: Try selector-based approach
            logger.info(f"Only found {len(inputs)} inputs, trying selector-based approach")

            # Try to find loan number input
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

            # Try to find ZIP input
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

        # Check for reCAPTCHA
        recaptcha_frame = await page.query_selector('iframe[src*="recaptcha"]')
        if recaptcha_frame:
            logger.info("reCAPTCHA detected, attempting to solve...")
            # Extract site key
            site_key = None
            recaptcha_div = await page.query_selector('.g-recaptcha, [data-sitekey]')
            if recaptcha_div:
                site_key = await recaptcha_div.get_attribute('data-sitekey')

            if site_key:
                captcha_response = await solve_captcha(page, site_key)
                if captcha_response:
                    # Inject the CAPTCHA response (properly escaped for JS)
                    escaped_response = json.dumps(captcha_response)
                    await page.evaluate(f'''
                        document.getElementById("g-recaptcha-response").innerHTML = {escaped_response};
                    ''')
                    logger.info("CAPTCHA response injected")

        # Submit the form - try multiple approaches
        print("DEBUG: Looking for submit button...", flush=True)
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
                    print(f"DEBUG: Found submit with: {selector}", flush=True)
                    await submit_btn.click()
                    print(f"DEBUG: Clicked submit!", flush=True)
                    submit_clicked = True
                    break
            except Exception as e:
                print(f"DEBUG: Selector {selector} failed: {e}", flush=True)
                continue

        if not submit_clicked:
            print("DEBUG: No submit button, pressing Enter...", flush=True)
            await page.keyboard.press('Enter')
            print("DEBUG: Pressed Enter", flush=True)

        # Wait for page response and check for CAPTCHA
        print("DEBUG: Waiting for response...", flush=True)
        await page.wait_for_timeout(3000)  # Wait for CAPTCHA or results to appear

        # Check for reCAPTCHA that appears after submit
        recaptcha_frame = await page.query_selector('iframe[src*="recaptcha"]')
        if recaptcha_frame:
            print("DEBUG: reCAPTCHA detected after submit, solving...", flush=True)

            # Extract site key from iframe src or page elements
            site_key = None

            # Try to get site key from iframe src
            frame_src = await recaptcha_frame.get_attribute('src')
            if frame_src and 'k=' in frame_src:
                match = re.search(r'k=([^&]+)', frame_src)
                if match:
                    site_key = match.group(1)
                    print(f"DEBUG: Got site key from iframe: {site_key[:20]}...", flush=True)

            # Fallback: try data-sitekey attribute
            if not site_key:
                recaptcha_div = await page.query_selector('.g-recaptcha, [data-sitekey]')
                if recaptcha_div:
                    site_key = await recaptcha_div.get_attribute('data-sitekey')
                    if site_key:
                        print(f"DEBUG: Got site key from div: {site_key[:20]}...", flush=True)

            print(f"DEBUG: Site key: {site_key}, 2Captcha configured: {bool(TWOCAPTCHA_API_KEY)}", flush=True)

            if site_key and TWOCAPTCHA_API_KEY:
                captcha_response = await solve_captcha(page, site_key)
                if captcha_response:
                    print("DEBUG: Got CAPTCHA solution, injecting...", flush=True)

                    # Save debug screenshot before injection
                    try:
                        debug_screenshot = SCREENSHOTS_DIR / f"debug-pre-inject-{uuid.uuid4()}.png"
                        await page.screenshot(path=str(debug_screenshot), full_page=True)
                        print(f"DEBUG: Pre-inject screenshot: {debug_screenshot}", flush=True)
                    except Exception as e:
                        print(f"DEBUG: Failed to save pre-inject screenshot: {e}", flush=True)

                    # Inject the CAPTCHA response - set value and make visible
                    # Properly escape for JavaScript to prevent injection
                    escaped_response = json.dumps(captcha_response)
                    await page.evaluate(f'''
                        var responseEl = document.getElementById("g-recaptcha-response");
                        var captchaVal = {escaped_response};
                        if (responseEl) {{
                            responseEl.innerHTML = captchaVal;
                            responseEl.value = captchaVal;
                            responseEl.style.display = "block";
                        }}
                        // Also try alternative response element names
                        var altResponse = document.querySelector('[name="g-recaptcha-response"]');
                        if (altResponse) {{
                            altResponse.value = captchaVal;
                        }}
                    ''')
                    print("DEBUG: CAPTCHA response injected into textarea", flush=True)
                    await page.wait_for_timeout(500)

                    # Try to trigger the callback function
                    print("DEBUG: Attempting to trigger CAPTCHA callback...", flush=True)
                    callback_triggered = await page.evaluate(f'''
                        (function() {{
                            var triggered = false;
                            var captchaVal = {escaped_response};
                            // Method 1: ___grecaptcha_cfg
                            if (typeof ___grecaptcha_cfg !== 'undefined' && ___grecaptcha_cfg.clients) {{
                                Object.keys(___grecaptcha_cfg.clients).forEach(key => {{
                                    var client = ___grecaptcha_cfg.clients[key];
                                    if (client && client.callback) {{
                                        try {{
                                            client.callback(captchaVal);
                                            triggered = true;
                                        }} catch(e) {{}}
                                    }}
                                    // Check nested structure
                                    for (var prop in client) {{
                                        if (client[prop] && typeof client[prop].callback === 'function') {{
                                            try {{
                                                client[prop].callback(captchaVal);
                                                triggered = true;
                                            }} catch(e) {{}}
                                        }}
                                    }}
                                }});
                            }}
                            // Method 2: Find callback in window.___grecaptcha_cfg
                            try {{
                                if (window.___grecaptcha_cfg && window.___grecaptcha_cfg.clients) {{
                                    for (var i in window.___grecaptcha_cfg.clients) {{
                                        var c = window.___grecaptcha_cfg.clients[i];
                                        for (var j in c) {{
                                            if (c[j] && c[j].callback) {{
                                                c[j].callback(captchaVal);
                                                triggered = true;
                                            }}
                                        }}
                                    }}
                                }}
                            }} catch(e) {{}}
                            // Method 3: Call grecaptcha.execute if available
                            if (typeof grecaptcha !== 'undefined' && grecaptcha.execute) {{
                                try {{
                                    grecaptcha.execute();
                                    triggered = true;
                                }} catch(e) {{}}
                            }}
                            return triggered;
                        }})()
                    ''')
                    print(f"DEBUG: Callback triggered: {callback_triggered}", flush=True)

                    await page.wait_for_timeout(2000)

                    # Save debug screenshot after injection
                    try:
                        debug_screenshot2 = SCREENSHOTS_DIR / f"debug-post-inject-{uuid.uuid4()}.png"
                        await page.screenshot(path=str(debug_screenshot2), full_page=True)
                        print(f"DEBUG: Post-inject screenshot: {debug_screenshot2}", flush=True)
                    except Exception as e:
                        print(f"DEBUG: Failed to save post-inject screenshot: {e}", flush=True)

                    # Try clicking submit again after CAPTCHA is solved
                    print("DEBUG: Looking for submit button after CAPTCHA...", flush=True)

                    # Try multiple selectors for submit button
                    post_captcha_selectors = [
                        'button:has-text("Search")',
                        'button[type="submit"]',
                        'input[type="submit"]',
                        'button.btn-primary',
                        'button:has-text("Submit")',
                    ]

                    submit_found = False
                    for selector in post_captcha_selectors:
                        try:
                            submit_btn = await page.query_selector(selector)
                            if submit_btn:
                                is_visible = await submit_btn.is_visible()
                                is_enabled = await submit_btn.is_enabled()
                                print(f"DEBUG: Found {selector} - visible: {is_visible}, enabled: {is_enabled}", flush=True)
                                if is_visible and is_enabled:
                                    await submit_btn.click()
                                    print(f"DEBUG: Clicked submit after CAPTCHA using: {selector}", flush=True)
                                    submit_found = True
                                    break
                        except Exception as e:
                            print(f"DEBUG: Selector {selector} error: {e}", flush=True)
                            continue

                    if not submit_found:
                        # Try pressing Enter as fallback
                        print("DEBUG: No submit found, trying Enter key...", flush=True)
                        await page.keyboard.press('Enter')

                    await page.wait_for_timeout(3000)
            else:
                print("DEBUG: No site key or 2Captcha not configured", flush=True)
        else:
            print("DEBUG: No reCAPTCHA detected", flush=True)

        # Wait for final results
        print("DEBUG: Waiting for results page to load...", flush=True)
        await page.wait_for_load_state("networkidle", timeout=60000)
        await page.wait_for_timeout(3000)  # Extra wait for Angular
        print("DEBUG: Results page loaded, taking screenshot...", flush=True)

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
    screenshot_url = None

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
        screenshot_url=screenshot_url,
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
    ssn_last4 = data.get("ssn_last4")
    servicer = data.get("servicer")

    if not loan_number:
        return jsonify({"error": "loan_number is required"}), 400
    if not zip_code:
        return jsonify({"error": "zip_code is required"}), 400

    # Run async check
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = loop.run_until_complete(
            check_mci_payment(loan_number, zip_code, last_name, _ssn_last4=ssn_last4, servicer=servicer)
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
