"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Playbook, AgentSuggestion } from "@/lib/agent-assist/types";

interface LiveAssistCardProps {
  playbook: Playbook | null;
  suggestions?: AgentSuggestion[];
  confidence?: number;
  matchedTriggers?: string[];
  onUseSuggestion?: (suggestion: AgentSuggestion) => void;
  onCopyScript?: (script: string) => void;
  className?: string;
}

// Script tab options
type ScriptTab = "opening" | "discovery" | "resolution";

// Suggestion type styling
const SUGGESTION_STYLES = {
  knowledge: { bg: "bg-blue-50 border-blue-200", text: "text-blue-800", icon: "📚" },
  compliance: { bg: "bg-red-50 border-red-200", text: "text-red-800", icon: "🛡️" },
  upsell: { bg: "bg-green-50 border-green-200", text: "text-green-800", icon: "💰" },
  next_action: { bg: "bg-purple-50 border-purple-200", text: "text-purple-800", icon: "➡️" },
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
  onUseSuggestion,
  onCopyScript,
  className,
}: LiveAssistCardProps) {
  const [scriptTab, setScriptTab] = useState<ScriptTab>("opening");
  const [expandedSection, setExpandedSection] = useState<string | null>("scripts");

  if (!playbook) {
    return (
      <div className={cn("p-4 text-center text-gray-500", className)}>
        <div className="text-4xl mb-2">🎧</div>
        <p className="text-sm">Listening to the call...</p>
        <p className="text-xs mt-1">Playbook suggestions will appear as the conversation develops.</p>
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
        <div className="p-3 bg-yellow-50 border-b border-yellow-200">
          <div className="text-xs font-semibold text-yellow-800 mb-1">✓ Confirm Understanding</div>
          <p className="text-sm text-yellow-900 italic">&quot;{playbook.confirm}&quot;</p>
          <button
            onClick={() => handleCopy(playbook.confirm)}
            className="mt-1 text-xs text-yellow-700 hover:text-yellow-900"
          >
            Copy
          </button>
        </div>

        {/* Scripts Section */}
        <div className="border-b">
          <button
            onClick={() => toggleSection("scripts")}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
          >
            <span className="text-sm font-semibold">💬 Say This</span>
            <span className="text-gray-400">{expandedSection === "scripts" ? "−" : "+"}</span>
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
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
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
                    className="p-2 bg-gray-50 rounded text-sm cursor-pointer hover:bg-gray-100 group"
                    onClick={() => handleCopy(script)}
                  >
                    <span className="text-gray-700">&quot;{script}&quot;</span>
                    <span className="ml-2 text-xs text-gray-400 opacity-0 group-hover:opacity-100">
                      Click to copy
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Do / Dont Section */}
        <div className="border-b">
          <button
            onClick={() => toggleSection("guidance")}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
          >
            <span className="text-sm font-semibold">📋 Guidance</span>
            <span className="text-gray-400">{expandedSection === "guidance" ? "−" : "+"}</span>
          </button>
          {expandedSection === "guidance" && (
            <div className="px-3 pb-3 grid grid-cols-2 gap-3">
              {/* Do */}
              <div>
                <div className="text-xs font-semibold text-green-700 mb-1">✓ DO</div>
                <ul className="space-y-1">
                  {playbook.do.map((item, i) => (
                    <li key={i} className="text-xs text-gray-700 flex items-start gap-1">
                      <span className="text-green-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* Dont */}
              <div>
                <div className="text-xs font-semibold text-red-700 mb-1">✗ DON&apos;T</div>
                <ul className="space-y-1">
                  {playbook.dont.map((item, i) => (
                    <li key={i} className="text-xs text-gray-700 flex items-start gap-1">
                      <span className="text-red-500 mt-0.5">•</span>
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
          <div className="border-b">
            <button
              onClick={() => toggleSection("escalate")}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-orange-600">⚠️ Escalate If</span>
              <span className="text-gray-400">{expandedSection === "escalate" ? "−" : "+"}</span>
            </button>
            {expandedSection === "escalate" && (
              <div className="px-3 pb-3">
                <ul className="space-y-1">
                  {playbook.escalateIf.map((item, i) => (
                    <li key={i} className="text-xs text-orange-700 flex items-start gap-1">
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
            <div className="text-xs font-semibold text-gray-600 mb-2">🤖 AI Suggestions</div>
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
          <div className="p-3 bg-gray-50 border-t">
            <div className="text-xs font-semibold text-gray-600 mb-1">📝 Compliance Notes</div>
            <ul className="space-y-0.5">
              {playbook.complianceNotes.map((note, i) => (
                <li key={i} className="text-xs text-gray-600">
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
