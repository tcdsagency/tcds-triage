'use client';

/**
 * Personalization Banner Component
 * ================================
 * Displays a summary of personalization context at the top of the Agent Assist panel.
 * Shows preferred name, communication preferences, sentiment, and customer tenure.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { PersonalContext } from '@/lib/claude/context/note-extractor';

// =============================================================================
// ICONS
// =============================================================================

const UserIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const AlertCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

export interface PersonalizationBannerProps {
  customerName: string;
  preferredName?: string;
  yearsAsCustomer?: number;
  communicationPrefs: string[];
  sentiment: PersonalContext['sentiment'];
  pendingItemsCount: number;
  lifeEventsCount: number;
  authorizedContacts: string[];
  isCompact?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function PersonalizationBanner({
  customerName,
  preferredName,
  yearsAsCustomer,
  communicationPrefs,
  sentiment,
  pendingItemsCount,
  lifeEventsCount,
  authorizedContacts,
  isCompact = false,
}: PersonalizationBannerProps) {
  const displayName = preferredName || customerName.split(' ')[0] || 'Customer';
  const hasPersonalContext = preferredName || communicationPrefs.length > 0 || pendingItemsCount > 0 || lifeEventsCount > 0;

  // Sentiment styling
  const getSentimentStyle = () => {
    switch (sentiment) {
      case 'positive':
        return {
          bg: 'bg-green-50 dark:bg-green-900/20',
          border: 'border-green-200 dark:border-green-800',
          icon: <HeartIcon />,
          iconColor: 'text-green-600 dark:text-green-400',
          label: 'Positive',
        };
      case 'at-risk':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          border: 'border-red-200 dark:border-red-800',
          icon: <AlertCircleIcon />,
          iconColor: 'text-red-600 dark:text-red-400',
          label: 'At-Risk',
        };
      default:
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          border: 'border-blue-200 dark:border-blue-800',
          icon: <UserIcon />,
          iconColor: 'text-blue-600 dark:text-blue-400',
          label: 'Neutral',
        };
    }
  };

  const sentimentStyle = getSentimentStyle();

  if (isCompact) {
    return (
      <div className={`px-3 py-2 ${sentimentStyle.bg} ${sentimentStyle.border} border-b flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className={sentimentStyle.iconColor}>{sentimentStyle.icon}</span>
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {preferredName ? `"${preferredName}"` : displayName}
          </span>
          {yearsAsCustomer !== undefined && yearsAsCustomer > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              • {yearsAsCustomer}yr customer
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {pendingItemsCount > 0 && (
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pendingItemsCount} pending
            </Badge>
          )}
          {communicationPrefs.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {communicationPrefs.length} pref
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg ${sentimentStyle.bg} ${sentimentStyle.border} border p-3 space-y-3`}>
      {/* Header with name and sentiment */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={sentimentStyle.iconColor}>{sentimentStyle.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              {preferredName ? (
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  "{preferredName}"
                </span>
              ) : (
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {displayName}
                </span>
              )}
              {preferredName && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({customerName})
                </span>
              )}
            </div>
            {yearsAsCustomer !== undefined && yearsAsCustomer > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                <ClockIcon />
                {yearsAsCustomer} year{yearsAsCustomer !== 1 ? 's' : ''} as customer
              </span>
            )}
          </div>
        </div>
        <Badge
          className={
            sentiment === 'positive'
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : sentiment === 'at-risk'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }
        >
          {sentimentStyle.label}
        </Badge>
      </div>

      {/* Communication Preferences */}
      {communicationPrefs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Communication Needs
          </p>
          <div className="flex flex-wrap gap-1">
            {communicationPrefs.map((pref, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-white dark:bg-gray-800">
                {pref}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
        {pendingItemsCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            {pendingItemsCount} pending item{pendingItemsCount !== 1 ? 's' : ''}
          </span>
        )}
        {lifeEventsCount > 0 && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            {lifeEventsCount} life event{lifeEventsCount !== 1 ? 's' : ''}
          </span>
        )}
        {authorizedContacts.length > 0 && (
          <span className="flex items-center gap-1">
            <PhoneIcon />
            {authorizedContacts.length} authorized
          </span>
        )}
      </div>

      {/* No personalization hint */}
      {!hasPersonalContext && (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          No personalization context extracted yet. Add notes with customer details to enable.
        </p>
      )}
    </div>
  );
}

export default PersonalizationBanner;
