// Orion180 HazardHub API Client
// Session-based auth with cookie management for property risk data (storm grades, flood zones, etc.)

const ORION180_USERNAME = process.env.ORION180_USERNAME || '';
const ORION180_PASSWORD = process.env.ORION180_PASSWORD || '';
const BASE_URL = 'https://app.orion180.com';

// =============================================================================
// TYPES
// =============================================================================

export interface Orion180PropertyData {
  // Risk grades (A-F)
  hurricaneGrade: string | null;
  floodGrade: string | null;
  tornadoGrade: string | null;
  wildfireGrade: string | null;
  convectionStormGrade: string | null;
  lightningGrade: string | null;

  // Property details
  yearBuilt: number | null;
  sqft: number | null;
  construction: string | null;
  roofMaterial: string | null;
  roofShape: string | null;
  numFloors: number | null;

  // Location / hazard
  distanceToCoast: number | null;
  protectionClass: string | null;
  femaFloodZone: string | null;
  lat: number | null;
  lng: number | null;

  // Full response for debugging
  raw: Array<{ fieldName: string; value: string }>;
}

// =============================================================================
// FIELD MAPPING
// =============================================================================

function mapFieldValue(fields: Map<string, string>, name: string): string | null {
  return fields.get(name) || null;
}

function mapFieldNumber(fields: Map<string, string>, name: string): number | null {
  const val = fields.get(name);
  if (!val) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
}

function transformResponse(items: Array<{ fieldName: string; value: string }>): Orion180PropertyData {
  const fields = new Map<string, string>();
  for (const item of items) {
    if (item.fieldName && item.value) {
      fields.set(item.fieldName, item.value);
    }
  }

  return {
    hurricaneGrade: mapFieldValue(fields, 'EnhancedHurricane') ?? mapFieldValue(fields, 'Hurricane'),
    floodGrade: mapFieldValue(fields, 'HazardhubFlood') ?? mapFieldValue(fields, 'Flood'),
    tornadoGrade: mapFieldValue(fields, 'EnhancedTornado') ?? mapFieldValue(fields, 'Tornado'),
    wildfireGrade: mapFieldValue(fields, 'EnhancedWildFire') ?? mapFieldValue(fields, 'WildFire'),
    convectionStormGrade: mapFieldValue(fields, 'ConvectionStorm'),
    lightningGrade: mapFieldValue(fields, 'EnhancedLightning') ?? mapFieldValue(fields, 'Lightning'),

    yearBuilt: mapFieldNumber(fields, 'YearBuilt'),
    sqft: mapFieldNumber(fields, 'SquareFootage'),
    construction: mapFieldValue(fields, 'Construction'),
    roofMaterial: mapFieldValue(fields, 'RoofMaterial'),
    roofShape: mapFieldValue(fields, 'RoofShape'),
    numFloors: mapFieldNumber(fields, 'NumFloors'),

    distanceToCoast: mapFieldNumber(fields, 'DistanceToCoast'),
    protectionClass: mapFieldValue(fields, 'ProtectionClass'),
    femaFloodZone: mapFieldValue(fields, 'fema_fld_zone'),
    lat: mapFieldNumber(fields, 'lat'),
    lng: mapFieldNumber(fields, 'lng'),

    raw: items,
  };
}

// =============================================================================
// CLIENT
// =============================================================================

class Orion180Client {
  private sessionCookie: string | null = null;
  private sessionExpiresAt: number = 0;
  private authPromise: Promise<string | null> | null = null;

  isConfigured(): boolean {
    return Boolean(ORION180_USERNAME && ORION180_PASSWORD);
  }

  private isSessionValid(): boolean {
    return !!this.sessionCookie && Date.now() < this.sessionExpiresAt;
  }

  private async authenticate(): Promise<string | null> {
    console.log('[Orion180] Authenticating...');

    const response = await fetch(`${BASE_URL}/api/auth/signIn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: ORION180_USERNAME, password: ORION180_PASSWORD }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`[Orion180] Auth failed: ${response.status} ${response.statusText}`);
      return null;
    }

    // Capture session cookies — getSetCookie() returns all Set-Cookie headers
    const setCookies = response.headers.getSetCookie?.() || [];
    const cookieHeader = setCookies.map(c => c.split(';')[0]).join('; ')
      || response.headers.get('set-cookie')?.split(';')[0]
      || '';
    if (!cookieHeader) {
      console.error('[Orion180] No set-cookie header in auth response');
      return null;
    }

    this.sessionCookie = cookieHeader;
    this.sessionExpiresAt = Date.now() + 55 * 60 * 1000; // 55 min
    console.log('[Orion180] Authenticated successfully');
    return this.sessionCookie;
  }

  private async getSession(): Promise<string | null> {
    if (this.isSessionValid() && this.sessionCookie) {
      return this.sessionCookie;
    }

    // Deduplicate concurrent auth requests
    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = this.authenticate();
    const result = await this.authPromise;
    this.authPromise = null;
    return result;
  }

  async lookupProperty(
    address: string,
    city: string,
    state: string,
    zip: string,
  ): Promise<Orion180PropertyData | null> {
    if (!this.isConfigured()) {
      console.log('[Orion180] Not configured — no credentials');
      return null;
    }

    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const cookie = await this.getSession();
        if (!cookie) {
          console.error('[Orion180] No valid session');
          return null;
        }

        console.log(`[Orion180] Looking up: ${address}, ${city}, ${state} ${zip}`);

        const response = await fetch(`${BASE_URL}/api/quote/propertyattrib/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          body: JSON.stringify({
            addr1: address,
            city,
            state,
            zip,
            county: '',
            propertyId: 0,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (response.status === 401 && attempt === 0) {
          console.log('[Orion180] 401 — re-authenticating...');
          this.sessionCookie = null;
          this.sessionExpiresAt = 0;
          continue;
        }

        if (!response.ok) {
          console.error(`[Orion180] API error: ${response.status} ${response.statusText}`);
          return null;
        }

        const json = await response.json();

        // Response is an array of { fieldName, value } objects
        if (!Array.isArray(json) || json.length === 0) {
          console.log('[Orion180] Empty or invalid response');
          return null;
        }

        const data = transformResponse(json);
        console.log(`[Orion180] Got ${json.length} fields — hurricane=${data.hurricaneGrade}, flood=${data.floodGrade}`);
        return data;
      }

      return null;
    } catch (error: any) {
      console.error('[Orion180] Lookup error:', error.message);
      return null;
    }
  }
}

// Export singleton
export const orion180Client = new Orion180Client();
