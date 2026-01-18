"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface LeadAssistCardsProps {
  phoneNumber: string;
  onCreateLead?: () => void;
  onStartQuote?: (quoteType: string) => void;
  className?: string;
  defaultExpanded?: boolean;
}

// Lead qualification questions
const QUALIFICATION_QUESTIONS = [
  {
    id: "name",
    question: "What's your name?",
    script: "May I get your first and last name please?",
    icon: "👤",
  },
  {
    id: "coverage",
    question: "What type of coverage are you looking for?",
    script: "What type of insurance are you looking to quote today?",
    icon: "📋",
  },
  {
    id: "timeline",
    question: "When do you need coverage?",
    script: "When do you need coverage to start? Is there a specific date?",
    icon: "📅",
  },
  {
    id: "current",
    question: "Do you have current coverage?",
    script: "Are you currently insured? Who's your current carrier?",
    icon: "🏢",
  },
  {
    id: "reason",
    question: "Why are you shopping?",
    script: "What's prompting you to look at new coverage today?",
    icon: "❓",
  },
];

// Quote type options with guidance
const QUOTE_TYPES = [
  {
    type: "personal-auto",
    label: "Auto",
    icon: "🚗",
    keyQuestions: ["# of vehicles?", "# of drivers?", "Clean driving record?"],
  },
  {
    type: "homeowners",
    label: "Home",
    icon: "🏠",
    keyQuestions: ["Own or rent?", "Year built?", "Roof age?"],
  },
  {
    type: "renters",
    label: "Renters",
    icon: "🏢",
    keyQuestions: ["Apartment or house?", "Personal property value?"],
  },
  {
    type: "umbrella",
    label: "Umbrella",
    icon: "☂️",
    keyQuestions: ["Current auto/home limits?", "Assets to protect?"],
  },
  {
    type: "commercial",
    label: "Business",
    icon: "🏪",
    keyQuestions: ["Business type?", "# employees?", "Annual revenue?"],
  },
  {
    type: "life",
    label: "Life",
    icon: "💚",
    keyQuestions: ["Coverage amount?", "Term or whole?", "Health conditions?"],
  },
];

