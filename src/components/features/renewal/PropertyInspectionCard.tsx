'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Loader2, AlertTriangle, Home, Eye } from 'lucide-react';
import type { PropertyData } from '@/lib/nearmap';

interface PropertyInspectionCardProps {
  renewalId: string;
  lineOfBusiness: string | null;
}

export default function PropertyInspectionCard({ renewalId, lineOfBusiness }: PropertyInspectionCardProps) {
  const [data, setData] = useState<PropertyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Only fetch for home policies
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
        const json = await res.json();
        if (!res.ok || !json.success) {
          setError(json.error || 'Failed to load property data');
        } else {
          setData(json.propertyData);
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

  const conditionColors: Record<string, string> = {
    excellent: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    good: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    fair: 'text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    poor: 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    unknown: 'text-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-800',
  };

  const conditionClass = conditionColors[data.roofConditionSummary] || conditionColors.unknown;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
      >
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
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Aerial Image */}
          {data.tileUrl && (
            <div className="relative rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.tileUrl}
                alt="Aerial view of property"
                className="w-full h-48 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Roof Condition Summary */}
          <div className="flex items-center gap-3">
            <Home className="h-4 w-4 text-gray-400 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Roof Condition:</span>
                <span className={`text-sm font-medium px-2 py-0.5 rounded ${conditionClass}`}>
                  {data.roofConditionSummary.charAt(0).toUpperCase() + data.roofConditionSummary.slice(1)}
                </span>
              </div>
              {data.roofMaterial && data.roofMaterial !== 'unknown' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Material: {data.roofMaterial}
                </p>
              )}
            </div>
          </div>

          {/* Roof Shape Breakdown */}
          {Object.keys(data.roofShapeBreakdown).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {Object.entries(data.roofShapeBreakdown).map(([shape, ratio]) => (
                <span
                  key={shape}
                  className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                >
                  {shape}: {typeof ratio === 'number' ? `${(ratio * 100).toFixed(0)}%` : ratio}
                </span>
              ))}
            </div>
          )}

          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            {data.metrics.building_sqft != null && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Building</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {Number(data.metrics.building_sqft).toLocaleString()} sqft
                </span>
              </div>
            )}
            {data.metrics.solar_panel_count != null && Number(data.metrics.solar_panel_count) > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Solar Panels</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {data.metrics.solar_panel_count}
                </span>
              </div>
            )}
          </div>

          {/* Issue Flags */}
          {data.issueFlags.length > 0 && (
            <div className="space-y-1">
              {data.issueFlags.map((flag, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400"
                >
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>{flag}</span>
                </div>
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
      )}
    </div>
  );
}
