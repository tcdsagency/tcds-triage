#!/usr/bin/env python3
"""
AgencyZoom SMS History Scraper
==============================
Extracts SMS threads and messages via Selenium browser automation.
Run on GCP VM where browser automation is not blocked.

Usage:
  python3 sms_history_scraper.py [--months=6] [--output=sms_history.json]
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime, timedelta
from typing import Optional

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException


# =============================================================================
# CONFIGURATION
# =============================================================================

LOGIN_URL = "https://app.agencyzoom.com/login"
MESSAGES_URL = "https://app.agencyzoom.com/integration/messages/index"
SMS_INBOX_URL = "https://app.agencyzoom.com/integration/messages/sms"

USERNAME = os.environ.get("AGENCYZOOM_API_USERNAME", "service@tcdsagency.com")
PASSWORD = os.environ.get("AGENCYZOOM_API_PASSWORD", "Welcome2023!")

HEADLESS = os.environ.get("HEADLESS", "true").lower() == "true"


# =============================================================================
# BROWSER SETUP
# =============================================================================

def create_driver() -> webdriver.Chrome:
    """Create a Chrome WebDriver instance."""
    options = Options()

    if HEADLESS:
        options.add_argument("--headless=new")

    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    service = Service()
    driver = webdriver.Chrome(service=service, options=options)

    # Remove webdriver flag
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    })

    return driver


# =============================================================================
# LOGIN
# =============================================================================

def login(driver: webdriver.Chrome) -> bool:
    """Log in to AgencyZoom."""
    print(f"[Login] Navigating to {LOGIN_URL}")
    driver.get(LOGIN_URL)
    time.sleep(2)

    try:
        # Wait for login form
        email_input = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='email'], input[name='email'], input[id='email']"))
        )

        # Find password field
        password_input = driver.find_element(By.CSS_SELECTOR, "input[type='password']")

        # Clear and enter credentials
        email_input.clear()
        email_input.send_keys(USERNAME)
        time.sleep(0.5)

        password_input.clear()
        password_input.send_keys(PASSWORD)
        time.sleep(0.5)

        # Find and click login button
        login_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit'], .login-button, button.btn-primary")
        login_button.click()

        print("[Login] Submitted credentials, waiting for redirect...")
        time.sleep(5)

        # Check if login succeeded
        current_url = driver.current_url
        if "/login" not in current_url and "agencyzoom.com" in current_url:
            print("[Login] Login successful!")
            return True
        else:
            print(f"[Login] Still on login page: {current_url}")
            return False

    except Exception as e:
        print(f"[Login] Error: {e}")
        return False


# =============================================================================
# SMS SCRAPING
# =============================================================================

def get_sms_threads(driver: webdriver.Chrome, cutoff_date: datetime) -> list:
    """
    Navigate to SMS inbox and extract all threads.
    Returns list of thread dicts with contact info.
    """
    threads = []

    print(f"[Threads] Navigating to SMS inbox...")
    driver.get(SMS_INBOX_URL)
    time.sleep(3)

    try:
        # Wait for conversation list to load
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".conversation-list, .sms-threads, .message-list, [class*='conversation'], [class*='thread']"))
        )

        # Scroll to load more threads
        scroll_count = 0
        max_scrolls = 50  # Load up to ~500 threads
        last_count = 0

        while scroll_count < max_scrolls:
            # Find thread elements
            thread_elements = driver.find_elements(By.CSS_SELECTOR,
                ".conversation-item, .sms-thread, .thread-item, [class*='conversation-row'], [class*='thread-row']"
            )

            if len(thread_elements) == last_count:
                # No new threads loaded
                break

            last_count = len(thread_elements)

            # Scroll down
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(1)
            scroll_count += 1

        print(f"[Threads] Found {len(thread_elements)} thread elements")

        # Extract thread data
        for elem in thread_elements:
            try:
                thread_data = extract_thread_data(elem)
                if thread_data:
                    # Check if thread is within date range
                    if thread_data.get("last_message_date"):
                        msg_date = datetime.fromisoformat(thread_data["last_message_date"].replace("Z", "+00:00"))
                        if msg_date.replace(tzinfo=None) < cutoff_date:
                            continue
                    threads.append(thread_data)
            except Exception as e:
                print(f"[Threads] Error extracting thread: {e}")
                continue

    except TimeoutException:
        print("[Threads] Timeout waiting for conversation list")
    except Exception as e:
        print(f"[Threads] Error: {e}")

    print(f"[Threads] Extracted {len(threads)} threads within date range")
    return threads


def extract_thread_data(elem) -> Optional[dict]:
    """Extract data from a thread element."""
    try:
        # Try to get contact name
        name_elem = elem.find_element(By.CSS_SELECTOR, ".contact-name, .name, [class*='contact'], h3, h4, .title")
        contact_name = name_elem.text.strip()

        # Try to get phone number
        try:
            phone_elem = elem.find_element(By.CSS_SELECTOR, ".phone, .phone-number, [class*='phone']")
            phone = phone_elem.text.strip()
        except NoSuchElementException:
            phone = ""

        # Try to get last message date
        try:
            date_elem = elem.find_element(By.CSS_SELECTOR, ".date, .time, .timestamp, [class*='date'], [class*='time']")
            last_date = date_elem.text.strip()
        except NoSuchElementException:
            last_date = ""

        # Try to get thread ID from data attribute or href
        thread_id = elem.get_attribute("data-id") or elem.get_attribute("data-thread-id") or ""
        if not thread_id:
            try:
                link = elem.find_element(By.TAG_NAME, "a")
                href = link.get_attribute("href") or ""
                if "/thread/" in href or "/conversation/" in href:
                    thread_id = href.split("/")[-1]
            except:
                pass

        return {
            "id": thread_id,
            "contact_name": contact_name,
            "phone": phone,
            "last_message_date": last_date,
        }

    except NoSuchElementException:
        return None


def get_thread_messages(driver: webdriver.Chrome, thread_id: str, cutoff_date: datetime) -> list:
    """
    Open a thread and extract all messages.
    """
    messages = []

    if not thread_id:
        return messages

    # Navigate to thread
    thread_url = f"{SMS_INBOX_URL}/{thread_id}"
    driver.get(thread_url)
    time.sleep(2)

    try:
        # Wait for messages to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".message, .sms-message, [class*='message-bubble'], [class*='chat-message']"))
        )

        # Find all message elements
        message_elements = driver.find_elements(By.CSS_SELECTOR,
            ".message, .sms-message, [class*='message-item'], [class*='chat-bubble']"
        )

        for elem in message_elements:
            try:
                msg_data = extract_message_data(elem)
                if msg_data:
                    # Check date
                    if msg_data.get("date"):
                        try:
                            msg_date = datetime.fromisoformat(msg_data["date"].replace("Z", "+00:00"))
                            if msg_date.replace(tzinfo=None) < cutoff_date:
                                continue
                        except:
                            pass
                    messages.append(msg_data)
            except Exception as e:
                print(f"[Messages] Error extracting message: {e}")
                continue

    except TimeoutException:
        print(f"[Messages] Timeout loading thread {thread_id}")
    except Exception as e:
        print(f"[Messages] Error: {e}")

    return messages


def extract_message_data(elem) -> Optional[dict]:
    """Extract data from a message element."""
    try:
        # Get message body
        body_elem = elem.find_element(By.CSS_SELECTOR, ".message-body, .body, .text, p, [class*='content']")
        body = body_elem.text.strip()

        if not body:
            return None

        # Determine direction (incoming/outgoing)
        classes = elem.get_attribute("class") or ""
        direction = "outgoing" if any(x in classes.lower() for x in ["outgoing", "sent", "outbound", "right"]) else "incoming"

        # Get timestamp
        try:
            time_elem = elem.find_element(By.CSS_SELECTOR, ".time, .timestamp, .date, [class*='time']")
            msg_date = time_elem.text.strip()
        except NoSuchElementException:
            msg_date = ""

        # Get message ID
        msg_id = elem.get_attribute("data-id") or elem.get_attribute("data-message-id") or ""

        return {
            "id": msg_id,
            "body": body,
            "direction": direction,
            "date": msg_date,
        }

    except NoSuchElementException:
        return None


# =============================================================================
# MAIN
# =============================================================================

def scrape_sms_history(months: int = 6) -> dict:
    """
    Main function to scrape SMS history.
    Returns dict with threads and their messages.
    """
    cutoff_date = datetime.now() - timedelta(days=months * 30)
    print(f"[Scraper] Scraping SMS history since {cutoff_date.isoformat()}")

    driver = None
    result = {
        "success": False,
        "scrape_date": datetime.now().isoformat(),
        "months": months,
        "cutoff_date": cutoff_date.isoformat(),
        "threads": [],
        "total_messages": 0,
        "error": None,
    }

    try:
        driver = create_driver()

        # Login
        if not login(driver):
            result["error"] = "Login failed"
            return result

        # Get threads
        threads = get_sms_threads(driver, cutoff_date)

        # Get messages for each thread
        for i, thread in enumerate(threads):
            print(f"[Scraper] Processing thread {i+1}/{len(threads)}: {thread.get('contact_name', 'Unknown')}")

            messages = get_thread_messages(driver, thread.get("id", ""), cutoff_date)
            thread["messages"] = messages
            result["total_messages"] += len(messages)

            # Rate limiting
            time.sleep(0.5)

        result["threads"] = threads
        result["success"] = True
        print(f"[Scraper] Complete. {len(threads)} threads, {result['total_messages']} messages")

    except Exception as e:
        result["error"] = str(e)
        print(f"[Scraper] Error: {e}")

    finally:
        if driver:
            driver.quit()

    return result


def main():
    parser = argparse.ArgumentParser(description="Scrape AgencyZoom SMS history")
    parser.add_argument("--months", type=int, default=6, help="Number of months to scrape")
    parser.add_argument("--output", type=str, default="sms_history.json", help="Output file")
    args = parser.parse_args()

    result = scrape_sms_history(months=args.months)

    # Write to file
    with open(args.output, "w") as f:
        json.dump(result, f, indent=2)

    print(f"[Scraper] Output written to {args.output}")

    if result["success"]:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
