'use client';

/**
 * Agent Assist Panel Component
 *
 * Right sidebar showing AI-powered suggestions including intent detection,
 * compliance warnings, script suggestions, and knowledge base recommendations.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Customer } from '@/types';
import type { AssistState, Suggestion, ComplianceWarning, KnowledgeItem } from '@/hooks/use-claude-assist';

// =============================================================================
// ICONS
// =============================================================================

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const TargetIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const MessageSquareIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const BookOpenIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const QuestionMarkIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TrendingUpIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const LoadingSpinner = () => (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface AgentAssistPanelProps {
  callId: string;
  agentId: string;
  customer: Customer | null;
  transcript: string;
  assistState: AssistState;
  isLoading?: boolean;
  onQuickPrompt?: (prompt: 'handle_objection' | 'close_sale' | 'find_upsell') => void;
}

// =============================================================================
// COLLAPSIBLE SECTION COMPONENT
// =============================================================================

function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = true,
  variant = 'default',
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  variant?: 'default' | 'warning' | 'info';
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const bgColor =
    variant === 'warning'
      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      : variant === 'info'
      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';

  return (
    <div className={`rounded-lg border ${bgColor} overflow-hidden`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
          {count !== undefined && count > 0 && (
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          )}
        </div>
        {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </button>
      {isOpen && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

// =============================================================================
// SUGGESTION CARD COMPONENT
// =============================================================================

function SuggestionCard({ suggestion }: { suggestion: Suggestion }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(suggestion.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [suggestion.content]);

  const getTypeIcon = () => {
    switch (suggestion.type) {
      case 'script':
        return <MessageSquareIcon />;
      case 'question':
        return <QuestionMarkIcon />;
      case 'action':
        return <TargetIcon />;
      case 'upsell':
        return <TrendingUpIcon />;
      default:
        return <SparklesIcon />;
    }
  };

  const getPriorityColor = () => {
    switch (suggestion.priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          {getTypeIcon()}
          <span className="text-xs font-medium uppercase">{suggestion.type}</span>
        </div>
        <Badge className={`text-xs ${getPriorityColor()}`}>{suggestion.priority}</Badge>
      </div>

      <h4 className="text-sm font-medium text-gray-900 dark:text-white">{suggestion.title}</h4>

      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
        {suggestion.content}
      </p>

      {suggestion.context && (
        <p className="text-xs text-gray-500 dark:text-gray-500 italic">
          {suggestion.context}
        </p>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs"
      >
        <CopyIcon />
        <span className="ml-1">{copied ? 'Copied!' : 'Copy'}</span>
      </Button>
    </div>
  );
}

// =============================================================================
// COMPLIANCE WARNING CARD COMPONENT
// =============================================================================

function ComplianceCard({ warning }: { warning: ComplianceWarning }) {
  const getSeverityStyle = () => {
    switch (warning.severity) {
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700';
      case 'warning':
        return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700';
      case 'info':
        return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
      default:
        return 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700';
    }
  };

  const getIconColor = () => {
    switch (warning.severity) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-amber-600 dark:text-amber-400';
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className={`p-3 rounded-lg border ${getSeverityStyle()}`}>
      <div className="flex items-start gap-2">
        <div className={getIconColor()}>
          <AlertTriangleIcon />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">{warning.title}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{warning.message}</p>
          {warning.regulation && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 italic">
              Ref: {warning.regulation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// KNOWLEDGE ITEM CARD COMPONENT
// =============================================================================

function KnowledgeCard({ item }: { item: KnowledgeItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <BookOpenIcon />
          {item.category && (
            <Badge variant="secondary" className="text-xs">
              {item.category}
            </Badge>
          )}
        </div>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Open
          </a>
        )}
      </div>
      <h4 className="text-sm font-medium text-gray-900 dark:text-white mt-2">{item.title}</h4>
      <p
        className={`text-sm text-gray-600 dark:text-gray-400 mt-1 ${
          expanded ? '' : 'line-clamp-2'
        }`}
      >
        {item.summary}
      </p>
      {item.summary.length > 100 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AgentAssistPanel({
  callId,
  agentId,
  customer,
  transcript,
  assistState,
  isLoading,
  onQuickPrompt,
}: AgentAssistPanelProps) {
  const { intent, suggestions, compliance, knowledge, questionsToAsk } = assistState;

  return (
    <aside className="w-96 flex-shrink-0 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <SparklesIcon />
          <h3 className="font-semibold">AI Agent Assist</h3>
        </div>
        <Badge className="bg-white/20 text-white border-white/30 text-xs">
          Claude
        </Badge>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <LoadingSpinner />
          <span className="text-sm">Analyzing conversation...</span>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Detected Intent */}
        {intent && (
          <CollapsibleSection title="Detected Intent" icon={<TargetIcon />} defaultOpen={true}>
            <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white capitalize">
                  {intent.label.replace(/_/g, ' ')}
                </h4>
                <Badge
                  className={
                    intent.confidence > 0.8
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : intent.confidence > 0.5
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }
                >
                  {Math.round(intent.confidence * 100)}%
                </Badge>
              </div>
              {/* Confidence bar */}
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${intent.confidence * 100}%` }}
                />
              </div>
              {intent.reasoning && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
                  {intent.reasoning}
                </p>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Compliance Warnings */}
        {compliance.length > 0 && (
          <CollapsibleSection
            title="Compliance"
            icon={<AlertTriangleIcon />}
            count={compliance.length}
            variant="warning"
            defaultOpen={true}
          >
            <div className="space-y-2">
              {compliance.map((warning) => (
                <ComplianceCard key={warning.id} warning={warning} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Suggested Responses */}
        {suggestions.length > 0 && (
          <CollapsibleSection
            title="Suggested Responses"
            icon={<MessageSquareIcon />}
            count={suggestions.length}
            defaultOpen={true}
          >
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Questions to Ask */}
        {questionsToAsk && questionsToAsk.length > 0 && (
          <CollapsibleSection
            title="Questions to Ask"
            icon={<QuestionMarkIcon />}
            count={questionsToAsk.length}
            defaultOpen={true}
          >
            <ul className="space-y-2">
              {questionsToAsk.map((question, idx) => (
                <li
                  key={idx}
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                >
                  <span className="text-blue-600 dark:text-blue-400">?</span>
                  {question}
                </li>
              ))}
            </ul>
          </CollapsibleSection>
        )}

        {/* Knowledge Base */}
        {knowledge.length > 0 && (
          <CollapsibleSection
            title="Knowledge Base"
            icon={<BookOpenIcon />}
            count={knowledge.length}
            defaultOpen={false}
          >
            <div className="space-y-2">
              {knowledge.map((item) => (
                <KnowledgeCard key={item.id} item={item} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Empty state */}
        {!intent && suggestions.length === 0 && compliance.length === 0 && !isLoading && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <SparklesIcon />
            <p className="text-sm mt-2">
              AI suggestions will appear as the conversation progresses
            </p>
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase">
          Quick Prompts
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onQuickPrompt?.('handle_objection')}
            disabled={isLoading}
          >
            Handle Objection
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onQuickPrompt?.('close_sale')}
            disabled={isLoading}
          >
            Close Sale
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => onQuickPrompt?.('find_upsell')}
            disabled={isLoading}
          >
            Find Upsell
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default AgentAssistPanel;
