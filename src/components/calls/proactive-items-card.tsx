'use client';

/**
 * Proactive Items Card Component
 * ==============================
 * Displays pending items, life events, and coverage gaps that the agent
 * should proactively mention during the call.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProactiveItem } from '@/lib/claude/prompts/personalized-system-prompt';

// =============================================================================
// ICONS
// =============================================================================

const ClipboardIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

// =============================================================================
// TYPES
// =============================================================================

export interface ProactiveItemsCardProps {
  items: ProactiveItem[];
  onItemMentioned?: (item: ProactiveItem) => void;
  defaultOpen?: boolean;
}

// =============================================================================
// ITEM COMPONENT
// =============================================================================

function ProactiveItemRow({
  item,
  onMentioned,
}: {
  item: ProactiveItem;
  onMentioned?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [mentioned, setMentioned] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(item.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [item.script]);

  const handleMentioned = useCallback(() => {
    setMentioned(true);
    onMentioned?.();
  }, [onMentioned]);

  const getTypeIcon = () => {
    switch (item.type) {
      case 'pending':
        return <ClipboardIcon />;
      case 'life-event':
        return <CalendarIcon />;
      case 'coverage-gap':
        return <ShieldIcon />;
      case 'follow-up':
        return <RefreshIcon />;
      default:
        return <ClipboardIcon />;
    }
  };

  const getTypeColor = () => {
    switch (item.type) {
      case 'pending':
        return 'text-amber-600 dark:text-amber-400';
      case 'life-event':
        return 'text-purple-600 dark:text-purple-400';
      case 'coverage-gap':
        return 'text-blue-600 dark:text-blue-400';
      case 'follow-up':
        return 'text-green-600 dark:text-green-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getPriorityBadge = () => {
    switch (item.priority) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'medium':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'low':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (mentioned) {
    return (
      <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 opacity-60">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckIcon />
          <span className="text-sm line-through">{item.item}</span>
          <span className="text-xs ml-auto">Mentioned</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2 group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className={`flex items-center gap-2 ${getTypeColor()}`}>
          {getTypeIcon()}
          <span className="text-xs font-medium uppercase">{item.type.replace('-', ' ')}</span>
        </div>
        <Badge className={`text-xs ${getPriorityBadge()}`}>{item.priority}</Badge>
      </div>

      {/* Item description */}
      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.item}</p>

      {/* Reason */}
      <p className="text-xs text-gray-500 dark:text-gray-400">{item.reason}</p>

      {/* Script suggestion */}
      <div className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 uppercase font-medium">
          Suggested script:
        </p>
        <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{item.script}"</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="text-xs h-7"
        >
          <CopyIcon />
          <span className="ml-1">{copied ? 'Copied!' : 'Copy Script'}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleMentioned}
          className="text-xs h-7 ml-auto"
        >
          <CheckIcon />
          <span className="ml-1">Mark Mentioned</span>
        </Button>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ProactiveItemsCard({
  items,
  onItemMentioned,
  defaultOpen = true,
}: ProactiveItemsCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (items.length === 0) {
    return null;
  }

  const highPriorityCount = items.filter((i) => i.priority === 'high').length;

  return (
    <div className="rounded-lg border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardIcon />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Proactive Items
          </span>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
          {highPriorityCount > 0 && (
            <Badge className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {highPriorityCount} high
            </Badge>
          )}
        </div>
        {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </button>

      {/* Content */}
      {isOpen && (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
            Mention these items proactively to show you remember the customer
          </p>
          {items.map((item, idx) => (
            <ProactiveItemRow
              key={`${item.type}-${idx}`}
              item={item}
              onMentioned={() => onItemMentioned?.(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ProactiveItemsCard;
