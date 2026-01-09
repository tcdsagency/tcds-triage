// MMI (Market Data) API Client
// Uses browser automation to extract auth token, then makes REST API calls
// Base URL: https://api.mmi.run/api/v2
// Requires MMI_EMAIL and MMI_PASSWORD environment variables

import { spawn } from "child_process";
import path from "path";

// =============================================================================
// TYPES
// =============================================================================

export interface MMIPropertySearchResult {
  DIMPROPERTYADDRESSID: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface MMIListingHistory {
  LISTING_DATE: string;
  LIST_PRICE: number;
  CLOSE_PRICE: number;
  STATUS: string;
  LISTING_AGENT: string;
  LISTING_BROKER: string;
  DAYS_ON_MARKET?: number;
}

export interface MMIDeedHistory {
  DATE: string;
  LOAN_AMOUNT: number;
  LENDER: string;
  LOAN_OFFICER?: string;
  TRANSACTION_TYPE: string;
  BUYER_NAME?: string;
  SELLER_NAME?: string;
  SALE_PRICE?: number;
}

export interface MMIPropertyData {
  propertyId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  listingHistory: MMIListingHistory[];
  deedHistory: MMIDeedHistory[];
  currentStatus: "off_market" | "active" | "pending" | "sold" | "unknown";
  lastSaleDate?: string;
  lastSalePrice?: number;
  lastUpdated: string;
}

export interface MMISearchResult {
  success: boolean;
  data?: MMIPropertyData;
  error?: string;
  source: "api" | "mock";
}

interface TokenData {
  token: string;
  expiresAt: number;
}

// =============================================================================
// MMI API CLIENT
// =============================================================================

class MMIClient {
  private baseUrl: string = "https://api.mmi.run/api/v2";
  private tokenData: TokenData | null = null;
  private tokenPromise: Promise<TokenData | null> | null = null;

  /**
   * Check if API credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(process.env.MMI_EMAIL && process.env.MMI_PASSWORD);
  }

  /**
   * Check if current token is valid
   */
  private isTokenValid(): boolean {
    if (!this.tokenData) return false;
    // Token is valid if it expires more than 1 minute from now
    return this.tokenData.expiresAt > Date.now() + 60000;
  }

  /**
   * Extract token using Python Playwright script
   */
  private async extractToken(): Promise<TokenData | null> {
    return new Promise((resolve) => {
      const scriptPath = path.join(process.cwd(), "server/scripts/mmi_cookie_extractor.py");

      const env = {
        ...process.env,
        MMI_EMAIL: process.env.MMI_EMAIL || "",
        MMI_PASSWORD: process.env.MMI_PASSWORD || "",
      };

      console.log("[MMI] Extracting token via browser automation...");

      const python = spawn("python3", [scriptPath], { env });

      let stdout = "";
      let stderr = "";

      python.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      python.stderr.on("data", (data) => {
        stderr += data.toString();
        console.log("[MMI]", data.toString().trim());
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("[MMI] Token extraction failed with code:", code);
          console.error("[MMI] stderr:", stderr);
          resolve(null);
          return;
        }

        try {
          const result = JSON.parse(stdout.trim());
          if (result.success && result.token) {
            resolve({
              token: result.token,
              expiresAt: result.expiresAt,
            });
          } else {
            console.error("[MMI] Token extraction error:", result.error);
            resolve(null);
          }
        } catch (e) {
          console.error("[MMI] Failed to parse token response:", stdout);
          resolve(null);
        }
      });

      python.on("error", (err) => {
        console.error("[MMI] Failed to spawn Python process:", err);
        resolve(null);
      });
    });
  }

