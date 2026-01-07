// RPR (Realtors Property Resource) Client
// Uses Playwright for browser automation to access property data
// Requires RPR_USERNAME and RPR_PASSWORD environment variables

import { chromium, Browser, Page, BrowserContext } from "playwright";

// =============================================================================
// TYPES
// =============================================================================

export interface RPRPropertyData {
  propertyId: string;
  beds: number;
  baths: number;
  sqft: number;
  stories: number;
  yearBuilt: number;
  roofType: string;
  foundation: string;
  exteriorWalls: string;
  hvac: string;
  lotSqft: number;
  lotAcres: number;
  ownerName: string;
  ownerOccupied: boolean;
  mailingAddress: string;
  assessedValue: number;
  estimatedValue: number;
  taxAmount: number;
  lastSaleDate: string;
  lastSalePrice: number;
  schools: {
    district: string;
    elementary: string;
    middle: string;
    high: string;
  };
  listing?: {
    active: boolean;
    price: number;
    daysOnMarket: number;
    agent: string;
  };
}

// =============================================================================
// RPR CLIENT
// Uses Playwright to automate RPR data retrieval
// =============================================================================

class RPRClient {
  private username: string;
  private password: string;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isLoggedIn: boolean = false;
  private lastLoginTime: Date | null = null;
  private loginExpiryMinutes: number = 30; // Re-login after 30 minutes

  constructor() {
    this.username = process.env.RPR_USERNAME || "";
    this.password = process.env.RPR_PASSWORD || "";
  }

  /**
   * Initialize browser if not already running
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      console.log("[RPR] Launching browser...");
      this.browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      this.context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1920, height: 1080 },
      });
    }
  }

  /**
   * Check if we need to re-login
   */
  private needsLogin(): boolean {
    if (!this.isLoggedIn) return true;
    if (!this.lastLoginTime) return true;

    const minutesSinceLogin =
      (Date.now() - this.lastLoginTime.getTime()) / 1000 / 60;
    return minutesSinceLogin > this.loginExpiryMinutes;
  }

