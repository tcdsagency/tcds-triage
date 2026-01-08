"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Playbook, AgentSuggestion, TelemetryFeedback } from "@/lib/agent-assist/types";

interface LiveAssistCardProps {
  playbook: Playbook | null;
  suggestions?: AgentSuggestion[];
  confidence?: number;
  matchedTriggers?: string[];
  isLoading?: boolean;
  onUseSuggestion?: (suggestion: AgentSuggestion) => void;
  onDismissSuggestion?: (suggestion: AgentSuggestion) => void;
  onPlaybookFeedback?: (playbookId: string, feedback: TelemetryFeedback) => void;
  onCopyScript?: (script: string) => void;
  className?: string;
}

// Script tab options
type ScriptTab = "opening" | "discovery" | "resolution";

// Suggestion type styling - dark mode optimized
const SUGGESTION_STYLES = {
  knowledge: { bg: "bg-blue-900/40 border-blue-500/50", text: "text-blue-100", icon: "📚" },
  compliance: { bg: "bg-red-900/40 border-red-500/50", text: "text-red-100", icon: "🛡️" },
  upsell: { bg: "bg-emerald-900/40 border-emerald-500/50", text: "text-emerald-100", icon: "💰" },
  next_action: { bg: "bg-indigo-900/40 border-indigo-500/50", text: "text-indigo-100", icon: "➡️" },
};

// Domain icons
const DOMAIN_ICONS: Record<string, string> = {
  billing_payments: "💳",
  new_business: "📝",
  renewals: "🔄",
  claims: "📋",
  policy_changes: "✏️",
  escalations: "⚠️",
};