  /**
   * Get valid token (cached or fresh)
   */
  private async getToken(): Promise<string | null> {
    if (this.isTokenValid() && this.tokenData) {
      return this.tokenData.token;
    }

    // If already fetching, wait for that
    if (this.tokenPromise) {
      const result = await this.tokenPromise;
      return result?.token || null;
    }

    // Start new token fetch
    this.tokenPromise = this.extractToken();
    this.tokenData = await this.tokenPromise;
    this.tokenPromise = null;

    return this.tokenData?.token || null;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
    const token = await this.getToken();
    if (!token) {
      console.error("[MMI] No valid token available");
      return null;
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      console.error(`[MMI] API error: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        // Token expired, clear it
        this.tokenData = null;
      }
      return null;
    }

    return response.json();
  }

  /**
   * Step 1: Search for property by address
   */
  async searchProperty(
    address: string,
    city: string,
    state: string,
    zipcode: string
  ): Promise<MMIPropertySearchResult | null> {
    console.log(`[MMI] Searching for property: ${address}, ${city}, ${state} ${zipcode}`);

    const result = await this.apiRequest<{ data: MMIPropertySearchResult[] }>("/property_search", {
      method: "POST",
      body: JSON.stringify({
        address: address.toUpperCase(),
        city: city.toUpperCase(),
        state: state.toUpperCase(),
        zipcode,
      }),
    });

    if (!result?.data?.length) {
      console.log("[MMI] No property found");
      return null;
    }

    return result.data[0];
  }

  /**
   * Step 2: Get property history by ID
   */
  async getPropertyHistory(propertyAddressId: string): Promise<{
    listingHistory: MMIListingHistory[];
    deedHistory: MMIDeedHistory[];
  } | null> {
    console.log(`[MMI] Getting property history for ID: ${propertyAddressId}`);

    const result = await this.apiRequest<{
      listing_history?: MMIListingHistory[];
      deed_history?: MMIDeedHistory[];
    }>(`/re/property_histories/${propertyAddressId}`);

    if (!result) {
      return null;
    }

    return {
      listingHistory: result.listing_history || [],
      deedHistory: result.deed_history || [],
    };
  }

  /**
   * Determine property status from listing history
   */
  private determineStatus(
    listingHistory: MMIListingHistory[]
  ): "off_market" | "active" | "pending" | "sold" | "unknown" {
    if (!listingHistory.length) return "off_market";

    // Sort by date descending
    const sorted = [...listingHistory].sort(
      (a, b) => new Date(b.LISTING_DATE).getTime() - new Date(a.LISTING_DATE).getTime()
    );

    const latest = sorted[0];
    const status = latest.STATUS?.toLowerCase() || "";

    if (status.includes("sold") || status.includes("closed")) return "sold";
    if (status.includes("pending") || status.includes("under contract")) return "pending";
    if (status.includes("active") || status.includes("for sale")) return "active";

    // Check if recent (within 6 months)
    const listingDate = new Date(latest.LISTING_DATE);
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    if (listingDate > sixMonthsAgo) {
      return latest.CLOSE_PRICE ? "sold" : "active";
    }

    return "off_market";
  }

  /**
   * Look up property by full address string
   */
  async lookupByAddress(fullAddress: string): Promise<MMISearchResult> {
    if (!this.isConfigured()) {
      console.log("[MMI] API not configured, returning mock data");
      return {
        success: true,
        data: this.getMockData(fullAddress),
        source: "mock",
      };
    }

    try {
      // Parse address
      const parsed = this.parseAddress(fullAddress);

      // Step 1: Search for property
      const searchResult = await this.searchProperty(
        parsed.street,
        parsed.city,
        parsed.state,
        parsed.zip
      );

      if (!searchResult) {
        console.log("[MMI] Property not found, returning mock data");
        return {
          success: true,
          data: this.getMockData(fullAddress),
          source: "mock",
        };
      }

      // Step 2: Get property history
      const history = await this.getPropertyHistory(searchResult.DIMPROPERTYADDRESSID);

      if (!history) {
        return {
          success: true,
          data: this.getMockData(fullAddress),
          source: "mock",
        };
      }

      // Determine current status
      const currentStatus = this.determineStatus(history.listingHistory);

      // Find last sale
      const lastSale = history.deedHistory
        .filter((d) => d.SALE_PRICE && d.SALE_PRICE > 0)
        .sort((a, b) => new Date(b.DATE).getTime() - new Date(a.DATE).getTime())[0];

      return {
        success: true,
        data: {
          propertyId: searchResult.DIMPROPERTYADDRESSID,
          address: {
            street: parsed.street,
            city: parsed.city,
            state: parsed.state,
            zip: parsed.zip,
          },
          listingHistory: history.listingHistory,
          deedHistory: history.deedHistory,
          currentStatus,
          lastSaleDate: lastSale?.DATE,
          lastSalePrice: lastSale?.SALE_PRICE,
          lastUpdated: new Date().toISOString(),
        },
        source: "api",
      };
    } catch (error) {
      console.error("[MMI] Lookup error:", error);
      return {
        success: true,
        data: this.getMockData(fullAddress),
        source: "mock",
      };
    }
  }

  /**
   * Check property listing status (for risk monitor)
   */
  async checkPropertyByAddress(fullAddress: string): Promise<{
    status: "off_market" | "active" | "pending" | "sold" | "unknown";
    listingPrice?: number;
    salePrice?: number;
    lastSaleDate?: string;
    source: "api" | "mock";
  }> {
    const result = await this.lookupByAddress(fullAddress);

    if (!result.success || !result.data) {
      return { status: "unknown", source: "mock" };
    }

    const latestListing = result.data.listingHistory[0];

    return {
      status: result.data.currentStatus,
      listingPrice: latestListing?.LIST_PRICE,
      salePrice: latestListing?.CLOSE_PRICE || result.data.lastSalePrice,
      lastSaleDate: result.data.lastSaleDate,
      source: result.source,
    };
  }

  /**
   * Parse address string into components
   */
  private parseAddress(address: string): {
    street: string;
    city: string;
    state: string;
    zip: string;
  } {
    const parts = address.split(",").map((p) => p.trim());

    let street = parts[0] || "";
    let city = parts[1] || "";
    let stateZip = parts[2] || "";

    const stateZipMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})?/i);
    let state = stateZipMatch?.[1]?.toUpperCase() || "";
    let zip = stateZipMatch?.[2] || "";

    if (!zip && parts[3]) {
      zip = parts[3].replace(/\D/g, "").slice(0, 5);
    }

    return { street, city, state, zip };
  }

  /**
   * Generate mock data for testing
   */
  private getMockData(address: string): MMIPropertyData {
    const hash = this.hashString(address);
    const parsed = this.parseAddress(address);

    const statuses: Array<"off_market" | "active" | "pending" | "sold"> = [
      "off_market",
      "off_market",
      "off_market",
      "active",
      "pending",
      "sold",
    ];

    return {
      propertyId: `MMI-MOCK-${hash}`,
      address: {
        street: parsed.street || "123 Main St",
        city: parsed.city || "Austin",
        state: parsed.state || "TX",
        zip: parsed.zip || "78701",
      },
      listingHistory: [],
      deedHistory: [],
      currentStatus: statuses[hash % statuses.length],
      lastUpdated: new Date().toISOString(),
    };
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const mmiClient = new MMIClient();
