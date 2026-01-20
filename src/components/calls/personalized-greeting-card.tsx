'use client';

/**
 * Personalized Greeting Card Component
 * ====================================
 * Displays a personalized greeting suggestion that the agent can use
 * at the start of the call. Includes copy functionality and variations.
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// =============================================================================
// ICONS
// =============================================================================

const WaveIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
  </svg>
);

const CopyIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

export interface PersonalizedGreetingCardProps {
  greeting: string;
  customerName: string;
  preferredName?: string;
  contextUsed?: string[];
  onRegenerateGreeting?: () => void;
  isRegenerating?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PersonalizedGreetingCard({
  greeting,
  customerName,
  preferredName,
  contextUsed = [],
  onRegenerateGreeting,
  isRegenerating = false,
}: PersonalizedGreetingCardProps) {
  const [copied, setCopied] = useState(false);
  const [used, setUsed] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(greeting);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [greeting]);

  const handleMarkUsed = useCallback(() => {
    setUsed(true);
  }, []);

  if (used) {
    return (
      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <CheckIcon />
          <span className="text-sm font-medium">Greeting used</span>
        </div>
        <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
          Great start! Continue building rapport with {preferredName || customerName.split(' ')[0] || 'the customer'}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-100 to-blue-100 dark:from-purple-900/40 dark:to-blue-900/40 border-b border-purple-200 dark:border-purple-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WaveIcon />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Personalized Greeting
            </h3>
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
              <SparklesIcon />
              <span className="ml-1">AI</span>
            </Badge>
          </div>
          {onRegenerateGreeting && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerateGreeting}
              disabled={isRegenerating}
              className="text-xs h-7"
            >
              <RefreshIcon />
              <span className="ml-1">{isRegenerating ? 'Regenerating...' : 'New'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Greeting Content */}
      <div className="p-4 space-y-3">
        {/* Name indicator */}
        {preferredName && (
          <div className="text-xs text-purple-600 dark:text-purple-400">
            Using preferred name: <strong>"{preferredName}"</strong>
          </div>
        )}

        {/* The greeting */}
        <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-purple-200 dark:border-purple-700">
          <p className="text-sm text-gray-900 dark:text-white leading-relaxed">
            {greeting}
          </p>
        </div>

        {/* Context used */}
        {contextUsed.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Based on:
            </p>
            <div className="flex flex-wrap gap-1">
              {contextUsed.map((ctx, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {ctx}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="text-xs flex-1"
          >
            <CopyIcon />
            <span className="ml-1">{copied ? 'Copied!' : 'Copy Greeting'}</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleMarkUsed}
            className="text-xs flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <CheckIcon />
            <span className="ml-1">Mark as Used</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PersonalizedGreetingCard;
