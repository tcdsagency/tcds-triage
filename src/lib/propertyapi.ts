// PropertyAPI.co API Client
// Simple REST API with API key auth for parcel/building/owner/valuation data

const PROPERTY_API_KEY = process.env.PROPERTY_API_KEY || "";
const BASE_URL = "https://propertyapi.co";

// =============================================================================
// TYPES
// =============================================================================

export interface PropertyAPIData {
  parcel?: { fips?: string; apn?: string; county?: string; legalDescription?: string };
  location?: { lat?: number; lng?: number };
  building?: { sqft?: number; bedrooms?: number; bathrooms?: number; yearBuilt?: number; lotSizeAcres?: number; stories?: number };
  owner?: { name?: string; type?: string; ownerOccupied?: boolean; mailingAddress?: string };
  valuation?: { marketValue?: number; assessedTotal?: number };
  saleHistory?: { lastSaleDate?: string; lastSalePrice?: number };
  tax?: { annualTax?: number; taxYear?: number };
  propertyType?: string;
}

// =============================================================================
// CLIENT
// =============================================================================

class PropertyAPIClient {
  isConfigured(): boolean {
    return Boolean(PROPERTY_API_KEY);
  }

  async lookupByAddress(address: string): Promise<PropertyAPIData | null> {
    if (!this.isConfigured()) {
      console.log("[PropertyAPI] Not configured — no API key");
      return null;
    }

    const encoded = encodeURIComponent(address);
    const url = `${BASE_URL}/api/v1/parcels/search-by-address?address=${encoded}&api_key=${PROPERTY_API_KEY}`;

    console.log(`[PropertyAPI] Looking up: ${address}`);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[PropertyAPI] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const json = await response.json();

    if (json.status !== "ok" || !json.rawData) {
      console.log("[PropertyAPI] No data returned:", json.status);
      return null;
    }

    // Use rawData — flat key-value pairs from the API
    const r = json.rawData;

    // Format sale date if present (comes as ISO string)
    const saleDate = r.sale_date
      ? new Date(r.sale_date).toISOString().split("T")[0]
      : undefined;

    // Build mailing address from parts
    const mailingParts = [r.mail_address, r.mail_city, r.mail_state, r.mail_zip].filter(Boolean);
    const mailingAddress = mailingParts.length ? mailingParts.join(", ") : undefined;

    const result: PropertyAPIData = {
      parcel: {
        fips: r.fips != null ? String(r.fips) : undefined,
        apn: r.apn,
        county: r.county,
        legalDescription: r.legal_desc,
      },
      location: {
        lat: r.latitude,
        lng: r.longitude,
      },
      building: {
        sqft: r.building_sqft,
        bedrooms: r.rooms_bedrooms,
        bathrooms: r.rooms_baths,
        yearBuilt: r.building_built_year ? parseInt(r.building_built_year, 10) : undefined,
        lotSizeAcres: r.acres_calculated,
        stories: r.stories_count,
      },
      owner: {
        name: r.owner_full_name,
        type: r.owner_type,
        ownerOccupied: r.owner_occupied,
        mailingAddress,
      },
      valuation: {
        marketValue: r.total_value_market,
        assessedTotal: r.total_value_assessed,
      },
      saleHistory: {
        lastSaleDate: saleDate,
        lastSalePrice: r.sale_value,
      },
      tax: {
        annualTax: r.tax_value,
        taxYear: r.tax_year ? parseInt(r.tax_year, 10) : undefined,
      },
      propertyType: r.property_class_desc,
    };

    console.log(`[PropertyAPI] Found parcel: APN=${result.parcel?.apn}, county=${result.parcel?.county}`);
    return result;
  }
}

// Export singleton
export const propertyApiClient = new PropertyAPIClient();
