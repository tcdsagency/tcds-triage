// MMI (Market Data) API Client
// Used for property sale history, ownership data, and estimated values
// Requires MMI_API_KEY and MMI_API_SECRET environment variables

// =============================================================================
// TYPES
// =============================================================================

export interface MMIPropertyData {
  propertyId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    county: string;
  };
  owner: {
    name: string;
    type: "individual" | "corporation" | "trust" | "llc" | "other";
    ownerOccupied: boolean;
    mailingAddress?: string;
  };
  saleHistory: Array<{
    date: string;
    price: number;
    type: "arms_length" | "foreclosure" | "corporate" | "estate" | "other";
    buyer: string;
    seller: string;
  }>;
  valuation: {
    estimatedValue: number;
    estimatedValueLow: number;
    estimatedValueHigh: number;
    assessedValue: number;
    taxAmount: number;
    lastAssessedDate: string;
  };
  propertyDetails: {
    propertyType: string;
    yearBuilt: number;
    sqft: number;
    lotSqft: number;
    beds: number;
    baths: number;
  };
  marketStatus: {
    currentStatus: "off_market" | "active" | "pending" | "sold" | "unknown";
    listingPrice?: number;
    listingDate?: string;
    daysOnMarket?: number;
    pendingDate?: string;
    soldDate?: string;
    soldPrice?: number;
  };
  lastUpdated: string;
}

export interface MMISearchResult {
  success: boolean;
  data?: MMIPropertyData;
  error?: string;
  source: "api" | "mock";
}

// =============================================================================
// MMI API CLIENT
// =============================================================================

class MMIClient {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string = "https://api.mmidata.com/v2"; // Placeholder URL

  constructor() {
    this.apiKey = process.env.MMI_API_KEY || "";
    this.apiSecret = process.env.MMI_API_SECRET || "";
  }

  /**
   * Check if API credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  /**
   * Generate auth headers for API requests
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      "X-API-Key": this.apiKey,
      "X-API-Secret": this.apiSecret,
      "Content-Type": "application/json",
    };
  }

  /**
   * Look up property by address
   */
  async lookupByAddress(address: string): Promise<MMISearchResult> {
    if (!this.isConfigured()) {
      console.log("[MMI] API not configured, returning mock data");
      return {
        success: true,
        data: this.getMockData(address),
        source: "mock",
      };
    }

    try {
      console.log(`[MMI] Looking up property: ${address}`);

      // Parse address components
      const parsed = this.parseAddress(address);

      const response = await fetch(`${this.baseUrl}/property/search`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          street: parsed.street,
          city: parsed.city,
          state: parsed.state,
          zip: parsed.zip,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[MMI] API error: ${response.status} - ${error}`);
        return {
          success: false,
          error: `API returned ${response.status}`,
          source: "api",
        };
      }

      const data = await response.json();

      if (!data.property) {
        console.log("[MMI] No property found, returning mock data");
        return {
          success: true,
          data: this.getMockData(address),
          source: "mock",
        };
      }

      // Transform API response to our format
      return {
        success: true,
        data: this.transformApiResponse(data.property),
        source: "api",
      };
    } catch (error) {
      console.error("[MMI] Lookup error:", error);
      // Fall back to mock data on error
      return {
        success: true,
        data: this.getMockData(address),
        source: "mock",
      };
    }
  }

  /**
   * Look up property by APN (Assessor Parcel Number)
   */
  async lookupByAPN(apn: string, county: string, state: string): Promise<MMISearchResult> {
    if (!this.isConfigured()) {
      console.log("[MMI] API not configured, returning mock data");
      return {
        success: true,
        data: this.getMockData(`${apn}, ${county}, ${state}`),
        source: "mock",
      };
    }

    try {
      console.log(`[MMI] Looking up property by APN: ${apn}`);

      const response = await fetch(`${this.baseUrl}/property/apn`, {
        method: "POST",
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ apn, county, state }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `API returned ${response.status}`,
          source: "api",
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: this.transformApiResponse(data.property),
        source: "api",
      };
    } catch (error) {
      console.error("[MMI] APN lookup error:", error);
      return {
        success: true,
        data: this.getMockData(`${apn}, ${county}, ${state}`),
        source: "mock",
      };
    }
  }

  /**
   * Get market status for a property (listing/sale activity)
   */
  async getMarketStatus(propertyId: string): Promise<{
    status: "off_market" | "active" | "pending" | "sold" | "unknown";
    details?: any;
  }> {
    if (!this.isConfigured()) {
      // Return random status for mock
      const statuses: Array<"off_market" | "active" | "pending" | "sold"> = [
        "off_market",
        "active",
        "pending",
        "sold",
      ];
      const hash = this.hashString(propertyId);
      return {
        status: statuses[hash % statuses.length],
        details: { source: "mock" },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/property/${propertyId}/market-status`, {
        headers: this.getAuthHeaders(),
      });

      if (!response.ok) {
        return { status: "unknown" };
      }

      const data = await response.json();
      return {
        status: data.status || "unknown",
        details: data,
      };
    } catch (error) {
      console.error("[MMI] Market status error:", error);
      return { status: "unknown" };
    }
  }

