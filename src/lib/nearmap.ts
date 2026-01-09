// =============================================================================
// Nearmap API Client - Correct API Implementation
// Documentation: https://developer.nearmap.com/
// =============================================================================
// Endpoints:
// - /ai/features/v4/features.json - AI feature detection (building, roof, pool, solar)
// - /coverage/v2/coord/{lat}/{lon} - Historical survey availability
// - /tiles/v3/Vert/{z}/{x}/{y}.jpg - Map tile imagery
// - /staticmap/v3/staticmap - Static aerial images
// =============================================================================

const NEARMAP_API_URL = 'https://api.nearmap.com';

// =============================================================================
// TYPES
// =============================================================================

export interface NearmapFeatures {
  surveyDate: string;
  surveyId?: string;
  building: {
    footprintArea: number;
    count: number;
    polygons: any[];
  };
  roof: {
    material: string;
    condition: string;
    conditionScore: number;
    area: number;
    age?: number;
    issues: string[];
  };
  pool: {
    present: boolean;
    type?: 'in-ground' | 'above-ground';
    fenced?: boolean;
    area?: number;
  };
  solar: {
    present: boolean;
    panelCount?: number;
    area?: number;
  };
  vegetation: {
    treeCount: number;
    coveragePercent: number;
    proximityToStructure: 'none' | 'minor' | 'moderate' | 'significant';
    treeOverhangArea?: number;
  };
  hazards: {
    trampoline: boolean;
    debris: boolean;
    construction: boolean;
  };
  tileUrl: string;
  staticImageUrl?: string;
}

export interface NearmapSurvey {
  id: string;
  captureDate: string;
  timezone: string;
  location?: {
    country: string;
    state: string;
    region: string;
  };
  pixelSize?: number;
  resources: {
    tiles?: any[];
    aifeatures?: any[];
    photos?: any[];
  };
}

export interface ObliqueViews {
  north: string;
  south: string;
  east: string;
  west: string;
}

interface NearmapAPIResponse {
  credits?: number;
  resourceId?: string;
  surveyId?: string;
  surveyDate?: string;
  features?: NearmapFeature[];
}

interface NearmapFeature {
  id: string;
  description: string;
  confidence: number;
  areaSqft?: number;
  areaSqm?: number;
  geometry: {
    type: string;
    coordinates: number[][][];
  };
  surveyDate?: string;
  attributes?: any[];
  properties?: Record<string, any>;
}

// =============================================================================
// API CLIENT
// =============================================================================

class NearmapClient {
  private apiKey: string;
  private aiApiKey: string;
  private d3ApiKey: string;
  private imageApiKey: string;

  constructor() {
    this.apiKey = process.env.NEARMAP_API_KEY || '';
    this.aiApiKey = process.env.NEARMAP_AI_API_KEY || '';
    this.d3ApiKey = process.env.NEARMAP_D3_API_KEY || '';
    this.imageApiKey = process.env.NEARMAP_IMAGE_API_KEY || '';
  }

  /**
   * Get the appropriate API key for an endpoint
   */
  private getKeyForEndpoint(endpoint: string): string {
    if (endpoint.includes('/ai/')) {
      return this.aiApiKey || this.apiKey;
    }
    if (endpoint.includes('/staticmap/') || endpoint.includes('/tiles/')) {
      return this.imageApiKey || this.apiKey;
    }
    return this.apiKey;
  }

  /**
   * Make authenticated API request
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    const apiKey = this.getKeyForEndpoint(endpoint);

    if (!apiKey) {
      throw new Error('NEARMAP_API_KEY not configured');
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${NEARMAP_API_URL}${endpoint}${separator}apikey=${apiKey}`;

    console.log(`[Nearmap] Fetching: ${endpoint.split('?')[0]}`);

    const response = await fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Nearmap] API error: ${response.status} - ${text}`);
      throw new Error(`Nearmap API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create bounding polygon from lat/lng (approximately 72 feet around point)
   */
  private createBoundingPolygon(lat: number, lng: number, offsetDegrees: number = 0.0002): string {
    const minLng = lng - offsetDegrees;
    const maxLng = lng + offsetDegrees;
    const minLat = lat - offsetDegrees;
    const maxLat = lat + offsetDegrees;

    // Polygon format: lon1,lat1,lon2,lat2,lon3,lat3,lon4,lat4,lon1,lat1 (closed)
    return `${minLng},${minLat},${maxLng},${minLat},${maxLng},${maxLat},${minLng},${maxLat},${minLng},${minLat}`;
  }

