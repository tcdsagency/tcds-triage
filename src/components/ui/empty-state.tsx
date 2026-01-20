'use client';

/**
 * Empty State Component
 * ====================
 * A reusable component for displaying helpful empty states
 * with icons, titles, descriptions, and actions.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';

// =============================================================================
// ICONS
// =============================================================================

const defaultIcons = {
  customers: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  calls: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  messages: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  quotes: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  policies: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  tasks: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  alerts: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  search: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  error: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  inbox: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
  ),
  document: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  default: () => (
    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  ),
};

export type EmptyStateIconType = keyof typeof defaultIcons;

// =============================================================================
// TYPES
// =============================================================================

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  icon?: React.ReactNode;
}

export interface EmptyStateProps {
  /** The icon to display - can be a preset name or custom React node */
  icon?: EmptyStateIconType | React.ReactNode;
  /** Title text */
  title: string;
  /** Description text */
  description?: string;
  /** Primary action button */
  action?: EmptyStateAction;
  /** Secondary action button */
  secondaryAction?: EmptyStateAction;
  /** Additional content to render below the actions */
  children?: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

// =============================================================================
// SIZE CONFIGS
// =============================================================================

const sizeConfig = {
  sm: {
    padding: 'py-6 px-4',
    iconWrapper: 'mb-2',
    iconScale: 'scale-75',
    title: 'text-sm font-medium',
    description: 'text-xs',
    buttonSize: 'sm' as const,
    gap: 'space-y-2',
  },
  md: {
    padding: 'py-8 px-6',
    iconWrapper: 'mb-4',
    iconScale: 'scale-100',
    title: 'text-base font-semibold',
    description: 'text-sm',
    buttonSize: 'default' as const,
    gap: 'space-y-4',
  },
  lg: {
    padding: 'py-12 px-8',
    iconWrapper: 'mb-6',
    iconScale: 'scale-125',
    title: 'text-lg font-semibold',
    description: 'text-base',
    buttonSize: 'lg' as const,
    gap: 'space-y-6',
  },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function EmptyState({
  icon = 'default',
  title,
  description,
  action,
  secondaryAction,
  children,
  size = 'md',
  className,
}: EmptyStateProps) {
  const config = sizeConfig[size];

  // Determine icon to render
  const renderIcon = () => {
    if (typeof icon === 'string' && icon in defaultIcons) {
      const IconComponent = defaultIcons[icon as EmptyStateIconType];
      return (
        <div className={cn(
          'text-gray-400 dark:text-gray-500',
          config.iconScale
        )}>
          <IconComponent />
        </div>
      );
    }
    return icon;
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        config.padding,
        config.gap,
        className
      )}
    >
      {/* Icon */}
      <div className={config.iconWrapper}>
        {renderIcon()}
      </div>

      {/* Text */}
      <div className="space-y-1">
        <h3 className={cn('text-gray-900 dark:text-white', config.title)}>
          {title}
        </h3>
        {description && (
          <p className={cn('text-gray-500 dark:text-gray-400 max-w-sm mx-auto', config.description)}>
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant={action.variant || 'default'}
              size={config.buttonSize}
              leftIcon={action.icon}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant={secondaryAction.variant || 'ghost'}
              size={config.buttonSize}
              leftIcon={secondaryAction.icon}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}

      {/* Additional content */}
      {children}
    </div>
  );
}

// =============================================================================
// PRESET EMPTY STATES
// =============================================================================

export function NoCustomersEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon="customers"
      title="No customers yet"
      description="Get started by adding your first customer. Customers are the heart of your agency!"
      action={{
        label: 'Add Customer',
        onClick: onAdd,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
      }}
    />
  );
}

export function NoCallsEmptyState() {
  return (
    <EmptyState
      icon="calls"
      title="No calls recorded"
      description="Call activity will appear here once calls come in through the phone system."
    />
  );
}

export function NoMessagesEmptyState() {
  return (
    <EmptyState
      icon="messages"
      title="No messages"
      description="Your inbox is empty. Messages from customers will appear here."
    />
  );
}

export function NoPendingReviewEmptyState() {
  return (
    <EmptyState
      icon="inbox"
      title="All caught up!"
      description="No items pending review. Great job staying on top of your queue!"
    />
  );
}

export function NoQuotesEmptyState({ onCreateQuote }: { onCreateQuote: () => void }) {
  return (
    <EmptyState
      icon="quotes"
      title="No quotes yet"
      description="Start building your pipeline by creating your first insurance quote."
      action={{
        label: 'Create Quote',
        onClick: onCreateQuote,
        icon: (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        ),
      }}
    />
  );
}

export function NoSearchResultsEmptyState({ query, onClear }: { query: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon="search"
      title={`No results for "${query}"`}
      description="Try adjusting your search terms or check for typos."
      action={onClear ? {
        label: 'Clear Search',
        onClick: onClear,
        variant: 'outline',
      } : undefined}
    />
  );
}

export function NoAlertsEmptyState() {
  return (
    <EmptyState
      icon="alerts"
      title="No active alerts"
      description="Property risk alerts will appear here when detected."
    />
  );
}

export function ErrorEmptyState({
  title = 'Something went wrong',
  description = 'An error occurred while loading this content.',
  onRetry
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon="error"
      title={title}
      description={description}
      action={onRetry ? {
        label: 'Try Again',
        onClick: onRetry,
        variant: 'outline',
      } : undefined}
    />
  );
}

export function NoTasksEmptyState() {
  return (
    <EmptyState
      icon="tasks"
      title="No tasks assigned"
      description="Tasks will appear here when assigned to you."
    />
  );
}

export default EmptyState;
