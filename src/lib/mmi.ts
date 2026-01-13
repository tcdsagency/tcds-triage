// MMI (Market Data) API Client
// Uses token service on GCP VM for authentication
// Base URL: https://api.mmi.run/api/v2

// Token service configuration
const TOKEN_SERVICE_URL = process.env.TOKEN_SERVICE_URL || "http://34.145.14.37:8899";
const TOKEN_SERVICE_SECRET = process.env.TOKEN_SERVICE_SECRET || "tcds_token_service_2025";

// 2FA callback - set by the app to handle 2FA prompts
let twoFACallback: ((sessionId: string) => Promise<string | null>) | null = null;

/**
 * Set the callback function for handling 2FA prompts
 * The callback should display a UI to get the 2FA code from the user
 * and return the code, or null if cancelled
 */
export function setTwoFACallback(callback: (sessionId: string) => Promise<string | null>) {
  twoFACallback = callback;
}

/**
 * Clear the 2FA callback
 */
export function clearTwoFACallback() {
  twoFACallback = null;
}

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
  SOLD_DATE?: string;
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
  data?: MMIPropertyData | null;
  error?: string;
  source: "api";
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
    // Check if token service is available (always true if we have the URL)
    return Boolean(TOKEN_SERVICE_URL);
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
   * Fetch token from token service on GCP VM
   * Handles 2FA challenges if needed
   */
  private async extractToken(): Promise<TokenData | null> {
    try {
      console.log("[MMI] Fetching token from token service...");

      const response = await fetch(`${TOKEN_SERVICE_URL}/tokens/mmi`, {
        headers: {
          Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
        },
        // 2 minute timeout for token extraction (browser automation takes time)
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[MMI] Token service error: ${response.status} - ${error}`);
        return null;
      }

      const result = await response.json();

      // Check if 2FA is required
      if (result.requires_2fa && result.session_id) {
        console.log("[MMI] 2FA required, session:", result.session_id);

        // If we have a callback, use it to get the 2FA code
        if (twoFACallback) {
          const code = await twoFACallback(result.session_id);

          if (code) {
            // Submit the 2FA code
            const twoFAResponse = await fetch(`${TOKEN_SERVICE_URL}/tokens/mmi/2fa`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                session_id: result.session_id,
                code: code,
              }),
              signal: AbortSignal.timeout(60000),
            });

            const twoFAResult = await twoFAResponse.json();

            if (twoFAResult.success && twoFAResult.token) {
              console.log("[MMI] 2FA successful, token received");
              return {
                token: twoFAResult.token,
                expiresAt: twoFAResult.expiresAt,
              };
            } else {
              console.error("[MMI] 2FA failed:", twoFAResult.error);
              return null;
            }
          } else {
            console.log("[MMI] 2FA cancelled by user");
            return null;
          }
        } else {
          console.log("[MMI] 2FA required but no callback registered");
          // Store the session ID for later - could be retrieved via API
          return null;
        }
      }

      if (result.success && result.token) {
        console.log("[MMI] Token received from service (cached:", result.cached, ")");
        return {
          token: result.token,
          expiresAt: result.expiresAt,
        };
      } else {
        console.error("[MMI] Token service returned error:", result.error);
        return null;
      }
    } catch (error: any) {
      console.error("[MMI] Failed to fetch token from service:", error.message);
      return null;
    }
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

    // The API returns 'transactions' and 'listings' not 'deed_history' and 'listing_history'
    const result = await this.apiRequest<{
      transactions?: Array<{
        RECORDINGDATE: string;
        SALESPRICE: string;
        LOANAMOUNT: string;
        LOANTRANSACTIONTYPEMMICATEGORY: string;
        LENDERNAME: string;
        PRIMARY_BORROWER_FIRST: string;
        PRIMARY_BORROWER_LAST: string;
      }>;
      listings?: Array<{
        LIST_DATE: string;
        SOLD_DATE: string;
        STATUS: string;
        LIST_PRICE: string;
        CLOSE_PRICE: string;
        AGENT_FULLNAME: string;
        OFFICENAME: string;
        DAYS_ON_MARKET: string;
      }>;
    }>(`/re/property_histories/${propertyAddressId}`);

    if (!result) {
      return null;
    }

    // Transform API response to expected format
    const listingHistory: MMIListingHistory[] = (result.listings || []).map((listing) => ({
      LISTING_DATE: listing.LIST_DATE,
      SOLD_DATE: listing.SOLD_DATE,
      LIST_PRICE: parseInt(listing.LIST_PRICE) || 0,
      CLOSE_PRICE: parseInt(listing.CLOSE_PRICE) || 0,
      STATUS: listing.STATUS,
      LISTING_AGENT: listing.AGENT_FULLNAME || "",
      LISTING_BROKER: listing.OFFICENAME || "",
      DAYS_ON_MARKET: parseInt(listing.DAYS_ON_MARKET) || undefined,
    }));

    const deedHistory: MMIDeedHistory[] = (result.transactions || []).map((tx) => ({
      DATE: tx.RECORDINGDATE,
      LOAN_AMOUNT: parseInt(tx.LOANAMOUNT) || 0,
      LENDER: tx.LENDERNAME || "",
      TRANSACTION_TYPE: tx.LOANTRANSACTIONTYPEMMICATEGORY || "",
      BUYER_NAME: `${tx.PRIMARY_BORROWER_FIRST || ""} ${tx.PRIMARY_BORROWER_LAST || ""}`.trim(),
      SALE_PRICE: parseInt(tx.SALESPRICE) || undefined,
    }));

    return {
      listingHistory,
      deedHistory,
    };
  }

  /**
   * Determine property status from listing history
   */
  private determineStatus(
    listingHistory: MMIListingHistory[]
  ): "off_market" | "active" | "pending" | "sold" | "unknown" {
    if (!listingHistory.length) return "off_market";

    // Sort by listing date descending (most recent first)
    const sorted = [...listingHistory].sort(
      (a, b) => new Date(b.LISTING_DATE).getTime() - new Date(a.LISTING_DATE).getTime()
    );

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Find the most recent ACTIVE listing
    const activeListing = sorted.find(
      (l) => l.STATUS?.toLowerCase() === "active" || l.STATUS?.toLowerCase() === "for sale"
    );
    if (activeListing) {
      const listDate = new Date(activeListing.LISTING_DATE);
      if (listDate > sixMonthsAgo) {
        return "active";
      }
    }

    // Find the most recent PENDING listing
    const pendingListing = sorted.find(
      (l) =>
        l.STATUS?.toLowerCase() === "pending" ||
        l.STATUS?.toLowerCase() === "under contract"
    );
    if (pendingListing) {
      const listDate = new Date(pendingListing.LISTING_DATE);
      if (listDate > sixMonthsAgo) {
        return "pending";
      }
    }

    // Find the most recent SOLD listing with a RECENT sold date
    const soldListing = sorted.find(
      (l) => l.STATUS?.toLowerCase() === "sold" || l.STATUS?.toLowerCase() === "closed"
    );
    if (soldListing) {
      // Use SOLD_DATE if available, otherwise use LISTING_DATE
      const soldDate = soldListing.SOLD_DATE
        ? new Date(soldListing.SOLD_DATE)
        : new Date(soldListing.LISTING_DATE);
      // Only return "sold" if the sale was within the last 6 months
      if (soldDate > sixMonthsAgo) {
        return "sold";
      }
    }

    // Default to off_market for old listings or no recent activity
    return "off_market";
  }

  /**
   * Look up property using browser-based scraping via token service
   */
  async lookupViaScraping(fullAddress: string): Promise<MMISearchResult> {
    try {
      console.log(`[MMI] Looking up property via scraping: ${fullAddress}`);

      const encodedAddress = encodeURIComponent(fullAddress);
      const response = await fetch(`${TOKEN_SERVICE_URL}/lookup/mmi?address=${encodedAddress}`, {
        headers: {
          Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
        },
        signal: AbortSignal.timeout(180000), // 3 minute timeout for browser scraping
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[MMI] Lookup service error: ${response.status} - ${error}`);
        return { success: false, data: null, source: "api", error: `Service error: ${response.status}` };
      }

      const result = await response.json();

      if (!result.success) {
        console.log(`[MMI] Lookup failed: ${result.error}`);
        return { success: false, data: null, source: "api", error: result.error };
      }

      const data = result.data;
      console.log(`[MMI] Scraping succeeded, captured ${data._apiCount || 0} API responses`);

      // Parse address
      const parsed = this.parseAddress(fullAddress);

      // Extract status from scraped data
      const currentStatus = data.currentStatus || "off_market";

      // Build listing history from scraped data if available
      const listingHistory: MMIListingHistory[] = (data.listingHistory || []).map((h: any) => ({
        LISTING_DATE: h.date || "",
        STATUS: h.status || "",
        LIST_PRICE: 0,
        CLOSE_PRICE: 0,
        LISTING_AGENT: "",
        LISTING_BROKER: "",
      }));

      return {
        success: true,
        data: {
          propertyId: data._propertyId || "scraped",
          address: {
            street: parsed.street,
            city: parsed.city,
            state: parsed.state,
            zip: parsed.zip,
          },
          listingHistory,
          deedHistory: [],
          currentStatus,
          lastUpdated: new Date().toISOString(),
        },
        source: "api",
      };
    } catch (error: any) {
      console.error("[MMI] Scraping error:", error.message);
      return { success: false, data: null, source: "api", error: error.message };
    }
  }

  /**
   * Look up property by full address string
   */
  async lookupByAddress(fullAddress: string): Promise<MMISearchResult> {
    if (!this.isConfigured()) {
      console.log("[MMI] API not configured");
      return { success: false, data: null, source: "api", error: "API not configured" };
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
        console.log("[MMI] Property not found in API");
        return { success: false, data: null, source: "api", error: "Property not found" };
      }

      // Step 2: Get property history
      const history = await this.getPropertyHistory(searchResult.DIMPROPERTYADDRESSID);

      if (!history) {
        console.log("[MMI] Property history not found, returning null (no mock data)");
        return {
          success: false,
          data: null,
          source: "api",
          error: "Property history not found",
        };
      }

      // Determine current status
      const currentStatus = this.determineStatus(history.listingHistory);

      // Find last sale from deed history (transactions)
      const lastDeedSale = history.deedHistory
        .filter((d) => d.SALE_PRICE && d.SALE_PRICE > 0)
        .sort((a, b) => new Date(b.DATE).getTime() - new Date(a.DATE).getTime())[0];

      // Also check listings for sold records with CLOSE_PRICE
      const lastListingSale = history.listingHistory
        .filter(
          (l) =>
            (l.STATUS?.toLowerCase() === "sold" || l.STATUS?.toLowerCase() === "closed") &&
            l.CLOSE_PRICE > 0
        )
        .sort((a, b) => {
          const dateA = a.SOLD_DATE || a.LISTING_DATE;
          const dateB = b.SOLD_DATE || b.LISTING_DATE;
          return new Date(dateB).getTime() - new Date(dateA).getTime();
        })[0];

      // Determine the most recent sale (compare deed and listing)
      let lastSaleDate: string | undefined;
      let lastSalePrice: number | undefined;

      const deedDate = lastDeedSale?.DATE ? new Date(lastDeedSale.DATE) : null;
      const listingDate = lastListingSale?.SOLD_DATE
        ? new Date(lastListingSale.SOLD_DATE)
        : lastListingSale?.LISTING_DATE
          ? new Date(lastListingSale.LISTING_DATE)
          : null;

      if (deedDate && listingDate) {
        // Use the more recent one
        if (deedDate >= listingDate) {
          lastSaleDate = lastDeedSale.DATE;
          lastSalePrice = lastDeedSale.SALE_PRICE;
        } else {
          lastSaleDate = lastListingSale.SOLD_DATE || lastListingSale.LISTING_DATE;
          lastSalePrice = lastListingSale.CLOSE_PRICE;
        }
      } else if (deedDate) {
        lastSaleDate = lastDeedSale.DATE;
        lastSalePrice = lastDeedSale.SALE_PRICE;
      } else if (listingDate) {
        lastSaleDate = lastListingSale.SOLD_DATE || lastListingSale.LISTING_DATE;
        lastSalePrice = lastListingSale.CLOSE_PRICE;
      }

      console.log(
        `[MMI] Property ${searchResult.DIMPROPERTYADDRESSID}: status=${currentStatus}, lastSaleDate=${lastSaleDate}, lastSalePrice=${lastSalePrice}`
      );

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
          lastSaleDate,
          lastSalePrice,
          lastUpdated: new Date().toISOString(),
        },
        source: "api",
      };
    } catch (error: any) {
      console.error("[MMI] API lookup error:", error.message);
      return { success: false, data: null, source: "api", error: error.message };
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
    source: "api" | "error";
  }> {
    const result = await this.lookupByAddress(fullAddress);

    if (!result.success || !result.data) {
      return { status: "unknown", source: "error" };
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
