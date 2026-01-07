"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Playbook,
  AgentSuggestion,
  LiveAssistCardProps,
  TelemetryFeedback,
} from "@/lib/agent-assist/types";

// Styling for suggestion types
const SUGGESTION_STYLES = {
  knowledge: {
    bg: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-200",
    icon: "📚",
  },
  compliance: {
    bg: "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800",
    text: "text-red-800 dark:text-red-200",
    icon: "🛡️",
  },
  upsell: {
    bg: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800",
    text: "text-green-800 dark:text-green-200",
    icon: "💰",
  },
  next_action: {
    bg: "bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800",
    text: "text-purple-800 dark:text-purple-200",
    icon: "➡️",
  },
};

// Domain colors for playbook header
const DOMAIN_COLORS = {
  billing_payments: "bg-amber-500",
  new_business: "bg-green-500",
  renewals: "bg-blue-500",
  claims: "bg-red-500",
  policy_changes: "bg-purple-500",
  escalations: "bg-orange-500",
};

/**
 * Live Assist Card - Displays playbook and AI suggestions during calls
 */
export default function LiveAssistCard({
  playbook,
  suggestions,
  isLoading,
  onUseSuggestion,
  onDismissSuggestion,
  onPlaybookFeedback,
}: LiveAssistCardProps) {
  const [activeScriptTab, setActiveScriptTab] = useState<"opening" | "discovery" | "resolution">("opening");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["scripts"]));

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">
          Analyzing conversation...
        </div>
      </div>
    );
  }

  if (!playbook && suggestions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <div className="text-2xl mb-2">🎯</div>
        <div className="text-sm">
          Live Assist is listening. Suggestions will appear based on the conversation.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Playbook Section */}
      {playbook && (
        <div className="border-b border-gray-200 dark:border-gray-700">
          {/* Playbook Header */}
          <div
            className={cn(
              "px-4 py-2 flex items-center gap-2",
              DOMAIN_COLORS[playbook.domain as keyof typeof DOMAIN_COLORS] || "bg-gray-500"
            )}
          >
            <span className="text-white text-lg">📋</span>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm truncate">
                {playbook.name}
              </div>
              <div className="text-white/80 text-xs truncate">
                {playbook.description}
              </div>
            </div>
          </div>

          {/* Collapsible Sections */}
          <div className="p-3 space-y-2">
            {/* Scripts Section */}
            <CollapsibleSection
              title="Say This"
              icon="💬"
              isExpanded={expandedSections.has("scripts")}
              onToggle={() => toggleSection("scripts")}
            >
              {/* Script Tabs */}
              <div className="flex gap-1 mb-2">
                {(["opening", "discovery", "resolution"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveScriptTab(tab)}
                    className={cn(
                      "px-2 py-1 text-xs rounded font-medium transition-colors",
                      activeScriptTab === tab
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    )}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Script Content */}
              <div className="space-y-1">
                {playbook.scripts[activeScriptTab].map((script, i) => (
                  <div
                    key={i}
                    className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-sm text-gray-800 dark:text-gray-200 border-l-2 border-blue-400"
                  >
                    &ldquo;{script}&rdquo;
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Do's Section */}
            <CollapsibleSection
              title="Do"
              icon="✅"
              isExpanded={expandedSections.has("do")}
              onToggle={() => toggleSection("do")}
              variant="success"
            >
              <ul className="space-y-1">
                {playbook.doList.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
                  >
                    <span className="text-green-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>

            {/* Don'ts Section */}
            <CollapsibleSection
              title="Don't"
              icon="❌"
              isExpanded={expandedSections.has("dont")}
              onToggle={() => toggleSection("dont")}
              variant="danger"
            >
              <ul className="space-y-1">
                {playbook.dontList.map((item, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
                  >
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>

            {/* Escalation Triggers */}
            {playbook.escalateIf.length > 0 && (
              <CollapsibleSection
                title="Escalate If"
                icon="🚨"
                isExpanded={expandedSections.has("escalate")}
                onToggle={() => toggleSection("escalate")}
                variant="warning"
              >
                <ul className="space-y-1">
                  {playbook.escalateIf.map((item, i) => (
                    <li
                      key={i}
                      className="text-sm text-orange-700 dark:text-orange-300 flex items-start gap-2"
                    >
                      <span className="text-orange-500 mt-0.5">⚠</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* Feedback */}
            {onPlaybookFeedback && (
              <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Was this helpful?
                </span>
                <button
                  onClick={() => onPlaybookFeedback(playbook.id, "helpful")}
                  className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
                >
                  👍 Yes
                </button>
                <button
                  onClick={() => onPlaybookFeedback(playbook.id, "not_helpful")}
                  className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50"
                >
                  👎 No
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Suggestions Section */}
      {suggestions.length > 0 && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🤖</span>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              AI Suggestions
            </h3>
          </div>

          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onUse={onUseSuggestion}
                onDismiss={onDismissSuggestion}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COLLAPSIBLE SECTION COMPONENT
// =============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  isExpanded: boolean;
  onToggle: () => void;
  variant?: "default" | "success" | "danger" | "warning";
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  variant = "default",
  children,
}: CollapsibleSectionProps) {
  const variants = {
    default: "bg-gray-50 dark:bg-gray-800",
    success: "bg-green-50 dark:bg-green-900/20",
    danger: "bg-red-50 dark:bg-red-900/20",
    warning: "bg-orange-50 dark:bg-orange-900/20",
  };

  return (
    <div className={cn("rounded-lg overflow-hidden", variants[variant])}>
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <span>{icon}</span>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 text-left">
          {title}
        </span>
        <span
          className={cn(
            "text-gray-400 transition-transform",
            isExpanded && "rotate-180"
          )}
        >
          ▼
        </span>
      </button>
      {isExpanded && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// =============================================================================
// SUGGESTION CARD COMPONENT
// =============================================================================

interface SuggestionCardProps {
  suggestion: AgentSuggestion;
  onUse?: (suggestion: AgentSuggestion) => void;
  onDismiss?: (suggestion: AgentSuggestion) => void;
}

function SuggestionCard({ suggestion, onUse, onDismiss }: SuggestionCardProps) {
  const style = SUGGESTION_STYLES[suggestion.type];

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-all duration-200",
        style.bg,
        style.text
      )}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm mb-1">{suggestion.title}</div>
          <div className="text-sm leading-relaxed opacity-90">
            {suggestion.content}
          </div>
          {suggestion.source && (
            <div className="text-xs opacity-60 mt-1">Source: {suggestion.source}</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-current/10">
        {onDismiss && (
          <button
            onClick={() => onDismiss(suggestion)}
            className="text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10"
          >
            Dismiss
          </button>
        )}
        {suggestion.actionLabel && onUse && (
          <button
            onClick={() => onUse(suggestion)}
            className="text-xs px-2 py-1 rounded bg-current/20 hover:bg-current/30 font-medium"
          >
            {suggestion.actionLabel}
          </button>
        )}
        {!suggestion.actionLabel && onUse && (
          <button
            onClick={() => onUse(suggestion)}
            className="text-xs px-2 py-1 rounded bg-current/20 hover:bg-current/30 font-medium"
          >
            Use This
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT VERSION FOR MINIMIZED STATE
// =============================================================================

export function LiveAssistCompact({
  playbook,
  suggestionCount,
}: {
  playbook: Playbook | null;
  suggestionCount: number;
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
      {playbook ? (
        <>
          <span className="text-sm">📋</span>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
            {playbook.name}
          </span>
        </>
      ) : (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          No playbook matched
        </span>
      )}

      {suggestionCount > 0 && (
        <span className="ml-auto text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
          {suggestionCount} tip{suggestionCount !== 1 && "s"}
        </span>
      )}
    </div>
  );
}
