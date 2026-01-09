"""
MyCoverageInfo Scraper Service.
Handles the actual scraping of payment information using HTML parsing.
"""

import re
import time
import asyncio
from typing import Optional
from dataclasses import dataclass, field
from datetime import date
import structlog

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException

from app.services.browser import browser_pool
from app.services.captcha import captcha_solver
from app.config import settings

logger = structlog.get_logger()


@dataclass
class MCIResult:
    """Result from MyCoverageInfo scraping."""
    success: bool = False

    # Payment info (CRITICAL)
    payment_status: Optional[str] = None  # Paid, Unpaid, Pending
    last_payment_amount: Optional[float] = None
    last_payment_date: Optional[str] = None  # MM/DD/YYYY format

    # Policy info
    homeowner: Optional[str] = None
    additional_homeowner: Optional[str] = None
    property_address: Optional[str] = None
    loan_number: Optional[str] = None
    policy_type: Optional[str] = None
    policy_status: Optional[str] = None
    policy_number: Optional[str] = None
    insurance_company: Optional[str] = None

    # Dates
    effective_date: Optional[str] = None  # MM/DD/YYYY
    expiration_date: Optional[str] = None  # MM/DD/YYYY

    # Financial
    premium: Optional[float] = None
    coverage_amount: Optional[float] = None
    deductible: Optional[float] = None

    # Mortgagee
    mortgagee_clause: Optional[str] = None

    # Error info
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    # Screenshot for audit trail
    screenshot_base64: Optional[str] = None

    # Performance
    duration_ms: int = 0


