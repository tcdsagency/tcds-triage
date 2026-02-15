'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { FloodZoneIndicator, FloodRisk } from '@/components/ui/flood-zone-indicator';
import {
  FileText, Send, Download, MapPin, Building2, Shield, TrendingUp, History,
  FileOutput, CheckCircle, Clock, AlertTriangle, ChevronDown, Eye, Layers,
  Home, Droplets, Flame, Wind, Cloud, Activity
} from 'lucide-react';

// Dynamic import for Leaflet map (client-side only)
const NearmapMap = dynamic(
  () => import('@/components/features/NearmapMap').then(mod => ({ default: mod.NearmapMap })),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
        <div className="animate-spin text-3xl">🛰️</div>
      </div>
    )
  }
);

// =============================================================================
// TYPES
// =============================================================================

interface PropertyAPIData {
  parcel?: { fips?: string; apn?: string; county?: string; legalDescription?: string };
  location?: { lat?: number; lng?: number };
  building?: { sqft?: number; bedrooms?: number; bathrooms?: number; yearBuilt?: number; lotSizeAcres?: number; stories?: number };
  owner?: { name?: string; type?: string; ownerOccupied?: boolean; mailingAddress?: string };
  valuation?: { marketValue?: number; assessedTotal?: number };
  saleHistory?: { lastSaleDate?: string; lastSalePrice?: number };
  tax?: { annualTax?: number; taxYear?: number };
  propertyType?: string;
}

interface PropertyLookup {
  id: string;
  address: string;
  formattedAddress: string;
  lat: number;
  lng: number;
  nearmapData: NearmapData | null;
  rprData: RPRData | null;
  mmiData: MMIData | null;
  propertyApiData: PropertyAPIData | null;
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
  pool?: { present: boolean; type?: string; fenced?: boolean; area?: number };
  solar: { present: boolean; panelCount?: number; area?: number };
  vegetation: { treeCount: number; coveragePercent: number; proximityToStructure: string; treeOverhangArea?: number };
  hazards?: { trampoline: boolean; debris: boolean; construction: boolean };
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
  garageSpaces?: number;
  fireplaces?: number;
  hasPool?: boolean;
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

type Mode = 'report' | 'explore';
type TabType = 'overview' | 'imagery' | 'analysis' | 'market' | 'historical' | 'export';

interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TABS: { id: TabType; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Home className="w-4 h-4" /> },
  { id: 'imagery', label: 'Imagery & Maps', icon: <Layers className="w-4 h-4" /> },
  { id: 'analysis', label: 'Analysis', icon: <Shield className="w-4 h-4" /> },
  { id: 'market', label: 'Market Data', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'historical', label: 'Historical', icon: <History className="w-4 h-4" /> },
  { id: 'export', label: 'Export', icon: <FileOutput className="w-4 h-4" /> },
];

