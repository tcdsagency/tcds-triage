// =============================================================================
// Nearmap API Client - Verified Working Endpoints (2026-02-14)
// Documentation: https://developer.nearmap.com/
// =============================================================================
// Verified endpoints:
// - /ai/features/v4/rollups.json - Insurance scoring rollups
// - /ai/features/v4/features.json - Detailed GeoJSON features
// - /ai/features/v4/coverage.json - AI coverage check
// - /ai/features/v4/packs.json   - Available AI packs
// - /tiles/v3/Vert/{z}/{x}/{y}.img - Aerial tiles (.img not .jpg)
// =============================================================================

const NEARMAP_API_URL = 'https://api.nearmap.com';

// Available packs we have access to
const AVAILABLE_PACKS = 'building,building_char,roof_char,roof_cond,solar';

// =============================================================================
// TYPES
// =============================================================================

export interface FeaturePolygon {
  type: string;
  coordinates: number[][][];
  description?: string;
  areaSqft?: number;
  confidence?: number;
}

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
  tileUrl: string;
  staticImageUrl?: string;
  // Insurance metrics from rollups
  insuranceMetrics?: Record<string, number | string>;
  // Polygon overlays for map rendering
  overlays?: {
    roof: FeaturePolygon[];
    treeOverhang: FeaturePolygon[];
    pool: FeaturePolygon[];
    solar: FeaturePolygon[];
    building: FeaturePolygon[];
  };
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

export interface RollupResponse {
  surveyResourceID?: string;
  since?: string;
  until?: string;
  features?: RollupFeature[];
}

export interface RollupFeature {
  id: string;
  description: string;
  confidence?: number;
  areaSqft?: number;
  areaSqm?: number;
  surveyDate?: string;
  attributes?: RollupAttribute[];
}

export interface RollupAttribute {
  description: string;
  value: number | string;
  unit?: string;
}

export interface PropertyData {
  lat: number;
  lon: number;
  surveyDate: string | null;
  tileUrl: string;
  nearmapLink: string;
  metrics: Record<string, number | string>;
  roofConditionSummary: string;
  roofMaterial: string;
  roofShapeBreakdown: Record<string, number>;
  issueFlags: string[];
}

// =============================================================================
// API CLIENT
// =============================================================================

class NearmapClient {
  private apiKey: string;

  constructor() {
    this.apiKey = (process.env.NEARMAP_API_KEY || '').replace(/\\n$/, '').trim();
  }

  /**
   * Make authenticated API request (JSON)
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.apiKey) {
      throw new Error('NEARMAP_API_KEY not configured');
    }

    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${NEARMAP_API_URL}${endpoint}${separator}apikey=${this.apiKey}`;

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
   * Create bounding polygon from lat/lng (~28m / ~90ft radius)
   * Polygon format: lon,lat pairs forming a closed ring
   */
  private createBoundingPolygon(lat: number, lng: number, offsetDegrees: number = 0.00025): string {
    const minLng = lng - offsetDegrees;
    const maxLng = lng + offsetDegrees;
    const minLat = lat - offsetDegrees;
    const maxLat = lat + offsetDegrees;

    // Polygon format: lon1,lat1,lon2,lat2,...,lon1,lat1 (closed ring)
    return `${minLng},${minLat},${maxLng},${minLat},${maxLng},${maxLat},${minLng},${maxLat},${minLng},${minLat}`;
  }

