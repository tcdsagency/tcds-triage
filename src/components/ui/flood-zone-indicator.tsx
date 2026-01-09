// Flood Zone Indicator Component
// Displays FEMA flood zone with risk-based color coding

import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Droplets, Shield, HelpCircle } from "lucide-react";

export type FloodRisk = "High" | "Moderate" | "Low" | "Minimal" | "Unknown";

export interface FloodZoneIndicatorProps {
  zone?: string | null;
  risk?: FloodRisk | null;
  inSFHA?: boolean;
  showDescription?: boolean;
  showInsuranceWarning?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const riskConfig: Record<FloodRisk, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof Droplets;
  label: string;
}> = {
  High: {
    color: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: AlertTriangle,
    label: "High Risk",
  },
  Moderate: {
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: Droplets,
    label: "Moderate Risk",
  },
  Low: {
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: Droplets,
    label: "Low Risk",
  },
  Minimal: {
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: Shield,
    label: "Minimal Risk",
  },
  Unknown: {
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    icon: HelpCircle,
    label: "Unknown",
  },
};

const sizeConfig = {
  sm: {
    container: "px-2 py-1 text-xs",
    icon: "h-3 w-3",
    zone: "text-xs font-medium",
    description: "text-[10px]",
  },
  md: {
    container: "px-2.5 py-1.5 text-sm",
    icon: "h-4 w-4",
    zone: "text-sm font-semibold",
    description: "text-xs",
  },
  lg: {
    container: "px-3 py-2 text-base",
    icon: "h-5 w-5",
    zone: "text-base font-semibold",
    description: "text-sm",
  },
};

const zoneDescriptions: Record<string, string> = {
  A: "High risk - 1% annual chance of flooding",
  AE: "High risk - Base flood elevations determined",
  AH: "High risk - Shallow flooding (1-3 feet)",
  AO: "High risk - Sheet flow flooding",
  AR: "High risk - Temporary flood protection removed",
  A99: "High risk - Federal flood protection under construction",
  V: "High risk - Coastal flooding with wave action",
  VE: "High risk - Coastal with base flood elevations",
  B: "Moderate risk - 0.2% annual chance",
  X500: "Moderate risk - 500-year floodplain",
  C: "Minimal risk - Outside 500-year floodplain",
  X: "Minimal risk - Outside 500-year floodplain",
  D: "Undetermined - No flood hazard analysis performed",
};

export function FloodZoneIndicator({
  zone,
  risk = "Unknown",
  inSFHA = false,
  showDescription = false,
  showInsuranceWarning = true,
  size = "md",
  className,
}: FloodZoneIndicatorProps) {
  const effectiveRisk = risk || "Unknown";
  const config = riskConfig[effectiveRisk];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  const normalizedZone = zone?.toUpperCase().trim() || "Unknown";
  const description = zoneDescriptions[normalizedZone] || `Flood Zone ${zone}`;

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border",
          config.bgColor,
          config.borderColor,
          sizes.container
        )}
      >
        <Icon className={cn(sizes.icon, config.color)} />
        <span className={cn(sizes.zone, config.color)}>
          Zone {normalizedZone}
        </span>
        <span className={cn("text-gray-500", sizes.description)}>
          ({config.label})
        </span>
      </div>

      {showDescription && (
        <p className={cn("text-gray-600", sizes.description)}>{description}</p>
      )}

      {showInsuranceWarning && inSFHA && (
        <div className="flex items-center gap-1.5 text-red-600 mt-0.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">
            Flood insurance required for mortgaged properties
          </span>
        </div>
      )}
    </div>
  );
}

// Compact badge version for inline use
export function FloodZoneBadge({
  zone,
  risk = "Unknown",
  className,
}: Pick<FloodZoneIndicatorProps, "zone" | "risk" | "className">) {
  const effectiveRisk = risk || "Unknown";
  const config = riskConfig[effectiveRisk];
  const normalizedZone = zone?.toUpperCase().trim() || "?";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium",
        config.bgColor,
        config.color,
        className
      )}
    >
      <Droplets className="h-3 w-3" />
      {normalizedZone}
    </span>
  );
}

// Card component for detailed flood zone display
export interface FloodZoneCardProps {
  zone?: string | null;
  risk?: FloodRisk | null;
  inSFHA?: boolean;
  panelNumber?: string | null;
  effectiveDate?: string | null;
  communityNumber?: string | null;
  source?: "lightbox" | "rpr" | "manual" | null;
  insuranceRecommendation?: {
    recommended: boolean;
    required: boolean;
    reason: string;
  } | null;
  className?: string;
}

export function FloodZoneCard({
  zone,
  risk = "Unknown",
  inSFHA = false,
  panelNumber,
  effectiveDate,
  communityNumber,
  source,
  insuranceRecommendation,
  className,
}: FloodZoneCardProps) {
  const effectiveRisk = risk || "Unknown";
  const config = riskConfig[effectiveRisk];
  const Icon = config.icon;
  const normalizedZone = zone?.toUpperCase().trim() || "Unknown";
  const description = zoneDescriptions[normalizedZone] || `Flood Zone ${zone}`;

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        config.borderColor,
        config.bgColor,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("p-2 rounded-full", config.bgColor)}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>
          <div>
            <h4 className={cn("font-semibold", config.color)}>
              Flood Zone {normalizedZone}
            </h4>
            <p className="text-sm text-gray-600">{config.label}</p>
          </div>
        </div>
        {inSFHA && (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
            SFHA
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-gray-700">{description}</p>

      {(panelNumber || effectiveDate || communityNumber) && (
        <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-2 text-xs">
          {panelNumber && (
            <div>
              <span className="text-gray-500">Panel:</span>{" "}
              <span className="font-medium">{panelNumber}</span>
            </div>
          )}
          {effectiveDate && (
            <div>
              <span className="text-gray-500">Effective:</span>{" "}
              <span className="font-medium">{effectiveDate}</span>
            </div>
          )}
          {communityNumber && (
            <div>
              <span className="text-gray-500">Community:</span>{" "}
              <span className="font-medium">{communityNumber}</span>
            </div>
          )}
          {source && (
            <div>
              <span className="text-gray-500">Source:</span>{" "}
              <span className="font-medium capitalize">{source}</span>
            </div>
          )}
        </div>
      )}

      {insuranceRecommendation && (
        <div
          className={cn(
            "mt-3 pt-3 border-t",
            insuranceRecommendation.required
              ? "border-red-200"
              : "border-gray-200"
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            {insuranceRecommendation.required ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : insuranceRecommendation.recommended ? (
              <Droplets className="h-4 w-4 text-amber-600" />
            ) : (
              <Shield className="h-4 w-4 text-green-600" />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                insuranceRecommendation.required
                  ? "text-red-700"
                  : insuranceRecommendation.recommended
                  ? "text-amber-700"
                  : "text-green-700"
              )}
            >
              {insuranceRecommendation.required
                ? "Flood Insurance Required"
                : insuranceRecommendation.recommended
                ? "Flood Insurance Recommended"
                : "Flood Insurance Optional"}
            </span>
          </div>
          <p className="text-xs text-gray-600">
            {insuranceRecommendation.reason}
          </p>
        </div>
      )}
    </div>
  );
}
