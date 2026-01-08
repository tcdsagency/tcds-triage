"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { FormSectionGuidance, FormGuidanceTip, QuoteType } from "@/lib/agent-assist/types";
import { QUOTE_FORM_GUIDANCE } from "@/lib/agent-assist/form-guidance";

// Field completion tracking for checklists
export interface FieldCompletionStatus {
  [fieldName: string]: boolean;
}

interface AgentAssistSidebarProps {
  quoteType: QuoteType;
  currentSection?: string;
  expandedSections?: string[];
  fieldCompletion?: FieldCompletionStatus;
  onSectionClick?: (sectionId: string) => void;
  className?: string;
}

// Tip type styling - using high contrast colors for readability in dark mode
const TIP_STYLES = {
  script: { bg: "bg-blue-900/40", border: "border-blue-500/50", text: "text-blue-100", icon: "💬" },
  tip: { bg: "bg-emerald-900/40", border: "border-emerald-500/50", text: "text-emerald-100", icon: "💡" },
  warning: { bg: "bg-amber-900/40", border: "border-amber-500/50", text: "text-amber-100", icon: "⚠️" },
  checklist: { bg: "bg-slate-800/60", border: "border-slate-500/50", text: "text-slate-100", icon: "☑️" },
};

// Section progress indicator
function SectionProgress({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-2 h-2 rounded-full transition-colors",
            i < current ? "bg-indigo-400" : i === current ? "bg-white" : "bg-indigo-800"
          )}
        />
      ))}
    </div>
  );
}

// Map checklist items to field names for tracking completion
const CHECKLIST_FIELD_MAP: Record<string, string[]> = {
  "Required Information": ["firstName", "lastName", "dob", "phone", "email"],
  "Required Per Vehicle": ["vin", "year", "make", "model", "mileage"],
  "Required Per Driver": ["driverName", "driverDob", "licenseNumber", "licenseState", "yearsLicensed"],
};

// Single tip display
function TipCard({ tip, fieldCompletion }: { tip: FormGuidanceTip; fieldCompletion?: FieldCompletionStatus }) {
  const style = TIP_STYLES[tip.type];
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isScript = tip.type === "script";
  const isChecklist = tip.type === "checklist";
  const content = tip.content;

  // Get completion status for checklist items
  const getItemCompletion = (item: string, index: number): boolean => {
    if (!fieldCompletion) return false;
    const fieldNames = CHECKLIST_FIELD_MAP[tip.title];
    if (fieldNames && fieldNames[index]) {
      return fieldCompletion[fieldNames[index]] || false;
    }
    // Fallback: check if any field name contains the item text (lowercased)
    const itemLower = item.toLowerCase();
    for (const [key, value] of Object.entries(fieldCompletion)) {
      if (itemLower.includes(key.toLowerCase()) || key.toLowerCase().includes(itemLower.split(" ")[0])) {
        return value;
      }
    }
    return false;
  };

  // Count completed items
  const completedCount = isChecklist && Array.isArray(content)
    ? content.filter((_, i) => getItemCompletion(content[i], i)).length
    : 0;
  const totalItems = isChecklist && Array.isArray(content) ? content.length : 0;

  return (
    <div className={cn("rounded-lg border p-3", style.bg, style.border)}>
      <div className={cn("flex items-start gap-2", style.text)}>
        <span className="text-base">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold">{tip.title}</span>
            {isChecklist && totalItems > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded",
                completedCount === totalItems
                  ? "bg-emerald-500/30 text-emerald-200"
                  : "bg-slate-700 text-slate-300"
              )}>
                {completedCount}/{totalItems}
              </span>
            )}
          </div>
          {isChecklist && Array.isArray(content) ? (
            <ul className="space-y-1">
              {content.map((item, i) => {
                const isComplete = getItemCompletion(item, i);
                return (
                  <li key={i} className="text-xs flex items-center gap-2">
                    {isComplete ? (
                      <span className="w-3.5 h-3.5 bg-emerald-500 rounded flex-shrink-0 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 border-2 border-slate-500 rounded flex-shrink-0 bg-slate-800" />
                    )}
                    <span className={cn(
                      "font-medium",
                      isComplete ? "text-emerald-300 line-through" : "text-slate-200"
                    )}>{item}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-xs">
              {isScript ? (
                <div className="relative group">
                  <span className="italic">&quot;{content}&quot;</span>
                  <button
                    onClick={() => handleCopy(content as string)}
                    className="ml-2 opacity-0 group-hover:opacity-100 text-xs underline transition-opacity"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              ) : (
                <span>{content}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Section display
function GuidanceSection({
  section,
  isActive,
  isExpanded,
  onToggle,
  fieldCompletion,
}: {
  section: FormSectionGuidance;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  fieldCompletion?: FieldCompletionStatus;
}) {
  return (
    <div className={cn("border-b border-gray-700 last:border-b-0", isActive && "bg-blue-900/30")}>
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-700/50 transition-colors",
          isActive && "bg-blue-900/40 hover:bg-blue-900/50"
        )}
      >
        <div className="flex items-center gap-2">
          {isActive && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
          <span className={cn("text-sm font-medium", isActive ? "text-blue-300" : "text-gray-300")}>
            {section.title}
          </span>
        </div>
        <span className="text-gray-500 text-xs">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {section.tips.map((tip, i) => (
            <TipCard key={i} tip={tip} fieldCompletion={fieldCompletion} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentAssistSidebar({
  quoteType,
  currentSection,
  expandedSections = [],
  fieldCompletion,
  onSectionClick,
  className,
}: AgentAssistSidebarProps) {
  const [localExpanded, setLocalExpanded] = useState<string[]>([]);
  const guidance = QUOTE_FORM_GUIDANCE[quoteType] || [];

  // Auto-expand current section
  useEffect(() => {
    if (currentSection && !localExpanded.includes(currentSection)) {
      setLocalExpanded((prev) => [...prev, currentSection]);
    }
  }, [currentSection]);

  const toggleSection = (sectionId: string) => {
    setLocalExpanded((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
    onSectionClick?.(sectionId);
  };

  const currentIndex = guidance.findIndex((g) => g.id === currentSection);

  if (guidance.length === 0) {
    return (
      <div className={cn("w-72 border-l border-gray-700 bg-gray-800 p-4", className)}>
        <div className="text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">No guidance available for this quote type yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-72 border-l border-gray-700 bg-gray-800 flex flex-col h-full overflow-hidden", className)}>
      {/* Header */}
      <div className="p-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Agent Assist</h3>
          <SectionProgress total={guidance.length} current={currentIndex >= 0 ? currentIndex : 0} />
        </div>
        <p className="text-xs text-indigo-200 mt-1">
          Section {currentIndex + 1} of {guidance.length}
        </p>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto">
        {guidance.map((section) => (
          <GuidanceSection
            key={section.id}
            section={section}
            isActive={section.id === currentSection}
            isExpanded={localExpanded.includes(section.id) || expandedSections.includes(section.id)}
            onToggle={() => toggleSection(section.id)}
            fieldCompletion={fieldCompletion}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-700 bg-gray-900/50 text-center">
        <p className="text-xs text-gray-500">
          Click sections for guidance tips
        </p>
      </div>
    </div>
  );
}
