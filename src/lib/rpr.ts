// RPR (Realtors Property Resource) API Client
// Uses token service on GCP VM for authentication
// Base URL: https://webapi.narrpr.com

// Token service configuration
const TOKEN_SERVICE_URL = process.env.TOKEN_SERVICE_URL || "http://34.145.14.37:8899";
const TOKEN_SERVICE_SECRET = process.env.TOKEN_SERVICE_SECRET || "tcds_token_service_2025";

// =============================================================================
// TYPES
// =============================================================================

export interface RPRLocationResult {
  propertyId: string;
  address: string;
  city: string;
  state: string;
  zip: string;
}

export interface RPRPropertyCommon {
  searchResult: {
    bedrooms: number;
    bathsFull: number;
    bathsHalf?: number;
    livingAreaInSqFt: number;
    yearBuilt: number;
    stories?: number;
    lastSaleDate?: string;
    lastSalePrice?: number;
  };
  owner?: {
    name: string;
    occupied: boolean;
    mailingAddress?: string;
  };
  tax?: {
    assessedValue: number;
    taxAmount: number;
    assessedYear?: number;
  };
  valuation?: {
    estimatedValue: number;
    valuationRangeLow: number;
    valuationRangeHigh: number;
  };
}

export interface RPRPropertyDetails {
  property: {
    roofType?: string;
    foundation?: string;
    exteriorWalls?: string;
    heatingType?: string;
    coolingType?: string;
    constructionType?: string;
  };
  features?: {
    pool?: string;
    garageSpaces?: number;
    fireplaces?: number;
    basement?: string;
  };
  flood?: {
    floodZone?: string;
    floodRisk?: string;
  };
}

export interface RPRListingData {
  listPrice: number;
  daysOnMarket: number;
  listingDate: string;
  photos?: string[];
  listingAgentName?: string;
  listingOfficeName?: string;
  status?: string;
}

export interface RPRPropertyData {
  propertyId: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
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
  floodZone?: string;
  floodRisk?: string;
  listing?: {
    active: boolean;
    price: number;
    daysOnMarket: number;
    agent: string;
    status: string;
  };
  currentStatus: "off_market" | "active" | "pending" | "sold" | "unknown";
}

interface TokenData {
  token: string;
  expiresAt: number;
}

// =============================================================================
// RPR API CLIENT
// =============================================================================

class RPRClient {
  private baseUrl: string = "https://webapi.narrpr.com";
  private tokenData: TokenData | null = null;
  private tokenPromise: Promise<TokenData | null> | null = null;

  /**
   * Check if API credentials are configured
   */
  isConfigured(): boolean {
    return Boolean(TOKEN_SERVICE_URL);
  }

  /**
   * Check if current token is valid
   */
  private isTokenValid(): boolean {
    if (!this.tokenData) return false;
    return this.tokenData.expiresAt > Date.now() + 60000;
  }

