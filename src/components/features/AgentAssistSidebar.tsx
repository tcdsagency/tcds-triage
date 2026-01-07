"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { FormSectionGuidance, FormGuidanceTip, QuoteType } from "@/lib/agent-assist/types";
import { QUOTE_FORM_GUIDANCE } from "@/lib/agent-assist/form-guidance";

interface AgentAssistSidebarProps {
  quoteType: QuoteType;
  currentSection?: string;
  expandedSections?: string[];
  onSectionClick?: (sectionId: string) => void;
  className?: string;
}

// Tip type styling
const TIP_STYLES = {
  script: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", icon: "💬" },
  tip: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800", icon: "💡" },
  warning: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-800", icon: "⚠️" },
  checklist: { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800", icon: "☑️" },
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
            i < current ? "bg-blue-600" : i === current ? "bg-blue-400" : "bg-gray-200"
          )}
        />
      ))}
    </div>
  );
}

// Single tip display
function TipCard({ tip }: { tip: FormGuidanceTip }) {
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

  return (
    <div className={cn("rounded-lg border p-3", style.bg, style.border)}>
      <div className={cn("flex items-start gap-2", style.text)}>
        <span className="text-base">{style.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold mb-1">{tip.title}</div>
          {isChecklist && Array.isArray(content) ? (
            <ul className="space-y-0.5">
              {content.map((item, i) => (
                <li key={i} className="text-xs flex items-center gap-1.5">
                  <span className="w-3 h-3 border rounded flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
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
}: {
  section: FormSectionGuidance;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cn("border-b last:border-b-0", isActive && "bg-blue-50/50")}>
      <button
        onClick={onToggle}
        className={cn(
          "w-full px-3 py-2 flex items-center justify-between text-left hover:bg-gray-50 transition-colors",
          isActive && "bg-blue-50 hover:bg-blue-100"
        )}
      >
        <div className="flex items-center gap-2">
          {isActive && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
          <span className={cn("text-sm font-medium", isActive ? "text-blue-800" : "text-gray-700")}>
            {section.title}
          </span>
        </div>
        <span className="text-gray-400 text-xs">{isExpanded ? "−" : "+"}</span>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3 space-y-2">
          {section.tips.map((tip, i) => (
            <TipCard key={i} tip={tip} />
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
      <div className={cn("w-72 border-l bg-gray-50 p-4", className)}>
        <div className="text-center text-gray-500">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">No guidance available for this quote type yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-72 border-l bg-white flex flex-col h-full overflow-hidden", className)}>
      {/* Header */}
      <div className="p-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Agent Assist</h3>
          <SectionProgress total={guidance.length} current={currentIndex >= 0 ? currentIndex : 0} />
        </div>
        <p className="text-xs text-purple-100 mt-1">
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
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 border-t bg-gray-50 text-center">
        <p className="text-xs text-gray-500">
          Click sections for guidance tips
        </p>
      </div>
    </div>
  );
}