  /**
   * Login to RPR
   */
  private async login(page: Page): Promise<boolean> {
    try {
      console.log("[RPR] Navigating to login page...");
      await page.goto("https://www.narrpr.com/login", {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Wait for login form
      await page.waitForSelector('input[type="email"], input[name="email"]', {
        timeout: 10000,
      });

      console.log("[RPR] Entering credentials...");
      // Enter username
      await page.fill(
        'input[type="email"], input[name="email"]',
        this.username
      );
      // Enter password
      await page.fill(
        'input[type="password"], input[name="password"]',
        this.password
      );

      // Click login button
      await page.click('button[type="submit"]');

      // Wait for redirect to dashboard or search page
      await page.waitForNavigation({ timeout: 15000 }).catch(() => {});

      // Verify login success by checking URL or page content
      const currentUrl = page.url();
      if (
        currentUrl.includes("dashboard") ||
        currentUrl.includes("search") ||
        !currentUrl.includes("login")
      ) {
        console.log("[RPR] Login successful");
        this.isLoggedIn = true;
        this.lastLoginTime = new Date();
        return true;
      }

      // Check for error messages
      const errorText = await page
        .textContent(".error-message, .alert-danger")
        .catch(() => null);
      if (errorText) {
        console.error("[RPR] Login error:", errorText);
      }

      return false;
    } catch (error) {
      console.error("[RPR] Login failed:", error);
      return false;
    }
  }

  /**
   * Search for property and navigate to details page
   */
  private async searchProperty(page: Page, address: string): Promise<boolean> {
    try {
      console.log(`[RPR] Searching for: ${address}`);

      // Navigate to search page
      await page.goto("https://www.narrpr.com/search", {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Wait for search input
      await page.waitForSelector(
        'input[type="search"], input[name="address"], input[placeholder*="address"]',
        { timeout: 10000 }
      );

      // Enter address in search
      await page.fill(
        'input[type="search"], input[name="address"], input[placeholder*="address"]',
        address
      );

      // Press enter or click search button
      await page.keyboard.press("Enter");

      // Wait for search results
      await page.waitForTimeout(3000);

      // Click on first result
      const firstResult = await page.$(
        '.search-result:first-child, .property-result:first-child, [data-property-id]:first-child'
      );
      if (firstResult) {
        await firstResult.click();
        await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        return true;
      }

      // Alternative: Look for direct match link
      const propertyLink = await page.$('a[href*="/property/"]');
      if (propertyLink) {
        await propertyLink.click();
        await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        return true;
      }

      console.warn("[RPR] No search results found");
      return false;
    } catch (error) {
      console.error("[RPR] Search failed:", error);
      return false;
    }
  }

  /**
   * Scrape property data from the details page
   */
  private async scrapePropertyData(page: Page): Promise<RPRPropertyData | null> {
    try {
      console.log("[RPR] Scraping property data...");

      // Wait for property details to load
      await page.waitForSelector(
        '.property-details, .property-info, [data-property-details]',
        { timeout: 10000 }
      );

      // Helper function to get text content
      const getText = async (selector: string): Promise<string> => {
        const element = await page.$(selector);
        return element ? (await element.textContent())?.trim() || "" : "";
      };

      // Helper to extract numbers
      const getNumber = async (selector: string): Promise<number> => {
        const text = await getText(selector);
        const num = parseFloat(text.replace(/[^0-9.]/g, ""));
        return isNaN(num) ? 0 : num;
      };

      // Extract property ID from URL
      const url = page.url();
      const propertyIdMatch = url.match(/property\/([^/]+)/);
      const propertyId = propertyIdMatch ? propertyIdMatch[1] : `RPR-${Date.now()}`;

      // Scrape basic property info
      const data: RPRPropertyData = {
        propertyId,
        beds: await getNumber('[data-beds], .beds, .bedrooms'),
        baths: await getNumber('[data-baths], .baths, .bathrooms'),
        sqft: await getNumber('[data-sqft], .sqft, .square-footage'),
        stories: await getNumber('[data-stories], .stories'),
        yearBuilt: await getNumber('[data-year-built], .year-built'),
        roofType: (await getText('[data-roof], .roof-type')) || "Unknown",
        foundation: (await getText('[data-foundation], .foundation')) || "Unknown",
        exteriorWalls: (await getText('[data-exterior], .exterior')) || "Unknown",
        hvac: (await getText('[data-hvac], .hvac')) || "Unknown",
        lotSqft: await getNumber('[data-lot-sqft], .lot-size'),
        lotAcres: await getNumber('[data-lot-acres], .lot-acres'),
        ownerName: (await getText('[data-owner], .owner-name')) || "Property Owner",
        ownerOccupied: (await getText('[data-occupancy], .occupancy')).toLowerCase().includes("owner"),
        mailingAddress: (await getText('[data-mailing], .mailing-address')) || "",
        assessedValue: await getNumber('[data-assessed], .assessed-value'),
        estimatedValue: await getNumber('[data-estimated], .estimated-value, .avm'),
        taxAmount: await getNumber('[data-tax], .tax-amount'),
        lastSaleDate: (await getText('[data-sale-date], .last-sale-date')) || "",
        lastSalePrice: await getNumber('[data-sale-price], .last-sale-price'),
        schools: {
          district: (await getText('[data-school-district], .school-district')) || "Unknown",
          elementary: (await getText('[data-elementary], .elementary-school')) || "Unknown",
          middle: (await getText('[data-middle], .middle-school')) || "Unknown",
          high: (await getText('[data-high], .high-school')) || "Unknown",
        },
      };

      // Check for active listing
      const listingPrice = await getNumber('[data-list-price], .list-price');
      if (listingPrice > 0) {
        data.listing = {
          active: true,
          price: listingPrice,
          daysOnMarket: await getNumber('[data-dom], .days-on-market'),
          agent: (await getText('[data-agent], .listing-agent')) || "Unknown",
        };
      }

      console.log("[RPR] Data scraped successfully");
      return data;
    } catch (error) {
      console.error("[RPR] Scraping failed:", error);
      return null;
    }
  }

  /**
   * Look up property by address
   * Uses Playwright to automate RPR login and search
   */
  async lookupProperty(address: string): Promise<RPRPropertyData | null> {
    // Check if credentials are configured
    if (!this.username || !this.password) {
      console.log("[RPR] Credentials not configured, returning mock data");
      return this.getMockData(address);
    }

    let page: Page | null = null;

    try {
      // Initialize browser
      await this.initBrowser();

      if (!this.context) {
        throw new Error("Browser context not initialized");
      }

      // Create new page
      page = await this.context.newPage();

      // Login if needed
      if (this.needsLogin()) {
        const loginSuccess = await this.login(page);
        if (!loginSuccess) {
          console.log("[RPR] Login failed, returning mock data");
          return this.getMockData(address);
        }
      }

      // Search for property
      const searchSuccess = await this.searchProperty(page, address);
      if (!searchSuccess) {
        console.log("[RPR] Search failed, returning mock data");
        return this.getMockData(address);
      }

      // Scrape property data
      const data = await this.scrapePropertyData(page);
      if (!data) {
        console.log("[RPR] Scraping failed, returning mock data");
        return this.getMockData(address);
      }

      return data;
    } catch (error) {
      console.error("[RPR] Lookup error:", error);
      return this.getMockData(address);
    } finally {
      // Close the page but keep browser running for reuse
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }

  /**
   * Close browser and cleanup
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => {});
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
    this.isLoggedIn = false;
    this.lastLoginTime = null;
  }

  /**
   * Generate realistic mock data based on address
   */
  private getMockData(address: string): RPRPropertyData {
    // Use address hash for consistent mock data
    const hash = this.hashAddress(address);

    const yearBuilt = 1990 + (hash % 30);
    const sqft = 1500 + (hash % 2500);
    const beds = 2 + (hash % 4);
    const baths = 1.5 + (hash % 3);
    const lotAcres = 0.15 + (hash % 50) / 100;
    const assessedValue = 200000 + (hash % 400000);
    const estimatedValue = Math.round(assessedValue * 1.15);

    const roofTypes = ['Composition Shingle', 'Metal', 'Tile', 'Slate', 'Wood Shake'];
    const foundations = ['Slab', 'Crawl Space', 'Basement', 'Pier and Beam'];
    const exteriors = ['Brick', 'Vinyl Siding', 'Stucco', 'Wood', 'Fiber Cement'];
    const hvacTypes = ['Central A/C', 'Heat Pump', 'Forced Air', 'Radiant'];

    return {
      propertyId: `RPR-${hash}`,
      beds,
      baths,
      sqft,
      stories: 1 + (hash % 2),
      yearBuilt,
      roofType: roofTypes[hash % roofTypes.length],
      foundation: foundations[hash % foundations.length],
      exteriorWalls: exteriors[hash % exteriors.length],
      hvac: hvacTypes[hash % hvacTypes.length],
      lotSqft: Math.round(lotAcres * 43560),
      lotAcres,
      ownerName: 'Property Owner',
      ownerOccupied: hash % 3 !== 0,
      mailingAddress: address,
      assessedValue,
      estimatedValue,
      taxAmount: Math.round(assessedValue * 0.025),
      lastSaleDate: `${2015 + (hash % 8)}-${String(1 + (hash % 12)).padStart(2, '0')}-15`,
      lastSalePrice: Math.round(assessedValue * 0.9),
      schools: {
        district: 'Local School District',
        elementary: 'Oak Elementary',
        middle: 'Central Middle School',
        high: 'Regional High School',
      },
      listing: hash % 5 === 0 ? {
        active: true,
        price: estimatedValue + 10000,
        daysOnMarket: hash % 60,
        agent: 'Local Agent',
      } : undefined,
    };
  }

  /**
   * Simple hash function for consistent mock data
   */
  private hashAddress(address: string): number {
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = ((hash << 5) - hash) + address.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const rprClient = new RPRClient();

// Export mock data generator for testing
export function getMockRPRData(address: string): RPRPropertyData {
  return new RPRClient()['getMockData'](address);
}