  /**
   * Calculate slippy map tile coordinates from lat/lng
   */
  private latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x, y };
  }

  // ---------------------------------------------------------------------------
  // Rollups API - Primary insurance scoring
  // ---------------------------------------------------------------------------

  /**
   * Get insurance-relevant rollup metrics for a location
   * Uses /ai/features/v4/rollups.json with verified packs
   */
  async getRollups(lat: number, lng: number, packs?: string): Promise<RollupResponse | null> {
    try {
      const polygon = this.createBoundingPolygon(lat, lng);
      const params = new URLSearchParams({
        polygon,
        packs: packs || AVAILABLE_PACKS,
      });

      const data: RollupResponse = await this.fetch(
        `/ai/features/v4/rollups.json?${params.toString()}`
      );

      console.log(`[Nearmap] Got ${data.features?.length || 0} rollup features`);
      return data;
    } catch (error) {
      console.error('[Nearmap] getRollups error:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Features API - Detailed GeoJSON
  // ---------------------------------------------------------------------------

  /**
   * Get AI feature analysis for a location
   * Uses /ai/features/v4/features.json with packs param to avoid 403
   */
  async getFeatures(lat: number, lng: number, packs?: string): Promise<NearmapFeatures | null> {
    try {
      const polygon = this.createBoundingPolygon(lat, lng);

      const params = new URLSearchParams({
        polygon,
        packs: packs || AVAILABLE_PACKS,
        since: '2020-01-01',
      });

      const data: NearmapAPIResponse = await this.fetch(
        `/ai/features/v4/features.json?${params.toString()}`
      );

      console.log(`[Nearmap] Got ${data.features?.length || 0} features`);

      const tileUrl = this.getTileUrl(lat, lng, 19);
      const features = data.features || [];

      // Extract building data
      const buildings = features.filter(f =>
        f.description?.toLowerCase().includes('building') ||
        f.description?.toLowerCase().includes('footprint')
      );
      const totalBuildingArea = buildings.reduce((sum, f) => sum + (f.areaSqft || f.areaSqm || 0), 0);

      // Extract roof data
      const roofIssues: string[] = [];
      let roofScore = 100;
      let roofArea = 0;
      let roofMaterial = 'Unknown';
      let roofCondition = 'unknown';

      const roofFeature = features.find(f => f.description === 'Roof');
      if (roofFeature) {
        roofArea = roofFeature.areaSqft || roofFeature.areaSqm || 0;
      }

      const materialFeature = features.find(f =>
        ['Shingle', 'Tile', 'Metal', 'Slate', 'Asphalt'].includes(f.description || '')
      );
      if (materialFeature) {
        roofMaterial = materialFeature.description || 'Unknown';
      }

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

      // Extract polygon overlays for map rendering
      const roofPolygons = features
        .filter(f => f.description === 'Roof' || f.description?.includes('Roof'))
        .map(f => ({
          type: f.geometry?.type || 'Polygon',
          coordinates: f.geometry?.coordinates || [],
          description: f.description,
          areaSqft: f.areaSqft || f.areaSqm,
          confidence: f.confidence,
        }));

      const treeOverhangPolygons = features
        .filter(f => f.description?.toLowerCase().includes('overhang') || f.description?.toLowerCase().includes('tree'))
        .map(f => ({
          type: f.geometry?.type || 'Polygon',
          coordinates: f.geometry?.coordinates || [],
          description: f.description,
          areaSqft: f.areaSqft || f.areaSqm,
          confidence: f.confidence,
        }));

      const solarPolygons = solarFeatures.map(f => ({
        type: f.geometry?.type || 'Polygon',
        coordinates: f.geometry?.coordinates || [],
        description: f.description,
        areaSqft: f.areaSqft || f.areaSqm,
        confidence: f.confidence,
      }));

      const buildingPolygons = buildings.map(f => ({
        type: f.geometry?.type || 'Polygon',
        coordinates: f.geometry?.coordinates || [],
        description: f.description,
        areaSqft: f.areaSqft || f.areaSqm,
        confidence: f.confidence,
      }));

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
        tileUrl,
        overlays: {
          roof: roofPolygons,
          treeOverhang: treeOverhangPolygons,
          pool: [], // No pool pack access
          solar: solarPolygons,
          building: buildingPolygons,
        },
      };
    } catch (error) {
      console.error('[Nearmap] getFeatures error:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Coverage & Packs
  // ---------------------------------------------------------------------------

  /**
   * Check AI feature coverage for a polygon
   */
  async getCoverage(lat: number, lng: number): Promise<any> {
    try {
      const polygon = this.createBoundingPolygon(lat, lng);
      const params = new URLSearchParams({ polygon });
      return await this.fetch(`/ai/features/v4/coverage.json?${params.toString()}`);
    } catch (error) {
      console.error('[Nearmap] getCoverage error:', error);
      return null;
    }
  }

  /**
   * Get available AI packs for this API key
   */
  async getPacks(): Promise<any> {
    try {
      return await this.fetch('/ai/features/v4/packs.json');
    } catch (error) {
      console.error('[Nearmap] getPacks error:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Tiles
  // ---------------------------------------------------------------------------

  /**
   * Get tile URL template for aerial imagery
   * Uses .img extension (not .jpg)
   */
  getTileUrl(lat: number, lng: number, zoom: number = 19): string {
    if (!this.apiKey) return '';
    return `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.img?apikey=${this.apiKey}`;
  }

  /**
   * Get a specific tile URL for a lat/lng at a given zoom
   */
  getSpecificTileUrl(lat: number, lng: number, zoom: number = 19): string {
    if (!this.apiKey) return '';
    const { x, y } = this.latLngToTile(lat, lng, zoom);
    return `https://api.nearmap.com/tiles/v3/Vert/${zoom}/${x}/${y}.img?apikey=${this.apiKey}`;
  }

  /**
   * Get tile coordinates for a lat/lng
   */
  getTileCoords(lat: number, lng: number, zoom: number = 19): { z: number; x: number; y: number } {
    const { x, y } = this.latLngToTile(lat, lng, zoom);
    return { z: zoom, x, y };
  }

  // ---------------------------------------------------------------------------
  // Insurance Metrics Extraction
  // ---------------------------------------------------------------------------

  /**
   * Extract insurance-relevant metrics from rollup features
   */
  extractInsuranceMetrics(rollups: RollupResponse): Record<string, number | string> {
    const metrics: Record<string, number | string> = {};

    if (!rollups.features) return metrics;

    for (const feature of rollups.features) {
      const key = feature.description
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');

      // Store area if available
      if (feature.areaSqft != null) {
        metrics[`${key}_sqft`] = feature.areaSqft;
      }

      // Store attributes
      if (feature.attributes) {
        for (const attr of feature.attributes) {
          const attrKey = attr.description
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_|_$/g, '');
          metrics[`${key}_${attrKey}`] = attr.value;
        }
      }

      // Store survey date
      if (feature.surveyDate) {
        metrics[`${key}_survey_date`] = feature.surveyDate;
      }
    }

    return metrics;
  }

  // ---------------------------------------------------------------------------
  // High-level: Property Data (rollups + tile + metrics)
  // ---------------------------------------------------------------------------

  /**
   * Get comprehensive property data for a lat/lng
   * Combines rollups, tile URL, and extracted insurance metrics
   */
  async getPropertyData(lat: number, lng: number): Promise<PropertyData | null> {
    try {
      const rollups = await this.getRollups(lat, lng);
      if (!rollups) return null;

      const metrics = this.extractInsuranceMetrics(rollups);
      const { x, y } = this.latLngToTile(lat, lng, 19);
      const tileUrl = `/api/nearmap/tile?z=19&x=${x}&y=${y}`;
      const nearmapLink = `https://apps.nearmap.com/maps/#/@${lat},${lng},19z`;

      // Determine survey date from first feature
      let surveyDate: string | null = null;
      if (rollups.features && rollups.features.length > 0) {
        surveyDate = rollups.features[0].surveyDate || rollups.until || null;
      }

      // Summarize roof condition
      let roofConditionSummary = 'unknown';
      let roofMaterial = 'unknown';
      const roofShapeBreakdown: Record<string, number> = {};
      const issueFlags: string[] = [];

      for (const feature of rollups.features || []) {
        const desc = feature.description.toLowerCase();

        // Roof condition from attributes
        if (desc.includes('roof') && desc.includes('cond')) {
          for (const attr of feature.attributes || []) {
            const attrDesc = attr.description.toLowerCase();
            if (attrDesc.includes('staining') && typeof attr.value === 'number' && attr.value > 0.05) {
              issueFlags.push(`Roof staining: ${(attr.value as number * 100).toFixed(0)}%`);
            }
            if (attrDesc.includes('damage') && typeof attr.value === 'number' && attr.value > 0) {
              issueFlags.push(`Structural damage detected`);
            }
          }
        }

        // Roof material/characteristics
        if (desc.includes('roof') && desc.includes('char')) {
          for (const attr of feature.attributes || []) {
            const attrDesc = attr.description.toLowerCase();
            if (attrDesc.includes('material') || attrDesc.includes('type')) {
              roofMaterial = String(attr.value);
            }
            if (attrDesc.includes('shape') || attrDesc.includes('hip') || attrDesc.includes('gable')) {
              roofShapeBreakdown[attr.description] = typeof attr.value === 'number' ? attr.value : 0;
            }
          }
        }

        // Building characteristics
        if (desc.includes('building_char') || desc.includes('building char')) {
          for (const attr of feature.attributes || []) {
            const attrDesc = attr.description.toLowerCase();
            if (attrDesc.includes('tree') && attrDesc.includes('overhang') && typeof attr.value === 'number' && attr.value > 50) {
              issueFlags.push(`Tree overhang: ${Math.round(attr.value)} sqft`);
            }
          }
        }

        // Solar
        if (desc.includes('solar')) {
          for (const attr of feature.attributes || []) {
            if (attr.description.toLowerCase().includes('count') && typeof attr.value === 'number' && attr.value > 0) {
              metrics['solar_panel_count'] = attr.value;
            }
          }
        }
      }

      // Determine overall condition from metrics
      const staining = metrics['roof_cond_staining_ratio'] || metrics['roof_condition_staining_ratio'];
      const damage = metrics['roof_cond_structural_damage_ratio'] || metrics['roof_condition_structural_damage_ratio'];

      if (typeof staining === 'number' || typeof damage === 'number') {
        const stainVal = typeof staining === 'number' ? staining : 0;
        const damageVal = typeof damage === 'number' ? damage : 0;

        if (damageVal > 0.05) roofConditionSummary = 'poor';
        else if (stainVal > 0.15) roofConditionSummary = 'fair';
        else if (stainVal > 0.05) roofConditionSummary = 'good';
        else roofConditionSummary = 'excellent';
      }

      return {
        lat,
        lon: lng,
        surveyDate,
        tileUrl,
        nearmapLink,
        metrics,
        roofConditionSummary,
        roofMaterial,
        roofShapeBreakdown,
        issueFlags,
      };
    } catch (error) {
      console.error('[Nearmap] getPropertyData error:', error);
      return null;
    }
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get configuration status
   */
  getKeyStatus(): Record<string, boolean> {
    return {
      apiKey: !!this.apiKey,
    };
  }
}

// Export singleton instance
export const nearmapClient = new NearmapClient();

// =============================================================================
// Insurance Risk Score
// =============================================================================

export interface InsuranceRiskScore {
  score: number;
  grade: string;
  factors: { name: string; points: number }[];
}

/**
 * Calculate an insurance risk score (0-100, higher = more risk) from
 * rollup metrics and AI feature data.
 */
export function calculateRiskScore(
  metrics: Record<string, number | string>,
  features?: NearmapFeatures | null
): InsuranceRiskScore {
  const factors: { name: string; points: number }[] = [];
  let score = 0;

  // --- Roof staining ratio (up to 25 pts) ---
  const stainingRatio =
    Number(metrics['roof_cond_staining_ratio'] || metrics['roof_condition_staining_ratio'] || 0);
  if (stainingRatio > 0) {
    const pts = Math.min(25, Math.round(stainingRatio * 25));
    if (pts > 0) {
      factors.push({ name: `Roof staining (${(stainingRatio * 100).toFixed(0)}%)`, points: pts });
      score += pts;
    }
  }

  // --- Roof damage ratio (up to 40 pts) ---
  const damageRatio =
    Number(metrics['roof_cond_structural_damage_ratio'] || metrics['roof_condition_structural_damage_ratio'] || 0);
  if (damageRatio > 0) {
    const pts = Math.min(40, Math.round(damageRatio * 40));
    if (pts > 0) {
      factors.push({ name: 'Structural damage', points: pts });
      score += pts;
    }
  }

  // --- Tree overhang area ---
  const treeOverhang = features?.vegetation?.treeOverhangArea ?? 0;
  if (treeOverhang > 200) {
    factors.push({ name: `Tree overhang (${Math.round(treeOverhang)} sqft)`, points: 15 });
    score += 15;
  } else if (treeOverhang > 100) {
    factors.push({ name: `Tree overhang (${Math.round(treeOverhang)} sqft)`, points: 10 });
    score += 10;
  } else if (treeOverhang > 50) {
    factors.push({ name: `Tree overhang (${Math.round(treeOverhang)} sqft)`, points: 5 });
    score += 5;
  }

  // --- Solar panels ---
  if (features?.solar?.present) {
    factors.push({ name: 'Solar panels present', points: 3 });
    score += 3;
  }

  // --- Multiple buildings ---
  if (features?.building && features.building.count > 1) {
    factors.push({ name: `${features.building.count} buildings`, points: 5 });
    score += 5;
  }

  // --- Missing/tarp/debris from roof issues ---
  const severeIssues = (features?.roof?.issues || []).filter(
    (i) => /missing|tarp|debris/i.test(i)
  );
  if (severeIssues.length > 0) {
    factors.push({ name: 'Missing/tarp/debris detected', points: 15 });
    score += 15;
  }

  score = Math.min(100, Math.max(0, score));

  return { score, grade: riskGrade(score), factors };
}

/**
 * Map a numeric risk score to a letter grade.
 */
export function riskGrade(score: number): string {
  if (score <= 15) return 'A';
  if (score <= 30) return 'B';
  if (score <= 50) return 'C';
  if (score <= 70) return 'D';
  return 'F';
}

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
    solar: {
      present: hash % 5 === 0,
      panelCount: hash % 5 === 0 ? 10 + (hash % 20) : undefined,
    },
    vegetation: {
      treeCount: hash % 10,
      coveragePercent: hash % 40,
      proximityToStructure: ['none', 'minor', 'moderate', 'significant'][hash % 4] as any,
    },
    tileUrl: `https://api.nearmap.com/tiles/v3/Vert/{z}/{x}/{y}.img`,
  };
}