export default function LiveAssistCard({
  playbook,
  suggestions = [],
  confidence = 0,
  matchedTriggers = [],
  isLoading = false,
  onUseSuggestion,
  onDismissSuggestion,
  onPlaybookFeedback,
  onCopyScript,
  className,
}: LiveAssistCardProps) {
  const [scriptTab, setScriptTab] = useState<ScriptTab>("opening");
  const [expandedSection, setExpandedSection] = useState<string | null>("scripts");

  if (isLoading) {
    return (
      <div className={cn("p-4 text-center text-gray-400", className)}>
        <div className="text-4xl mb-2 animate-pulse">🔍</div>
        <p className="text-sm">Analyzing conversation...</p>
      </div>
    );
  }

  if (!playbook) {
    return (
      <div className={cn("p-4 text-center text-gray-400", className)}>
        <div className="text-4xl mb-2">🎧</div>
        <p className="text-sm">Listening to the call...</p>
        <p className="text-xs mt-1 text-gray-500">Playbook suggestions will appear as the conversation develops.</p>
      </div>
    );
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    onCopyScript?.(text);
  };

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Header */}
      <div className="p-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{DOMAIN_ICONS[playbook.domain] || "📞"}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{playbook.title}</h3>
            <p className="text-xs text-blue-100 truncate">{playbook.description}</p>
          </div>
          {confidence > 0 && (
            <div className="text-xs bg-blue-800/50 px-2 py-1 rounded">
              {Math.round(confidence * 100)}%
            </div>
          )}
        </div>
        {matchedTriggers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {matchedTriggers.slice(0, 3).map((trigger, i) => (
              <span key={i} className="text-xs bg-blue-800/50 px-1.5 py-0.5 rounded">
                {trigger}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Confirm Statement */}
        <div className="p-3 bg-amber-900/40 border-b border-amber-500/30">
          <div className="text-xs font-semibold text-amber-200 mb-1">✓ Confirm Understanding</div>
          <p className="text-sm text-amber-100 italic">&quot;{playbook.confirm}&quot;</p>
          <button
            onClick={() => handleCopy(playbook.confirm)}
            className="mt-1 text-xs text-amber-300 hover:text-amber-100"
          >
            Copy
          </button>
        </div>

        {/* Scripts Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection("scripts")}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-700/50"
          >
            <span className="text-sm font-semibold text-gray-200">💬 Say This</span>
            <span className="text-gray-500">{expandedSection === "scripts" ? "−" : "+"}</span>
          </button>
          {expandedSection === "scripts" && (
            <div className="px-3 pb-3">
              {/* Tabs */}
              <div className="flex gap-1 mb-2">
                {(["opening", "discovery", "resolution"] as ScriptTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setScriptTab(tab)}
                    className={cn(
                      "px-2 py-1 text-xs rounded capitalize",
                      scriptTab === tab
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              {/* Scripts */}
              <div className="space-y-2">
                {playbook.scripts[scriptTab].map((script, i) => (
                  <div
                    key={i}
                    className="p-2 bg-gray-700/50 rounded text-sm cursor-pointer hover:bg-gray-700 group"
                    onClick={() => handleCopy(script)}
                  >
                    <span className="text-gray-200">&quot;{script}&quot;</span>
                    <span className="ml-2 text-xs text-gray-500 opacity-0 group-hover:opacity-100">
                      Click to copy
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Do / Dont Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => toggleSection("guidance")}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-700/50"
          >
            <span className="text-sm font-semibold text-gray-200">📋 Guidance</span>
            <span className="text-gray-500">{expandedSection === "guidance" ? "−" : "+"}</span>
          </button>
          {expandedSection === "guidance" && (
            <div className="px-3 pb-3 grid grid-cols-2 gap-3">
              {/* Do */}
              <div>
                <div className="text-xs font-semibold text-emerald-400 mb-1">✓ DO</div>
                <ul className="space-y-1">
                  {playbook.do.map((item, i) => (
                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                      <span className="text-emerald-400 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Dont */}
              <div>
                <div className="text-xs font-semibold text-red-400 mb-1">✗ DON&apos;T</div>
                <ul className="space-y-1">
                  {playbook.dont.map((item, i) => (
                    <li key={i} className="text-xs text-gray-300 flex items-start gap-1">
                      <span className="text-red-400 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Escalation Warnings */}
        {playbook.escalateIf.length > 0 && (
          <div className="border-b border-gray-700">
            <button
              onClick={() => toggleSection("escalate")}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-700/50"
            >
              <span className="text-sm font-semibold text-orange-400">⚠️ Escalate If</span>
              <span className="text-gray-500">{expandedSection === "escalate" ? "−" : "+"}</span>
            </button>
            {expandedSection === "escalate" && (
              <div className="px-3 pb-3">
                <ul className="space-y-1">
                  {playbook.escalateIf.map((item, i) => (
                    <li key={i} className="text-xs text-orange-300 flex items-start gap-1">
                      <span className="mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* AI Suggestions */}
        {suggestions.length > 0 && (
          <div className="p-3">
            <div className="text-xs font-semibold text-gray-400 mb-2">🤖 AI Suggestions</div>
            <div className="space-y-2">
              {suggestions.map((suggestion) => {
                const style = SUGGESTION_STYLES[suggestion.type] || SUGGESTION_STYLES.next_action;
                return (
                  <div
                    key={suggestion.id}
                    className={cn(
                      "p-2 rounded border cursor-pointer hover:shadow-sm transition-shadow",
                      style.bg,
                      style.text
                    )}
                    onClick={() => onUseSuggestion?.(suggestion)}
                  >
                    <div className="flex items-start gap-1.5">
                      <span>{style.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold">{suggestion.title}</div>
                        <div className="text-xs mt-0.5">{suggestion.content}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compliance Notes */}
        {playbook.complianceNotes && playbook.complianceNotes.length > 0 && (
          <div className="p-3 bg-gray-900/50 border-t border-gray-700">
            <div className="text-xs font-semibold text-gray-400 mb-1">📝 Compliance Notes</div>
            <ul className="space-y-0.5">
              {playbook.complianceNotes.map((note, i) => (
                <li key={i} className="text-xs text-gray-400">
                  • {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact version for minimized call popup
 */
export function LiveAssistCompact({
  playbook,
  suggestionCount = 0,
}: {
  playbook: Playbook | null;
  suggestionCount?: number;
}) {
  if (!playbook && suggestionCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-indigo-900/40 border border-indigo-500/50 rounded-md">
      {playbook && (
        <div className="flex items-center gap-1 text-xs text-indigo-200">
          <span>{DOMAIN_ICONS[playbook.domain] || "📞"}</span>
          <span className="font-medium truncate max-w-[120px]">{playbook.title}</span>
        </div>
      )}
      {suggestionCount > 0 && (
        <span className="text-xs bg-indigo-700/50 text-indigo-200 px-1.5 py-0.5 rounded">
          {suggestionCount} tip{suggestionCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
