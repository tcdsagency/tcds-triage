#!/usr/bin/env python3
"""
AgencyZoom Browser Automation
=============================
Selenium-based automation for AgencyZoom operations that lack public API support.

Primary use case: Sending SMS messages through AgencyZoom's web UI.

Usage:
    python agencyzoom_automation.py stdin
    # Then pipe JSON commands via stdin

Commands:
    {"action": "login"}
    {"action": "send_sms", "phone_number": "+1234567890", "message": "Hello"}
    {"action": "check_session"}
"""

import os
import sys
import json
import time
import logging
from typing import Optional, Dict, Any
from datetime import datetime

# Selenium imports
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    NoSuchElementException,
    ElementClickInterceptedException,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

LOGIN_URL = "https://app.agencyzoom.com/login"
MESSAGES_URL = "https://app.agencyzoom.com/integration/messages/index"
COOKIE_FILE = "/tmp/agencyzoom_cookies.json"

# Timeouts
PAGE_LOAD_TIMEOUT = 30
ELEMENT_WAIT_TIMEOUT = 10
SMS_SEND_TIMEOUT = 120


# =============================================================================
# AGENCYZOOM AUTOMATION CLASS
# =============================================================================

class AgencyZoomAutomation:
    """Browser automation for AgencyZoom operations."""

    def __init__(self, username: str, password: str, headless: bool = True):
        self.username = username
        self.password = password
        self.headless = headless
        self.driver: Optional[webdriver.Chrome] = None

    def _init_driver(self) -> webdriver.Chrome:
        """Initialize Chrome WebDriver with appropriate options."""
        options = Options()

        if self.headless:
            options.add_argument("--headless=new")

        # Standard options for stability
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-blink-features=AutomationControlled")

        # Reduce detection
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        # User agent
        options.add_argument(
            "user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(PAGE_LOAD_TIMEOUT)

        # Remove webdriver property
        driver.execute_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )

        return driver

    def _ensure_driver(self):
        """Ensure driver is initialized."""
        if self.driver is None:
            self.driver = self._init_driver()

    def _save_cookies(self):
        """Save session cookies to file."""
        if self.driver is None:
            return

        cookies = self.driver.get_cookies()
        with open(COOKIE_FILE, 'w') as f:
            json.dump(cookies, f)
        logger.info(f"Saved {len(cookies)} cookies to {COOKIE_FILE}")

    def _load_cookies(self) -> bool:
        """Load session cookies from file."""
        if not os.path.exists(COOKIE_FILE):
            return False

        try:
            with open(COOKIE_FILE, 'r') as f:
                cookies = json.load(f)

            # Navigate to domain first (required for setting cookies)
            self.driver.get("https://app.agencyzoom.com")
            time.sleep(1)

            for cookie in cookies:
                # Remove problematic fields
                cookie.pop('sameSite', None)
                cookie.pop('expiry', None)
                try:
                    self.driver.add_cookie(cookie)
                except Exception as e:
                    logger.warning(f"Failed to add cookie: {e}")

            logger.info(f"Loaded {len(cookies)} cookies from {COOKIE_FILE}")
            return True
        except Exception as e:
            logger.error(f"Failed to load cookies: {e}")
            return False

    def _is_logged_in(self) -> bool:
        """Check if currently logged into AgencyZoom."""
        try:
            # Check for login form (means NOT logged in)
            login_form = self.driver.find_elements(By.NAME, "LoginForm[username]")
            if login_form:
                return False

            # Check for dashboard elements (means logged in)
            # Look for common logged-in indicators
            dashboard_indicators = [
                ".main-sidebar",
                ".user-menu",
                "#sidebar-menu",
                ".navbar-user",
            ]

            for selector in dashboard_indicators:
                try:
                    self.driver.find_element(By.CSS_SELECTOR, selector)
                    return True
                except NoSuchElementException:
                    continue

            # Check URL - if not on login page, probably logged in
            current_url = self.driver.current_url
            if "/login" not in current_url and "agencyzoom.com" in current_url:
                return True

            return False
        except Exception as e:
            logger.error(f"Error checking login status: {e}")
            return False

    def login(self, force: bool = False) -> Dict[str, Any]:
        """
        Login to AgencyZoom.

        Args:
            force: Force fresh login even if cookies exist

        Returns:
            {"success": True} or {"success": False, "error": "message"}
        """
        self._ensure_driver()

        # Try loading existing session
        if not force and self._load_cookies():
            self.driver.get(MESSAGES_URL)
            time.sleep(3)

            if self._is_logged_in():
                logger.info("Restored session from cookies")
                return {"success": True, "method": "cookies"}

        # Fresh login required
        logger.info("Performing fresh login...")

        try:
            # Clear any stale cookies
            if os.path.exists(COOKIE_FILE):
                os.remove(COOKIE_FILE)

            # Navigate to login page
            self.driver.get(LOGIN_URL)
            time.sleep(2)

            # Wait for login form
            wait = WebDriverWait(self.driver, ELEMENT_WAIT_TIMEOUT)

            # Fill email
            email_field = wait.until(
                EC.presence_of_element_located((By.NAME, "LoginForm[username]"))
            )
            email_field.clear()
            email_field.send_keys(self.username)

            # Fill password
            password_field = self.driver.find_element(By.NAME, "LoginForm[password]")
            password_field.clear()
            password_field.send_keys(self.password)

            # Submit form
            password_field.submit()

            # Wait for redirect (indicates successful login)
            time.sleep(5)

            # Verify login success
            if self._is_logged_in():
                self._save_cookies()
                logger.info("Login successful")
                return {"success": True, "method": "fresh_login"}
            else:
                # Check for error messages
                error_msgs = self.driver.find_elements(By.CSS_SELECTOR, ".alert-danger, .error-message")
                error_text = error_msgs[0].text if error_msgs else "Unknown login failure"
                logger.error(f"Login failed: {error_text}")
                return {"success": False, "error": error_text}

        except TimeoutException:
            return {"success": False, "error": "Login page timeout"}
        except Exception as e:
            logger.exception("Login error")
            return {"success": False, "error": str(e)}

    def send_sms(
        self,
        phone_number: str,
        message: str,
        customer_id: Optional[str] = None,
        customer_type: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send SMS through AgencyZoom's web interface.

        Args:
            phone_number: Recipient phone number
            message: SMS message body
            customer_id: Optional AgencyZoom contact ID
            customer_type: Optional 'customer' or 'lead'

        Returns:
            {"success": True} or {"success": False, "error": "message"}
        """
        self._ensure_driver()

        # Ensure logged in
        login_result = self.login()
        if not login_result.get("success"):
            return {"success": False, "error": f"Login failed: {login_result.get('error')}"}

        try:
            # Navigate to Messages page
            logger.info("Navigating to Messages page...")
            self.driver.get(MESSAGES_URL)
            time.sleep(4)

            wait = WebDriverWait(self.driver, ELEMENT_WAIT_TIMEOUT)

            # Step 1: Click "Add" button
            logger.info("Clicking Add button...")
            self.driver.execute_script("""
                const addButton = Array.from(document.querySelectorAll('button'))
                    .find(btn => btn.textContent.trim() === 'Add');
                if (addButton) {
                    addButton.click();
                    return true;
                }
                return false;
            """)
            time.sleep(1)

            # Step 2: Click "Send a Text" link
            logger.info("Clicking 'Send a Text'...")
            self.driver.execute_script("""
                const sendTextLink = Array.from(document.querySelectorAll('a'))
                    .find(a => a.textContent.includes('Send a Text'));
                if (sendTextLink) {
                    sendTextLink.click();
                    return true;
                }
                return false;
            """)
            time.sleep(2)

            # Step 3: Enter phone number in tagify input
            logger.info(f"Entering phone number: {phone_number}")

            # Normalize phone number (remove non-digits except leading +)
            normalized_phone = phone_number.lstrip('+')
            if not normalized_phone.startswith('1') and len(normalized_phone) == 10:
                normalized_phone = '1' + normalized_phone

            # Find and interact with tagify input
            try:
                tags_input = wait.until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, ".tagify__input"))
                )
                tags_input.click()
                time.sleep(0.5)
                tags_input.send_keys(normalized_phone)
                time.sleep(1)
                tags_input.send_keys(Keys.ENTER)
                time.sleep(1)
            except Exception as e:
                logger.warning(f"Tagify input failed, trying alternate method: {e}")
                # Try direct input field
                self.driver.execute_script(f"""
                    const input = document.querySelector('input[name="recipients"]')
                        || document.querySelector('.tagify input');
                    if (input) {{
                        input.value = '{normalized_phone}';
                        input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    }}
                """)

            # Step 4: Enter message
            logger.info("Entering message...")
            escaped_message = message.replace("'", "\\'").replace("\n", "\\n")

            self.driver.execute_script(f"""
                const textarea = document.getElementById('textMessage')
                    || document.querySelector('textarea[name="message"]');
                if (textarea) {{
                    textarea.value = '{escaped_message}';
                    textarea.focus();
                    textarea.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    textarea.dispatchEvent(new Event('change', {{ bubbles: true }}));
                }}
            """)
            time.sleep(1)

            # Step 5: Click Send button
            logger.info("Clicking Send...")
            send_clicked = self.driver.execute_script("""
                const sendBtn = document.getElementById('send-text-btn')
                    || document.querySelector('button[type="submit"]')
                    || Array.from(document.querySelectorAll('button'))
                        .find(btn => btn.textContent.toLowerCase().includes('send'));
                if (sendBtn) {
                    sendBtn.click();
                    return true;
                }
                return false;
            """)

            if not send_clicked:
                return {"success": False, "error": "Could not find Send button"}

            # Wait for send to complete
            time.sleep(3)

            # Check for success indicators
            # Look for success toast/message or modal close
            success_indicators = [
                ".alert-success",
                ".toast-success",
                ".notification-success",
            ]

            for selector in success_indicators:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    logger.info("SMS sent successfully (success indicator found)")
                    return {"success": True}

            # Check for error indicators
            error_indicators = [
                ".alert-danger",
                ".toast-error",
                ".error-message",
            ]

            for selector in error_indicators:
                elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements and elements[0].is_displayed():
                    error_text = elements[0].text
                    logger.error(f"SMS send error: {error_text}")
                    return {"success": False, "error": error_text}

            # No clear indicator - assume success if no error
            logger.info("SMS send completed (no error detected)")
            return {"success": True}

        except TimeoutException as e:
            return {"success": False, "error": f"Timeout: {str(e)}"}
        except Exception as e:
            logger.exception("SMS send error")
            return {"success": False, "error": str(e)}

    def check_session(self) -> Dict[str, Any]:
        """Check if current session is valid."""
        self._ensure_driver()

        if self._load_cookies():
            self.driver.get(MESSAGES_URL)
            time.sleep(2)

            if self._is_logged_in():
                return {"success": True, "logged_in": True}

        return {"success": True, "logged_in": False}

    def get_cookies(self) -> Dict[str, Any]:
        """Get current session cookies for external use."""
        self._ensure_driver()

        login_result = self.login()
        if not login_result.get("success"):
            return {"success": False, "error": login_result.get("error")}

        cookies = self.driver.get_cookies()
        return {
            "success": True,
            "cookies": cookies,
        }

    def close(self):
        """Close the browser."""
        if self.driver:
            try:
                self.driver.quit()
            except Exception:
                pass
            self.driver = None


# =============================================================================
# CLI INTERFACE
# =============================================================================

def process_command(automation: AgencyZoomAutomation, command: Dict[str, Any]) -> Dict[str, Any]:
    """Process a single command."""
    action = command.get("action")

    if action == "login":
        return automation.login(force=command.get("force", False))

    elif action == "send_sms":
        phone = command.get("phone_number") or command.get("recipient_name")
        message = command.get("message")

        if not phone or not message:
            return {"success": False, "error": "phone_number and message are required"}

        return automation.send_sms(
            phone_number=phone,
            message=message,
            customer_id=command.get("customer_id"),
            customer_type=command.get("customer_type"),
        )

    elif action == "check_session":
        return automation.check_session()

    elif action == "get_cookies":
        return automation.get_cookies()

    else:
        return {"success": False, "error": f"Unknown action: {action}"}


def main():
    """Main entry point."""
    # Get credentials from environment
    username = os.environ.get("AGENCYZOOM_API_USERNAME") or os.environ.get("AGENCYZOOM_USERNAME")
    password = os.environ.get("AGENCYZOOM_API_PASSWORD") or os.environ.get("AGENCYZOOM_PASSWORD")

    if not username or not password:
        print(json.dumps({"success": False, "error": "AGENCYZOOM credentials not set"}))
        sys.exit(1)

    headless = os.environ.get("HEADLESS", "true").lower() == "true"
    automation = AgencyZoomAutomation(username, password, headless=headless)

    try:
        if len(sys.argv) > 1 and sys.argv[1] == "stdin":
            # Read commands from stdin (for Node.js integration)
            input_data = sys.stdin.read()
            try:
                command = json.loads(input_data)
                result = process_command(automation, command)
                print(json.dumps(result))
            except json.JSONDecodeError as e:
                print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))

        elif len(sys.argv) > 1:
            # Direct command from args
            command = {"action": sys.argv[1]}
            if len(sys.argv) > 2:
                command.update(json.loads(sys.argv[2]))

            result = process_command(automation, command)
            print(json.dumps(result))

        else:
            # Interactive mode - read line by line
            print("AgencyZoom Automation ready. Enter JSON commands:")
            for line in sys.stdin:
                line = line.strip()
                if not line:
                    continue
                if line.lower() == "quit":
                    break

                try:
                    command = json.loads(line)
                    result = process_command(automation, command)
                    print(json.dumps(result))
                    sys.stdout.flush()
                except json.JSONDecodeError as e:
                    print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
                    sys.stdout.flush()

    finally:
        automation.close()


if __name__ == "__main__":
    main()
