'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { FloodZoneIndicator, FloodRisk } from '@/components/ui/flood-zone-indicator';

// Dynamic import for Leaflet map (client-side only)
const NearmapMap = dynamic(
  () => import('@/components/features/NearmapMap').then(mod => ({ default: mod.NearmapMap })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
        <div className="animate-spin text-3xl">🛰️</div>
      </div>
    )
  }
);

// =============================================================================
// TYPES
// =============================================================================

interface PropertyLookup {
  id: string;
  address: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  nearmapData: NearmapData | null;
  rprData: RPRData | null;
  mmiData: MMIData | null;
  aiAnalysis: AIAnalysis | null;
  obliqueViews: ObliqueViews | null;
  historicalSurveys: Array<{ date: string; imageUrl: string }>;
  historicalComparison?: HistoricalComparison;
  createdAt: string;
}

interface FeaturePolygon {
  type: string;
  coordinates: number[][][];
  description?: string;
  areaSqft?: number;
  confidence?: number;
}

interface NearmapData {
  surveyDate: string;
  building: { footprintArea: number; count: number };
  roof: { material: string; condition: string; conditionScore: number; area: number; age?: number; issues?: string[] };
  pool: { present: boolean; type?: string; fenced?: boolean; area?: number };
  solar: { present: boolean; panelCount?: number; area?: number };
  vegetation: { treeCount: number; coveragePercent: number; proximityToStructure: string; treeOverhangArea?: number };
  hazards: { trampoline: boolean; debris: boolean; construction: boolean };
  tileUrl: string;
  staticImageUrl?: string;
  overlays?: {
    roof: FeaturePolygon[];
    treeOverhang: FeaturePolygon[];
    pool: FeaturePolygon[];
    solar: FeaturePolygon[];
    building: FeaturePolygon[];
  };
}

interface RPRData {
  propertyId: string;
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
  assessedValue: number;
  estimatedValue: number;
  taxAmount: number;
  lastSaleDate: string;
  lastSalePrice: number;
  floodZone?: string;
  floodRisk?: string;
  schools: { district: string; elementary: string; middle: string; high: string };
  listing?: { active: boolean; price: number; daysOnMarket: number; agent: string };
}

interface AIAnalysis {
  roofScore: number;
  roofIssues: string[];
  roofAgeEstimate: string;
  roofConditionSummary: string;
  hazardScan: {
    trampoline: { detected: boolean; confidence: number };
    unfencedPool: { detected: boolean; confidence: number };
    debris: { detected: boolean; confidence: number };
    treeOverhang: { detected: boolean; severity: string };
  };
  underwritingNotes: string;
  riskLevel: 'low' | 'medium' | 'high';
  recommendedAction: string;
}

interface ObliqueViews {
  north: string;
  south: string;
  east: string;
  west: string;
}

interface HistoricalComparison {
  comparedDates: { current: string; previous: string };
  changesDetected: boolean;
  changes: Array<{ type: string; severity: string; description: string }>;
}

interface MMIData {
  propertyId: string;
  listingHistory: Array<{
    LISTING_DATE: string;
    LIST_PRICE: number;
    CLOSE_PRICE: number;
    STATUS: string;
    LISTING_AGENT: string;
    LISTING_BROKER: string;
    DAYS_ON_MARKET?: number;
  }>;
  deedHistory: Array<{
    DATE: string;
    LOAN_AMOUNT: number;
    LENDER: string;
    LOAN_OFFICER?: string;
    TRANSACTION_TYPE: string;
    BUYER_NAME?: string;
    SELLER_NAME?: string;
    SALE_PRICE?: number;
  }>;
  currentStatus: 'off_market' | 'active' | 'pending' | 'sold' | 'unknown';
  lastSaleDate?: string;
  lastSalePrice?: number;
  lastUpdated: string;
}

type TabType = 'overview' | 'analysis' | 'market';

// =============================================================================
// COMPONENT
// =============================================================================

