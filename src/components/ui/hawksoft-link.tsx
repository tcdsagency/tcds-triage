"use client";

import { cn } from "@/lib/utils";
import { Button } from "./button";

// =============================================================================
// HAWKSOFT LINK COMPONENTS
// =============================================================================
// Reusable components for linking to HawkSoft profiles using deep links.
// Use HawkSoftLink for inline text links, HawkSoftButton for button-style links.
//
// URL Pattern:
// - Client: hs://{clientCode}  (e.g., hs://97)
// =============================================================================

// HawkSoft brand color (blue)
const HS_BRAND_COLOR = "#0066CC";

// =============================================================================
// HAWKSOFT LOGO (SVG)
// =============================================================================

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function HawkSoftLogo({ size = "md", className }: LogoProps) {
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
      {/* HS Logo - stylized hawk/bird */}
      <rect width="24" height="24" rx="4" fill={HS_BRAND_COLOR} />
      <path
        d="M6 17V7h2v4h4V7h2v10h-2v-4H8v4H6z"
        fill="white"
      />
      <path
        d="M15 14c0-1.1.5-2.1 1.3-2.7-.3-.8-.3-1.6 0-2.3.2-.5.6-.8 1-.8.5 0 .9.3 1.1.8.3.7.3 1.5 0 2.3.8.6 1.3 1.6 1.3 2.7 0 1.7-1.3 3-3 3H16.5c-1 0-1.5-1.3-1.5-3z"
        fill="white"
      />
    </svg>
  );
}

// =============================================================================
// HAWKSOFT LINK (TEXT LINK STYLE)
// =============================================================================

interface HawkSoftLinkProps {
  clientCode: string | number | null | undefined;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function HawkSoftLink({
  clientCode,
  showText = false,
  size = "md",
  className,
}: HawkSoftLinkProps) {
  if (!clientCode) return null;

  const href = getHawkSoftUrl(clientCode);

  const textSizeMap = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-[#0066CC] hover:text-[#004C99] transition-colors",
        textSizeMap[size],
        className
      )}
      title="Open in HawkSoft"
    >
      <HawkSoftLogo size={size} />
      {showText && <span>Open in HawkSoft</span>}
    </a>
  );
}

// =============================================================================
// HAWKSOFT BUTTON (BUTTON STYLE)
// =============================================================================

interface HawkSoftButtonProps {
  clientCode: string | number | null | undefined;
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  showText?: boolean;
}

export function HawkSoftButton({
  clientCode,
  variant = "outline",
  size = "md",
  className,
  showText = true,
}: HawkSoftButtonProps) {
  if (!clientCode) return null;

  const href = getHawkSoftUrl(clientCode);

  const sizeMap = {
    sm: "sm" as const,
    md: "default" as const,
    lg: "lg" as const,
  };

  const variantClasses = {
    default: "bg-[#0066CC] text-white hover:bg-[#004C99] border-[#0066CC]",
    outline: "border-[#0066CC] text-[#0066CC] hover:bg-[#0066CC]/5",
    ghost: "text-[#0066CC] hover:bg-[#0066CC]/10",
  };

  return (
    <a
      href={href}
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
        <HawkSoftLogo size={size} />
        {showText && <span>Open in HawkSoft</span>}
      </Button>
    </a>
  );
}

// =============================================================================
// URL HELPERS
// =============================================================================

/**
 * Build HawkSoft deep link URL
 * Format: hs://{clientCode}
 */
export function getHawkSoftUrl(clientCode: string | number): string {
  return `hs://${clientCode}`;
}