// Lead Qualification Card
function QualificationCard({
  checkedItems,
  onToggle,
}: {
  checkedItems: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  const handleCopyScript = (id: string, script: string) => {
    navigator.clipboard.writeText(script);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 1500);
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-blue-600">📝</span>
        <span className="text-xs font-semibold text-blue-800 uppercase">
          Lead Qualification
        </span>
        <span className="ml-auto text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full">
          {checkedItems.size}/{QUALIFICATION_QUESTIONS.length}
        </span>
      </div>
      <div className="space-y-2">
        {QUALIFICATION_QUESTIONS.map((q) => {
          const isChecked = checkedItems.has(q.id);
          return (
            <div
              key={q.id}
              className={cn(
                "flex items-start gap-2 text-xs p-2 rounded border transition-colors cursor-pointer",
                isChecked
                  ? "bg-green-50 border-green-200"
                  : "bg-white border-blue-100 hover:border-blue-300"
              )}
              onClick={() => onToggle(q.id)}
            >
              <div className="flex-shrink-0 mt-0.5">
                {isChecked ? (
                  <span className="w-4 h-4 bg-green-500 rounded flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </span>
                ) : (
                  <span className="w-4 h-4 border-2 border-blue-300 rounded flex-shrink-0" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span>{q.icon}</span>
                  <span
                    className={cn(
                      "font-medium",
                      isChecked ? "text-green-700 line-through" : "text-gray-700"
                    )}
                  >
                    {q.question}
                  </span>
                </div>
                {!isChecked && (
                  <div className="flex items-center gap-1 mt-1 text-blue-600 italic">
                    <span className="line-clamp-1">"{q.script}"</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyScript(q.id, q.script);
                      }}
                      className="ml-1 text-blue-500 hover:text-blue-700 flex-shrink-0"
                    >
                      {copiedScript === q.id ? "✓" : "📋"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Quote Type Selection Card
function QuoteTypeCard({
  selectedType,
  onSelect,
}: {
  selectedType: string | null;
  onSelect: (type: string) => void;
}) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-green-600">📋</span>
        <span className="text-xs font-semibold text-green-800 uppercase">
          Quote Type
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {QUOTE_TYPES.map((qt) => (
          <button
            key={qt.type}
            onClick={() => onSelect(qt.type)}
            className={cn(
              "p-2 rounded border text-center transition-all",
              selectedType === qt.type
                ? "bg-green-500 border-green-600 text-white"
                : "bg-white border-green-200 hover:border-green-400 text-gray-700"
            )}
          >
            <div className="text-lg">{qt.icon}</div>
            <div className="text-[10px] font-medium">{qt.label}</div>
          </button>
        ))}
      </div>

      {/* Show key questions for selected type */}
      {selectedType && (
        <div className="bg-white rounded border border-green-200 p-2">
          <div className="text-[10px] font-semibold text-green-700 uppercase mb-1">
            Key Questions
          </div>
          <ul className="space-y-0.5">
            {QUOTE_TYPES.find((qt) => qt.type === selectedType)?.keyQuestions.map(
              (q, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                  <span className="text-green-400">•</span>
                  {q}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// Quick Tips Card for New Leads
function QuickTipsCard() {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-600">💡</span>
        <span className="text-xs font-semibold text-amber-800 uppercase">
          Quick Tips
        </span>
      </div>
      <ul className="space-y-1.5 text-xs text-amber-800">
        <li className="flex items-start gap-1">
          <span>•</span>
          <span>Build rapport before asking for info</span>
        </li>
        <li className="flex items-start gap-1">
          <span>•</span>
          <span>Ask about bundling opportunities early</span>
        </li>
        <li className="flex items-start gap-1">
          <span>•</span>
          <span>Get best contact method for follow-up</span>
        </li>
        <li className="flex items-start gap-1">
          <span>•</span>
          <span>Set expectations on quote timeline</span>
        </li>
      </ul>
    </div>
  );
}

export default function LeadAssistCards({
  phoneNumber,
  onCreateLead,
  onStartQuote,
  className,
  defaultExpanded = false,
}: LeadAssistCardsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [checkedQuestions, setCheckedQuestions] = useState<Set<string>>(new Set());
  const [selectedQuoteType, setSelectedQuoteType] = useState<string | null>(null);

  const toggleQuestion = (id: string) => {
    setCheckedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectQuoteType = (type: string) => {
    setSelectedQuoteType(type);
    onStartQuote?.(type);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-600">📋</span>
          <span className="text-sm font-semibold text-blue-800">
            New Lead Assist
          </span>
          <span className="text-xs bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded-full">
            {checkedQuestions.size}/{QUALIFICATION_QUESTIONS.length}
          </span>
        </div>
        <span className="text-blue-600 text-sm">
          {isExpanded ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>

      {/* Collapsed Summary */}
      {!isExpanded && (
        <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600">
          <span>Qualification questions, quote types, and tips for new leads</span>
        </div>
      )}

      {/* Expanded Content */}
      {isExpanded && (
        <>
          {/* Qualification Checklist */}
          <QualificationCard
            checkedItems={checkedQuestions}
            onToggle={toggleQuestion}
          />

          {/* Quote Type Selection */}
          <QuoteTypeCard
            selectedType={selectedQuoteType}
            onSelect={handleSelectQuoteType}
          />

          {/* Quick Tips */}
          <QuickTipsCard />
        </>
      )}

      {/* Action Buttons - Always visible */}
      <div className="flex gap-2">
        <button
          onClick={onCreateLead}
          className="flex-1 px-3 py-2 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"
        >
          <span>➕</span>
          Create Lead
        </button>
        {selectedQuoteType && (
          <button
            onClick={() => onStartQuote?.(selectedQuoteType)}
            className="flex-1 px-3 py-2 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"
          >
            <span>📋</span>
            Start Quote
          </button>
        )}
      </div>
    </div>
  );
}
