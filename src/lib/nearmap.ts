// Nearmap API Client
// Documentation: https://docs.nearmap.com/

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
  resources: {
    tiles: string;
    ortho: string;
  };
}

export interface ObliqueViews {
  north: string;
  south: string;
  east: string;
  west: string;
}

// =============================================================================
// API CLIENT
// =============================================================================

class NearmapClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.NEARMAP_API_KEY || '';
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    if (!this.apiKey) {
      throw new Error('NEARMAP_API_KEY not configured');
    }

    const url = `${NEARMAP_API_URL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Nearmap API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get available surveys for a location
   */
  async getSurveys(lat: number, lng: number): Promise<NearmapSurvey[]> {
    try {
      const data = await this.fetch(
        `/coverage/v2/point/${lng},${lat}?resources=tiles`
      );
      return data.surveys || [];
    } catch (error) {
      console.error('Nearmap getSurveys error:', error);
      return [];
    }
  }

  /**
   * Get AI feature analysis for a location
   */
  async getFeatures(lat: number, lng: number): Promise<NearmapFeatures | null> {
    try {
      // Get the latest survey
      const surveys = await this.getSurveys(lat, lng);
      if (surveys.length === 0) {
        return null;
      }

      const latestSurvey = surveys[0];

      // Get AI features - roof, building, pool, solar, etc.
      const [roofData, buildingData, poolData, solarData, vegetationData] = await Promise.all([
        this.getRoofAnalysis(lat, lng).catch(() => null),
        this.getBuildingFootprints(lat, lng).catch(() => null),
        this.getPoolDetection(lat, lng).catch(() => null),
        this.getSolarDetection(lat, lng).catch(() => null),
        this.getVegetationAnalysis(lat, lng).catch(() => null),
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
          trampoline: false, // Will be detected by AI vision
          debris: false,
          construction: false,
        },
        tileUrl,
      };
    } catch (error) {
      console.error('Nearmap getFeatures error:', error);
      return null;
    }
  }

  /**
   * Get roof analysis
   */
  async getRoofAnalysis(lat: number, lng: number) {
    try {
      const data = await this.fetch(
        `/ai/features/v4/roof.json?point=${lng},${lat}`
      );

      const roof = data.features?.[0]?.properties;
      if (!roof) return null;

      return {
        material: roof.roofMaterial || 'unknown',
        condition: roof.roofCondition || 'unknown',
        conditionScore: this.conditionToScore(roof.roofCondition),
        area: roof.roofArea || 0,
        estimatedAge: roof.estimatedAge,
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
   * Get vegetation analysis
   */
  async getVegetationAnalysis(lat: number, lng: number) {
    try {
      const data = await this.fetch(
        `/ai/features/v4/vegetation.json?point=${lng},${lat}`
      );

      const features = data.features || [];
      const trees = features.filter((f: any) => f.properties?.type === 'tree');

      return {
        treeCount: trees.length,
        coveragePercent: data.coveragePercent || 0,
        proximity: data.structureProximity || 'none',
      };
    } catch {
      return null;
    }
  }

  /**
   * Get tile URL for aerial imagery
   */
  getTileUrl(lat: number, lng: number, zoom: number = 19): string {
    if (!this.apiKey) return '';
    return `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg?apikey=${this.apiKey}`;
  }

  /**
   * Get static aerial image URL
   */
  getStaticImageUrl(lat: number, lng: number, width: number = 800, height: number = 600): string {
    if (!this.apiKey) return '';
    return `https://api.nearmap.com/staticmap/v3/staticmap?center=${lat},${lng}&size=${width}x${height}&zoom=19&apikey=${this.apiKey}`;
  }

  /**
   * Get oblique view URLs (N/S/E/W angles)
   */
  async getObliqueViews(lat: number, lng: number): Promise<ObliqueViews | null> {
    if (!this.apiKey) return null;

    const directions = ['N', 'S', 'E', 'W'] as const;
    const views: Partial<ObliqueViews> = {};

    for (const dir of directions) {
      views[dir.toLowerCase() as keyof ObliqueViews] =
        `https://api.nearmap.com/staticmap/v3/staticmap?center=${lat},${lng}&size=400x300&zoom=19&direction=${dir}&apikey=${this.apiKey}`;
    }

    return views as ObliqueViews;
  }

  /**
   * Get historical surveys
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
   * Convert condition string to numeric score
   */
  private conditionToScore(condition: string): number {
    const scores: Record<string, number> = {
      'excellent': 95,
      'good': 80,
      'fair': 60,
      'poor': 40,
      'severe': 20,
    };
    return scores[condition?.toLowerCase()] || 50;
  }
}

// Export singleton instance
export const nearmapClient = new NearmapClient();

// Export mock data for development
export function getMockNearmapData(lat: number, lng: number): NearmapFeatures {
  return {
    surveyDate: new Date().toISOString().split('T')[0],
    building: {
      footprintArea: 2450,
      count: 1,
      polygons: [],
    },
    roof: {
      material: 'Composition Shingle',
      condition: 'fair',
      conditionScore: 72,
      area: 2800,
      age: 15,
    },
    pool: {
      present: true,
      type: 'in-ground',
      fenced: true,
    },
    solar: {
      present: false,
    },
    vegetation: {
      treeCount: 4,
      coveragePercent: 25,
      proximityToStructure: 'minor',
    },
    hazards: {
      trampoline: false,
      debris: false,
      construction: false,
    },
    tileUrl: `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.jpg`,
  };
}
