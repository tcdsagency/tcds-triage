"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  Wind,
  Droplets,
  Flame,
  Activity,
  CloudHail,
  Home,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Info,
} from "lucide-react";

interface HazardScore {
  category: string;
  score: number;
  level: "low" | "moderate" | "high" | "severe";
  description: string;
  factors: string[];
}

interface RiskScoreData {
  overall: number;
  level: "low" | "moderate" | "high" | "severe";
  hazards: HazardScore[];
  recommendations: string[];
  lastUpdated: string;
}

interface HazardRiskCardProps {
  address?: string;
  propertyId?: string;
  lat?: number;
  lng?: number;
  compact?: boolean;
}

const HAZARD_ICONS: Record<string, any> = {
  Wind: Wind,
  Hail: CloudHail,
  Flood: Droplets,
  Wildfire: Flame,
  Earthquake: Activity,
  "Property Condition": Home,
};

const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  low: { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
  moderate: { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-200" },
  high: { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  severe: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
};

export function HazardRiskCard({
  address,
  propertyId,
  lat,
  lng,
  compact = false,
}: HazardRiskCardProps) {
  const [data, setData] = useState<RiskScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(!compact);

  const fetchRiskScore = useCallback(async () => {
    if (!address && !propertyId && !(lat && lng)) return;

    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (address) params.set("address", address);
      if (propertyId) params.set("propertyId", propertyId);
      if (lat) params.set("lat", lat.toString());
      if (lng) params.set("lng", lng.toString());

      const response = await fetch(`/api/hazard-risk?${params.toString()}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load risk data");
      }

      setData(result.riskScore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [address, propertyId, lat, lng]);

  useEffect(() => {
    fetchRiskScore();
  }, [fetchRiskScore]);

  const getLevelLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  const getOverallColor = (level: string) => {
    return LEVEL_COLORS[level] || LEVEL_COLORS.moderate;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          <span className="ml-2 text-gray-500">Calculating risk score...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={fetchRiskScore}
            className="ml-auto p-2 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="text-center text-gray-500 py-4">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No risk data available</p>
          <p className="text-sm mt-1">Provide an address to calculate risk score</p>
        </div>
      </div>
    );
  }

  const colors = getOverallColor(data.level);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div
        className={`p-4 ${colors.bg} border-b ${colors.border} cursor-pointer`}
        onClick={() => compact && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-full bg-white border-2 ${colors.border} flex items-center justify-center`}
            >
              <span className={`text-xl font-bold ${colors.text}`}>
                {data.overall}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Hazard Risk Score</h3>
              <p className={`text-sm ${colors.text}`}>
                {getLevelLabel(data.level)} Risk
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                fetchRiskScore();
              }}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
            {compact && (
              expanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500" />
              )
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {(!compact || expanded) && (
        <div className="p-4 space-y-4">
          {/* Risk Gauge */}
          <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 via-yellow-500 via-orange-500 to-red-500"
              style={{ width: "100%" }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-5 bg-white rounded border-2 border-gray-800 shadow-lg transition-all"
              style={{ left: `calc(${data.overall}% - 6px)` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
            <span>Severe</span>
          </div>

          {/* Individual Hazards */}
          <div className="space-y-2 mt-4">
            <h4 className="text-sm font-medium text-gray-400 mb-2">
              Risk Breakdown
            </h4>
            {data.hazards.map((hazard) => {
              const Icon = HAZARD_ICONS[hazard.category] || AlertTriangle;
              const hColors = LEVEL_COLORS[hazard.level];

              return (
                <div
                  key={hazard.category}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-800/50 transition-colors group"
                >
                  <div className={`p-1.5 rounded ${hColors.bg}`}>
                    <Icon className={`w-4 h-4 ${hColors.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">
                        {hazard.category}
                      </span>
                      <span className={`text-sm font-medium ${hColors.text}`}>
                        {hazard.score}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full mt-1 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          hazard.level === "low"
                            ? "bg-green-500"
                            : hazard.level === "moderate"
                            ? "bg-yellow-500"
                            : hazard.level === "high"
                            ? "bg-orange-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${hazard.score}%` }}
                      />
                    </div>
                  </div>
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Info className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendations */}
          {data.recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <h4 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Recommendations
              </h4>
              <ul className="space-y-1.5">
                {data.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-gray-300 flex items-start gap-2"
                  >
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-xs text-gray-500 text-right mt-2">
            Updated: {new Date(data.lastUpdated).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