  // ---------------------------------------------------------------------------
  // Main Features API - Correct Implementation
  // ---------------------------------------------------------------------------

  /**
   * Get comprehensive AI feature analysis for a location
   * Uses the correct /ai/features/v4/features.json endpoint with polygon
   */
  async getFeatures(lat: number, lng: number): Promise<NearmapFeatures | null> {
    try {
      // Build bounding polygon (larger area to capture full property)
      const polygon = this.createBoundingPolygon(lat, lng, 0.0005);

      // Call the main features endpoint (no packs param - returns all available features)
      const params = new URLSearchParams({
        polygon: polygon,
        since: '2020-01-01',
      });

      const data: NearmapAPIResponse = await this.fetch(
        `/ai/features/v4/features.json?${params.toString()}`
      );

      console.log(`[Nearmap] Got ${data.features?.length || 0} features`);

      // Build static image URL
      const staticImageUrl = this.getStaticImageUrl(lat, lng, 800, 600);
      const tileUrl = this.getTileUrl(lat, lng, 19);

      // Parse features into structured data
      const features = data.features || [];

      // Extract building data
      const buildings = features.filter(f =>
        f.description?.toLowerCase().includes('building') ||
        f.description?.toLowerCase().includes('footprint')
      );
      const totalBuildingArea = buildings.reduce((sum, f) => sum + (f.areaSqft || f.areaSqm || 0), 0);

      // Extract roof data - based on actual Nearmap API response format
      const roofIssues: string[] = [];
      let roofScore = 100;
      let roofArea = 0;
      let roofMaterial = 'Unknown';
      let roofCondition = 'unknown';

      // Get main roof feature
      const roofFeature = features.find(f => f.description === 'Roof');
      if (roofFeature) {
        roofArea = roofFeature.areaSqft || roofFeature.areaSqm || 0;
      }

      // Get roof material (Shingle, Tile, Metal, etc.)
      const materialFeature = features.find(f =>
        ['Shingle', 'Tile', 'Metal', 'Slate', 'Asphalt'].includes(f.description || '')
      );
      if (materialFeature) {
        roofMaterial = materialFeature.description || 'Unknown';
      }

      // Get roof type (Hip, Flat, Gable, etc.)
      const roofTypeFeature = features.find(f =>
        ['Hip', 'Flat', 'Gable'].includes(f.description || '')
      );

      // Process roof issues
      for (const f of features) {
        const desc = f.description || '';
        const area = f.areaSqft || f.areaSqm || 0;

        if (desc.includes('Staining')) {
          roofIssues.push(`${desc} (${Math.round(area)} sq ft)`);
          roofScore -= Math.min(20, area * 0.2);
        }
        if (desc.includes('Ponding')) {
          roofIssues.push(`${desc} (${Math.round(area)} sq ft)`);
          roofScore -= Math.min(25, area * 0.3);
        }
        if (desc.includes('Missing') || desc.includes('Damage')) {
          roofIssues.push(`${desc} (${Math.round(area)} sq ft)`);
          roofScore -= Math.min(30, area * 0.5);
        }
        if (desc.includes('Debris') || desc.includes('Tarp')) {
          roofIssues.push(`${desc} (${Math.round(area)} sq ft)`);
          roofScore -= Math.min(20, area * 0.4);
        }
      }

      roofScore = Math.max(0, Math.min(100, roofScore));
      if (roofScore >= 90) roofCondition = 'excellent';
      else if (roofScore >= 80) roofCondition = 'good';
      else if (roofScore >= 70) roofCondition = 'fair';
      else if (roofScore >= 60) roofCondition = 'poor';
      else roofCondition = 'severe';

      // Extract pool data
      const poolFeatures = features.filter(f =>
        f.description?.toLowerCase().includes('pool') ||
        f.description?.toLowerCase().includes('swimming')
      );
      const hasPool = poolFeatures.length > 0;
      const poolArea = poolFeatures.reduce((sum, f) => sum + (f.areaSqft || f.areaSqm || 0), 0);

      // Extract solar data
      const solarFeatures = features.filter(f =>
        f.description?.toLowerCase().includes('solar')
      );
      const hasSolar = solarFeatures.length > 0;
      const solarArea = solarFeatures.reduce((sum, f) => sum + (f.areaSqft || f.areaSqm || 0), 0);

      // Extract vegetation/tree data
      const treeFeatures = features.filter(f =>
        f.description?.toLowerCase().includes('tree') ||
        f.description?.toLowerCase().includes('vegetation') ||
        f.description?.toLowerCase().includes('overhang')
      );
      const treeOverhangArea = treeFeatures
        .filter(f => f.description?.toLowerCase().includes('overhang'))
        .reduce((sum, f) => sum + (f.areaSqft || f.areaSqm || 0), 0);

      let treeProximity: 'none' | 'minor' | 'moderate' | 'significant' = 'none';
      if (treeOverhangArea > 200) treeProximity = 'significant';
      else if (treeOverhangArea > 100) treeProximity = 'moderate';
      else if (treeOverhangArea > 0) treeProximity = 'minor';

      if (treeOverhangArea > 0) {
        roofIssues.push(`Tree overhang (${Math.round(treeOverhangArea)} sq ft)`);
        roofScore -= Math.min(15, treeOverhangArea * 0.1);
        roofScore = Math.max(0, roofScore);
      }

      // Extract hazards
      const trampolineFeatures = features.filter(f =>
        f.description?.toLowerCase().includes('trampoline')
      );
      const debrisFeatures = features.filter(f =>
        f.description?.toLowerCase().includes('debris') &&
        !f.description?.toLowerCase().includes('roof')
      );

      return {
        surveyDate: data.surveyDate || new Date().toISOString().split('T')[0],
        surveyId: data.surveyId,
        building: {
          footprintArea: totalBuildingArea || roofArea,
          count: buildings.length || 1,
          polygons: buildings.map(b => b.geometry),
        },
        roof: {
          material: roofMaterial,
          condition: roofCondition,
          conditionScore: Math.round(roofScore),
          area: roofArea || totalBuildingArea,
          issues: roofIssues,
        },
        pool: {
          present: hasPool,
          type: poolFeatures[0]?.description?.toLowerCase().includes('above') ? 'above-ground' : 'in-ground',
          area: poolArea,
        },
        solar: {
          present: hasSolar,
          panelCount: solarFeatures.length,
          area: solarArea,
        },
        vegetation: {
          treeCount: treeFeatures.length,
          coveragePercent: 0,
          proximityToStructure: treeProximity,
          treeOverhangArea,
        },
        hazards: {
          trampoline: trampolineFeatures.length > 0,
          debris: debrisFeatures.length > 0,
          construction: features.some(f => f.description?.toLowerCase().includes('construction')),
        },
        tileUrl,
        staticImageUrl,
      };
    } catch (error) {
      console.error('[Nearmap] getFeatures error:', error);

      // Return minimal data with just image URLs if API fails
      const staticImageUrl = this.getStaticImageUrl(lat, lng, 800, 600);
      if (staticImageUrl) {
        return {
          surveyDate: new Date().toISOString().split('T')[0],
          building: { footprintArea: 0, count: 0, polygons: [] },
          roof: { material: 'Unknown', condition: 'unknown', conditionScore: 0, area: 0, issues: ['API unavailable'] },
          pool: { present: false },
          solar: { present: false },
          vegetation: { treeCount: 0, coveragePercent: 0, proximityToStructure: 'none' },
          hazards: { trampoline: false, debris: false, construction: false },
          tileUrl: this.getTileUrl(lat, lng, 19),
          staticImageUrl,
        };
      }
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Coverage & Surveys
  // ---------------------------------------------------------------------------

  /**
   * Get available surveys for a location
   */
  async getSurveys(lat: number, lng: number): Promise<NearmapSurvey[]> {
    try {
      const data = await this.fetch(`/coverage/v2/coord/${lat}/${lng}`);
      return data.surveys || [];
    } catch (error) {
      console.error('[Nearmap] getSurveys error:', error);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Tiles & Static Images
  // ---------------------------------------------------------------------------

  /**
   * Get tile URL for aerial imagery
   */
  getTileUrl(lat: number, lng: number, zoom: number = 19): string {
    const key = this.imageApiKey || this.apiKey;
    if (!key) return '';
    return `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg?apikey=${key}`;
  }

  /**
   * Get static aerial image URL
   * Uses Google Static Maps as fallback since Nearmap static maps may be unavailable
   */
  getStaticImageUrl(lat: number, lng: number, width: number = 800, height: number = 600): string {
    // Use Google Static Maps for reliable satellite imagery
    const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
    if (googleKey) {
      return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=19&size=${width}x${height}&maptype=satellite&key=${googleKey}`;
    }
    // Fallback to Nearmap if available
    const key = this.imageApiKey || this.apiKey;
    if (!key) return '';
    return `https://api.nearmap.com/staticmap/v3/staticmap?center=${lat},${lng}&size=${width}x${height}&zoom=19&apikey=${key}`;
  }

  /**
   * Get oblique view URLs (N/S/E/W angles)
   */
  async getObliqueViews(lat: number, lng: number): Promise<ObliqueViews | null> {
    const key = this.imageApiKey || this.apiKey;
    if (!key) return null;

    return {
      north: `https://api.nearmap.com/staticmap/v3/staticmap?center=${lat},${lng}&size=400x300&zoom=19&direction=N&apikey=${key}`,
      south: `https://api.nearmap.com/staticmap/v3/staticmap?center=${lat},${lng}&size=400x300&zoom=19&direction=S&apikey=${key}`,
      east: `https://api.nearmap.com/staticmap/v3/staticmap?center=${lat},${lng}&size=400x300&zoom=19&direction=E&apikey=${key}`,
      west: `https://api.nearmap.com/staticmap/v3/staticmap?center=${lat},${lng}&size=400x300&zoom=19&direction=W&apikey=${key}`,
    };
  }

  /**
   * Get historical surveys with image URLs
   */
  async getHistoricalSurveys(lat: number, lng: number): Promise<Array<{ date: string; imageUrl: string }>> {
    try {
      const surveys = await this.getSurveys(lat, lng);
      return surveys.slice(0, 10).map(survey => ({
        date: survey.captureDate,
        imageUrl: this.getStaticImageUrl(lat, lng),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey || !!this.aiApiKey;
  }

  /**
   * Get configuration status for all keys
   */
  getKeyStatus(): Record<string, boolean> {
    return {
      coverage: !!this.apiKey,
      ai: !!this.aiApiKey,
      d3: !!this.d3ApiKey,
      image: !!this.imageApiKey,
    };
  }
}

// Export singleton instance
export const nearmapClient = new NearmapClient();

// =============================================================================
// Mock Data for Development/Fallback
// =============================================================================

export function getMockNearmapData(lat: number, lng: number, surveyDate?: string): NearmapFeatures {
  const hash = Math.abs(Math.round(lat * 1000) + Math.round(lng * 1000)) % 100;

  return {
    surveyDate: surveyDate || new Date().toISOString().split('T')[0],
    building: {
      footprintArea: 2000 + hash * 20,
      count: 1,
      polygons: [],
    },
    roof: {
      material: ['Composition Shingle', 'Metal', 'Tile', 'Slate'][hash % 4],
      condition: ['good', 'fair', 'poor'][hash % 3],
      conditionScore: 50 + (hash % 40),
      area: 2400 + hash * 15,
      age: 5 + (hash % 20),
      issues: [],
    },
    pool: {
      present: hash % 4 === 0,
      type: hash % 2 === 0 ? 'in-ground' : 'above-ground',
      fenced: hash % 3 !== 0,
    },
    solar: {
      present: hash % 5 === 0,
      panelCount: hash % 5 === 0 ? 10 + (hash % 20) : undefined,
    },
    vegetation: {
      treeCount: hash % 10,
      coveragePercent: hash % 40,
      proximityToStructure: ['none', 'minor', 'moderate', 'significant'][hash % 4] as any,
    },
    hazards: {
      trampoline: hash % 8 === 0,
      debris: hash % 12 === 0,
      construction: hash % 15 === 0,
    },
    tileUrl: `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg`,
  };
}