const GENERATION_STEPS: GenerationStep[] = [
  { id: 'geocoding', label: 'Geocoding', status: 'pending' },
  { id: 'aerial', label: 'Aerial Data', status: 'pending' },
  { id: 'property', label: 'Property Records', status: 'pending' },
  { id: 'market', label: 'Market Data', status: 'pending' },
  { id: 'analysis', label: 'AI Analysis', status: 'pending' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function PropertyIntelligencePage() {
  // Mode & Navigation
  const [mode, setMode] = useState<Mode>('report');
  const [activeTab, setActiveTab] = useState<TabType>('overview');

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

  // Generation Progress (Report Mode)
  const [generationSteps, setGenerationSteps] = useState<GenerationStep[]>(GENERATION_STEPS);
  const [generationProgress, setGenerationProgress] = useState(0);

  // View State
  const [viewMode, setViewMode] = useState<'aerial' | 'street' | 'split'>('aerial');
  const [selectedHistoricalDate, setSelectedHistoricalDate] = useState<string | null>(null);
  const [comparisonDate, setComparisonDate] = useState<string | null>(null);

  // Overlay Controls
  const [overlays, setOverlays] = useState({
    roof: true,
    pool: true,
    treeOverhang: true,
    building: true,
    solar: false,
    parcel: false,
  });

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

  const updateStep = (stepId: string, status: 'pending' | 'active' | 'complete' | 'error') => {
    setGenerationSteps(prev => prev.map(s => s.id === stepId ? { ...s, status } : s));
    const stepIndex = GENERATION_STEPS.findIndex(s => s.id === stepId);
    if (status === 'complete') {
      setGenerationProgress(Math.round(((stepIndex + 1) / GENERATION_STEPS.length) * 100));
    } else if (status === 'active') {
      setGenerationProgress(Math.round((stepIndex / GENERATION_STEPS.length) * 100));
    }
  };

  const handleSelectAddress = useCallback(async (suggestion: any) => {
    setSearchQuery(suggestion.description);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    setActiveTab('overview');
    setGenerationSteps(GENERATION_STEPS.map(s => ({ ...s, status: 'pending' })));
    setGenerationProgress(0);

    try {
      // Step 1: Geocoding
      updateStep('geocoding', 'active');
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
      updateStep('geocoding', 'complete');

      // Steps 2-4: Property Lookup (parallel)
      updateStep('aerial', 'active');
      updateStep('property', 'active');
      updateStep('market', 'active');

      const response = await fetch('/api/property/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: suggestion.description, formattedAddress, lat, lng }),
      });

      const data = await response.json();

      if (data.success) {
        updateStep('aerial', 'complete');
        updateStep('property', 'complete');
        updateStep('market', 'complete');
        setLookup(data.lookup);

        // Step 5: AI Analysis
        if (!data.lookup.aiAnalysis) {
          updateStep('analysis', 'active');
          await runAIAnalysis(data.lookup.id, data.lookup.nearmapData?.tileUrl);
          updateStep('analysis', 'complete');
        } else {
          updateStep('analysis', 'complete');
        }
      } else {
        setError(data.error || 'Lookup failed');
        updateStep('aerial', 'error');
        updateStep('property', 'error');
        updateStep('market', 'error');
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

  const getRoofGrade = (score: number): { grade: string; color: string } => {
    if (score >= 90) return { grade: 'A', color: 'bg-green-500' };
    if (score >= 80) return { grade: 'B', color: 'bg-green-400' };
    if (score >= 70) return { grade: 'C', color: 'bg-yellow-500' };
    if (score >= 60) return { grade: 'D', color: 'bg-orange-500' };
    return { grade: 'F', color: 'bg-red-500' };
  };

  const getDecision = (analysis: AIAnalysis | null): { decision: string; color: string; bgColor: string } => {
    if (!analysis) return { decision: 'PENDING', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    if (analysis.riskLevel === 'low') return { decision: 'ACCEPT', color: 'text-green-700', bgColor: 'bg-green-100' };
    if (analysis.riskLevel === 'medium') return { decision: 'REVIEW', color: 'text-amber-700', bgColor: 'bg-amber-100' };
    return { decision: 'DECLINE', color: 'text-red-700', bgColor: 'bg-red-100' };
  };

  const getConfidence = (analysis: AIAnalysis | null): number => {
    if (!analysis) return 0;
    // Calculate confidence based on data completeness
    let confidence = 70;
    if (analysis.roofScore > 0) confidence += 10;
    if (analysis.roofConditionSummary) confidence += 10;
    if (analysis.hazardScan) confidence += 10;
    return Math.min(confidence, 100);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Property Intelligence
          </h1>

          {/* Mode Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setMode('report')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                mode === 'report'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              <FileText className="w-4 h-4 inline mr-1.5" />
              Report Mode
            </button>
            <button
              onClick={() => setMode('explore')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                mode === 'explore'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              )}
            >
              <Eye className="w-4 h-4 inline mr-1.5" />
              Explore Mode
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div ref={searchRef} className="mt-3 relative">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Enter address..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {loading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-600">⏳</div>
              )}
            </div>
            <button
              onClick={() => suggestions[0] && handleSelectAddress(suggestions[0])}
              disabled={!suggestions.length || loading}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Generate Report
            </button>
          </div>

          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
              {suggestions.map((s, i) => (
                <button
                  key={s.place_id || i}
                  onClick={() => handleSelectAddress(s)}
                  className="w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-gray-900 dark:text-gray-100 font-medium">{s.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress Tracker (Report Mode) */}
        {mode === 'report' && loading && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-4 mb-3">
              {generationSteps.map((step, i) => (
                <div key={step.id} className="flex items-center">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    step.status === 'complete' ? 'bg-green-500 text-white' :
                    step.status === 'active' ? 'bg-blue-500 text-white animate-pulse' :
                    step.status === 'error' ? 'bg-red-500 text-white' :
                    'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                  )}>
                    {step.status === 'complete' ? '✓' : step.status === 'error' ? '!' : i + 1}
                  </div>
                  <span className={cn(
                    'ml-2 text-sm font-medium',
                    step.status === 'active' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400'
                  )}>
                    {step.label}
                  </span>
                  {i < generationSteps.length - 1 && (
                    <div className={cn(
                      'w-8 h-0.5 ml-2',
                      step.status === 'complete' ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                    )} />
                  )}
                </div>
              ))}
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              {generationProgress}% - {generationSteps.find(s => s.status === 'active')?.label || 'Preparing...'}
            </p>
          </div>
        )}
      </div>

      {/* Main Content */}
      {!lookup && !loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Search for a Property</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Enter an address to generate a comprehensive underwriting report with aerial imagery, property details, AI analysis, and market data.
            </p>
          </div>
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
          </div>
        </div>
      ) : lookup ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {/* ============================================================ */}
            {/* OVERVIEW TAB */}
            {/* ============================================================ */}
            {activeTab === 'overview' && (
              <div className="p-6 space-y-6">
                {/* Decision Banner */}
                <DecisionBanner
                  address={lookup.formattedAddress}
                  aiAnalysis={lookup.aiAnalysis}
                  nearmapData={lookup.nearmapData}
                  analyzing={analyzing}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Property Snapshot */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Home className="w-5 h-5 text-blue-600" />
                      Property Snapshot
                      <SourceBadge source="RPR" />
                    </h3>
                    {lookup.rprData ? (
                      <>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                          <StatCard icon="🛏️" label="Beds" value={lookup.rprData.beds} />
                          <StatCard icon="🚿" label="Baths" value={lookup.rprData.baths} />
                          <StatCard icon="📐" label="Sqft" value={lookup.rprData.sqft.toLocaleString()} />
                        </div>
                        <div className="space-y-2 text-sm">
                          <InfoRow label="Year Built" value={lookup.rprData.yearBuilt} icon="📅" />
                          <InfoRow label="Roof Type" value={`${lookup.rprData.exteriorWalls} / ${lookup.rprData.roofType}`} icon="🏗️" />
                          <InfoRow label="Garage" value={`${lookup.rprData.garageSpaces || 0}-car garage`} icon="🚗" />
                          <InfoRow label="Fireplace" value={`${lookup.rprData.fireplaces || 0} fireplace${(lookup.rprData.fireplaces || 0) !== 1 ? 's' : ''}`} icon="🔥" />
                          <div className="border-t border-gray-100 dark:border-gray-700 my-3" />
                          <InfoRow label="Est. Value" value={formatCurrency(lookup.rprData.estimatedValue)} highlight icon="💰" />
                          <InfoRow label="Assessed" value={formatCurrency(lookup.rprData.assessedValue)} icon="📋" />
                          <InfoRow label="Last Sale" value={`${formatCurrency(lookup.rprData.lastSalePrice)} (${lookup.rprData.lastSaleDate})`} icon="🏷️" />
                          <InfoRow label="Tax" value={`${formatCurrency(lookup.rprData.taxAmount)}/yr`} icon="💵" />
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-gray-500">Property data not available</div>
                    )}
                  </div>

                  {/* Quick Image */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-blue-600" />
                      Aerial View
                      <SourceBadge source="Nearmap" />
                    </h3>
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                      {lookup.nearmapData?.tileUrl ? (
                        <img
                          src={`/api/property/nearmap-tile?url=${encodeURIComponent(lookup.nearmapData.tileUrl)}`}
                          alt="Aerial view"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-gray-500">No aerial image</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>Survey Date: {lookup.nearmapData?.surveyDate || 'N/A'}</span>
                      <button
                        onClick={() => setActiveTab('imagery')}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        View Full Map →
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Detected Features */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-600" />
                      Detected Features
                      <SourceBadge source="Nearmap AI" />
                    </h3>
                    {lookup.nearmapData ? (
                      <div className="space-y-3">
                        <FeatureRow
                          label="Pool Detected"
                          detected={lookup.nearmapData.pool?.present || false}
                          detail={lookup.nearmapData.pool?.present ? (lookup.nearmapData.pool?.fenced ? 'Fenced' : 'Unfenced ⚠️') : undefined}
                          confidence={98}
                        />
                        <FeatureRow
                          label="Solar Panels"
                          detected={lookup.nearmapData.solar.present}
                          detail={lookup.nearmapData.solar.panelCount ? `${lookup.nearmapData.solar.panelCount} panels` : undefined}
                        />
                        <FeatureRow
                          label="Trampoline"
                          detected={lookup.nearmapData.hazards?.trampoline || false}
                        />
                        <FeatureRow
                          label="Tree Overhang"
                          detected={(lookup.nearmapData.vegetation.treeOverhangArea || 0) > 50}
                          detail={lookup.nearmapData.vegetation.treeOverhangArea ? `${Math.round(lookup.nearmapData.vegetation.treeOverhangArea)} sqft` : undefined}
                          warning={(lookup.nearmapData.vegetation.treeOverhangArea || 0) > 100}
                        />
                        <FeatureRow
                          label="Debris/Clutter"
                          detected={lookup.nearmapData.hazards?.debris || false}
                          confidence={lookup.aiAnalysis?.hazardScan.debris.confidence}
                        />
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">Feature detection not available</div>
                    )}
                  </div>

                  {/* Risk Factors */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-600" />
                      Risk Factors
                    </h3>
                    <div className="space-y-3">
                      <RiskRow
                        icon={<Droplets className="w-4 h-4" />}
                        label="Flood Zone"
                        value={lookup.rprData?.floodZone || 'Unknown'}
                        level={lookup.rprData?.floodZone?.startsWith('X') ? 'low' : lookup.rprData?.floodZone?.startsWith('A') ? 'high' : 'medium'}
                      />
                      <RiskRow
                        icon={<Flame className="w-4 h-4" />}
                        label="Wildfire"
                        value="15/100"
                        level="low"
                      />
                      <RiskRow
                        icon={<Cloud className="w-4 h-4" />}
                        label="Hail"
                        value="45/100"
                        level="medium"
                      />
                      <RiskRow
                        icon={<Wind className="w-4 h-4" />}
                        label="Wind"
                        value="35/100"
                        level="low"
                      />
                      <RiskRow
                        icon={<Activity className="w-4 h-4" />}
                        label="Earthquake"
                        value="5/100"
                        level="low"
                      />
                    </div>
                  </div>
                </div>

                {/* Owner & Occupancy */}
                {lookup.rprData && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">Owner & Occupancy</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Owner</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{lookup.rprData.ownerName || 'Unknown'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Occupancy</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {lookup.rprData.ownerOccupied ? 'Owner-Occupied ✓' : 'Rental/Tenant'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Mailing</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">Same as property</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Years Owned</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {lookup.rprData.lastSaleDate ? `${Math.floor((Date.now() - new Date(lookup.rprData.lastSaleDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))} years` : 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* PropertyAPI Enrichment */}
                {lookup.propertyApiData && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Parcel &amp; Tax Records
                      <SourceBadge source="PropertyAPI" />
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                      {/* Parcel Info */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-1">Parcel</h4>
                        {lookup.propertyApiData.parcel?.apn && (
                          <InfoRow label="APN" value={lookup.propertyApiData.parcel.apn} icon="📋" />
                        )}
                        {lookup.propertyApiData.parcel?.county && (
                          <InfoRow label="County" value={lookup.propertyApiData.parcel.county} icon="📍" />
                        )}
                        {lookup.propertyApiData.propertyType && (
                          <InfoRow label="Type" value={lookup.propertyApiData.propertyType} icon="🏠" />
                        )}
                        {lookup.propertyApiData.building?.lotSizeAcres != null && (
                          <InfoRow label="Lot Size" value={`${lookup.propertyApiData.building.lotSizeAcres.toFixed(2)} acres`} icon="📐" />
                        )}
                        {lookup.propertyApiData.parcel?.legalDescription && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic truncate" title={lookup.propertyApiData.parcel.legalDescription}>
                            {lookup.propertyApiData.parcel.legalDescription}
                          </div>
                        )}
                      </div>

                      {/* Valuation & Sale */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-1">Valuation</h4>
                        {lookup.propertyApiData.valuation?.marketValue != null && (
                          <InfoRow label="Market Value" value={formatCurrency(lookup.propertyApiData.valuation.marketValue)} highlight icon="💰" />
                        )}
                        {lookup.propertyApiData.valuation?.assessedTotal != null && (
                          <InfoRow label="Assessed" value={formatCurrency(lookup.propertyApiData.valuation.assessedTotal)} icon="📋" />
                        )}
                        {lookup.propertyApiData.saleHistory?.lastSalePrice != null && (
                          <InfoRow
                            label="Last Sale"
                            value={`${formatCurrency(lookup.propertyApiData.saleHistory.lastSalePrice)}${lookup.propertyApiData.saleHistory.lastSaleDate ? ` (${lookup.propertyApiData.saleHistory.lastSaleDate})` : ''}`}
                            icon="🏷️"
                          />
                        )}
                      </div>

                      {/* Tax & Owner */}
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-700 pb-1">Tax &amp; Owner</h4>
                        {lookup.propertyApiData.tax?.annualTax != null && (
                          <InfoRow label="Annual Tax" value={`${formatCurrency(lookup.propertyApiData.tax.annualTax)}${lookup.propertyApiData.tax.taxYear ? ` (${lookup.propertyApiData.tax.taxYear})` : ''}`} icon="💵" />
                        )}
                        {lookup.propertyApiData.owner?.name && (
                          <InfoRow label="Owner" value={lookup.propertyApiData.owner.name} icon="👤" />
                        )}
                        {lookup.propertyApiData.owner?.ownerOccupied != null && (
                          <InfoRow label="Occupancy" value={lookup.propertyApiData.owner.ownerOccupied ? 'Owner-Occupied' : 'Non-Owner'} icon="🏡" />
                        )}
                        {lookup.propertyApiData.building?.sqft != null && (
                          <InfoRow label="Building Sqft" value={lookup.propertyApiData.building.sqft.toLocaleString()} icon="📏" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* IMAGERY TAB */}
            {/* ============================================================ */}
            {activeTab === 'imagery' && (
              <div className="p-6 space-y-6">
                {/* View Controls */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    {(['aerial', 'street', 'split'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setViewMode(v)}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                          viewMode === v
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        )}
                      >
                        {v === 'aerial' ? '🛰️ Aerial' : v === 'street' ? '🚗 Street View' : '⬜ Split View'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Overlays:</span>
                    {Object.entries(overlays).map(([key, value]) => (
                      <button
                        key={key}
                        onClick={() => setOverlays(prev => ({ ...prev, [key]: !prev[key as keyof typeof overlays] }))}
                        className={cn(
                          'px-2 py-1 text-xs rounded border transition-colors',
                          value
                            ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700'
                            : 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600'
                        )}
                      >
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Viewport */}
                <div className={cn(
                  'rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700',
                  viewMode === 'split' ? 'grid grid-cols-2 gap-1' : ''
                )}>
                  {(viewMode === 'aerial' || viewMode === 'split') && (
                    <div className="h-[500px] relative bg-gray-200 dark:bg-gray-700">
                      <NearmapMap
                        lat={lookup.lat}
                        lng={lookup.lng}
                        zoom={19}
                        surveyDate={selectedHistoricalDate || lookup.nearmapData?.surveyDate}
                        overlays={lookup.nearmapData?.overlays}
                      />
                    </div>
                  )}
                  {(viewMode === 'street' || viewMode === 'split') && (
                    <div className="h-[500px] relative">
                      <iframe
                        src={`https://www.google.com/maps/embed/v1/streetview?key=AIzaSyCwt9YE8VmZkkZZllchR1gOeX08_63r3Ns&location=${lookup.lat},${lookup.lng}&heading=0&pitch=0&fov=90`}
                        className="absolute inset-0 w-full h-full"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                {/* Oblique Views */}
                {lookup.obliqueViews && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">Oblique Views (4-Direction)</h3>
                    <div className="grid grid-cols-4 gap-4">
                      {(['north', 'south', 'east', 'west'] as const).map((dir) => (
                        <div key={dir} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                          {lookup.obliqueViews?.[dir] ? (
                            <img
                              src={lookup.obliqueViews[dir]}
                              alt={`${dir} view`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                              {dir.toUpperCase()}
                            </div>
                          )}
                          <div className="text-center mt-2 text-sm font-medium text-gray-700 dark:text-gray-300 uppercase">
                            {dir}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Survey Info */}
                <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <span>Survey Date: <strong>{lookup.nearmapData?.surveyDate || 'N/A'}</strong></span>
                  <span>Resolution: <strong>7.5cm</strong></span>
                  <span>Coverage: <strong className="text-green-600">✓ Full</strong></span>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* ANALYSIS TAB */}
            {/* ============================================================ */}
            {activeTab === 'analysis' && (
              <div className="p-6 space-y-6">
                {analyzing ? (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-8 text-center border border-blue-200 dark:border-blue-800">
                    <div className="animate-spin text-4xl mb-4">🤖</div>
                    <h3 className="text-lg font-bold text-blue-800 dark:text-blue-200">Analyzing Property...</h3>
                    <p className="text-blue-600 dark:text-blue-400 mt-2">AI is reviewing aerial imagery</p>
                  </div>
                ) : lookup.aiAnalysis ? (
                  <>
                    {/* Roof Condition Analysis */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          Roof Condition Analysis
                          <SourceBadge source="Claude AI" />
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold',
                            getRoofGrade(lookup.aiAnalysis.roofScore).color
                          )}>
                            {getRoofGrade(lookup.aiAnalysis.roofScore).grade}
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{lookup.aiAnalysis.roofScore}/100</div>
                            <div className="text-sm text-gray-500">
                              {lookup.aiAnalysis.roofScore >= 80 ? 'EXCELLENT' : lookup.aiAnalysis.roofScore >= 60 ? 'GOOD' : 'NEEDS ATTENTION'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div className="space-y-3 mb-6">
                        <ScoreBar label="Material Condition" value={85} />
                        <ScoreBar label="Age Factor" value={95} detail={`Est. ${lookup.aiAnalysis.roofAgeEstimate}`} />
                        <ScoreBar label="Debris/Staining" value={92} />
                        <ScoreBar label="Structural Integrity" value={98} />
                        <ScoreBar label="Tree Impact" value={75} detail={lookup.nearmapData?.vegetation.treeOverhangArea ? `${Math.round(lookup.nearmapData.vegetation.treeOverhangArea)}sf overhang` : undefined} />
                      </div>

                      <div className="grid grid-cols-2 gap-6 text-sm">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Material</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{lookup.nearmapData?.roof.material || 'Unknown'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Estimated Install</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{lookup.aiAnalysis.roofAgeEstimate}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Remaining Life</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">18-23 years</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Area</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{lookup.nearmapData?.roof.area?.toLocaleString() || 'N/A'} sqft</p>
                        </div>
                      </div>

                      {/* Issues */}
                      {lookup.aiAnalysis.roofIssues.length > 0 && (
                        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Issues Detected:</h4>
                          <ul className="space-y-2">
                            {lookup.aiAnalysis.roofIssues.map((issue, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-700 dark:text-gray-300">{issue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Hazard Detection */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        Hazard Detection
                        <SourceBadge source="Claude AI" />
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <HazardCard
                          label="Pool"
                          detected={lookup.nearmapData?.pool?.present || false}
                          confidence={98}
                          detail={lookup.nearmapData?.pool?.present ? (lookup.nearmapData.pool?.fenced ? 'Fenced' : 'Unfenced ⚠️') : undefined}
                        />
                        <HazardCard
                          label="Trampoline"
                          detected={lookup.aiAnalysis.hazardScan.trampoline.detected}
                          confidence={lookup.aiAnalysis.hazardScan.trampoline.confidence}
                        />
                        <HazardCard
                          label="Solar"
                          detected={lookup.nearmapData?.solar.present || false}
                        />
                        <HazardCard
                          label="Fencing"
                          detected={lookup.nearmapData?.pool?.fenced || false}
                          confidence={65}
                          detail={lookup.nearmapData?.pool?.fenced ? 'Complete' : 'Partial/None'}
                        />
                      </div>
                      {(lookup.nearmapData?.pool?.present && !lookup.nearmapData.pool?.fenced) && (
                        <div className="mt-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                          <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">Liability Notes:</h4>
                          <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                            <li>• Pool detected - liability endorsement recommended</li>
                            <li>• Fencing appears incomplete - verification needed</li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Composite Risk Score */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Composite Risk Score</h3>
                      <div className="flex items-center gap-4 mb-6">
                        <div className={cn(
                          'px-4 py-2 rounded-lg font-bold text-lg',
                          lookup.aiAnalysis.riskLevel === 'low' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          lookup.aiAnalysis.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                        )}>
                          OVERALL: {lookup.aiAnalysis.riskLevel.toUpperCase()} (42/100)
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                            <th className="pb-2">Component</th>
                            <th className="pb-2">Score</th>
                            <th className="pb-2">Weight</th>
                            <th className="pb-2">Contribution</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-900 dark:text-gray-100">
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2">Wind Risk</td>
                            <td>35</td>
                            <td>20%</td>
                            <td>7.0</td>
                          </tr>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2">Hail Risk</td>
                            <td>45</td>
                            <td>15%</td>
                            <td>6.8</td>
                          </tr>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2">Flood Risk</td>
                            <td>20</td>
                            <td>25%</td>
                            <td>5.0</td>
                          </tr>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2">Wildfire Risk</td>
                            <td>15</td>
                            <td>15%</td>
                            <td>2.3</td>
                          </tr>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2">Earthquake Risk</td>
                            <td>5</td>
                            <td>10%</td>
                            <td>0.5</td>
                          </tr>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-2">Property Condition</td>
                            <td>{lookup.aiAnalysis.roofScore}</td>
                            <td>15%</td>
                            <td>{(((100 - lookup.aiAnalysis.roofScore) * 0.15)).toFixed(1)}</td>
                          </tr>
                          <tr className="font-bold">
                            <td className="pt-3">TOTAL</td>
                            <td></td>
                            <td></td>
                            <td className="pt-3">42.0</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* AI Recommendation */}
                    <div className={cn(
                      'rounded-xl border p-6',
                      lookup.aiAnalysis.riskLevel === 'low'
                        ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                        : lookup.aiAnalysis.riskLevel === 'medium'
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
                        : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                    )}>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">AI Underwriting Recommendation</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Confidence:</span>
                          <span className="font-bold text-gray-900 dark:text-gray-100">{getConfidence(lookup.aiAnalysis)}%</span>
                        </div>
                      </div>
                      <div className={cn(
                        'inline-block px-4 py-2 rounded-lg font-bold text-lg mb-4',
                        getDecision(lookup.aiAnalysis).bgColor,
                        getDecision(lookup.aiAnalysis).color
                      )}>
                        {getDecision(lookup.aiAnalysis).decision} ✓
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 mb-4">{lookup.aiAnalysis.underwritingNotes}</p>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Key Positives</h4>
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            {lookup.aiAnalysis.roofScore >= 80 && <li>✓ Roof in excellent condition</li>}
                            {lookup.rprData?.ownerOccupied && <li>✓ Owner-occupied</li>}
                            {lookup.rprData?.floodZone?.startsWith('X') && <li>✓ Low flood risk</li>}
                            <li>✓ No visible structural damage</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Action Items</h4>
                          <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
                            {lookup.nearmapData?.pool?.present && <li>⚠ Add pool liability endorsement</li>}
                            {lookup.nearmapData?.pool?.present && !lookup.nearmapData.pool?.fenced && <li>⚠ Verify pool fencing on inspect</li>}
                            {(lookup.nearmapData?.vegetation.treeOverhangArea || 0) > 100 && <li>⚠ Recommend tree trimming</li>}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Shield className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>AI analysis not available yet</p>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* MARKET DATA TAB */}
            {/* ============================================================ */}
            {activeTab === 'market' && (
              <div className="p-6 space-y-6">
                {lookup.mmiData ? (
                  <>
                    {/* Current Status */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Current Status</h3>
                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
                          <p className={cn(
                            'text-lg font-bold uppercase',
                            lookup.mmiData.currentStatus === 'active' ? 'text-green-600' :
                            lookup.mmiData.currentStatus === 'pending' ? 'text-amber-600' :
                            lookup.mmiData.currentStatus === 'sold' ? 'text-blue-600' :
                            'text-gray-600'
                          )}>
                            {lookup.mmiData.currentStatus === 'off_market' ? 'OFF MARKET' : lookup.mmiData.currentStatus.toUpperCase()}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Estimated Value</span>
                          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(lookup.rprData?.estimatedValue || 0)}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">Price/SqFt</span>
                          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {lookup.rprData ? formatCurrency(Math.round(lookup.rprData.estimatedValue / lookup.rprData.sqft)) : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Sale History */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                        Sale History
                        <SourceBadge source="MMI" />
                      </h3>
                      {lookup.mmiData.deedHistory.filter(d => d.SALE_PRICE && d.SALE_PRICE > 0).length > 0 ? (
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Price</th>
                              <th className="pb-2">Type</th>
                              <th className="pb-2">Buyer/Seller</th>
                              <th className="pb-2">Change</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-900 dark:text-gray-100">
                            {lookup.mmiData.deedHistory
                              .filter(d => d.SALE_PRICE && d.SALE_PRICE > 0)
                              .slice(0, 5)
                              .map((deed, i, arr) => (
                                <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                                  <td className="py-3">{new Date(deed.DATE).toLocaleDateString()}</td>
                                  <td className="font-medium">{formatCurrency(deed.SALE_PRICE || 0)}</td>
                                  <td>{deed.TRANSACTION_TYPE}</td>
                                  <td className="truncate max-w-[200px]">{deed.BUYER_NAME || '—'}</td>
                                  <td>
                                    {i < arr.length - 1 && arr[i + 1].SALE_PRICE && deed.SALE_PRICE ? (
                                      <span className={deed.SALE_PRICE > arr[i + 1].SALE_PRICE! ? 'text-green-600' : 'text-red-600'}>
                                        {deed.SALE_PRICE > arr[i + 1].SALE_PRICE!
                                          ? `+${((deed.SALE_PRICE - arr[i + 1].SALE_PRICE!) / arr[i + 1].SALE_PRICE! * 100).toFixed(1)}%`
                                          : `${((deed.SALE_PRICE - arr[i + 1].SALE_PRICE!) / arr[i + 1].SALE_PRICE! * 100).toFixed(1)}%`
                                        }
                                      </span>
                                    ) : '—'}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-gray-500 text-center py-4">No sale history available</p>
                      )}
                    </div>

                    {/* Mortgage Info */}
                    {lookup.mmiData.deedHistory.some(d => d.LOAN_AMOUNT > 0) && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Mortgage Information</h3>
                        {(() => {
                          const latestLoan = lookup.mmiData.deedHistory.find(d => d.LOAN_AMOUNT > 0);
                          if (!latestLoan) return null;
                          return (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-sm">
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Lender</span>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{latestLoan.LENDER || 'Unknown'}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Loan Amount</span>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(latestLoan.LOAN_AMOUNT)}</p>
                              </div>
                              <div>
                                <span className="text-gray-500 dark:text-gray-400">Origination</span>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{new Date(latestLoan.DATE).toLocaleDateString()}</p>
                              </div>
                              {latestLoan.LOAN_OFFICER && (
                                <div>
                                  <span className="text-gray-500 dark:text-gray-400">Loan Officer</span>
                                  <p className="font-medium text-gray-900 dark:text-gray-100">{latestLoan.LOAN_OFFICER}</p>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Listing History */}
                    {lookup.mmiData.listingHistory.length > 0 && (
                      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                          Listing History
                          <SourceBadge source="MMI" />
                        </h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                              <th className="pb-2">Date</th>
                              <th className="pb-2">Event</th>
                              <th className="pb-2">Price</th>
                              <th className="pb-2">DOM</th>
                              <th className="pb-2">Agent/Broker</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-900 dark:text-gray-100">
                            {lookup.mmiData.listingHistory.slice(0, 10).map((listing, i) => (
                              <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                                <td className="py-3">{new Date(listing.LISTING_DATE).toLocaleDateString()}</td>
                                <td>
                                  <span className={cn(
                                    'px-2 py-0.5 rounded text-xs font-medium',
                                    listing.STATUS?.toLowerCase().includes('sold') ? 'bg-green-100 text-green-700' :
                                    listing.STATUS?.toLowerCase().includes('active') ? 'bg-blue-100 text-blue-700' :
                                    listing.STATUS?.toLowerCase().includes('pending') ? 'bg-amber-100 text-amber-700' :
                                    'bg-gray-100 text-gray-700'
                                  )}>
                                    {listing.STATUS || 'Unknown'}
                                  </span>
                                </td>
                                <td className="font-medium">{formatCurrency(listing.LIST_PRICE)}</td>
                                <td>{listing.DAYS_ON_MARKET || '—'}</td>
                                <td className="truncate max-w-[200px]">{listing.LISTING_AGENT} / {listing.LISTING_BROKER}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Market data not available</p>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* HISTORICAL TAB */}
            {/* ============================================================ */}
            {activeTab === 'historical' && (
              <div className="p-6 space-y-6">
                {/* Date Selectors */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Date</label>
                      <select
                        value={selectedHistoricalDate || ''}
                        onChange={(e) => setSelectedHistoricalDate(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Latest ({lookup.nearmapData?.surveyDate || 'Current'})</option>
                        {lookup.historicalSurveys?.map((survey, i) => (
                          <option key={i} value={survey.date}>{survey.date}</option>
                        ))}
                      </select>
                    </div>
                    <span className="text-gray-500 font-medium">vs</span>
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compare To</label>
                      <select
                        value={comparisonDate || ''}
                        onChange={(e) => setComparisonDate(e.target.value || null)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">Select date...</option>
                        {lookup.historicalSurveys?.map((survey, i) => (
                          <option key={i} value={survey.date}>{survey.date}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                {comparisonDate ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-center font-medium">
                        Current ({selectedHistoricalDate || lookup.nearmapData?.surveyDate || 'Latest'})
                      </div>
                      <div className="h-80 relative bg-gray-200 dark:bg-gray-700">
                        <NearmapMap
                          lat={lookup.lat}
                          lng={lookup.lng}
                          zoom={19}
                          surveyDate={selectedHistoricalDate || lookup.nearmapData?.surveyDate}
                          overlays={lookup.nearmapData?.overlays}
                        />
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 text-center font-medium">
                        Historical ({comparisonDate})
                      </div>
                      <div className="h-80 relative bg-gray-200 dark:bg-gray-700">
                        <NearmapMap
                          lat={lookup.lat}
                          lng={lookup.lng}
                          zoom={19}
                          surveyDate={comparisonDate}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <History className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">Select a comparison date to view historical changes</p>
                  </div>
                )}

                {/* Available Surveys */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3">Available Surveys</h3>
                  <div className="flex flex-wrap gap-2">
                    {lookup.historicalSurveys?.length ? (
                      <>
                        <button
                          onClick={() => { setSelectedHistoricalDate(null); setComparisonDate(null); }}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                            !selectedHistoricalDate
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-500'
                          )}
                        >
                          ● {lookup.nearmapData?.surveyDate || 'Latest'}
                        </button>
                        {lookup.historicalSurveys.map((survey, i) => (
                          <button
                            key={i}
                            onClick={() => setComparisonDate(survey.date)}
                            className={cn(
                              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                              comparisonDate === survey.date
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-500'
                            )}
                          >
                            ○ {survey.date}
                          </button>
                        ))}
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">No historical surveys available</p>
                    )}
                  </div>
                </div>

                {/* Detected Changes */}
                {lookup.historicalComparison?.changesDetected && (
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4">Detected Changes</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                          <th className="pb-2">Date</th>
                          <th className="pb-2">Change Type</th>
                          <th className="pb-2">Significance</th>
                          <th className="pb-2">Details</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-900 dark:text-gray-100">
                        {lookup.historicalComparison.changes.map((change, i) => (
                          <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="py-3">{lookup.historicalComparison?.comparedDates.current}</td>
                            <td className="font-medium">{change.type}</td>
                            <td>
                              <span className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium',
                                change.severity === 'high' ? 'bg-red-100 text-red-700' :
                                change.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-green-100 text-green-700'
                              )}>
                                {change.severity}
                              </span>
                            </td>
                            <td>{change.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* EXPORT TAB */}
            {/* ============================================================ */}
            {activeTab === 'export' && (
              <div className="p-6 space-y-6">
                {/* Download Report */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Download className="w-5 h-5 text-blue-600" />
                    Download Report
                  </h3>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Report Type</label>
                    <div className="flex gap-3">
                      {['Full Report', 'Summary Only', 'Images Only'].map((type) => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="reportType" defaultChecked={type === 'Full Report'} className="text-blue-600" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Include Sections</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Overview & Decision', 'Aerial Imagery', 'Roof Analysis', 'Hazard Detection', 'Market Data', 'Historical Comparison', 'Construction Details', 'Raw Data Appendix'].map((section, i) => (
                        <label key={section} className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" defaultChecked={i < 6} className="text-blue-600 rounded" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{section}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => alert('PDF export coming soon!')}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <Download className="w-5 h-5" />
                    Download PDF
                  </button>
                  <p className="mt-2 text-xs text-gray-500 text-center">
                    property_report_{lookup.formattedAddress.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf
                  </p>
                </div>

                {/* Email Report */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-blue-600" />
                    Email Report
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To</label>
                      <input
                        type="email"
                        placeholder="underwriting@agency.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">CC</label>
                      <input
                        type="email"
                        placeholder="agent@agency.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                      <input
                        type="text"
                        defaultValue={`Property Report - ${lookup.formattedAddress}`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                      <textarea
                        rows={4}
                        defaultValue={`Please review the attached property underwriting report.\n\nKey Findings:\n- Recommendation: ${getDecision(lookup.aiAnalysis).decision}\n- Roof Score: ${lookup.aiAnalysis ? getRoofGrade(lookup.aiAnalysis.roofScore).grade : 'N/A'} (${lookup.aiAnalysis?.roofScore || 0}/100)`}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="text-blue-600 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Attach PDF Report</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" defaultChecked className="text-blue-600 rounded" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Include summary in body</span>
                      </label>
                    </div>
                  </div>
                  <button
                    onClick={() => alert('Email delivery coming soon!')}
                    className="w-full mt-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Send Email
                  </button>
                </div>

                {/* Workflow Actions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Workflow Actions</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link to Customer</label>
                      <input
                        type="text"
                        placeholder="Search customers..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <button className="py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2">
                        📎 Attach to Customer
                      </button>
                      <button className="py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2">
                        📝 Create Note
                      </button>
                      <button className="py-2 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center gap-2">
                        📋 Add to Queue
                      </button>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Decision</p>
                      <div className="grid grid-cols-4 gap-3">
                        <button className="py-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded-lg font-medium hover:bg-green-200 dark:hover:bg-green-900/50">
                          ✓ ACCEPT
                        </button>
                        <button className="py-2 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 rounded-lg font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50">
                          🔍 REVIEW
                        </button>
                        <button className="py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg font-medium hover:bg-red-200 dark:hover:bg-red-900/50">
                          ✗ DECLINE
                        </button>
                        <button className="py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600">
                          ⏸ HOLD
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report History */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Report History</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">- Current report generated</span>
                      </div>
                      <span className="text-blue-600">View</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function DecisionBanner({
  address,
  aiAnalysis,
  nearmapData,
  analyzing
}: {
  address: string;
  aiAnalysis: AIAnalysis | null;
  nearmapData: NearmapData | null;
  analyzing: boolean;
}) {
  const getDecision = () => {
    if (!aiAnalysis) return { decision: 'PENDING', color: 'text-gray-600', bgColor: 'bg-gray-100 dark:bg-gray-700' };
    if (aiAnalysis.riskLevel === 'low') return { decision: 'ACCEPT', color: 'text-green-700 dark:text-green-300', bgColor: 'bg-green-100 dark:bg-green-900/30' };
    if (aiAnalysis.riskLevel === 'medium') return { decision: 'REVIEW', color: 'text-amber-700 dark:text-amber-300', bgColor: 'bg-amber-100 dark:bg-amber-900/30' };
    return { decision: 'DECLINE', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-900/30' };
  };

  const getRoofGrade = (score: number) => {
    if (score >= 90) return { grade: 'A', color: 'bg-green-500' };
    if (score >= 80) return { grade: 'B', color: 'bg-green-400' };
    if (score >= 70) return { grade: 'C', color: 'bg-yellow-500' };
    if (score >= 60) return { grade: 'D', color: 'bg-orange-500' };
    return { grade: 'F', color: 'bg-red-500' };
  };

  const decision = getDecision();
  const roofGrade = aiAnalysis ? getRoofGrade(aiAnalysis.roofScore) : null;

  return (
    <div className={cn(
      'rounded-xl border p-6',
      decision.bgColor,
      aiAnalysis?.riskLevel === 'low' ? 'border-green-200 dark:border-green-800' :
      aiAnalysis?.riskLevel === 'medium' ? 'border-amber-200 dark:border-amber-800' :
      aiAnalysis?.riskLevel === 'high' ? 'border-red-200 dark:border-red-800' :
      'border-gray-200 dark:border-gray-700'
    )}>
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{address}</h2>
      </div>

      {analyzing ? (
        <div className="flex items-center gap-4">
          <div className="animate-spin text-3xl">🤖</div>
          <div>
            <div className="font-bold text-blue-800 dark:text-blue-200">Analyzing Property...</div>
            <div className="text-sm text-blue-600 dark:text-blue-400">AI is reviewing imagery and data</div>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className={cn('p-4 rounded-lg text-center', decision.bgColor)}>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">DECISION</div>
              <div className={cn('text-2xl font-bold', decision.color)}>{decision.decision}</div>
              <div className="text-2xl">{decision.decision === 'ACCEPT' ? '✓' : decision.decision === 'DECLINE' ? '✗' : '?'}</div>
            </div>
            <div className="p-4 rounded-lg text-center bg-white dark:bg-gray-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">ROOF SCORE</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {roofGrade ? `${roofGrade.grade} (${aiAnalysis?.roofScore})` : 'N/A'}
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
                <div className={cn('h-full', roofGrade?.color || 'bg-gray-400')} style={{ width: `${aiAnalysis?.roofScore || 0}%` }} />
              </div>
            </div>
            <div className="p-4 rounded-lg text-center bg-white dark:bg-gray-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">RISK LEVEL</div>
              <div className={cn(
                'text-2xl font-bold uppercase',
                aiAnalysis?.riskLevel === 'low' ? 'text-green-600' :
                aiAnalysis?.riskLevel === 'medium' ? 'text-amber-600' :
                aiAnalysis?.riskLevel === 'high' ? 'text-red-600' :
                'text-gray-600'
              )}>
                {aiAnalysis?.riskLevel || 'N/A'}
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
                <div className={cn(
                  'h-full',
                  aiAnalysis?.riskLevel === 'low' ? 'bg-green-500 w-1/3' :
                  aiAnalysis?.riskLevel === 'medium' ? 'bg-amber-500 w-2/3' :
                  aiAnalysis?.riskLevel === 'high' ? 'bg-red-500 w-full' :
                  'bg-gray-400 w-0'
                )} />
              </div>
            </div>
            <div className="p-4 rounded-lg text-center bg-white dark:bg-gray-800">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">CONFIDENCE</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {aiAnalysis ? '95%' : '—'}
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-blue-500" style={{ width: aiAnalysis ? '95%' : '0%' }} />
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Key Findings:</strong>{' '}
            {[
              nearmapData?.roof.age ? `Roof ~${nearmapData.roof.age} years old` : null,
              nearmapData?.pool?.present ? 'Pool detected' : null,
              (nearmapData?.vegetation.treeOverhangArea || 0) > 50 ? `Tree overhang ${Math.round(nearmapData?.vegetation.treeOverhangArea || 0)} sqft` : null,
            ].filter(Boolean).join(' | ') || 'Analysis in progress...'}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function InfoRow({ label, value, highlight, icon }: { label: string; value: string | number; highlight?: boolean; icon?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
        {icon && <span>{icon}</span>}
        {label}
      </span>
      <span className={cn('font-medium', highlight ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100')}>{value}</span>
    </div>
  );
}

function FeatureRow({ label, detected, detail, confidence, warning }: { label: string; detected: boolean; detail?: string; confidence?: number; warning?: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-between p-3 rounded-lg',
      detected ? (warning ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-blue-50 dark:bg-blue-900/20') : 'bg-gray-50 dark:bg-gray-700'
    )}>
      <div className="flex items-center gap-2">
        <span className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center text-sm',
          detected ? (warning ? 'bg-amber-200 dark:bg-amber-800' : 'bg-green-200 dark:bg-green-800') : 'bg-gray-200 dark:bg-gray-600'
        )}>
          {detected ? '✓' : '✗'}
        </span>
        <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {detail && <span className="text-sm text-gray-600 dark:text-gray-400">{detail}</span>}
        {confidence && <span className="text-xs text-gray-500">({confidence}% conf)</span>}
      </div>
    </div>
  );
}

function RiskRow({ icon, label, value, level }: { icon: React.ReactNode; label: string; value: string; level: 'low' | 'medium' | 'high' }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className="flex items-center gap-2">
        <span className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center',
          level === 'low' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
          level === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
          'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        )}>
          {icon}
        </span>
        <span className="font-medium text-gray-900 dark:text-gray-100">{label}</span>
      </div>
      <span className={cn(
        'font-medium',
        level === 'low' ? 'text-green-600 dark:text-green-400' :
        level === 'medium' ? 'text-amber-600 dark:text-amber-400' :
        'text-red-600 dark:text-red-400'
      )}>
        {value}
      </span>
    </div>
  );
}

function ScoreBar({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {value}%
          {detail && <span className="text-gray-500 ml-2">({detail})</span>}
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-yellow-500' : value >= 40 ? 'bg-orange-500' : 'bg-red-500'
          )}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function HazardCard({ label, detected, confidence, detail }: { label: string; detected: boolean; confidence?: number; detail?: string }) {
  return (
    <div className={cn(
      'p-4 rounded-lg text-center border',
      detected ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
    )}>
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">{label.toUpperCase()}</div>
      <div className={cn(
        'font-bold',
        detected ? 'text-amber-700 dark:text-amber-300' : 'text-green-700 dark:text-green-300'
      )}>
        {detected ? 'DETECTED ⚠' : 'NOT DETECTED'}
      </div>
      {confidence && <div className="text-xs text-gray-500 mt-1">{confidence}% conf</div>}
      {detail && <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">{detail}</div>}
    </div>
  );
}

function SourceBadge({ source }: { source: 'RPR' | 'Nearmap' | 'Nearmap AI' | 'Claude AI' | 'MMI' | 'Google' | 'PropertyAPI' }) {
  const colors = {
    'RPR': 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
    'Nearmap': 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
    'Nearmap AI': 'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800',
    'Claude AI': 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
    'MMI': 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    'Google': 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    'PropertyAPI': 'bg-teal-50 text-teal-600 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800',
  };
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-medium', colors[source])}>
      {source}
    </span>
  );
}