export default function PropertyIntelligencePage() {
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Data State
  const [lookup, setLookup] = useState<PropertyLookup | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [viewMode, setViewMode] = useState<'aerial' | 'street'>('aerial');
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string | null>(null);

  // ==========================================================================
  // Google Places Autocomplete
  // ==========================================================================

  const handleSearchChange = useCallback(async (value: string) => {
    setSearchQuery(value);

    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(value)}`);
      const data = await response.json();
      setSuggestions(data.predictions || []);
      setShowSuggestions(true);
    } catch (err) {
      console.error('Autocomplete error:', err);
      setSuggestions([]);
    }
  }, []);

  const handleSelectAddress = useCallback(async (suggestion: any) => {
    setSearchQuery(suggestion.description);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setActiveTab('overview');

    try {
      let lat = 32.7767;
      let lng = -96.7970;
      let formattedAddress = suggestion.description;

      const detailsResponse = await fetch(`/api/places/details?place_id=${suggestion.place_id}`);
      const details = await detailsResponse.json();

      if (details.result?.geometry?.location) {
        lat = details.result.geometry.location.lat;
        lng = details.result.geometry.location.lng;
      }
      if (details.result?.formatted_address) {
        formattedAddress = details.result.formatted_address;
      }

      const response = await fetch('/api/property/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: suggestion.description, formattedAddress, lat, lng }),
      });

      const data = await response.json();

      if (data.success) {
        setLookup(data.lookup);
        if (!data.lookup.aiAnalysis) {
          runAIAnalysis(data.lookup.id, data.lookup.nearmapData?.staticImageUrl);
        }
      } else {
        setError(data.error || 'Lookup failed');
      }
    } catch (err) {
      setError('Failed to lookup property');
    } finally {
      setLoading(false);
    }
  }, []);

  const runAIAnalysis = async (lookupId: string, imageUrl?: string) => {
    setAnalyzing(true);
    try {
      const response = await fetch('/api/property/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookupId, imageUrl }),
      });
      const data = await response.json();
      if (data.success && data.analysis) {
        setLookup(prev => prev ? { ...prev, aiAnalysis: data.analysis } : null);
      }
    } catch (err) {
      console.error('AI analysis error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    if (score >= 40) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getRiskBadge = (level: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800 border-green-200',
      medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      high: 'bg-red-100 text-red-800 border-red-200',
    };
    return colors[level as keyof typeof colors] || colors.medium;
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Compact Header */}
      <div className="border-b px-4 py-3 flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span>🏠</span> Property Intelligence
        </h1>

        {/* Search */}
        <div ref={searchRef} className="flex-1 max-w-xl relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search address..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin">⏳</div>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={s.place_id || i}
                  onClick={() => handleSelectAddress(s)}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b last:border-0 flex items-center gap-2"
                >
                  <span className="text-blue-500">📍</span>
                  <span className="text-gray-900 font-medium">{s.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {lookup && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Survey:</span>
            <span className="font-medium text-gray-900">{lookup.nearmapData?.surveyDate || 'N/A'}</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {!lookup && !loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Search for a Property</h2>
              <p className="text-gray-600">
                Enter an address to view aerial imagery, property details, AI roof analysis, and market data.
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        ) : lookup ? (
          <>
            {/* Left: Map Panel - 45% width */}
            <div className="w-[45%] border-r flex flex-col">
              {/* View Toggle + Date Selector */}
              <div className="p-2 border-b bg-gray-50">
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setViewMode('aerial')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded font-medium text-sm transition-colors',
                      viewMode === 'aerial' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-100'
                    )}
                  >
                    🛰️ Aerial
                  </button>
                  <button
                    onClick={() => setViewMode('street')}
                    className={cn(
                      'flex-1 py-2 px-3 rounded font-medium text-sm transition-colors',
                      viewMode === 'street' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border hover:bg-gray-100'
                    )}
                  >
                    🚗 Street
                  </button>
                </div>

                {/* Historical Date Selector - Only show for aerial view */}
                {viewMode === 'aerial' && lookup.historicalSurveys && lookup.historicalSurveys.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-medium">Date:</span>
                    <select
                      value={selectedHistoricalDate || ''}
                      onChange={(e) => setSelectedHistoricalDate(e.target.value || null)}
                      className="flex-1 text-sm px-2 py-1.5 border rounded bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Latest ({lookup.nearmapData?.surveyDate || 'Current'})</option>
                      {lookup.historicalSurveys.map((survey, i) => (
                        <option key={i} value={survey.date}>{survey.date}</option>
                      ))}
                    </select>
                    {selectedHistoricalDate && (
                      <button
                        onClick={() => setSelectedHistoricalDate(null)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Map/Street View */}
              <div className="flex-1 relative bg-gray-200">
                {viewMode === 'aerial' ? (
                  <NearmapMap
                    lat={lookup.lat}
                    lng={lookup.lng}
                    zoom={19}
                    surveyDate={selectedHistoricalDate || lookup.nearmapData?.surveyDate}
                    overlays={lookup.nearmapData?.overlays}
                  />
                ) : (
                  <iframe
                    src={`https://www.google.com/maps/embed/v1/streetview?key=AIzaSyCwt9YE8VmZkkZZllchR1gOeX08_63r3Ns&location=${lookup.lat},${lookup.lng}&heading=0&pitch=0&fov=90`}
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                  />
                )}
              </div>

              {/* Quick Stats Bar */}
              {lookup.nearmapData && (
                <div className="p-3 border-t bg-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-500">Quick Stats</span>
                    <SourceBadge source="Nearmap AI" />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-gray-900">
                        {lookup.nearmapData.roof.conditionScore || '--'}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Roof Score</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-gray-900">
                        {lookup.nearmapData.pool.present ? '✓' : '✗'}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Pool</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-gray-900">
                        {lookup.nearmapData.solar.present ? '✓' : '✗'}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Solar</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <div className="text-lg font-bold text-gray-900">
                        {lookup.nearmapData.vegetation.treeCount}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">Trees</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Details Panel - 55% width */}
            <div className="w-[55%] flex flex-col overflow-hidden">
              {/* Address Header */}
              <div className="p-4 border-b bg-gray-50">
                <h2 className="text-lg font-bold text-gray-900 truncate">{lookup.formattedAddress}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm">
                  {lookup.rprData && (
                    <>
                      <span className="text-gray-900 font-medium">{lookup.rprData.beds} bed</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-900 font-medium">{lookup.rprData.baths} bath</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-900 font-medium">{lookup.rprData.sqft.toLocaleString()} sqft</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-900 font-medium">Built {lookup.rprData.yearBuilt}</span>
                    </>
                  )}
                  {lookup.mmiData && (
                    <span className={cn(
                      'ml-auto px-2 py-0.5 rounded text-xs font-bold uppercase border',
                      lookup.mmiData.currentStatus === 'active' ? 'bg-green-100 text-green-700 border-green-200' :
                      lookup.mmiData.currentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                      lookup.mmiData.currentStatus === 'sold' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      'bg-gray-100 text-gray-700 border-gray-200'
                    )}>
                      {lookup.mmiData.currentStatus === 'off_market' ? 'Off Market' : lookup.mmiData.currentStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b bg-white">
                {[
                  { id: 'overview', label: 'Overview', icon: '📋' },
                  { id: 'analysis', label: 'AI Analysis', icon: '🤖' },
                  { id: 'market', label: 'Market Data', icon: '📈' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={cn(
                      'flex-1 py-3 px-2 text-sm font-medium border-b-2 transition-colors',
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Property Details */}
                    {lookup.rprData && (
                      <div className="bg-white border rounded-lg p-4">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">Property Details <SourceBadge source="RPR" /></h3>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <InfoRow label="Stories" value={lookup.rprData.stories} />
                          <InfoRow label="Lot Size" value={`${lookup.rprData.lotAcres.toFixed(2)} acres`} />
                          <InfoRow label="Roof Type" value={lookup.rprData.roofType} />
                          <InfoRow label="Foundation" value={lookup.rprData.foundation} />
                          <InfoRow label="Exterior" value={lookup.rprData.exteriorWalls} />
                          <InfoRow label="HVAC" value={lookup.rprData.hvac} />
                        </div>
                        <div className="border-t mt-3 pt-3 grid grid-cols-2 gap-3 text-sm">
                          <InfoRow label="Owner" value={lookup.rprData.ownerName} />
                          <InfoRow
                            label="Owner Occupied"
                            value={lookup.rprData.ownerOccupied ? 'Yes' : 'No'}
                          />
                          <InfoRow label="Last Sale" value={`${formatCurrency(lookup.rprData.lastSalePrice)} (${lookup.rprData.lastSaleDate})`} />
                          <InfoRow label="Est. Value" value={formatCurrency(lookup.rprData.estimatedValue)} highlight />
                        </div>
                      </div>
                    )}

                    {/* Flood Zone */}
                    {lookup.rprData?.floodZone && (
                      <div className="bg-white border rounded-lg p-4">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          Flood Zone <SourceBadge source="RPR" />
                        </h3>
                        <FloodZoneIndicator
                          zone={lookup.rprData.floodZone}
                          risk={(lookup.rprData.floodRisk as FloodRisk) || 'Unknown'}
                          inSFHA={lookup.rprData.floodZone?.startsWith('A') || lookup.rprData.floodZone?.startsWith('V')}
                          showDescription
                          showInsuranceWarning
                          size="md"
                        />
                      </div>
                    )}

                    {/* Detected Features */}
                    {lookup.nearmapData && (
                      <div className="bg-white border rounded-lg p-4">
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">Detected Features <SourceBadge source="Nearmap AI" /></h3>
                        <div className="grid grid-cols-3 gap-3">
                          <FeatureCard
                            icon="🏊"
                            label="Pool"
                            detected={lookup.nearmapData.pool.present}
                            detail={lookup.nearmapData.pool.present ? (lookup.nearmapData.pool.fenced ? 'Fenced' : 'Unfenced') : undefined}
                          />
                          <FeatureCard
                            icon="☀️"
                            label="Solar"
                            detected={lookup.nearmapData.solar.present}
                            detail={lookup.nearmapData.solar.panelCount ? `${lookup.nearmapData.solar.panelCount} panels` : undefined}
                          />
                          <FeatureCard
                            icon="🌳"
                            label="Tree Overhang"
                            detected={(lookup.nearmapData.vegetation.treeOverhangArea || 0) > 0}
                            detail={lookup.nearmapData.vegetation.treeOverhangArea ? `${Math.round(lookup.nearmapData.vegetation.treeOverhangArea)} sqft` : undefined}
                          />
                        </div>
                      </div>
                    )}

                    {/* Quick Risk Summary */}
                    {(lookup.aiAnalysis || analyzing) && (
                      <div className={cn(
                        'border rounded-lg p-4',
                        analyzing ? 'bg-blue-50 border-blue-200' : 'bg-white'
                      )}>
                        {analyzing ? (
                          <div className="flex items-center gap-3">
                            <div className="animate-spin text-2xl">🤖</div>
                            <div>
                              <div className="font-bold text-blue-800">Analyzing Property...</div>
                              <div className="text-sm text-blue-600">AI is reviewing imagery</div>
                            </div>
                          </div>
                        ) : lookup.aiAnalysis && (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-bold text-gray-900 flex items-center gap-2">Risk Summary <SourceBadge source="Claude AI" /></h3>
                              <span className={cn('px-3 py-1 rounded-full text-sm font-bold border', getRiskBadge(lookup.aiAnalysis.riskLevel))}>
                                {lookup.aiAnalysis.riskLevel.toUpperCase()} RISK
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">{lookup.aiAnalysis.underwritingNotes}</p>
                            <button
                              onClick={() => setActiveTab('analysis')}
                              className="mt-3 text-sm text-blue-600 font-medium hover:underline"
                            >
                              View Full Analysis →
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'analysis' && (
                  <div className="space-y-4">
                    {/* Roof Analysis */}
                    {lookup.aiAnalysis ? (
                      <>
                        <div className="bg-white border rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">Roof Condition <SourceBadge source="Claude AI" /></h3>
                            <div className="flex items-center gap-2">
                              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-white font-bold', getScoreColor(lookup.aiAnalysis.roofScore))}>
                                {lookup.aiAnalysis.roofScore}
                              </div>
                              <span className="text-sm text-gray-600">/100</span>
                            </div>
                          </div>
                          <div className="space-y-3">
                            <InfoRow label="Age Estimate" value={lookup.aiAnalysis.roofAgeEstimate} />
                            <div>
                              <div className="text-sm text-gray-600 font-medium mb-1">Condition Summary</div>
                              <p className="text-sm text-gray-900">{lookup.aiAnalysis.roofConditionSummary}</p>
                            </div>
                            {lookup.aiAnalysis.roofIssues.length > 0 && (
                              <div>
                                <div className="text-sm text-gray-600 font-medium mb-1">Issues Detected</div>
                                <ul className="space-y-1">
                                  {lookup.aiAnalysis.roofIssues.map((issue, i) => (
                                    <li key={i} className="text-sm text-gray-900 flex items-start gap-2">
                                      <span className="text-amber-500 mt-0.5">⚠️</span>
                                      {issue}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Hazard Detection */}
                        <div className="bg-white border rounded-lg p-4">
                          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">Hazard Detection <SourceBadge source="Claude AI" /></h3>
                          <div className="grid grid-cols-2 gap-3">
                            <HazardCard
                              label="Trampoline"
                              detected={lookup.aiAnalysis.hazardScan.trampoline.detected}
                            />
                            <HazardCard
                              label="Unfenced Pool"
                              detected={lookup.aiAnalysis.hazardScan.unfencedPool.detected}
                              warning
                            />
                            <HazardCard
                              label="Debris"
                              detected={lookup.aiAnalysis.hazardScan.debris.detected}
                            />
                            <HazardCard
                              label="Tree Overhang"
                              detected={lookup.aiAnalysis.hazardScan.treeOverhang.detected}
                              severity={lookup.aiAnalysis.hazardScan.treeOverhang.severity}
                            />
                          </div>
                        </div>

                        {/* Recommendation */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                          <h3 className="font-bold text-blue-900 mb-2">🤖 AI Recommendation</h3>
                          <p className="text-gray-800">{lookup.aiAnalysis.recommendedAction}</p>
                          <div className="mt-3 flex items-center gap-2">
                            <span className="text-sm text-gray-600">Risk Level:</span>
                            <span className={cn('px-2 py-0.5 rounded text-sm font-bold border', getRiskBadge(lookup.aiAnalysis.riskLevel))}>
                              {lookup.aiAnalysis.riskLevel.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        {analyzing ? (
                          <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin text-4xl">🤖</div>
                            <p>AI is analyzing the property...</p>
                          </div>
                        ) : (
                          <p>AI analysis not available yet</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'market' && (
                  <div className="space-y-4">
                    {lookup.mmiData ? (
                      <>
                        {/* Listing History */}
                        {lookup.mmiData.listingHistory.length > 0 && (
                          <div className="bg-white border rounded-lg p-4">
                            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">Listing History <SourceBadge source="MMI" /></h3>
                            <div className="space-y-2">
                              {lookup.mmiData.listingHistory.map((listing, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                                  <div>
                                    <div className="font-medium text-gray-900">
                                      {new Date(listing.LISTING_DATE).toLocaleDateString()}
                                    </div>
                                    <div className="text-sm text-gray-600">{listing.LISTING_AGENT || 'Unknown Agent'}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="font-bold text-gray-900">{formatCurrency(listing.LIST_PRICE)}</div>
                                    {listing.CLOSE_PRICE > 0 && (
                                      <div className="text-sm text-green-600">Sold: {formatCurrency(listing.CLOSE_PRICE)}</div>
                                    )}
                                    <span className={cn(
                                      'text-xs px-2 py-0.5 rounded font-medium',
                                      listing.STATUS?.toLowerCase().includes('sold') ? 'bg-green-100 text-green-700' :
                                      listing.STATUS?.toLowerCase().includes('active') ? 'bg-blue-100 text-blue-700' :
                                      'bg-gray-200 text-gray-600'
                                    )}>
                                      {listing.STATUS || 'Unknown'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Deed History */}
                        {lookup.mmiData.deedHistory.length > 0 && (
                          <div className="bg-white border rounded-lg p-4">
                            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">Sale & Loan History <SourceBadge source="MMI" /></h3>
                            <div className="space-y-2">
                              {lookup.mmiData.deedHistory.map((deed, i) => (
                                <div key={i} className="p-3 bg-gray-50 rounded">
                                  <div className="flex items-center justify-between">
                                    <div className="font-medium text-gray-900">
                                      {new Date(deed.DATE).toLocaleDateString()}
                                    </div>
                                    <span className="text-sm text-gray-600">{deed.TRANSACTION_TYPE}</span>
                                  </div>
                                  <div className="flex items-center justify-between mt-1 text-sm">
                                    {deed.SALE_PRICE && deed.SALE_PRICE > 0 ? (
                                      <span className="text-gray-900 font-medium">Sale: {formatCurrency(deed.SALE_PRICE)}</span>
                                    ) : deed.LOAN_AMOUNT > 0 ? (
                                      <span className="text-gray-900 font-medium">Loan: {formatCurrency(deed.LOAN_AMOUNT)}</span>
                                    ) : <span />}
                                    {deed.LENDER && <span className="text-gray-600 truncate max-w-[200px]">{deed.LENDER}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {lookup.mmiData.listingHistory.length === 0 && lookup.mmiData.deedHistory.length === 0 && (
                          <div className="text-center py-12 text-gray-500">
                            No market history available
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        Market data not available
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t bg-gray-50 flex gap-3">
                <button className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2">
                  📄 Generate Report
                </button>
                <button className="flex-1 py-2.5 bg-white text-gray-700 border rounded-lg font-medium hover:bg-gray-100 flex items-center justify-center gap-2">
                  ✉️ Email Report
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function InfoRow({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className={cn('font-medium', highlight ? 'text-green-600' : 'text-gray-900')}>{value}</span>
    </div>
  );
}

function FeatureCard({ icon, label, detected, detail }: { icon: string; label: string; detected: boolean; detail?: string }) {
  return (
    <div className={cn(
      'p-3 rounded-lg text-center',
      detected ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50'
    )}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-sm font-medium text-gray-900">{label}</div>
      <div className={cn('text-xs', detected ? 'text-blue-600' : 'text-gray-500')}>
        {detected ? (detail || 'Detected') : 'Not detected'}
      </div>
    </div>
  );
}

function HazardCard({ label, detected, warning, severity }: { label: string; detected: boolean; warning?: boolean; severity?: string }) {
  return (
    <div className={cn(
      'p-3 rounded-lg flex items-center gap-3',
      detected ? (warning ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200') : 'bg-green-50 border border-green-200'
    )}>
      <span className="text-xl">
        {detected ? (warning ? '⚠️' : '⚡') : '✅'}
      </span>
      <div>
        <div className="font-medium text-gray-900">
          {detected ? label : `No ${label.toLowerCase()}`}
        </div>
        {severity && severity !== 'none' && (
          <div className="text-xs text-gray-600 capitalize">{severity}</div>
        )}
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: 'RPR' | 'Nearmap' | 'Nearmap AI' | 'Claude AI' | 'MMI' | 'Google' }) {
  const colors = {
    'RPR': 'bg-purple-50 text-purple-600 border-purple-200',
    'Nearmap': 'bg-sky-50 text-sky-600 border-sky-200',
    'Nearmap AI': 'bg-sky-50 text-sky-600 border-sky-200',
    'Claude AI': 'bg-orange-50 text-orange-600 border-orange-200',
    'MMI': 'bg-emerald-50 text-emerald-600 border-emerald-200',
    'Google': 'bg-blue-50 text-blue-600 border-blue-200',
  };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', colors[source])}>
      {source}
    </span>
  );
}
