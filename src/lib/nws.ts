/**
 * NWS (National Weather Service) API Utility
 *
 * Interfaces with the public NWS API for weather alert monitoring.
 * Docs: https://www.weather.gov/documentation/services-web-api
 */

const NWS_BASE_URL = 'https://api.weather.gov';
const USER_AGENT = '(tcds-triage, contact@agency.com)';

// =============================================================================
// TYPES
// =============================================================================

export interface NWSAlertParams {
  /** Filter by NWS zone IDs */
  zone?: string[];
  /** Filter by event type (e.g., "Tornado Warning") */
  event?: string[];
  /** Filter by severity: Extreme, Severe, Moderate, Minor, Unknown */
  severity?: string[];
  /** Filter by urgency */
  urgency?: string[];
  /** Filter by status */
  status?: string[];
  /** Limit results */
  limit?: number;
}

export interface NWSAlert {
  id: string;
  areaDesc: string;
  geocode: {
    SAME?: string[];
    UGC?: string[];
  };
  affectedZones: string[];
  references: Array<{ identifier: string }>;
  sent: string;
  effective: string;
  onset: string;
  expires: string;
  ends: string | null;
  status: string;
  messageType: string;
  category: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  certainty: string;
  urgency: string;
  event: string;
  sender: string;
  senderName: string;
  headline: string | null;
  description: string;
  instruction: string | null;
  response: string;
  parameters: Record<string, string[]>;
}

export interface NWSAlertResponse {
  type: string;
  features: Array<{
    id: string;
    type: string;
    geometry: unknown;
    properties: NWSAlert;
  }>;
  title: string;
  updated: string;
}

export interface NWSZoneInfo {
  zoneId: string;
  zoneName: string;
  state: string;
  county: string;
  forecastOffice: string;
}

// =============================================================================
// ALERT TYPE CATEGORIES (for UI grouping)
// =============================================================================

export const ALERT_TYPE_CATEGORIES: Record<string, string[]> = {
  Tornado: [
    'Tornado Warning',
    'Tornado Watch',
    'Tornado Emergency',
  ],
  'Severe Storm': [
    'Severe Thunderstorm Warning',
    'Severe Thunderstorm Watch',
    'Severe Weather Statement',
    'Special Weather Statement',
  ],
  Flood: [
    'Flash Flood Warning',
    'Flash Flood Watch',
    'Flood Warning',
    'Flood Watch',
    'Flood Advisory',
    'Coastal Flood Warning',
    'Coastal Flood Watch',
    'Coastal Flood Advisory',
    'River Flood Warning',
    'River Flood Watch',
  ],
  Tropical: [
    'Hurricane Warning',
    'Hurricane Watch',
    'Tropical Storm Warning',
    'Tropical Storm Watch',
    'Storm Surge Warning',
    'Storm Surge Watch',
  ],
  Winter: [
    'Winter Storm Warning',
    'Winter Storm Watch',
    'Winter Weather Advisory',
    'Ice Storm Warning',
    'Blizzard Warning',
    'Freeze Warning',
    'Freeze Watch',
    'Frost Advisory',
    'Wind Chill Warning',
    'Wind Chill Watch',
    'Wind Chill Advisory',
  ],
  Wind: [
    'High Wind Warning',
    'High Wind Watch',
    'Wind Advisory',
    'Extreme Wind Warning',
  ],
  Fire: [
    'Red Flag Warning',
    'Fire Weather Watch',
    'Fire Warning',
  ],
  'Heat & Cold': [
    'Excessive Heat Warning',
    'Excessive Heat Watch',
    'Heat Advisory',
    'Extreme Cold Warning',
    'Extreme Cold Watch',
  ],
};

/** Flat list of all known alert event types */
export const ALL_ALERT_TYPES = Object.values(ALERT_TYPE_CATEGORIES).flat();

// =============================================================================
// SEVERITY LEVELS (ordered from most to least severe)
// =============================================================================

export const SEVERITY_LEVELS = ['Extreme', 'Severe', 'Moderate', 'Minor', 'Unknown'] as const;
export type SeverityLevel = typeof SEVERITY_LEVELS[number];

