'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink, Loader2, AlertTriangle, Eye, Home, Maximize2, X, Map } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PropertyData, NearmapFeatures, InsuranceRiskScore } from '@/lib/nearmap';

const NearmapMap = dynamic(() => import('@/components/features/NearmapMap'), {
  ssr: false,
  loading: () => (
    <div className="aspect-square min-h-[400px] flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-md">
      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
    </div>
  ),
});

interface PropertyViewerCardProps {
  renewalId: string;
  lineOfBusiness: string | null;
  address?: { street?: string; city?: string; state?: string; zip?: string };
}

interface PropertyDataResponse {
  success: boolean;
  error?: string;
  propertyData?: PropertyData;
  features?: NearmapFeatures | null;
  riskScore?: InsuranceRiskScore;
}

const GRADE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', ring: 'ring-green-400' },
  B: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', ring: 'ring-emerald-400' },
  C: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', ring: 'ring-yellow-400' },
  D: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400', ring: 'ring-orange-400' },
  F: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', ring: 'ring-red-400' },
};

const CONDITION_COLORS: Record<string, string> = {
  excellent: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  good: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
  fair: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  poor: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  unknown: 'text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-800',
};

type ViewerTab = 'aerial' | 'streetview' | 'satellite';

export default function PropertyViewerCard({ renewalId, lineOfBusiness, address }: PropertyViewerCardProps) {
  const [data, setData] = useState<PropertyData | null>(null);
  const [features, setFeatures] = useState<NearmapFeatures | null>(null);
  const [riskScore, setRiskScore] = useState<InsuranceRiskScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerTab, setViewerTab] = useState<ViewerTab>('aerial');
  const [fullscreen, setFullscreen] = useState<'aerial' | 'street' | null>(null);

  // Overlay toggles
  const [overlayToggles, setOverlayToggles] = useState({
    roof: true,
    treeOverhang: true,
    pool: true,
    solar: true,
    building: false,
  });

  const isHome = lineOfBusiness?.toLowerCase().includes('home') ||
    lineOfBusiness?.toLowerCase().includes('dwelling') ||
    lineOfBusiness?.toLowerCase().includes('ho3') ||
    lineOfBusiness?.toLowerCase().includes('ho5') ||
    lineOfBusiness?.toLowerCase().includes('dp3');

  useEffect(() => {
    if (!isHome || !renewalId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/renewals/${renewalId}/property-data`)
      .then(async (res) => {
        if (cancelled) return;
        const json: PropertyDataResponse = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || 'Failed to load property data');
        } else {
          setData(json.propertyData || null);
          setFeatures(json.features || null);
          setRiskScore(json.riskScore || null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Network error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [renewalId, isHome]);

  // Escape key closes fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  const toggleOverlay = useCallback((key: keyof typeof overlayToggles) => {
    setOverlayToggles(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  if (!isHome) return null;

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading aerial property view...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Property inspection unavailable: {error}</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const gradeColors = riskScore ? GRADE_COLORS[riskScore.grade] || GRADE_COLORS.C : null;
  const conditionClass = CONDITION_COLORS[data.roofConditionSummary] || CONDITION_COLORS.unknown;

  const buildingSqft = data.metrics.building_sqft != null ? Number(data.metrics.building_sqft) : null;
  const solarPanelCount = data.metrics.solar_panel_count != null ? Number(data.metrics.solar_panel_count) : 0;
  const treeOverhangArea = features?.vegetation?.treeOverhangArea ?? 0;
  const stainingPct = (() => {
    const v = data.metrics['roof_cond_staining_ratio'] ?? data.metrics['roof_condition_staining_ratio'];
    return typeof v === 'number' ? v : null;
  })();

  // Street view
  const fullAddress = address ? [address.street, address.city, address.state, address.zip].filter(Boolean).join(' ') : '';
  const encodedAddress = encodeURIComponent(fullAddress);
  const commaAddress = address ? [address.street, address.city, address.state, address.zip].filter(Boolean).join(', ') : '';
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const streetViewEmbedUrl = apiKey && data?.lat && data?.lon
    ? `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${data.lat},${data.lon}&heading=0&pitch=0&fov=90`
    : null;
  const mapEmbedUrl = commaAddress && apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(commaAddress)}&zoom=18&maptype=satellite`
    : null;

  // Filter overlays based on toggles
  const filteredOverlays = features?.overlays ? {
    roof: overlayToggles.roof ? features.overlays.roof : [],
    treeOverhang: overlayToggles.treeOverhang ? features.overlays.treeOverhang : [],
    pool: overlayToggles.pool ? features.overlays.pool : [],
    solar: overlayToggles.solar ? features.overlays.solar : [],
    building: overlayToggles.building ? features.overlays.building : [],
  } : undefined;

  return (
    <>
      {/* Fullscreen overlay */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
          <button
            onClick={() => setFullscreen(null)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="w-full h-full p-4">
            {fullscreen === 'aerial' ? (
              <NearmapMap
                lat={data.lat}
                lng={data.lon}
                zoom={19}
                surveyDate={data.surveyDate || undefined}
                overlays={filteredOverlays}
              />
            ) : streetViewEmbedUrl ? (
              <iframe
                src={streetViewEmbedUrl}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <p>Street View unavailable</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Aerial Property Inspection
            </span>
            {data.surveyDate && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {data.surveyDate}
              </span>
            )}
          </div>
          {riskScore && gradeColors && (
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ring-1 ${gradeColors.bg} ${gradeColors.text} ${gradeColors.ring}`}>
              <span className="text-xs font-bold">{riskScore.score}</span>
              <span className="text-[10px] font-semibold">{riskScore.grade}</span>
            </div>
          )}
        </div>

        {/* Side-by-side viewer grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 px-4">
          {/* Aerial viewer */}
          <div className="relative rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 aspect-square min-h-[400px]">
            <NearmapMap
              lat={data.lat}
              lng={data.lon}
              zoom={19}
              surveyDate={data.surveyDate || undefined}
              overlays={filteredOverlays}
            />
            <button
              onClick={() => setFullscreen('aerial')}
              className="absolute bottom-2 right-2 p-1.5 rounded bg-black/50 hover:bg-black/70 text-white transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Street View */}
          <div className="relative rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 aspect-square min-h-[400px]">
            {viewerTab === 'satellite' && mapEmbedUrl ? (
              <iframe
                src={mapEmbedUrl}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : streetViewEmbedUrl ? (
              <iframe
                src={streetViewEmbedUrl}
                className="w-full h-full border-0"
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                  <Map className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <p className="text-xs">Street View unavailable</p>
                </div>
              </div>
            )}
            {/* Street/Satellite toggle */}
            <div className="absolute top-2 right-2 flex rounded overflow-hidden border border-gray-300/80 dark:border-gray-600/80 shadow-sm">
              <button
                onClick={() => setViewerTab('streetview')}
                className={cn(
                  'px-2 py-1 text-[10px] font-medium transition-colors',
                  viewerTab !== 'satellite'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/90 dark:bg-gray-700/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'
                )}
              >
                Street
              </button>
              <button
                onClick={() => setViewerTab('satellite')}
                className={cn(
                  'px-2 py-1 text-[10px] font-medium transition-colors',
                  viewerTab === 'satellite'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/90 dark:bg-gray-700/90 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-600'
                )}
              >
                Satellite
              </button>
            </div>
            <button
              onClick={() => setFullscreen('street')}
              className="absolute bottom-2 right-2 p-1.5 rounded bg-black/50 hover:bg-black/70 text-white transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* AI Overlay toggles */}
        {features?.overlays && (
          <div className="px-4 pt-3 flex flex-wrap gap-1.5">
            {([
              ['roof', 'Roof'],
              ['treeOverhang', 'Tree'],
              ['pool', 'Pool'],
              ['solar', 'Solar'],
              ['building', 'Building'],
            ] as [keyof typeof overlayToggles, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => toggleOverlay(key)}
                className={cn(
                  'text-[11px] px-2 py-1 rounded border transition-colors',
                  overlayToggles[key]
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Metrics row */}
        <div className="px-4 py-3 space-y-3">
          {/* Roof condition + key metrics in compact row */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <span className="text-gray-500">Roof:</span>
              <span className={cn('font-medium px-1.5 py-0.5 rounded text-xs', conditionClass)}>
                {data.roofConditionSummary.charAt(0).toUpperCase() + data.roofConditionSummary.slice(1)}
              </span>
            </div>
            {data.roofMaterial && data.roofMaterial !== 'unknown' && (
              <span className="text-gray-500 text-xs">Material: {data.roofMaterial}</span>
            )}
            {stainingPct != null && stainingPct > 0 && (
              <span className="text-gray-600 dark:text-gray-300 text-xs">Staining: {(stainingPct * 100).toFixed(0)}%</span>
            )}
            {treeOverhangArea > 0 && (
              <span className="text-gray-600 dark:text-gray-300 text-xs">Tree: {Math.round(treeOverhangArea)} sqft</span>
            )}
            {buildingSqft != null && (
              <span className="text-gray-600 dark:text-gray-300 text-xs">Building: {buildingSqft.toLocaleString()} sqft</span>
            )}
            {solarPanelCount > 0 && (
              <span className="text-gray-600 dark:text-gray-300 text-xs">Solar: {solarPanelCount}</span>
            )}
          </div>

          {/* Issue Flags */}
          {data.issueFlags.length > 0 && (
            <div className="space-y-1">
              {data.issueFlags.map((flag, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          )}

          {/* Risk Score Factors */}
          {riskScore && riskScore.factors.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {riskScore.factors.map((f, i) => (
                <span
                  key={i}
                  className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                >
                  {f.name}: +{f.points}
                </span>
              ))}
            </div>
          )}

          {/* View in Nearmap link */}
          {data.nearmapLink && (
            <a
              href={data.nearmapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              View in Nearmap
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </>
  );
}
