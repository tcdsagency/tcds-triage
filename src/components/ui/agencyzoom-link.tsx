"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";

// =============================================================================
// AGENCYZOOM LINK COMPONENTS
// =============================================================================
// Reusable components for linking to AgencyZoom profiles and resources.
// Use AgencyZoomLink for inline text links, AgencyZoomButton for button-style links.
//
// URL Patterns:
// - Customer: https://app.agencyzoom.com/customer/index?id={id}
// - Lead: https://app.agencyzoom.com/lead/index?id={id}
// - Contact (generic): https://app.agencyzoom.com/contacts/{id}
// - Service Pipeline: https://app.agencyzoom.com/pipeline/service-pipeline
// =============================================================================

// AgencyZoom brand color
const AZ_BRAND_COLOR = "#192C68";

// =============================================================================
// AGENCYZOOM LOGO (SVG)
// =============================================================================

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

function AgencyZoomLogo({ size = "md", className }: LogoProps) {
  const sizeMap = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn(sizeMap[size], className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* AZ Logo - stylized letters */}
      <rect width="24" height="24" rx="4" fill={AZ_BRAND_COLOR} />
      <path
        d="M5 17L9 7h2l4 10h-2l-1-3H8l-1 3H5zm3.5-5h3l-1.5-4.5L8.5 12z"
        fill="white"
      />
      <path
        d="M14 17V15l4-6h-3.5V7H20v2l-4 6h4v2h-6z"
        fill="white"
      />
    </svg>
  );
}

// =============================================================================
// AGENCYZOOM LINK (TEXT LINK STYLE)
// =============================================================================

interface AgencyZoomLinkProps {
  href: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function AgencyZoomLink({
  href,
  showText = true,
  size = "md",
  className,
}: AgencyZoomLinkProps) {
  const textSizeMap = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 text-[#192C68] hover:text-[#0f1d45] transition-colors",
        textSizeMap[size],
        className
      )}
      title="Open in AgencyZoom"
    >
      <AgencyZoomLogo size={size} />
      {showText && <span>Open in AgencyZoom</span>}
    </a>
  );
}

// =============================================================================
// AGENCYZOOM BUTTON (BUTTON STYLE)
// =============================================================================

interface AgencyZoomButtonProps {
  href: string;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export function AgencyZoomButton({
  href,
  variant = "outline",
  size = "md",
  className,
  showText = true,
}: AgencyZoomButtonProps) {
  const sizeMap = {
    sm: "sm" as const,
    md: "default" as const,
    lg: "lg" as const,
  };

  const variantClasses = {
    default: "bg-[#192C68] text-white hover:bg-[#0f1d45] border-[#192C68]",
    outline: "border-[#192C68] text-[#192C68] hover:bg-[#192C68]/5",
    ghost: "text-[#192C68] hover:bg-[#192C68]/10",
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block"
    >
      <Button
        variant={variant === "default" ? "default" : variant}
        size={sizeMap[size]}
        className={cn(
          variantClasses[variant],
          "gap-2",
          className
        )}
        asChild={false}
        type="button"
      >
        <AgencyZoomLogo size={size} />
        {showText && <span>Open in AgencyZoom</span>}
      </Button>
    </a>
  );
}

// =============================================================================
// URL HELPERS
// =============================================================================

/**
 * Build AgencyZoom URL based on contact type
 */
export function getAgencyZoomUrl(
  contactId: string,
  contactType: "customer" | "lead" | "contact" = "customer"
): string {
  const baseUrl = "https://app.agencyzoom.com";

  switch (contactType) {
    case "customer":
      return `${baseUrl}/customer/index?id=${contactId}`;
    case "lead":
      return `${baseUrl}/lead/index?id=${contactId}`;
    case "contact":
      return `${baseUrl}/contacts/${contactId}`;
    default:
      return `${baseUrl}/contacts/${contactId}`;
  }
}

/**
 * Service Pipeline URL
 */
export const AGENCYZOOM_SERVICE_PIPELINE_URL =
  "https://app.agencyzoom.com/pipeline/service-pipeline";

// =============================================================================
// EXPORTS
// =============================================================================

export { AgencyZoomLogo };
