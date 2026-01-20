'use client';

/**
 * Call Header Component
 *
 * Top bar showing call status, duration, customer info, and action buttons.
 * Displays direction badge, live duration counter, and controls for
 * hold, transfer, and end call actions.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Call, Customer } from '@/types';

// =============================================================================
// ICONS (inline SVG for simplicity)
// =============================================================================

const PhoneIncoming = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 3l4 4m0 0l-4 4m4-4H8" />
  </svg>
);

const PhoneOutgoing = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-4-4m0 0l4-4m-4 4h12" />
  </svg>
);

const PauseIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

const PhoneXIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface CallHeaderProps {
  call: Call;
  customer: Customer | null;
  isLoading?: boolean;
  onHold: () => void;
  onTransfer: () => void;
  onEnd: () => void;
}

// =============================================================================
// HELPER: Format duration as MM:SS
// =============================================================================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CallHeader({
  call,
  customer,
  isLoading,
  onHold,
  onTransfer,
  onEnd,
}: CallHeaderProps) {
  const router = useRouter();
  const [duration, setDuration] = useState(0);

  // Live duration counter
  useEffect(() => {
    if (!call.startedAt) return;

    const startTime = new Date(call.startedAt).getTime();

    const updateDuration = () => {
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setDuration(elapsed);
    };

    updateDuration();
    const interval = setInterval(updateDuration, 1000);

    return () => clearInterval(interval);
  }, [call.startedAt]);

  // Determine direction
  const isInbound = call.direction === 'inbound';

  // Determine status for badge
  const getStatusBadge = () => {
    const status = call.status;
    if (status === 'in_progress') {
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 animate-pulse">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
          In Progress
        </Badge>
      );
    }
    if (status === 'ringing') {
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
          <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 animate-bounce" />
          Ringing
        </Badge>
      );
    }
    if (status === 'completed' || status === 'missed') {
      return (
        <Badge variant="secondary">
          {status === 'completed' ? 'Completed' : 'Missed'}
        </Badge>
      );
    }
    // Fallback for on_hold or other statuses
    return (
      <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
        {status}
      </Badge>
    );
  };

  // Customer display name
  const customerName = customer
    ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown'
    : 'Unknown Caller';

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left: Back button + Call info */}
        <div className="flex items-center gap-4">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeftIcon />
            <span className="ml-1 hidden sm:inline">Back</span>
          </Button>

          {/* Direction badge */}
          <Badge
            variant={isInbound ? 'default' : 'secondary'}
            className={
              isInbound
                ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                : 'bg-purple-500/10 text-purple-600 border-purple-500/20'
            }
          >
            {isInbound ? <PhoneIncoming /> : <PhoneOutgoing />}
            <span className="ml-1">{isInbound ? 'INCOMING' : 'OUTGOING'}</span>
          </Badge>

          {/* Customer name */}
          <div className="flex flex-col">
            <span className="font-semibold text-gray-900 dark:text-white">
              {isLoading ? (
                <span className="animate-pulse bg-gray-200 dark:bg-gray-700 rounded h-5 w-32 inline-block" />
              ) : (
                customerName
              )}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {call.fromNumber || call.toNumber || 'No number'}
            </span>
          </div>
        </div>

        {/* Center: Duration + Status */}
        <div className="flex items-center gap-4">
          {/* Live duration */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-semibold text-gray-900 dark:text-white">
              {formatDuration(duration)}
            </span>
          </div>

          {/* Status badge */}
          {getStatusBadge()}
        </div>

        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onHold}
            className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
          >
            <PauseIcon />
            <span className="ml-1 hidden sm:inline">Hold</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={onTransfer}
            className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <ArrowRightIcon />
            <span className="ml-1 hidden sm:inline">Transfer</span>
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={onEnd}
          >
            <PhoneXIcon />
            <span className="ml-1 hidden sm:inline">End Call</span>
          </Button>
        </div>
      </div>
    </header>
  );
}

export default CallHeader;
