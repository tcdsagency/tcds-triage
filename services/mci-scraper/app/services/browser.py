"""
Browser pool management for MCI Scraper.
Uses undetected-chromedriver to avoid bot detection.
"""

import asyncio
from typing import Optional
import structlog
import undetected_chromedriver as uc
from selenium.webdriver.chrome.options import Options

from app.config import settings

logger = structlog.get_logger()


class BrowserPool:
    """Manages a pool of browser instances for parallel scraping."""

    def __init__(self, max_size: int = 3):
        self.max_size = max_size
        self._pool: list[uc.Chrome] = []
        self._available: asyncio.Queue[uc.Chrome] = asyncio.Queue()
        self._lock = asyncio.Lock()
        self._initialized = False

    async def initialize(self):
        """Initialize the browser pool."""
        if self._initialized:
            return

        async with self._lock:
            if self._initialized:
                return

            logger.info("Initializing browser pool", size=self.max_size)

            for i in range(self.max_size):
                try:
                    driver = self._create_driver()
                    self._pool.append(driver)
                    await self._available.put(driver)
                    logger.info(f"Created browser instance {i + 1}/{self.max_size}")
                except Exception as e:
                    logger.error(f"Failed to create browser instance {i + 1}", error=str(e))

            self._initialized = True
            logger.info("Browser pool initialized", available=self._available.qsize())

    def _create_driver(self) -> uc.Chrome:
        """Create a new undetected Chrome driver instance."""
        options = uc.ChromeOptions()

        if settings.browser_headless:
            options.add_argument("--headless=new")

        # Standard options for stability
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-blink-features=AutomationControlled")

        # Additional anti-detection
        options.add_argument("--disable-infobars")
        options.add_argument("--disable-notifications")

        driver = uc.Chrome(options=options)
        driver.set_page_load_timeout(settings.page_timeout_seconds)

        return driver

    async def acquire(self, timeout: float = 60.0) -> Optional[uc.Chrome]:
        """
        Acquire a browser instance from the pool.

        Args:
            timeout: Maximum time to wait for an available browser

        Returns:
            Chrome driver instance or None if timeout
        """
        if not self._initialized:
            await self.initialize()

        try:
            driver = await asyncio.wait_for(
                self._available.get(),
                timeout=timeout
            )
            logger.debug("Browser acquired", available=self._available.qsize())
            return driver
        except asyncio.TimeoutError:
            logger.warning("Timeout waiting for browser instance")
            return None

    async def release(self, driver: uc.Chrome):
        """Release a browser instance back to the pool."""
        if driver in self._pool:
            try:
                # Clear cookies and navigate away
                driver.delete_all_cookies()
                driver.get("about:blank")
            except Exception as e:
                logger.warning("Error cleaning up browser", error=str(e))
                # Try to replace the broken driver
                try:
                    driver.quit()
                    self._pool.remove(driver)
                    new_driver = self._create_driver()
                    self._pool.append(new_driver)
                    await self._available.put(new_driver)
                    logger.info("Replaced broken browser instance")
                    return
                except Exception as e2:
                    logger.error("Failed to replace browser", error=str(e2))

            await self._available.put(driver)
            logger.debug("Browser released", available=self._available.qsize())

    async def cleanup(self):
        """Clean up all browser instances."""
        logger.info("Cleaning up browser pool")

        for driver in self._pool:
            try:
                driver.quit()
            except Exception as e:
                logger.warning("Error closing browser", error=str(e))

        self._pool.clear()
        self._initialized = False

        # Clear the queue
        while not self._available.empty():
            try:
                self._available.get_nowait()
            except asyncio.QueueEmpty:
                break

        logger.info("Browser pool cleaned up")

    @property
    def available_count(self) -> int:
        """Number of available browser instances."""
        return self._available.qsize()

    @property
    def total_count(self) -> int:
        """Total number of browser instances in pool."""
        return len(self._pool)


# Global browser pool instance
browser_pool = BrowserPool(max_size=settings.browser_pool_size)
