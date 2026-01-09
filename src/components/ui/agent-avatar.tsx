"use client";

import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import { cn } from "@/lib/utils";

export interface AgentAvatarProps {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  showTooltip?: boolean;
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

const colorClasses = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-orange-100 text-orange-700",
];

function getInitials(
  name?: string | null,
  firstName?: string | null,
  lastName?: string | null
): string {
  if (firstName && lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  }
  return "?";
}

function getColorClass(name?: string | null): string {
  if (!name) return colorClasses[0];
  // Generate consistent color based on name
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colorClasses[hash % colorClasses.length];
}

export function AgentAvatar({
  name,
  firstName,
  lastName,
  avatarUrl,
  size = "md",
  className,
  showTooltip = false,
}: AgentAvatarProps) {
  const initials = getInitials(name, firstName, lastName);
  const displayName = name || [firstName, lastName].filter(Boolean).join(" ") || "Unknown";
  const colorClass = getColorClass(displayName);

  const avatar = (
    <Avatar className={cn(sizeClasses[size], className)}>
      {avatarUrl && (
        <AvatarImage src={avatarUrl} alt={displayName} />
      )}
      <AvatarFallback className={cn("font-medium", colorClass)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (showTooltip) {
    return (
      <div className="relative group">
        {avatar}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
          {displayName}
        </div>
      </div>
    );
  }

  return avatar;
}

// Convenience component for inline agent display with name
export function AgentBadge({
  name,
  firstName,
  lastName,
  avatarUrl,
  size = "sm",
  className,
  showRole,
  role,
}: AgentAvatarProps & { showRole?: boolean; role?: string }) {
  const displayName = name || [firstName, lastName].filter(Boolean).join(" ") || "Unknown";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <AgentAvatar
        name={name}
        firstName={firstName}
        lastName={lastName}
        avatarUrl={avatarUrl}
        size={size}
      />
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{displayName}</div>
        {showRole && role && (
          <div className="text-xs text-gray-500 truncate">{role}</div>
        )}
      </div>
    </div>
  );
}

export default AgentAvatar;
