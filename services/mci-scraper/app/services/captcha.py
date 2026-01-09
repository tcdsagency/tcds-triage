"""
2Captcha integration for solving reCAPTCHA.
"""

import asyncio
from typing import Optional
import structlog
from twocaptcha import TwoCaptcha

from app.config import settings

logger = structlog.get_logger()


class CaptchaSolver:
    """Wrapper for 2Captcha service."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self._solver: Optional[TwoCaptcha] = None
        self._balance: Optional[float] = None

    @property
    def solver(self) -> TwoCaptcha:
        """Get or create 2Captcha solver instance."""
        if self._solver is None:
            self._solver = TwoCaptcha(self.api_key)
        return self._solver

    async def solve_recaptcha(
        self,
        site_key: str,
        page_url: str,
        timeout: int = 120
    ) -> Optional[str]:
        """
        Solve a reCAPTCHA v2 challenge.

        Args:
            site_key: The reCAPTCHA site key (data-sitekey attribute)
            page_url: The URL of the page with the CAPTCHA
            timeout: Maximum time to wait for solution in seconds

        Returns:
            The CAPTCHA solution token or None if failed
        """
        if not self.api_key:
            logger.error("2Captcha API key not configured")
            return None

        logger.info(
            "Solving reCAPTCHA",
            site_key=site_key[:20] + "...",
            url=page_url,
        )

        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: self.solver.recaptcha(
                    sitekey=site_key,
                    url=page_url,
                )
            )

            if result and "code" in result:
                logger.info("CAPTCHA solved successfully")
                return result["code"]

            logger.warning("CAPTCHA solving returned no code", result=result)
            return None

        except Exception as e:
            logger.error("CAPTCHA solving failed", error=str(e))
            return None

    async def get_balance(self) -> Optional[float]:
        """Get current 2Captcha account balance."""
        if not self.api_key:
            return None

        try:
            loop = asyncio.get_event_loop()
            balance = await loop.run_in_executor(
                None,
                self.solver.balance
            )
            self._balance = float(balance)
            logger.info("2Captcha balance retrieved", balance=self._balance)
            return self._balance
        except Exception as e:
            logger.error("Failed to get 2Captcha balance", error=str(e))
            return None

    @property
    def cached_balance(self) -> Optional[float]:
        """Get cached balance without making API call."""
        return self._balance


# Global captcha solver instance
captcha_solver = CaptchaSolver(settings.two_captcha_api_key)