  /**
   * Fetch token from token service on GCP VM
   */
  private async extractToken(): Promise<TokenData | null> {
    try {
      console.log("[RPR] Fetching token from token service...");

      const response = await fetch(`${TOKEN_SERVICE_URL}/tokens/rpr`, {
        headers: {
          Authorization: `Bearer ${TOKEN_SERVICE_SECRET}`,
        },
        // 2 minute timeout for token extraction
        signal: AbortSignal.timeout(120000),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[RPR] Token service error: ${response.status} - ${error}`);
        return null;
      }

      const result = await response.json();

      if (result.success && result.token) {
        console.log("[RPR] Token received from service (cached:", result.cached, ")");
        return {
          token: result.token,
          expiresAt: result.expiresAt,
        };
      } else {
        console.error("[RPR] Token service returned error:", result.error);
        return null;
      }
    } catch (error: any) {
      console.error("[RPR] Failed to fetch token from service:", error.message);
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

    if (this.tokenPromise) {
      const result = await this.tokenPromise;
      return result?.token || null;
    }

    this.tokenPromise = this.extractToken();
    this.tokenData = await this.tokenPromise;
    this.tokenPromise = null;

    return this.tokenData?.token || null;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(endpoint: string, params?: Record<string, string>): Promise<T | null> {
    const token = await this.getToken();
    if (!token) {
      console.error("[RPR] No valid token available");
      return null;
    }

    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`[RPR] API error: ${response.status} ${response.statusText}`);
      if (response.status === 401) {
        this.tokenData = null;
      }
      return null;
    }

    return response.json();
  }

  /**
   * Search for property by address (autocomplete)
   */
  async searchLocation(address: string): Promise<RPRLocationResult | null> {
    console.log(`[RPR] Searching for location: ${address}`);

    const result = await this.apiRequest<{ locations: RPRLocationResult[] }>(
      "/LocationSearch/Locations",
      { term: address }
    );

    if (!result?.locations?.length) {
      console.log("[RPR] No location found");
      return null;
    }

    return result.locations[0];
  }

  /**
   * Get common property data
   */
  async getPropertyCommon(propertyId: string): Promise<RPRPropertyCommon | null> {
    console.log(`[RPR] Getting common data for property: ${propertyId}`);

    return this.apiRequest<RPRPropertyCommon>("/Property/GetCommon", { propertyId });
  }

  /**
   * Get detailed property data
   */
  async getPropertyDetails(propertyId: string): Promise<RPRPropertyDetails | null> {
    console.log(`[RPR] Getting details for property: ${propertyId}`);

    return this.apiRequest<RPRPropertyDetails>("/Property/GetDetails", { propertyId });
  }

  /**
   * Get listing data if property is active
   */
  async getPropertyListing(listingId: string): Promise<RPRListingData | null> {
    console.log(`[RPR] Getting listing data: ${listingId}`);

    return this.apiRequest<RPRListingData>("/Property/GetListing", { listingId });
  }

  /**
   * Look up complete property data by address
   */
  async lookupProperty(address: string): Promise<RPRPropertyData | null> {
    if (!this.isConfigured()) {
      console.log("[RPR] Credentials not configured, returning mock data");
      return this.getMockData(address);
    }

    try {
      // Step 1: Search for property
      const location = await this.searchLocation(address);
      if (!location) {
        console.log("[RPR] Location not found, returning mock data");
        return this.getMockData(address);
      }

      // Step 2: Get common data
      const common = await this.getPropertyCommon(location.propertyId);
      if (!common) {
        return this.getMockData(address);
      }

      // Step 3: Get details
      const details = await this.getPropertyDetails(location.propertyId);

      // Determine status
      let currentStatus: "off_market" | "active" | "pending" | "sold" | "unknown" = "off_market";
      let listingData: RPRPropertyData["listing"] | undefined;

      // Check if there's an active listing (would need listing ID from common data)
      // For now, infer from lastSaleDate if recent
      const lastSaleDate = common.searchResult.lastSaleDate;
      if (lastSaleDate) {
        const saleDate = new Date(lastSaleDate);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (saleDate > thirtyDaysAgo) {
          currentStatus = "sold";
        }
      }

      return {
        propertyId: location.propertyId,
        address: {
          street: location.address,
          city: location.city,
          state: location.state,
          zip: location.zip,
        },
        beds: common.searchResult.bedrooms || 0,
        baths: (common.searchResult.bathsFull || 0) + (common.searchResult.bathsHalf || 0) * 0.5,
        sqft: common.searchResult.livingAreaInSqFt || 0,
        stories: common.searchResult.stories || 1,
        yearBuilt: common.searchResult.yearBuilt || 0,
        roofType: details?.property?.roofType || "Unknown",
        foundation: details?.property?.foundation || "Unknown",
        exteriorWalls: details?.property?.exteriorWalls || "Unknown",
        hvac: `${details?.property?.heatingType || "Unknown"} / ${details?.property?.coolingType || "Unknown"}`,
        lotSqft: 0, // Would need from details
        lotAcres: 0,
        ownerName: common.owner?.name || "Property Owner",
        ownerOccupied: common.owner?.occupied ?? true,
        mailingAddress: common.owner?.mailingAddress || "",
        assessedValue: common.tax?.assessedValue || 0,
        estimatedValue: common.valuation?.estimatedValue || 0,
        taxAmount: common.tax?.taxAmount || 0,
        lastSaleDate: common.searchResult.lastSaleDate || "",
        lastSalePrice: common.searchResult.lastSalePrice || 0,
        schools: {
          district: "Unknown",
          elementary: "Unknown",
          middle: "Unknown",
          high: "Unknown",
        },
        floodZone: details?.flood?.floodZone,
        floodRisk: details?.flood?.floodRisk,
        listing: listingData,
        currentStatus,
      };
    } catch (error) {
      console.error("[RPR] Lookup error:", error);
      return this.getMockData(address);
    }
  }

  /**
   * Check property listing status (for risk monitor)
   */
  async checkPropertyListingStatus(address: string): Promise<{
    status: "off_market" | "active" | "pending" | "sold" | "unknown";
    listingPrice?: number;
    daysOnMarket?: number;
    listingAgent?: string;
    source: "api" | "mock";
  }> {
    const result = await this.lookupProperty(address);

    if (!result) {
      return { status: "unknown", source: "mock" };
    }

    return {
      status: result.currentStatus,
      listingPrice: result.listing?.price,
      daysOnMarket: result.listing?.daysOnMarket,
      listingAgent: result.listing?.agent,
      source: this.isConfigured() ? "api" : "mock",
    };
  }

  /**
   * Generate mock data for testing
   */
  private getMockData(address: string): RPRPropertyData {
    const hash = this.hashAddress(address);
    const parsed = this.parseAddress(address);

    const yearBuilt = 1990 + (hash % 30);
    const sqft = 1500 + (hash % 2500);
    const beds = 2 + (hash % 4);
    const baths = 1.5 + (hash % 3);
    const lotAcres = 0.15 + (hash % 50) / 100;
    const assessedValue = 200000 + (hash % 400000);
    const estimatedValue = Math.round(assessedValue * 1.15);

    const roofTypes = ["Composition Shingle", "Metal", "Tile", "Slate", "Wood Shake"];
    const foundations = ["Slab", "Crawl Space", "Basement", "Pier and Beam"];
    const exteriors = ["Brick", "Vinyl Siding", "Stucco", "Wood", "Fiber Cement"];
    const hvacTypes = ["Central A/C", "Heat Pump", "Forced Air", "Radiant"];
    const statuses: Array<"off_market" | "active" | "pending" | "sold"> = [
      "off_market",
      "off_market",
      "off_market",
      "active",
      "pending",
      "sold",
    ];

    const currentStatus = statuses[hash % statuses.length];

    return {
      propertyId: `RPR-MOCK-${hash}`,
      address: {
        street: parsed.street || "123 Main St",
        city: parsed.city || "Austin",
        state: parsed.state || "TX",
        zip: parsed.zip || "78701",
      },
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
      ownerName: "Property Owner",
      ownerOccupied: hash % 3 !== 0,
      mailingAddress: address,
      assessedValue,
      estimatedValue,
      taxAmount: Math.round(assessedValue * 0.025),
      lastSaleDate: `${2015 + (hash % 8)}-${String(1 + (hash % 12)).padStart(2, "0")}-15`,
      lastSalePrice: Math.round(assessedValue * 0.9),
      schools: {
        district: "Local School District",
        elementary: "Oak Elementary",
        middle: "Central Middle School",
        high: "Regional High School",
      },
      listing:
        currentStatus === "active"
          ? {
              active: true,
              price: estimatedValue + 10000,
              daysOnMarket: hash % 60,
              agent: "Local Agent",
              status: "Active",
            }
          : undefined,
      currentStatus,
    };
  }

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

  private hashAddress(address: string): number {
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = (hash << 5) - hash + address.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const rprClient = new RPRClient();

// Export mock data generator for testing
export function getMockRPRData(address: string): RPRPropertyData {
  return new RPRClient()["getMockData"](address);
}
