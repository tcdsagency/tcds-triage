"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  FormSectionGuidance,
  FormGuidanceTip,
  QuoteType,
  AgentAssistSidebarProps,
} from "@/lib/agent-assist/types";
import { QUOTE_FORM_GUIDANCE, getSectionGuidance } from "@/lib/agent-assist/form-guidance";

// Tip type styling
const TIP_STYLES = {
  script: {
    bg: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    text: "text-blue-800 dark:text-blue-200",
    icon: "💬",
  },
  tip: {
    bg: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    text: "text-green-800 dark:text-green-200",
    icon: "💡",
  },
  warning: {
    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    text: "text-amber-800 dark:text-amber-200",
    icon: "⚠️",
  },
  checklist: {
    bg: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800",
    text: "text-purple-800 dark:text-purple-200",
    icon: "✅",
  },
};

/**
 * Agent Assist Sidebar - Form guidance for quote intake
 * Shows section-by-section tips, scripts, and checklists
 */
export default function AgentAssistSidebar({
  quoteType,
  currentSection,
  expandedSections = [],
  onSectionClick,
  className,
}: AgentAssistSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(
    new Set(expandedSections)
  );

  // Get all guidance for this quote type
  const allGuidance = QUOTE_FORM_GUIDANCE[quoteType] || [];

  // Update expanded sections when current section changes
  useEffect(() => {
    if (currentSection && !internalExpanded.has(currentSection)) {
      setInternalExpanded((prev) => new Set([...prev, currentSection]));
    }
  }, [currentSection]);

  const toggleSection = (sectionId: string) => {
    setInternalExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
    onSectionClick?.(sectionId);
  };

  if (allGuidance.length === 0) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div
        className={cn(
          "w-12 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col items-center py-4",
          className
        )}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-800"
          title="Expand Agent Assist"
        >
          🎯
        </button>
        <div className="mt-4 writing-mode-vertical text-xs text-gray-500 dark:text-gray-400 font-medium">
          Agent Assist
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-80 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <span className="font-semibold">Agent Assist</span>
        </div>
        <button
          onClick={() => setIsCollapsed(true)}
          className="p-1 hover:bg-white/20 rounded"
          title="Collapse"
        >
          ◀
        </button>
      </div>

      {/* Section Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Progress indicator */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
            <span>Progress</span>
            <span>
              {allGuidance.findIndex((g) => g.id === currentSection) + 1} /{" "}
              {allGuidance.length}
            </span>
          </div>
          <div className="flex gap-1">
            {allGuidance.map((section, i) => {
              const isActive = section.id === currentSection;
              const isPast =
                allGuidance.findIndex((g) => g.id === currentSection) > i;
              return (
                <div
                  key={section.id}
                  className={cn(
                    "flex-1 h-1.5 rounded-full transition-colors",
                    isActive && "bg-purple-500",
                    isPast && "bg-green-500",
                    !isActive && !isPast && "bg-gray-200 dark:bg-gray-700"
                  )}
                />
              );
            })}
          </div>
        </div>

        {/* Section List */}
        <div className="p-2 space-y-1">
          {allGuidance.map((section) => {
            const isActive = section.id === currentSection;
            const isExpanded = internalExpanded.has(section.id);

            return (
              <div
                key={section.id}
                className={cn(
                  "rounded-lg overflow-hidden transition-colors",
                  isActive && "ring-2 ring-purple-500"
                )}
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className={cn(
                    "w-full px-3 py-2 flex items-center gap-2 text-left transition-colors",
                    isActive
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200"
                      : "bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                >
                  <span
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                      isActive
                        ? "bg-purple-500 text-white"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                    )}
                  >
                    {allGuidance.findIndex((g) => g.id === section.id) + 1}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">
                    {section.title}
                  </span>
                  <span
                    className={cn(
                      "text-xs text-gray-400 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  >
                    ▼
                  </span>
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="px-3 py-2 bg-white dark:bg-gray-800 space-y-2">
                    {section.tips.map((tip, i) => (
                      <TipCard key={i} tip={tip} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Click sections to expand/collapse
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TIP CARD COMPONENT
// =============================================================================

function TipCard({ tip }: { tip: FormGuidanceTip }) {
  const style = TIP_STYLES[tip.type];
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    const text = Array.isArray(tip.content) ? tip.content.join("\n") : tip.content;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className={cn("rounded-lg border p-2", style.bg)}>
      <div className="flex items-start gap-2">
        <span className="text-sm">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className={cn("text-xs font-semibold mb-1", style.text)}>
            {tip.title}
          </div>

          {/* Content rendering based on type */}
          {tip.type === "checklist" && Array.isArray(tip.content) ? (
            <ul className="space-y-0.5">
              {tip.content.map((item, i) => (
                <li
                  key={i}
                  className={cn(
                    "text-xs flex items-start gap-1.5",
                    style.text.replace("800", "700").replace("200", "300")
                  )}
                >
                  <span className="opacity-60">☐</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : tip.type === "script" ? (
            <div className="relative">
              <div
                className={cn(
                  "text-xs italic border-l-2 pl-2",
                  style.text.replace("800", "700").replace("200", "300"),
                  "border-current/30"
                )}
              >
                &ldquo;{tip.content}&rdquo;
              </div>
              <button
                onClick={handleCopy}
                className={cn(
                  "absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded",
                  isCopied
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500"
                )}
              >
                {isCopied ? "Copied!" : "Copy"}
              </button>
            </div>
          ) : (
            <div
              className={cn(
                "text-xs leading-relaxed",
                style.text.replace("800", "700").replace("200", "300")
              )}
            >
              {tip.content}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT SIDEBAR FOR MOBILE/NARROW SCREENS
// =============================================================================

export function AgentAssistSidebarCompact({
  quoteType,
  currentSection,
}: {
  quoteType: QuoteType;
  currentSection: string;
}) {
  const currentGuidance = getSectionGuidance(quoteType, currentSection);

  if (!currentGuidance) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-40">
      <div className="px-3 py-2 bg-purple-500 text-white flex items-center gap-2">
        <span>🎯</span>
        <span className="text-sm font-medium">{currentGuidance.title}</span>
      </div>
      <div className="p-3 max-h-60 overflow-y-auto space-y-2">
        {currentGuidance.tips.slice(0, 2).map((tip, i) => (
          <TipCard key={i} tip={tip} />
        ))}
      </div>
    </div>
  );
}