class MCIScraperService:
    """Scrapes MyCoverageInfo.com for payment status using HTML parsing."""

    MCI_URL = "https://www.mycoverageinfo.com/agent"
    RESULTS_URL_PATTERN = "/policy-manager/policy-info"

    def __init__(self):
        self.browser_pool = browser_pool
        self.captcha_solver = captcha_solver

    async def check_payment(
        self,
        loan_number: str,
        zip_code: str,
        last_name: Optional[str] = None,
    ) -> MCIResult:
        """
        Check payment status for a mortgage on MyCoverageInfo.

        Args:
            loan_number: The mortgage loan number
            zip_code: Property ZIP code
            last_name: Borrower's last name (may help with lookup)

        Returns:
            MCIResult with payment status and policy details
        """
        start_time = time.time()
        result = MCIResult()
        driver = None

        try:
            # Acquire browser from pool
            driver = await self.browser_pool.acquire(timeout=30)
            if not driver:
                result.error_code = "NO_BROWSER"
                result.error_message = "No browser instance available"
                return result

            # Navigate to MCI
            logger.info("Navigating to MyCoverageInfo", url=self.MCI_URL)
            driver.get(self.MCI_URL)
            await asyncio.sleep(2)  # Wait for page load

            # Fill search form
            await self._fill_search_form(driver, loan_number, zip_code, last_name)

            # Handle CAPTCHA if present
            if await self._detect_captcha(driver):
                logger.info("CAPTCHA detected, solving...")
                solved = await self._solve_captcha(driver)
                if not solved:
                    result.error_code = "CAPTCHA_FAILED"
                    result.error_message = "Failed to solve CAPTCHA"
                    return result
                logger.info("CAPTCHA solved successfully")

            # Submit search
            await self._submit_search(driver)

            # Wait for results page
            try:
                WebDriverWait(driver, 15).until(
                    EC.url_contains(self.RESULTS_URL_PATTERN)
                )
            except TimeoutException:
                # Check for "not found" message
                page_text = driver.find_element(By.TAG_NAME, "body").text
                if "not found" in page_text.lower() or "no results" in page_text.lower():
                    result.error_code = "NOT_FOUND"
                    result.error_message = "Policy not found on MyCoverageInfo"
                    return result

                result.error_code = "TIMEOUT"
                result.error_message = "Timeout waiting for results page"
                return result

            # Handle "Important Message" modal if present
            await self._handle_modal(driver)

            # Extract data from results page
            page_text = driver.find_element(By.TAG_NAME, "body").text
            await self._parse_results(result, page_text)

            # Take screenshot for audit trail
            try:
                result.screenshot_base64 = driver.get_screenshot_as_base64()
            except Exception as e:
                logger.warning("Failed to take screenshot", error=str(e))

            result.success = True
            logger.info(
                "Payment check completed",
                payment_status=result.payment_status,
                policy_number=result.policy_number,
            )

        except TimeoutException:
            result.error_code = "TIMEOUT"
            result.error_message = "Page load timeout"
            logger.error("Scraping timeout", error=result.error_message)

        except Exception as e:
            result.error_code = "SCRAPE_ERROR"
            result.error_message = str(e)
            logger.error("Scraping error", error=str(e))

        finally:
            result.duration_ms = int((time.time() - start_time) * 1000)
            if driver:
                await self.browser_pool.release(driver)

        return result

    async def _fill_search_form(
        self,
        driver,
        loan_number: str,
        zip_code: str,
        last_name: Optional[str]
    ):
        """Fill in the MCI search form."""
        logger.debug("Filling search form", loan_number=loan_number[:4] + "****")

        # Wait for form to be ready
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "loanInput"))
        )

        # Clear and fill loan number
        loan_input = driver.find_element(By.ID, "loanInput")
        loan_input.clear()
        loan_input.send_keys(loan_number)

        # Clear and fill ZIP code
        zip_input = driver.find_element(By.ID, "zipInput")
        zip_input.clear()
        zip_input.send_keys(zip_code)

        # Fill last name if provided
        if last_name:
            try:
                last_name_input = driver.find_element(By.ID, "lastNameInput")
                last_name_input.clear()
                last_name_input.send_keys(last_name)
            except NoSuchElementException:
                logger.debug("Last name field not found")

    async def _detect_captcha(self, driver) -> bool:
        """Check if CAPTCHA is present on page."""
        try:
            driver.find_element(
                By.CSS_SELECTOR,
                ".g-recaptcha, [data-sitekey], iframe[src*='recaptcha']"
            )
            return True
        except NoSuchElementException:
            return False

    async def _solve_captcha(self, driver) -> bool:
        """Solve reCAPTCHA using 2Captcha service."""
        try:
            # Find site key
            recaptcha_elem = driver.find_element(By.CLASS_NAME, "g-recaptcha")
            site_key = recaptcha_elem.get_attribute("data-sitekey")

            if not site_key:
                logger.error("Could not find reCAPTCHA site key")
                return False

            # Solve via 2Captcha
            solution = await self.captcha_solver.solve_recaptcha(
                site_key=site_key,
                page_url=driver.current_url,
                timeout=settings.captcha_timeout_seconds,
            )

            if not solution:
                return False

            # Inject solution into page
            driver.execute_script(
                f"document.getElementById('g-recaptcha-response').innerHTML='{solution}';"
            )
            driver.execute_script(
                "document.getElementById('g-recaptcha-response').style.display='block';"
            )

            return True

        except Exception as e:
            logger.error("Error solving CAPTCHA", error=str(e))
            return False

    async def _submit_search(self, driver):
        """Submit the search form."""
        try:
            search_button = driver.find_element(
                By.XPATH, '//button[text()="Search"]'
            )
            search_button.click()
            await asyncio.sleep(1)  # Brief wait after click
        except NoSuchElementException:
            # Try alternative button selectors
            try:
                search_button = driver.find_element(
                    By.CSS_SELECTOR, 'button[type="submit"]'
                )
                search_button.click()
            except NoSuchElementException:
                logger.warning("Search button not found, trying form submit")
                driver.find_element(By.TAG_NAME, "form").submit()

    async def _handle_modal(self, driver):
        """Handle any "Important Message" modal that appears."""
        try:
            continue_button = WebDriverWait(driver, 5).until(
                EC.element_to_be_clickable((By.XPATH, '//button[text()="Continue"]'))
            )
            continue_button.click()
            await asyncio.sleep(2)
            logger.debug("Dismissed modal dialog")
        except TimeoutException:
            pass  # Modal not present, continue normally

    async def _parse_results(self, result: MCIResult, page_text: str):
        """Parse data from the results page using regex."""
        logger.debug("Parsing results page")

        # Homeowner info
        result.homeowner = self._extract_regex(
            page_text, r"Homeowner:\s*(.+?)(?:\n|$)"
        )
        result.additional_homeowner = self._extract_regex(
            page_text, r"Additional Homeowner:\s*(.+?)(?:\n|$)"
        )
        result.property_address = self._extract_regex(
            page_text, r"Property Address:\s*(.+?)(?:\n|$)"
        )

        # Loan and policy info
        result.loan_number = self._extract_regex(
            page_text, r"Loan Number\s*:\s*(.+?)(?:\n|$)"
        )
        result.policy_type = self._extract_regex(
            page_text, r"(HOMEOWNERS|AUTO|UMBRELLA|DWELLING|FLOOD)"
        )
        result.policy_status = self._extract_regex(
            page_text, r"(Policy Active|Policy Inactive|Policy Cancelled)"
        )
        result.policy_number = self._extract_regex(
            page_text, r"Policy Number:\s*(.+?)(?:\n|$)"
        )
        result.insurance_company = self._extract_regex(
            page_text, r"Insurance Company:\s*(.+?)(?:\n|$)"
        )

        # Dates
        result.effective_date = self._extract_regex(
            page_text, r"Effective Date\s+.*?\s+(\d{2}/\d{2}/\d{4})"
        )
        result.expiration_date = self._extract_regex(
            page_text, r"Expiration Date\s+.*?\s+(\d{2}/\d{2}/\d{4})"
        )

        # Financial - parse dollar amounts
        premium_str = self._extract_regex(
            page_text, r"Premium\s+.*?\s+\$?([\d,]+\.\d{2})"
        )
        if premium_str:
            result.premium = self._parse_currency(premium_str)

        coverage_str = self._extract_regex(
            page_text, r"Coverage Amount\s+.*?\s+\$?([\d,]+\.\d{2})"
        )
        if coverage_str:
            result.coverage_amount = self._parse_currency(coverage_str)

        deductible_str = self._extract_regex(
            page_text, r"Deductible\s+.*?\s+\$?([\d,]+\.\d{2})"
        )
        if deductible_str:
            result.deductible = self._parse_currency(deductible_str)

        # CRITICAL: Payment status
        result.payment_status = self._extract_regex(
            page_text, r"(?:Payment Status|Status).*?(Paid|Unpaid|Pending|Past Due)"
        )
        if not result.payment_status:
            # Try alternate patterns
            if "Paid" in page_text:
                result.payment_status = "Paid"
            elif "Unpaid" in page_text or "Past Due" in page_text:
                result.payment_status = "Unpaid"
            elif "Pending" in page_text:
                result.payment_status = "Pending"

        # Last payment info
        last_payment_str = self._extract_regex(
            page_text, r"\$([\d,]+\.\d{2})\s+on\s+(\d{2}/\d{2}/\d{4})"
        )
        if last_payment_str:
            # The regex returns a tuple if there are groups
            match = re.search(r"\$([\d,]+\.\d{2})\s+on\s+(\d{2}/\d{2}/\d{4})", page_text)
            if match:
                result.last_payment_amount = self._parse_currency(match.group(1))
                result.last_payment_date = match.group(2)

        # Mortgagee clause
        result.mortgagee_clause = self._extract_mortgagee_clause(page_text)

    def _extract_regex(self, text: str, pattern: str) -> Optional[str]:
        """Extract data using regex pattern."""
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = match.group(1).strip()
            # Clean up common issues
            value = re.sub(r"\s+", " ", value)  # Normalize whitespace
            return value
        return None

    def _parse_currency(self, value: str) -> float:
        """Parse currency string to float."""
        try:
            # Remove commas and dollar signs
            cleaned = value.replace(",", "").replace("$", "")
            return float(cleaned)
        except (ValueError, AttributeError):
            return 0.0

    def _extract_mortgagee_clause(self, text: str) -> Optional[str]:
        """Extract mortgagee clause information."""
        match = re.search(
            r"Mortgagee Clause:(.+?)(?=Submit|Add/Update|$)",
            text,
            re.DOTALL | re.IGNORECASE
        )
        if match:
            clause = match.group(1).strip()
            # Clean up extra whitespace but preserve line breaks
            clause = re.sub(r"[ \t]+", " ", clause)
            clause = re.sub(r"\n\s*\n", "\n", clause)
            return clause
        return None


# Global scraper instance
mci_scraper = MCIScraperService()