  /**
   * Batch lookup multiple properties
   */
  async batchLookup(addresses: string[]): Promise<Map<string, MMISearchResult>> {
    const results = new Map<string, MMISearchResult>();

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map((addr) => this.lookupByAddress(addr))
      );

      batch.forEach((addr, idx) => {
        results.set(addr, batchResults[idx]);
      });

      // Rate limit: wait 1 second between batches
      if (i + batchSize < addresses.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
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
    // Basic address parsing - in production would use more robust parsing
    const parts = address.split(",").map((p) => p.trim());

    let street = parts[0] || "";
    let city = parts[1] || "";
    let stateZip = parts[2] || "";

    // Parse state and zip
    const stateZipMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})?/i);
    let state = stateZipMatch?.[1]?.toUpperCase() || "";
    let zip = stateZipMatch?.[2] || "";

    // If zip is in separate part
    if (!zip && parts[3]) {
      zip = parts[3].replace(/\D/g, "").slice(0, 5);
    }

    return { street, city, state, zip };
  }

  /**
   * Transform API response to our standard format
   */
  private transformApiResponse(apiData: any): MMIPropertyData {
    return {
      propertyId: apiData.id || `MMI-${Date.now()}`,
      address: {
        street: apiData.address?.street || "",
        city: apiData.address?.city || "",
        state: apiData.address?.state || "",
        zip: apiData.address?.zip || "",
        county: apiData.address?.county || "",
      },
      owner: {
        name: apiData.owner?.name || "Property Owner",
        type: apiData.owner?.type || "individual",
        ownerOccupied: apiData.owner?.ownerOccupied ?? true,
        mailingAddress: apiData.owner?.mailingAddress,
      },
      saleHistory: (apiData.saleHistory || []).map((sale: any) => ({
        date: sale.date,
        price: sale.price || 0,
        type: sale.type || "arms_length",
        buyer: sale.buyer || "Unknown",
        seller: sale.seller || "Unknown",
      })),
      valuation: {
        estimatedValue: apiData.valuation?.estimatedValue || 0,
        estimatedValueLow: apiData.valuation?.estimatedValueLow || 0,
        estimatedValueHigh: apiData.valuation?.estimatedValueHigh || 0,
        assessedValue: apiData.valuation?.assessedValue || 0,
        taxAmount: apiData.valuation?.taxAmount || 0,
        lastAssessedDate: apiData.valuation?.lastAssessedDate || "",
      },
      propertyDetails: {
        propertyType: apiData.propertyDetails?.propertyType || "Single Family",
        yearBuilt: apiData.propertyDetails?.yearBuilt || 0,
        sqft: apiData.propertyDetails?.sqft || 0,
        lotSqft: apiData.propertyDetails?.lotSqft || 0,
        beds: apiData.propertyDetails?.beds || 0,
        baths: apiData.propertyDetails?.baths || 0,
      },
      marketStatus: {
        currentStatus: apiData.marketStatus?.currentStatus || "off_market",
        listingPrice: apiData.marketStatus?.listingPrice,
        listingDate: apiData.marketStatus?.listingDate,
        daysOnMarket: apiData.marketStatus?.daysOnMarket,
        pendingDate: apiData.marketStatus?.pendingDate,
        soldDate: apiData.marketStatus?.soldDate,
        soldPrice: apiData.marketStatus?.soldPrice,
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Generate consistent mock data based on address
   */
  private getMockData(address: string): MMIPropertyData {
    const hash = this.hashString(address);
    const parsed = this.parseAddress(address);

    // Generate consistent mock values based on hash
    const yearBuilt = 1970 + (hash % 50);
    const sqft = 1200 + (hash % 2800);
    const beds = 2 + (hash % 4);
    const baths = 1 + (hash % 3);
    const assessedValue = 150000 + (hash % 500000);
    const estimatedValue = Math.round(assessedValue * (1.1 + (hash % 30) / 100));

    // Determine market status based on hash
    const statuses: Array<"off_market" | "active" | "pending" | "sold"> = [
      "off_market",
      "off_market",
      "off_market",
      "active",
      "pending",
      "sold",
    ];
    const marketStatus = statuses[hash % statuses.length];

    // Generate sale history
    const saleHistory = [];
    const saleCount = 1 + (hash % 3);
    for (let i = 0; i < saleCount; i++) {
      const yearOffset = 2 + i * 5 + (hash % 3);
      const saleYear = 2024 - yearOffset;
      const salePrice = Math.round(assessedValue * (0.7 + i * 0.15 + (hash % 20) / 100));
      saleHistory.push({
        date: `${saleYear}-${String(1 + (hash % 12)).padStart(2, "0")}-15`,
        price: salePrice,
        type: "arms_length" as const,
        buyer: i === 0 ? "Current Owner" : "Previous Owner",
        seller: i === 0 ? "Previous Owner" : "Earlier Owner",
      });
    }

    const data: MMIPropertyData = {
      propertyId: `MMI-${hash}`,
      address: {
        street: parsed.street || "123 Main St",
        city: parsed.city || "Austin",
        state: parsed.state || "TX",
        zip: parsed.zip || "78701",
        county: "Travis",
      },
      owner: {
        name: "Property Owner",
        type: hash % 4 === 0 ? "trust" : "individual",
        ownerOccupied: hash % 3 !== 0,
        mailingAddress: hash % 5 === 0 ? "PO Box 1234, Austin, TX 78701" : undefined,
      },
      saleHistory,
      valuation: {
        estimatedValue,
        estimatedValueLow: Math.round(estimatedValue * 0.92),
        estimatedValueHigh: Math.round(estimatedValue * 1.08),
        assessedValue,
        taxAmount: Math.round(assessedValue * 0.022),
        lastAssessedDate: "2024-01-01",
      },
      propertyDetails: {
        propertyType: hash % 5 === 0 ? "Condo" : "Single Family",
        yearBuilt,
        sqft,
        lotSqft: Math.round(sqft * (2.5 + (hash % 20) / 10)),
        beds,
        baths,
      },
      marketStatus: {
        currentStatus: marketStatus,
      },
      lastUpdated: new Date().toISOString(),
    };

    // Add listing details if active or pending
    if (marketStatus === "active") {
      data.marketStatus.listingPrice = estimatedValue + 15000;
      data.marketStatus.listingDate = this.getRecentDate(hash % 60);
      data.marketStatus.daysOnMarket = hash % 60;
    } else if (marketStatus === "pending") {
      data.marketStatus.listingPrice = estimatedValue + 10000;
      data.marketStatus.listingDate = this.getRecentDate(30 + (hash % 30));
      data.marketStatus.pendingDate = this.getRecentDate(hash % 14);
      data.marketStatus.daysOnMarket = 30 + (hash % 30);
    } else if (marketStatus === "sold") {
      data.marketStatus.soldDate = this.getRecentDate(hash % 30);
      data.marketStatus.soldPrice = estimatedValue + 5000;
    }

    return data;
  }

  /**
   * Get a date N days ago as ISO string
   */
  private getRecentDate(daysAgo: number): string {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return date.toISOString().split("T")[0];
  }

  /**
   * Simple hash function for consistent mock data
   */
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
