// FEMA Flood Zone Service
// Integrates with LightBox FEMA National Flood Hazard Layer API

const LIGHTBOX_API_KEY = process.env.LIGHTBOX_API_KEY;
const LIGHTBOX_BASE_URL = "https://api.lightboxre.com/v1";

// =============================================================================
// TYPES
// =============================================================================

export interface FloodZoneData {
  floodZone: string;
  floodRisk: "High" | "Moderate" | "Low" | "Minimal" | "Unknown";
  specialFloodHazardArea: boolean;
  panelNumber?: string;
  effectiveDate?: string;
  communityNumber?: string;
  requiresFloodInsurance: boolean;
  description: string;
  source: "lightbox" | "rpr" | "manual";
}

export interface FloodZoneCheckResult {
  success: boolean;
  data?: FloodZoneData;
  error?: string;
  cached?: boolean;
}

// =============================================================================
// FLOOD ZONE DEFINITIONS
// =============================================================================

export const FLOOD_ZONE_INFO: Record<string, { risk: FloodZoneData["floodRisk"]; description: string; sfha: boolean }> = {
  // High Risk - Special Flood Hazard Areas (SFHA)
  A: { risk: "High", description: "High risk - 1% annual chance of flooding", sfha: true },
  AE: { risk: "High", description: "High risk - Base flood elevations determined", sfha: true },
  AH: { risk: "High", description: "High risk - Shallow flooding (1-3 feet)", sfha: true },
  AO: { risk: "High", description: "High risk - Sheet flow flooding", sfha: true },
  AR: { risk: "High", description: "High risk - Temporary flood protection removed", sfha: true },
  A99: { risk: "High", description: "High risk - Federal flood protection under construction", sfha: true },
  V: { risk: "High", description: "High risk - Coastal flooding with wave action", sfha: true },
  VE: { risk: "High", description: "High risk - Coastal with base flood elevations", sfha: true },

  // Moderate Risk
  B: { risk: "Moderate", description: "Moderate risk - 0.2% annual chance", sfha: false },
  X500: { risk: "Moderate", description: "Moderate risk - 500-year floodplain", sfha: false },
  "X (shaded)": { risk: "Moderate", description: "Moderate risk - 500-year floodplain", sfha: false },

  // Minimal Risk
  C: { risk: "Minimal", description: "Minimal risk - Outside 500-year floodplain", sfha: false },
  X: { risk: "Minimal", description: "Minimal risk - Outside 500-year floodplain", sfha: false },
  "X (unshaded)": { risk: "Minimal", description: "Minimal risk - Area of minimal flood hazard", sfha: false },

  // Other
  D: { risk: "Unknown", description: "Undetermined - No flood hazard analysis performed", sfha: false },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function determineFloodRisk(zone: string | undefined | null): FloodZoneData["floodRisk"] {
  if (!zone) return "Unknown";

  const normalizedZone = zone.toUpperCase().trim();
  const info = FLOOD_ZONE_INFO[normalizedZone];

  if (info) return info.risk;

  // Handle variations
  if (normalizedZone.startsWith("A") || normalizedZone.startsWith("V")) {
    return "High";
  }
  if (normalizedZone.includes("500") || normalizedZone === "B") {
    return "Moderate";
  }
  if (normalizedZone === "X" || normalizedZone === "C") {
    return "Minimal";
  }

  return "Unknown";
}

export function isInSFHA(zone: string | undefined | null): boolean {
  if (!zone) return false;

  const normalizedZone = zone.toUpperCase().trim();
  const info = FLOOD_ZONE_INFO[normalizedZone];

  if (info) return info.sfha;

  // Default check for A and V zones
  return normalizedZone.startsWith("A") || normalizedZone.startsWith("V");
}

export function getFloodZoneDescription(zone: string | undefined | null): string {
  if (!zone) return "Flood zone not determined";

  const normalizedZone = zone.toUpperCase().trim();
  const info = FLOOD_ZONE_INFO[normalizedZone];

  return info?.description || `Flood Zone ${zone}`;
}

export function parseFloodZoneData(
  zone: string | undefined | null,
  source: FloodZoneData["source"] = "rpr"
): FloodZoneData {
  const risk = determineFloodRisk(zone);
  const sfha = isInSFHA(zone);

  return {
    floodZone: zone || "Unknown",
    floodRisk: risk,
    specialFloodHazardArea: sfha,
    requiresFloodInsurance: sfha,
    description: getFloodZoneDescription(zone),
    source,
  };
}

// =============================================================================
// LIGHTBOX API INTEGRATION
// =============================================================================

export async function getFloodZoneByAddress(address: string): Promise<FloodZoneCheckResult> {
  if (!LIGHTBOX_API_KEY) {
    console.warn("[FEMA Flood] LightBox API key not configured");
    return {
      success: false,
      error: "Flood zone lookup service not configured",
    };
  }

  try {
    const response = await fetch(
      `${LIGHTBOX_BASE_URL}/nfhls/address/search?text=${encodeURIComponent(address)}`,
      {
        headers: {
          "x-api-key": LIGHTBOX_API_KEY,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: "No flood zone data found for this address",
        };
      }
      throw new Error(`LightBox API error: ${response.status}`);
    }

    const data = await response.json();

    // Extract flood zone from response
    // LightBox returns features array with flood zone info
    const feature = data.features?.[0];
    if (!feature?.properties) {
      return {
        success: false,
        error: "No flood zone data in response",
      };
    }

    const props = feature.properties;
    const zone = props.fld_zone || props.floodZone || props.ZONE_SUBTY;

    return {
      success: true,
      data: {
        floodZone: zone || "Unknown",
        floodRisk: determineFloodRisk(zone),
        specialFloodHazardArea: isInSFHA(zone),
        panelNumber: props.panel_num || props.DFIRM_ID,
        effectiveDate: props.eff_date || props.EFF_DATE,
        communityNumber: props.comm_num || props.CID,
        requiresFloodInsurance: isInSFHA(zone),
        description: getFloodZoneDescription(zone),
        source: "lightbox",
      },
    };
  } catch (error) {
    console.error("[FEMA Flood] LightBox API error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Flood zone lookup failed",
    };
  }
}

export async function getFloodZoneByCoordinates(
  latitude: number,
  longitude: number
): Promise<FloodZoneCheckResult> {
  if (!LIGHTBOX_API_KEY) {
    return {
      success: false,
      error: "Flood zone lookup service not configured",
    };
  }

  try {
    const wkt = `POINT(${longitude} ${latitude})`;
    const response = await fetch(
      `${LIGHTBOX_BASE_URL}/nfhls/us/geometry?wkt=${encodeURIComponent(wkt)}&bufferDistance=50&bufferUnit=m`,
      {
        headers: {
          "x-api-key": LIGHTBOX_API_KEY,
          "Accept": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`LightBox API error: ${response.status}`);
    }

    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature?.properties) {
      return {
        success: false,
        error: "No flood zone data found for coordinates",
      };
    }

    const props = feature.properties;
    const zone = props.fld_zone || props.floodZone;

    return {
      success: true,
      data: {
        floodZone: zone || "Unknown",
        floodRisk: determineFloodRisk(zone),
        specialFloodHazardArea: isInSFHA(zone),
        panelNumber: props.panel_num,
        effectiveDate: props.eff_date,
        communityNumber: props.comm_num,
        requiresFloodInsurance: isInSFHA(zone),
        description: getFloodZoneDescription(zone),
        source: "lightbox",
      },
    };
  } catch (error) {
    console.error("[FEMA Flood] Coordinate lookup error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Flood zone lookup failed",
    };
  }
}

// =============================================================================
// RISK SCORING
// =============================================================================

export function getFloodRiskScore(zone: string | undefined | null): number {
  const risk = determineFloodRisk(zone);

  switch (risk) {
    case "High": return 90;
    case "Moderate": return 50;
    case "Low": return 25;
    case "Minimal": return 10;
    default: return 0;
  }
}

export function getFloodInsuranceRecommendation(data: FloodZoneData): {
  recommended: boolean;
  required: boolean;
  reason: string;
} {
  if (data.specialFloodHazardArea) {
    return {
      recommended: true,
      required: true,
      reason: `Property is in a Special Flood Hazard Area (Zone ${data.floodZone}). Flood insurance is required by lenders for mortgaged properties.`,
    };
  }

  if (data.floodRisk === "Moderate") {
    return {
      recommended: true,
      required: false,
      reason: `Property is in a moderate flood risk area (Zone ${data.floodZone}). Flood insurance is recommended even though not required.`,
    };
  }

  return {
    recommended: false,
    required: false,
    reason: `Property is in a minimal flood risk area (Zone ${data.floodZone}). Flood insurance is optional but may still be beneficial.`,
  };
}