export const SEVERITY_COLORS: Record<string, string> = {
  Extreme: 'bg-red-600 text-white',
  Severe: 'bg-orange-500 text-white',
  Moderate: 'bg-yellow-500 text-black',
  Minor: 'bg-blue-400 text-white',
  Unknown: 'bg-gray-400 text-white',
};

// =============================================================================
// API FUNCTIONS
// =============================================================================

/**
 * Fetch active alerts from the NWS API.
 */
export async function fetchActiveAlerts(params?: NWSAlertParams): Promise<NWSAlertResponse> {
  const url = new URL(`${NWS_BASE_URL}/alerts/active`);

  if (params?.zone?.length) {
    url.searchParams.set('zone', params.zone.join(','));
  }
  if (params?.event?.length) {
    url.searchParams.set('event', params.event.join(','));
  }
  if (params?.severity?.length) {
    url.searchParams.set('severity', params.severity.join(','));
  }
  if (params?.urgency?.length) {
    url.searchParams.set('urgency', params.urgency.join(','));
  }
  if (params?.status?.length) {
    url.searchParams.set('status', params.status.join(','));
  }
  if (params?.limit) {
    url.searchParams.set('limit', String(params.limit));
  }

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    },
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!response.ok) {
    throw new Error(`NWS API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch alerts for a specific area (by point coordinates).
 * First resolves the point to zones, then fetches alerts for those zones.
 */
export async function fetchAlertsForPoint(lat: number, lon: number): Promise<NWSAlertResponse> {
  const zoneInfo = await resolveNWSZone(lat, lon);
  return fetchActiveAlerts({ zone: [zoneInfo.zoneId] });
}

/**
 * Resolve a lat/lon coordinate to an NWS forecast zone.
 * Uses the /points endpoint to get zone information.
 */
export async function resolveNWSZone(lat: number, lon: number): Promise<NWSZoneInfo> {
  const url = `${NWS_BASE_URL}/points/${lat.toFixed(4)},${lon.toFixed(4)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/geo+json',
    },
  });

  if (!response.ok) {
    throw new Error(`NWS Points API error: ${response.status} for ${lat},${lon}`);
  }

  const data = await response.json();
  const props = data.properties;

  // Extract zone ID from the zone URL (e.g., "https://api.weather.gov/zones/forecast/FLZ050")
  const forecastZoneUrl: string = props.forecastZone || '';
  const zoneId = forecastZoneUrl.split('/').pop() || '';

  // Extract county zone from county URL
  const countyUrl: string = props.county || '';
  const county = countyUrl.split('/').pop() || '';

  return {
    zoneId,
    zoneName: props.relativeLocation?.properties?.city || '',
    state: props.relativeLocation?.properties?.state || '',
    county,
    forecastOffice: props.forecastOffice || '',
  };
}

/**
 * Detect if an alert is a PDS (Particularly Dangerous Situation).
 * PDS indicators can appear in multiple fields.
 */
export function isPDS(alert: NWSAlert): boolean {
  // Check tornadoDamageThreat parameter
  const damageThreat = alert.parameters?.tornadoDamageThreat;
  if (damageThreat?.some(v => v.toUpperCase().includes('CATASTROPHIC') || v.toUpperCase().includes('DEVASTATING'))) {
    return true;
  }

  // Check headline for PDS keywords
  const headline = (alert.headline || '').toUpperCase();
  if (headline.includes('PARTICULARLY DANGEROUS SITUATION') || headline.includes('PDS')) {
    return true;
  }

  // Check description
  const desc = (alert.description || '').toUpperCase();
  if (desc.includes('PARTICULARLY DANGEROUS SITUATION')) {
    return true;
  }

  // Check thunderstormDamageThreat
  const thunderDmg = alert.parameters?.thunderstormDamageThreat;
  if (thunderDmg?.some(v => v.toUpperCase().includes('DESTRUCTIVE'))) {
    return true;
  }

  return false;
}

/**
 * Get a severity rank number (lower = more severe) for sorting.
 */
export function severityRank(severity: string): number {
  const idx = SEVERITY_LEVELS.indexOf(severity as SeverityLevel);
  return idx >= 0 ? idx : SEVERITY_LEVELS.length;
}
