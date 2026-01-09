'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { HazardRiskCard } from '@/components/features/HazardRiskCard';

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

interface NearmapData {
  surveyDate: string;
  building: { footprintArea: number; count: number };
  roof: { material: string; condition: string; conditionScore: number; area: number; age?: number };
  pool: { present: boolean; type?: string; fenced?: boolean };
  solar: { present: boolean; panelCount?: number };
  vegetation: { treeCount: number; coveragePercent: number; proximityToStructure: string };
  hazards: { trampoline: boolean; debris: boolean; construction: boolean };
  tileUrl: string;
  staticImageUrl?: string;
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
  const [activeObliqueView, setActiveObliqueView] = useState<'north' | 'south' | 'east' | 'west' | null>(null);
  const [showHistorical, setShowHistorical] = useState(false);
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string | null>(null);

  // ==========================================================================
  // Google Places Autocomplete (via server proxy)
  // ==========================================================================

  const handleSearchChange = useCallback(async (value: string) => {
    setSearchQuery(value);

    if (value.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      // Use our server-side proxy to avoid CORS issues
      const response = await fetch(
        `/api/places/autocomplete?input=${encodeURIComponent(value)}`
      );
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

    try {
      // Get place details for lat/lng via server proxy
      let lat = 32.7767; // Default Dallas
      let lng = -96.7970;
      let formattedAddress = suggestion.description;

      const detailsResponse = await fetch(
        `/api/places/details?place_id=${suggestion.place_id}`
      );
      const details = await detailsResponse.json();

      if (details.result?.geometry?.location) {
        lat = details.result.geometry.location.lat;
        lng = details.result.geometry.location.lng;
      }
      if (details.result?.formatted_address) {
        formattedAddress = details.result.formatted_address;
      }

      // Call our lookup API
      const response = await fetch('/api/property/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: suggestion.description,
          formattedAddress,
          lat,
          lng,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setLookup(data.lookup);

        // Trigger AI analysis if not already done
        if (!data.lookup.aiAnalysis) {
          const imageUrl = data.lookup.nearmapData?.staticImageUrl;
          runAIAnalysis(data.lookup.id, imageUrl);
        }
      } else {
        setError(data.error || 'Lookup failed');
      }
    } catch (err) {
      setError('Failed to lookup property');
      console.error('Lookup error:', err);
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

  // Close suggestions when clicking outside
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

  const getRoofScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getRiskLevelColor = (level: string) => {
    if (level === 'low') return 'bg-green-100 text-green-700';
    if (level === 'medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with Search */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏠</span>
            <h1 className="text-xl font-bold text-gray-900">Property Intelligence</h1>
          </div>

          {/* Address Search */}
          <div ref={searchRef} className="flex-1 max-w-2xl relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Enter property address..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {loading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin text-xl">⏳</div>
              </div>
            )}

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {suggestions.map((suggestion, i) => (
                  <button
                    key={suggestion.place_id || i}
                    onClick={() => handleSelectAddress(suggestion)}
                    className="w-full px-4 py-3 text-left text-gray-900 hover:bg-gray-100 border-b last:border-b-0"
                  >
                    <span className="text-blue-500 mr-2">📍</span>
                    <span className="font-medium">{suggestion.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {!lookup && !loading ? (
          /* Empty State */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Search for a Property
              </h2>
              <p className="text-gray-500 max-w-md">
                Enter an address to get aerial imagery, property details, AI roof analysis, and underwriting insights.
              </p>
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="text-5xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
              <p className="text-gray-500">{error}</p>
            </div>
          </div>
        ) : lookup ? (
          /* Property Results */
          <div className="h-full flex overflow-hidden">
            {/* Left Column - Map & Images */}
            <div className="w-1/2 border-r flex flex-col overflow-hidden">
              {/* Aerial Map */}
              <div className="flex-1 bg-gray-200 relative">
                {lookup.nearmapData?.staticImageUrl ? (
                  <div className="absolute inset-0">
                    {/* Nearmap Static Map Image */}
                    <img
                      src={lookup.nearmapData.staticImageUrl}
                      alt="Aerial view"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback to placeholder on error
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                    {/* Fallback placeholder (hidden by default) */}
                    <div className="hidden absolute inset-0 flex items-center justify-center bg-gray-700">
                      <div className="text-center text-white">
                        <div className="text-4xl mb-2">🛰️</div>
                        <p className="text-sm font-medium">Aerial Imagery</p>
                        <p className="text-xs text-gray-300 mt-1">
                          Survey: {lookup.nearmapData.surveyDate}
                        </p>
                      </div>
                    </div>
                    {/* Survey date overlay */}
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      Survey: {lookup.nearmapData.surveyDate}
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-amber-50">
                    <div className="text-center p-4">
                      <div className="text-4xl mb-2">⚠️</div>
                      <p className="text-amber-800 font-medium">Nearmap Data Unavailable</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Check Nearmap API configuration or coverage for this location
                      </p>
                    </div>
                  </div>
                )}

                {/* Layer Toggles */}
                <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-2 space-y-1">
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-gray-100 w-full">
                    <span>🏠</span> Building
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-gray-100 w-full">
                    <span>🔲</span> Roof
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-gray-100 w-full">
                    <span>🏊</span> Pool
                  </button>
                  <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded hover:bg-gray-100 w-full">
                    <span>☀️</span> Solar
                  </button>
                </div>
              </div>

              {/* Street View */}
              <div className="h-48 bg-gray-100 border-t relative">
                {lookup.lat && lookup.lng ? (
                  <iframe
                    src={`https://www.google.com/maps/embed/v1/streetview?key=AIzaSyCwt9YE8VmZkkZZllchR1gOeX08_63r3Ns&location=${lookup.lat},${lookup.lng}&heading=0&pitch=0&fov=90`}
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                    <div className="text-center">
                      <div className="text-3xl mb-1">🚗</div>
                      <p className="text-sm text-gray-700 font-medium">Street View</p>
                      <p className="text-xs text-gray-500">No location available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Oblique Views */}
              <div className="h-24 bg-white border-t p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">OBLIQUE VIEWS</div>
                <div className="flex gap-2">
                  {(['north', 'south', 'east', 'west'] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setActiveObliqueView(activeObliqueView === dir ? null : dir)}
                      className={cn(
                        'flex-1 py-2 rounded text-sm font-medium transition-colors',
                        activeObliqueView === dir
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      {dir.charAt(0).toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Details */}
            <div className="w-1/2 overflow-y-auto p-4 space-y-4">
              {/* Property Details (RPR) */}
              {lookup.rprData && (
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                    Property Details
                  </h3>
                  <div className="space-y-2">
                    <div className="font-medium text-lg">{lookup.formattedAddress}</div>

                    <div className="grid grid-cols-4 gap-3 mt-3">
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-lg font-bold">{lookup.rprData.beds}</div>
                        <div className="text-xs text-gray-500">Beds</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-lg font-bold">{lookup.rprData.baths}</div>
                        <div className="text-xs text-gray-500">Baths</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-lg font-bold">{lookup.rprData.sqft.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Sq Ft</div>
                      </div>
                      <div className="text-center p-2 bg-gray-50 rounded">
                        <div className="text-lg font-bold">{lookup.rprData.yearBuilt}</div>
                        <div className="text-xs text-gray-500">Built</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Stories:</span>
                        <span className="font-medium">{lookup.rprData.stories}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Lot:</span>
                        <span className="font-medium">{lookup.rprData.lotAcres.toFixed(2)} acres</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Roof:</span>
                        <span className="font-medium">{lookup.rprData.roofType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Foundation:</span>
                        <span className="font-medium">{lookup.rprData.foundation}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Exterior:</span>
                        <span className="font-medium">{lookup.rprData.exteriorWalls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">HVAC:</span>
                        <span className="font-medium">{lookup.rprData.hvac}</span>
                      </div>
                    </div>

                    <div className="border-t mt-4 pt-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Owner:</span>
                        <span className="font-medium">
                          {lookup.rprData.ownerName}
                          {lookup.rprData.ownerOccupied && (
                            <span className="ml-2 text-xs text-green-600">(Owner Occupied)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500">Last Sale:</span>
                        <span className="font-medium">
                          {formatCurrency(lookup.rprData.lastSalePrice)} ({lookup.rprData.lastSaleDate})
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Est. Value:</span>
                        <span className="font-medium text-green-600">
                          {formatCurrency(lookup.rprData.estimatedValue)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Market Data (MMI) */}
              {lookup.mmiData && (
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase">
                      Market Status
                    </h3>
                    <span className={cn(
                      'px-2 py-1 rounded text-xs font-bold uppercase',
                      lookup.mmiData.currentStatus === 'active' ? 'bg-green-100 text-green-700' :
                      lookup.mmiData.currentStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      lookup.mmiData.currentStatus === 'sold' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    )}>
                      {lookup.mmiData.currentStatus === 'off_market' ? 'Off Market' : lookup.mmiData.currentStatus}
                    </span>
                  </div>

                  {/* Listing History */}
                  {lookup.mmiData.listingHistory.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-500 mb-2">LISTING HISTORY</div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {lookup.mmiData.listingHistory.slice(0, 5).map((listing, i) => (
                          <div key={i} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded">
                            <div>
                              <span className="font-medium">{new Date(listing.LISTING_DATE).toLocaleDateString()}</span>
                              <span className={cn(
                                'ml-2 text-xs px-1.5 py-0.5 rounded',
                                listing.STATUS?.toLowerCase().includes('sold') ? 'bg-blue-100 text-blue-700' :
                                listing.STATUS?.toLowerCase().includes('active') ? 'bg-green-100 text-green-700' :
                                'bg-gray-200 text-gray-600'
                              )}>
                                {listing.STATUS || 'Unknown'}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="font-medium">{formatCurrency(listing.LIST_PRICE)}</div>
                              {listing.CLOSE_PRICE > 0 && (
                                <div className="text-xs text-gray-500">Sold: {formatCurrency(listing.CLOSE_PRICE)}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Deed/Sale History */}
                  {lookup.mmiData.deedHistory.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-2">SALE & LOAN HISTORY</div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {lookup.mmiData.deedHistory.slice(0, 5).map((deed, i) => (
                          <div key={i} className="text-sm bg-gray-50 px-3 py-2 rounded">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{new Date(deed.DATE).toLocaleDateString()}</span>
                              <span className="text-xs text-gray-500">{deed.TRANSACTION_TYPE}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1 text-xs text-gray-600">
                              {deed.SALE_PRICE && deed.SALE_PRICE > 0 ? (
                                <span>Sale: {formatCurrency(deed.SALE_PRICE)}</span>
                              ) : deed.LOAN_AMOUNT > 0 ? (
                                <span>Loan: {formatCurrency(deed.LOAN_AMOUNT)}</span>
                              ) : null}
                              {deed.LENDER && <span className="truncate max-w-[150px]">{deed.LENDER}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lookup.mmiData.listingHistory.length === 0 && lookup.mmiData.deedHistory.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No market history available for this property.</p>
                  )}
                </div>
              )}

              {/* AI Roof Analysis */}
              {analyzing ? (
                <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin text-2xl">🤖</div>
                    <div>
                      <div className="font-medium text-blue-800">Analyzing Property...</div>
                      <div className="text-sm text-blue-600">AI is reviewing aerial imagery</div>
                    </div>
                  </div>
                </div>
              ) : lookup.aiAnalysis ? (
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase">
                      AI Roof Analysis
                    </h3>
                    <span className={cn(
                      'px-3 py-1 rounded-full text-lg font-bold',
                      getRoofScoreColor(lookup.aiAnalysis.roofScore)
                    )}>
                      {lookup.aiAnalysis.roofScore}/100
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">Age Estimate</div>
                      <div className="font-medium">{lookup.aiAnalysis.roofAgeEstimate}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500">Condition</div>
                      <div className="text-sm">{lookup.aiAnalysis.roofConditionSummary}</div>
                    </div>

                    {lookup.aiAnalysis.roofIssues.length > 0 && (
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Issues Detected</div>
                        <ul className="space-y-1">
                          {lookup.aiAnalysis.roofIssues.map((issue, i) => (
                            <li key={i} className="text-sm flex items-start gap-2">
                              <span className="text-amber-500">•</span>
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2">
                      <span className="text-sm text-gray-500">Recommendation:</span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-sm font-medium',
                        getRiskLevelColor(lookup.aiAnalysis.riskLevel)
                      )}>
                        {lookup.aiAnalysis.recommendedAction}
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Hazard Detection */}
              {lookup.aiAnalysis && (
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                    Hazard Detection
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <HazardItem
                      label="Trampoline"
                      detected={lookup.aiAnalysis.hazardScan.trampoline.detected}
                    />
                    <HazardItem
                      label="Unfenced Pool"
                      detected={lookup.aiAnalysis.hazardScan.unfencedPool.detected}
                      warning
                    />
                    <HazardItem
                      label="Debris"
                      detected={lookup.aiAnalysis.hazardScan.debris.detected}
                    />
                    <HazardItem
                      label="Tree Overhang"
                      detected={lookup.aiAnalysis.hazardScan.treeOverhang.detected}
                      severity={lookup.aiAnalysis.hazardScan.treeOverhang.severity}
                    />
                  </div>
                </div>
              )}

              {/* Environmental Hazard Risk Score */}
              {lookup && (
                <HazardRiskCard
                  address={lookup.formattedAddress}
                  lat={lookup.lat}
                  lng={lookup.lng}
                />
              )}

              {/* Nearmap Features */}
              {lookup.nearmapData && (
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                    Detected Features
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <FeatureItem
                      emoji="🏊"
                      label="Pool"
                      value={lookup.nearmapData.pool.present ? (
                        <span className="text-blue-600">
                          {lookup.nearmapData.pool.type || 'Detected'}
                          {lookup.nearmapData.pool.fenced && ' (Fenced)'}
                        </span>
                      ) : 'None'}
                    />
                    <FeatureItem
                      emoji="☀️"
                      label="Solar"
                      value={lookup.nearmapData.solar.present ? (
                        <span className="text-yellow-600">
                          {lookup.nearmapData.solar.panelCount || ''} Panels
                        </span>
                      ) : 'None'}
                    />
                    <FeatureItem
                      emoji="🌳"
                      label="Trees"
                      value={`${lookup.nearmapData.vegetation.treeCount} detected`}
                    />
                  </div>
                </div>
              )}

              {/* Historical Comparison */}
              {lookup.historicalSurveys && lookup.historicalSurveys.length > 1 && (
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase">
                      Historical Comparison
                    </h3>
                    <button
                      onClick={() => setShowHistorical(!showHistorical)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {showHistorical ? 'Hide' : 'Show'} History
                    </button>
                  </div>

                  {showHistorical && (
                    <div className="space-y-2">
                      {lookup.historicalSurveys.map((survey, i) => (
                        <button
                          key={i}
                          onClick={() => setSelectedHistoricalDate(survey.date)}
                          className={cn(
                            'w-full flex items-center justify-between px-3 py-2 rounded text-sm',
                            selectedHistoricalDate === survey.date
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-50 hover:bg-gray-100'
                          )}
                        >
                          <span>📅 {survey.date}</span>
                          <span className="text-gray-400">View</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {lookup.historicalComparison && (
                    <div className="mt-3 p-3 bg-amber-50 rounded border border-amber-200">
                      <div className="text-sm font-medium text-amber-800 mb-2">
                        Changes Detected
                      </div>
                      {lookup.historicalComparison.changes.map((change, i) => (
                        <div key={i} className="text-sm text-amber-700 flex items-start gap-2">
                          <span>{change.severity === 'major' ? '🔴' : '🟡'}</span>
                          <span>{change.description}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Underwriting Notes */}
              {lookup.aiAnalysis && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
                  <h3 className="text-sm font-semibold text-blue-700 uppercase mb-2 flex items-center gap-2">
                    <span>🤖</span> AI Underwriting Notes
                  </h3>
                  <p className="text-sm text-gray-700">{lookup.aiAnalysis.underwritingNotes}</p>

                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-sm text-gray-500">Risk Level:</span>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-sm font-bold uppercase',
                      getRiskLevelColor(lookup.aiAnalysis.riskLevel)
                    )}>
                      {lookup.aiAnalysis.riskLevel}
                    </span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2">
                  <span>📄</span> Generate PDF
                </button>
                <button className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium flex items-center justify-center gap-2">
                  <span>✉️</span> Email Report
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function HazardItem({
  label,
  detected,
  warning,
  severity,
}: {
  label: string;
  detected: boolean;
  warning?: boolean;
  severity?: string;
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded',
      detected
        ? warning ? 'bg-red-50' : 'bg-amber-50'
        : 'bg-green-50'
    )}>
      <span className="text-lg">
        {detected
          ? warning ? '⚠️' : '⚡'
          : '✅'}
      </span>
      <div>
        <div className="text-sm font-medium">
          {detected ? label : `No ${label.toLowerCase()}`}
        </div>
        {severity && severity !== 'none' && (
          <div className="text-xs text-gray-500 capitalize">{severity}</div>
        )}
      </div>
    </div>
  );
}

function FeatureItem({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded">
      <div className="text-2xl mb-1">{emoji}</div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
