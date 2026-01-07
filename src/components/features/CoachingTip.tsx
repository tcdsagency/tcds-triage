"use client";

import { cn } from "@/lib/utils";

export interface CoachingSuggestion {
  type: "tip" | "warning" | "opportunity" | "compliance";
  label: string;
  message: string;
}

interface CoachingTipProps {
  suggestion: CoachingSuggestion;
  onDismiss?: () => void;
  className?: string;
}

// Styling for each coaching type
const COACHING_STYLES = {
  tip: {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
    emoji: "💡"
  },
  warning: {
    bg: "bg-orange-50 border-orange-200",
    text: "text-orange-800",
    emoji: "⚠️"
  },
  opportunity: {
    bg: "bg-green-50 border-green-200",
    text: "text-green-800",
    emoji: "💰"
  },
  compliance: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-800",
    emoji: "🛡️"
  }
};

/**
 * AI Coaching Tip Display
 * Shows contextual suggestions with color-coded types
 */
export default function CoachingTip({ suggestion, onDismiss, className }: CoachingTipProps) {
  const style = COACHING_STYLES[suggestion.type];

  return (
    <div className={cn("p-4 border-t border-gray-200", className)}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">
          🤖 AI Coaching
        </h4>
        {onDismiss && (
          <button
            className="h-6 w-6 flex items-center justify-center rounded hover:bg-gray-100"
            onClick={onDismiss}
          >
            <span className="text-gray-500">×</span>
          </button>
        )}
      </div>

      <div className={cn(
        "rounded-lg border-2 p-3 transition-all duration-200",
        style.bg,
        style.text
      )}>
        <div className="flex items-start gap-2">
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Label with emoji */}
            <div className="font-semibold text-sm mb-1 flex items-center gap-1.5">
              <span>{style.emoji}</span>
              <span>{suggestion.label}</span>
            </div>

            {/* Message */}
            <div className="text-sm leading-relaxed">
              {suggestion.message}
            </div>
          </div>
        </div>
      </div>

      {/* Auto-dismiss indicator */}
      <div className="mt-2 text-xs text-gray-500 text-center">
        This tip will auto-dismiss in 30 seconds
      </div>
    </div>
  );
}

/**
 * Compact version for minimized state
 */
export function CoachingTipCompact({ suggestion }: { suggestion: CoachingSuggestion }) {
  const style = COACHING_STYLES[suggestion.type];

  return (
    <div className={cn(
      "rounded-md border px-2 py-1 text-xs flex items-center gap-1.5",
      style.bg,
      style.text
    )}>
      <span>{style.emoji}</span>
      <span className="font-medium truncate">{suggestion.label}</span>
    </div>
  );
}
