'use client';

/**
 * Live Transcript Panel Component
 *
 * Center panel displaying real-time conversation transcript with
 * speaker-labeled chat bubbles, entity highlighting, and auto-scroll.
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { DetectedEntity } from './caller-context-panel';

// =============================================================================
// ICONS
// =============================================================================

const MicIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
  </svg>
);

const WifiIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
  </svg>
);

const WifiOffIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
  </svg>
);

const ArrowDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

export interface TranscriptSegment {
  id: string;
  text: string;
  speaker: 'agent' | 'caller' | 'unknown';
  timestamp: Date;
  confidence: number;
  isFinal: boolean;
  sequenceNumber?: number;
}

interface LiveTranscriptPanelProps {
  segments: TranscriptSegment[];
  isConnected: boolean;
  connectionState?: 'connecting' | 'connected' | 'disconnected' | 'error';
  onEntityDetected?: (entity: DetectedEntity) => void;
}

// =============================================================================
// ENTITY DETECTION PATTERNS
// =============================================================================

const ENTITY_PATTERNS: { type: DetectedEntity['type']; pattern: RegExp; validate?: (match: string) => boolean }[] = [
  {
    // VIN: 17 alphanumeric characters, no I, O, Q
    type: 'vin',
    pattern: /\b[A-HJ-NPR-Z0-9]{17}\b/gi,
    validate: (match) => {
      // Basic VIN validation - 17 chars, no I/O/Q
      return match.length === 17 && !/[IOQ]/i.test(match);
    },
  },
  {
    // Policy numbers - various formats
    type: 'policy_number',
    pattern: /\b(?:policy\s*#?\s*)?([A-Z]{2,4}[-\s]?\d{5,10}|\d{8,12})\b/gi,
  },
  {
    // Dollar amounts
    type: 'dollar_amount',
    pattern: /\$[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|bucks?)\b/gi,
  },
  {
    // Dates - various formats
    type: 'date',
    pattern: /\b(?:\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)\b/gi,
  },
  {
    // Phone numbers
    type: 'phone',
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    // Email addresses
    type: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  },
];

// =============================================================================
// HELPER: Detect entities in text
// =============================================================================

function detectEntities(text: string): DetectedEntity[] {
  const entities: DetectedEntity[] = [];
  const seen = new Set<string>();

  for (const { type, pattern, validate } of ENTITY_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const value = match[0].trim();
      const key = `${type}:${value.toLowerCase()}`;

      if (seen.has(key)) continue;

      if (validate && !validate(value)) continue;

      seen.add(key);
      entities.push({
        type,
        value,
        confidence: 0.9, // High confidence for regex matches
      });
    }
  }

  return entities;
}

// =============================================================================
// HELPER: Highlight entities in text
// =============================================================================

function highlightEntities(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  const allMatches: { start: number; end: number; type: string; value: string }[] = [];

  // Collect all matches
  for (const { type, pattern, validate } of ENTITY_PATTERNS) {
    const matches = text.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      if (match.index === undefined) continue;
      const value = match[0];
      if (validate && !validate(value)) continue;

      allMatches.push({
        start: match.index,
        end: match.index + value.length,
        type,
        value,
      });
    }
  }

  // Sort by position and remove overlaps
  allMatches.sort((a, b) => a.start - b.start);
  const filtered: typeof allMatches = [];
  for (const match of allMatches) {
    const last = filtered[filtered.length - 1];
    if (!last || match.start >= last.end) {
      filtered.push(match);
    }
  }

  // Build highlighted text
  for (const match of filtered) {
    if (match.start > lastIndex) {
      parts.push(text.slice(lastIndex, match.start));
    }

    const bgColor =
      match.type === 'vin'
        ? 'bg-orange-200 dark:bg-orange-900/50'
        : match.type === 'policy_number'
        ? 'bg-blue-200 dark:bg-blue-900/50'
        : match.type === 'dollar_amount'
        ? 'bg-green-200 dark:bg-green-900/50'
        : match.type === 'date'
        ? 'bg-purple-200 dark:bg-purple-900/50'
        : match.type === 'phone'
        ? 'bg-cyan-200 dark:bg-cyan-900/50'
        : match.type === 'email'
        ? 'bg-pink-200 dark:bg-pink-900/50'
        : 'bg-yellow-200 dark:bg-yellow-900/50';

    parts.push(
      <mark
        key={`${match.start}-${match.type}`}
        className={`${bgColor} rounded px-0.5 cursor-pointer hover:opacity-80`}
        title={`${match.type}: ${match.value}`}
      >
        {match.value}
      </mark>
    );

    lastIndex = match.end;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// =============================================================================
// HELPER: Group consecutive segments by speaker
// =============================================================================

interface GroupedMessage {
  speaker: 'agent' | 'caller' | 'unknown';
  segments: TranscriptSegment[];
  timestamp: Date;
}

function groupSegmentsBySpeaker(segments: TranscriptSegment[]): GroupedMessage[] {
  const groups: GroupedMessage[] = [];

  for (const segment of segments) {
    const lastGroup = groups[groups.length - 1];

    // If same speaker and within 10 seconds, add to existing group
    if (
      lastGroup &&
      lastGroup.speaker === segment.speaker &&
      segment.timestamp.getTime() - lastGroup.timestamp.getTime() < 10000
    ) {
      lastGroup.segments.push(segment);
    } else {
      // Start new group
      groups.push({
        speaker: segment.speaker,
        segments: [segment],
        timestamp: segment.timestamp,
      });
    }
  }

  return groups;
}

// =============================================================================
// HELPER: Format timestamp
// =============================================================================

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LiveTranscriptPanel({
  segments,
  isConnected,
  connectionState = isConnected ? 'connected' : 'disconnected',
  onEntityDetected,
}: LiveTranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const lastProcessedRef = useRef<Set<string>>(new Set());

  // Group segments by speaker
  const groupedMessages = useMemo(() => groupSegmentsBySpeaker(segments), [segments]);

  // Detect entities in new segments
  useEffect(() => {
    if (!onEntityDetected) return;

    for (const segment of segments) {
      if (lastProcessedRef.current.has(segment.id)) continue;
      lastProcessedRef.current.add(segment.id);

      const entities = detectEntities(segment.text);
      for (const entity of entities) {
        onEntityDetected(entity);
      }
    }
  }, [segments, onEntityDetected]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [segments, autoScroll]);

  // Handle scroll to detect if user scrolled up
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    setAutoScroll(isAtBottom);
    setShowScrollButton(!isAtBottom && segments.length > 0);
  }, [segments.length]);

  // Scroll to bottom button handler
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setAutoScroll(true);
      setShowScrollButton(false);
    }
  }, []);

  // Connection status indicator
  const getConnectionBadge = () => {
    switch (connectionState) {
      case 'connected':
        return (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <WifiIcon />
            <span className="ml-1">Live</span>
          </Badge>
        );
      case 'connecting':
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse">
            <WifiIcon />
            <span className="ml-1">Connecting...</span>
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
            <WifiOffIcon />
            <span className="ml-1">Error</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <WifiOffIcon />
            <span className="ml-1">Offline</span>
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-white">Live Transcript</h3>
        {getConnectionBadge()}
      </div>

      {/* Transcript Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {segments.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mb-4 animate-pulse">
              <MicIcon />
            </div>
            <p className="text-center">
              {connectionState === 'connecting'
                ? 'Connecting to live transcript...'
                : connectionState === 'connected'
                ? 'Waiting for conversation...'
                : 'Transcript will appear here'}
            </p>
          </div>
        ) : (
          /* Messages */
          groupedMessages.map((group, groupIdx) => {
            const isAgent = group.speaker === 'agent';
            const combinedText = group.segments.map((s) => s.text).join(' ');

            return (
              <div
                key={`group-${groupIdx}`}
                className={`flex ${isAgent ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] ${isAgent ? 'order-1' : ''}`}>
                  {/* Speaker label */}
                  <div
                    className={`text-xs text-gray-500 dark:text-gray-400 mb-1 ${
                      isAgent ? 'text-right' : 'text-left'
                    }`}
                  >
                    {isAgent ? 'Agent' : group.speaker === 'caller' ? 'Caller' : 'Speaker'}
                    <span className="mx-1">-</span>
                    {formatTime(group.timestamp)}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`rounded-2xl px-4 py-2 ${
                      isAgent
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-md border border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {highlightEntities(combinedText)}
                    </p>
                  </div>

                  {/* Confidence indicator for non-final segments */}
                  {group.segments.some((s) => !s.isFinal) && (
                    <div
                      className={`text-xs text-gray-400 dark:text-gray-500 mt-1 italic ${
                        isAgent ? 'text-right' : 'text-left'
                      }`}
                    >
                      Transcribing...
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator when connected but no recent segments */}
        {isConnected && segments.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-gray-200 dark:bg-gray-700 rounded-full px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <Button
            size="sm"
            onClick={scrollToBottom}
            className="shadow-lg bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4"
          >
            <ArrowDownIcon />
            <span className="ml-1">Scroll to latest</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default LiveTranscriptPanel;
