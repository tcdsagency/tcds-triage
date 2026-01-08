// =============================================================================
// Nearmap API Client - Multi-Key Support
// Documentation: https://developer.nearmap.com/
// =============================================================================
// Key routing:
// - NEARMAP_API_KEY (XDH-Prod): Coverage, surveys, tiles, static maps
// - NEARMAP_AI_API_KEY: AI features (roof, pool, solar, vegetation)
// - NEARMAP_D3_API_KEY: D3 Location Insights
// - NEARMAP_IMAGE_API_KEY: High-res imagery portal
// =============================================================================

const NEARMAP_API_URL = 'https://api.nearmap.com';

// =============================================================================
// TYPES
// =============================================================================

export interface NearmapFeatures {
  surveyDate: string;
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
  };
  pool: {
    present: boolean;
    type?: 'in-ground' | 'above-ground';
    fenced?: boolean;
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
  };
  hazards: {
    trampoline: boolean;
    debris: boolean;
    construction: boolean;
  };
  tileUrl: string;
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

// =============================================================================
// API CLIENT - Multi-Key Support
// =============================================================================

type ApiKeyType = 'coverage' | 'ai' | 'd3' | 'image';

class NearmapClient {
  private apiKey: string;      // XDH-Prod - Coverage, surveys, tiles
  private aiApiKey: string;    // AI Feature API - roof, pool, solar
  private d3ApiKey: string;    // D3 Location Insights
  private imageApiKey: string; // Image Data Portal

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
    // AI features use AI key
    if (endpoint.includes('/ai/')) {
      return this.aiApiKey || this.apiKey;
    }
    // D3/insights use D3 key
    if (endpoint.includes('/d3/') || endpoint.includes('/insights/')) {
      return this.d3ApiKey || this.apiKey;
    }
    // Static maps and high-res imagery can use image key
    if (endpoint.includes('/staticmap/') || endpoint.includes('/image/')) {
      return this.imageApiKey || this.apiKey;
    }
    // Default to main API key
    return this.apiKey;
  }

  /**
   * Make authenticated API request with appropriate key
   */
  private async fetch(endpoint: string, options: RequestInit = {}) {
    const apiKey = this.getKeyForEndpoint(endpoint);

    if (!apiKey) {
      throw new Error('NEARMAP_API_KEY not configured');
    }

    // Nearmap uses apikey query parameter
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${NEARMAP_API_URL}${endpoint}${separator}apikey=${apiKey}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Nearmap API error: ${response.status} ${response.statusText} - ${text}`);
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // Coverage & Surveys
  // ---------------------------------------------------------------------------

  /**
   * Get available surveys for a location
   */
  async getSurveys(lat: number, lng: number): Promise<NearmapSurvey[]> {
    try {
      const data = await this.fetch(
        `/coverage/v2/point/${lng},${lat}?resources=tiles,aifeatures`
      );
      return data.surveys || [];
    } catch (error) {
      console.error('Nearmap getSurveys error:', error);
      return [];
    }
  }

  /**
   * Get the latest survey date for a location
   */
  async getLatestSurveyDate(lat: number, lng: number): Promise<string | null> {
    const surveys = await this.getSurveys(lat, lng);
    return surveys[0]?.captureDate || null;
  }

  // ---------------------------------------------------------------------------
  // AI Features - Roof, Pool, Solar, Vegetation, Building
  // ---------------------------------------------------------------------------

  /**
   * Get comprehensive AI feature analysis for a location
   */
  async getFeatures(lat: number, lng: number): Promise<NearmapFeatures | null> {
    try {
      // Get the latest survey
      const surveys = await this.getSurveys(lat, lng);
      if (surveys.length === 0) {
        console.log('Nearmap: No surveys available for location');
        return null;
      }

      const latestSurvey = surveys[0];

      // Get AI features in parallel - roof, building, pool, solar, vegetation
      const [roofData, buildingData, poolData, solarData, vegetationData, trampolineData] = await Promise.all([
        this.getRoofAnalysis(lat, lng).catch((e) => { console.log('Roof analysis error:', e.message); return null; }),
        this.getBuildingFootprints(lat, lng).catch((e) => { console.log('Building analysis error:', e.message); return null; }),
        this.getPoolDetection(lat, lng).catch((e) => { console.log('Pool detection error:', e.message); return null; }),
        this.getSolarDetection(lat, lng).catch((e) => { console.log('Solar detection error:', e.message); return null; }),
        this.getVegetationAnalysis(lat, lng).catch((e) => { console.log('Vegetation analysis error:', e.message); return null; }),
        this.getTrampolineDetection(lat, lng).catch((e) => { console.log('Trampoline detection error:', e.message); return null; }),
      ]);

      // Build tile URL
      const tileUrl = this.getTileUrl(lat, lng, 19);

      return {
        surveyDate: latestSurvey.captureDate,
        building: {
          footprintArea: buildingData?.totalArea || 0,
          count: buildingData?.count || 1,
          polygons: buildingData?.polygons || [],
        },
        roof: {
          material: roofData?.material || 'unknown',
          condition: roofData?.condition || 'unknown',
          conditionScore: roofData?.conditionScore || 0,
          area: roofData?.area || 0,
          age: roofData?.estimatedAge,
        },
        pool: {
          present: poolData?.detected || false,
          type: poolData?.type as 'in-ground' | 'above-ground' | undefined,
          fenced: poolData?.fenced,
        },
        solar: {
          present: solarData?.detected || false,
          panelCount: solarData?.panelCount,
          area: solarData?.area,
        },
        vegetation: {
          treeCount: vegetationData?.treeCount || 0,
          coveragePercent: vegetationData?.coveragePercent || 0,
          proximityToStructure: vegetationData?.proximity || 'none',
        },
        hazards: {
          trampoline: trampolineData?.detected || false,
          debris: false, // Would need debris detection endpoint
          construction: false, // Would need construction detection endpoint
        },
        tileUrl,
      };
    } catch (error) {
      console.error('Nearmap getFeatures error:', error);
      return null;
    }
  }

  /**
   * Get roof analysis from AI Feature API
   */
  async getRoofAnalysis(lat: number, lng: number) {
    try {
      const data = await this.fetch(
        `/ai/features/v4/roof.json?point=${lng},${lat}`
      );

      const roof = data.features?.[0]?.properties;
      if (!roof) return null;

      return {
        material: roof.roofMaterial || roof.material || 'unknown',
        condition: roof.roofCondition || roof.condition || 'unknown',
        conditionScore: this.conditionToScore(roof.roofCondition || roof.condition),
        area: roof.roofArea || roof.area || 0,
        estimatedAge: roof.estimatedAge || roof.age,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get building footprints
   */
  async getBuildingFootprints(lat: number, lng: number) {
    try {
      const data = await this.fetch(
        `/ai/features/v4/building.json?point=${lng},${lat}`
      );

      const features = data.features || [];
      return {
        count: features.length,
        totalArea: features.reduce((sum: number, f: any) => sum + (f.properties?.area || 0), 0),
        polygons: features.map((f: any) => f.geometry),
      };
    } catch {
      return null;
    }
  }

  /**
   * Get pool detection
   */
  async getPoolDetection(lat: number, lng: number) {
    try {
      const data = await this.fetch(
        `/ai/features/v4/swimming_pool.json?point=${lng},${lat}`
      );

      const pool = data.features?.[0];
      if (!pool) return { detected: false };

      return {
        detected: true,
        type: pool.properties?.poolType === 'above_ground' ? 'above-ground' : 'in-ground',
        fenced: pool.properties?.fenced,
        condition: pool.properties?.condition,
      };
    } catch {
      return { detected: false };
    }
  }

  /**
   * Get solar panel detection
   */
  async getSolarDetection(lat: number, lng: number) {
    try {
      const data = await this.fetch(
        `/ai/features/v4/solar_panel.json?point=${lng},${lat}`
      );

      const features = data.features || [];
      if (features.length === 0) return { detected: false };

      return {
        detected: true,
        panelCount: features.length,
        area: features.reduce((sum: number, f: any) => sum + (f.properties?.area || 0), 0),
      };
    } catch {
      return { detected: false };
    }
  }

  /**
   * Get vegetation/tree analysis
   */
  async getVegetationAnalysis(lat: number, lng: number) {
    try {
      const data = await this.fetch(
        `/ai/features/v4/vegetation.json?point=${lng},${lat}`
      );

      const features = data.features || [];
      const trees = features.filter((f: any) => f.properties?.type === 'tree' || f.properties?.class === 'tree');

      return {
        treeCount: trees.length || features.length,
        coveragePercent: data.coveragePercent || 0,
        proximity: data.structureProximity || 'none',
      };
    } catch {
      return null;
    }
  }

  /**
   * Get trampoline detection
   */
  async getTrampolineDetection(lat: number, lng: number) {
    try {
      const data = await this.fetch(
        `/ai/features/v4/trampoline.json?point=${lng},${lat}`
      );

      const features = data.features || [];
      return {
        detected: features.length > 0,
        count: features.length,
      };
    } catch {
      return { detected: false };
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
   */
  getStaticImageUrl(lat: number, lng: number, width: number = 800, height: number = 600): string {
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

    const directions = ['N', 'S', 'E', 'W'] as const;
    const views: Partial<ObliqueViews> = {};

    for (const dir of directions) {
      views[dir.toLowerCase() as keyof ObliqueViews] =
        `https://api.nearmap.com/staticmap/v3/staticmap?center=${lat},${lng}&size=400x300&zoom=19&direction=${dir}&apikey=${key}`;
    }

    return views as ObliqueViews;
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

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  /**
   * Convert condition string to numeric score (0-100)
   */
  private conditionToScore(condition: string): number {
    const scores: Record<string, number> = {
      'excellent': 95,
      'good': 80,
      'fair': 60,
      'poor': 40,
      'severe': 20,
      'critical': 10,
    };
    return scores[condition?.toLowerCase()] || 50;
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
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

export function getMockNearmapData(lat: number, lng: number): NearmapFeatures {
  // Generate deterministic mock data based on coordinates
  const hash = Math.abs(Math.round(lat * 1000) + Math.round(lng * 1000)) % 100;

  return {
    surveyDate: new Date().toISOString().split('T')[0],
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
