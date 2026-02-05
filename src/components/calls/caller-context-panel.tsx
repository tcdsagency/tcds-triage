'use client';

/**
 * Caller Context Panel Component
 *
 * Left sidebar showing customer information, policies, and detected entities.
 * Provides quick actions and links to external systems (AgencyZoom, HawkSoft).
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Customer, Policy } from '@/types';
import { buildZillowUrl } from '@/lib/utils/zillow';

// =============================================================================
// ICONS
// =============================================================================

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const PhoneIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
);

const MapPinIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
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

const ExternalLinkIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const CarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h8m-8 5h8m-4 4v-4m-6 4h12a2 2 0 002-2V8a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
  </svg>
);

const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const UmbrellaIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m-8-9h1m14 0h1m-2.636-6.364l-.707.707M6.343 6.343l-.707.707m12.728 12.728l-.707-.707M6.343 17.657l-.707-.707M12 5a7 7 0 017 7H5a7 7 0 017-7z" />
  </svg>
);

const HeartIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const DocumentIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

export interface DetectedEntity {
  type: 'vin' | 'policy_number' | 'dollar_amount' | 'date' | 'phone' | 'email' | 'address' | 'name';
  value: string;
  confidence: number;
}

interface CallerContextPanelProps {
  customer: Customer | null;
  policies: Policy[];
  detectedEntities: DetectedEntity[];
  callId: string;
  isLoading?: boolean;
  onQuickAction?: (action: 'add_vehicle' | 'add_driver' | 'new_quote' | 'schedule_call') => void;
}

// =============================================================================
// HELPER: Get initials
// =============================================================================

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// =============================================================================
// HELPER: Get policy icon and color
// =============================================================================

function getPolicyDisplay(type: string): { icon: React.ReactNode; color: string; label: string } {
  const lowerType = type?.toLowerCase() || '';

  if (lowerType.includes('auto') || lowerType.includes('vehicle') || lowerType.includes('car')) {
    return { icon: <CarIcon />, color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30', label: 'Auto' };
  }
  if (lowerType.includes('home') || lowerType.includes('dwelling') || lowerType.includes('property')) {
    return { icon: <HomeIcon />, color: 'text-green-600 bg-green-100 dark:bg-green-900/30', label: 'Home' };
  }
  if (lowerType.includes('umbrella') || lowerType.includes('excess')) {
    return { icon: <UmbrellaIcon />, color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30', label: 'Umbrella' };
  }
  if (lowerType.includes('life')) {
    return { icon: <HeartIcon />, color: 'text-red-600 bg-red-100 dark:bg-red-900/30', label: 'Life' };
  }

  return { icon: <DocumentIcon />, color: 'text-gray-600 bg-gray-100 dark:bg-gray-700', label: type || 'Policy' };
}

// =============================================================================
// HELPER: Get entity badge style
// =============================================================================

function getEntityStyle(type: DetectedEntity['type']): { color: string; label: string } {
  switch (type) {
    case 'vin':
      return { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'VIN' };
    case 'policy_number':
      return { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Policy #' };
    case 'dollar_amount':
      return { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: '$' };
    case 'date':
      return { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', label: 'Date' };
    case 'phone':
      return { color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', label: 'Phone' };
    case 'email':
      return { color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400', label: 'Email' };
    case 'address':
      return { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Address' };
    case 'name':
      return { color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', label: 'Name' };
    default:
      return { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', label: type };
  }
}

// =============================================================================
// COLLAPSIBLE SECTION COMPONENT
// =============================================================================

function CollapsibleSection({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{title}</span>
        <div className="flex items-center gap-2">
          {count !== undefined && (
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          )}
          {isOpen ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </div>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CallerContextPanel({
  customer,
  policies,
  detectedEntities,
  callId,
  isLoading,
  onQuickAction,
}: CallerContextPanelProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  // Copy to clipboard handler
  const copyToClipboard = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setTimeout(() => setCopiedValue(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Customer display values
  const customerName = customer
    ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
    : 'Unknown Caller';

  const isExistingCustomer = customer && (customer.hawksoftClientCode || customer.agencyzoomId);

  // Build address string
  const addressParts = [
    customer?.address?.street,
    customer?.address?.city,
    customer?.address?.state,
    customer?.address?.zip,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

  return (
    <aside className="w-80 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
      {/* Customer Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Avatar + Name */}
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                {customerName !== 'Unknown Caller' ? getInitials(customerName) : <UserIcon />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 dark:text-white truncate">
                  {customerName}
                </h2>
                <Badge
                  variant={isExistingCustomer ? 'default' : 'secondary'}
                  className={
                    isExistingCustomer
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }
                >
                  {isExistingCustomer ? 'Existing Customer' : 'New Prospect'}
                </Badge>
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-2">
              {customer?.phone && (
                <div className="flex items-center justify-between group">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <PhoneIcon />
                    <span>{customer.phone}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(customer.phone!)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                    title="Copy phone"
                  >
                    {copiedValue === customer.phone ? (
                      <span className="text-xs text-green-600">Copied!</span>
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                </div>
              )}

              {fullAddress && (
                <div className="flex items-center justify-between group">
                  <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <MapPinIcon />
                    <span className="line-clamp-2">{fullAddress}</span>
                    {(() => {
                      const zUrl = buildZillowUrl({ street: customer?.address?.street, city: customer?.address?.city, state: customer?.address?.state, zip: customer?.address?.zip });
                      return zUrl ? (
                        <a href={zUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 flex-shrink-0" title="View on Zillow">
                          <svg className="w-3.5 h-3.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : null;
                    })()}
                  </div>
                  <button
                    onClick={() => copyToClipboard(fullAddress)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex-shrink-0"
                    title="Copy address"
                  >
                    {copiedValue === fullAddress ? (
                      <span className="text-xs text-green-600">Copied!</span>
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* External Links */}
            {(customer?.agencyzoomId || customer?.hawksoftClientCode) && (
              <div className="flex gap-2 mt-3">
                {customer.agencyzoomId && (
                  <a
                    href={`https://app.agencyzoom.com/customer/index?id=${customer.agencyzoomId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    AgencyZoom <ExternalLinkIcon />
                  </a>
                )}
                {customer.hawksoftClientCode && (
                  <a
                    href={`hawksoft://client/${customer.hawksoftClientCode}`}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 transition-colors"
                  >
                    HawkSoft <ExternalLinkIcon />
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Policies Section */}
      <CollapsibleSection title="Policies" count={policies.length} defaultOpen={true}>
        {policies.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">No policies on file</p>
        ) : (
          <div className="space-y-2">
            {policies.map((policy) => {
              const display = getPolicyDisplay(policy.lineOfBusiness || '');
              return (
                <div
                  key={policy.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${display.color}`}>
                    {display.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {display.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {policy.policyNumber || 'No policy number'}
                    </p>
                  </div>
                  <Badge
                    variant={policy.status === 'active' ? 'default' : 'secondary'}
                    className={
                      policy.status === 'active'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs'
                        : 'text-xs'
                    }
                  >
                    {policy.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Detected Entities Section */}
      <CollapsibleSection
        title="Detected Entities"
        count={detectedEntities.length}
        defaultOpen={detectedEntities.length > 0}
      >
        {detectedEntities.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Entities will appear as they&apos;re detected in the conversation
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {detectedEntities.map((entity, idx) => {
              const style = getEntityStyle(entity.type);
              return (
                <button
                  key={`${entity.type}-${idx}`}
                  onClick={() => copyToClipboard(entity.value)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all hover:scale-105 ${style.color}`}
                  title={`Click to copy: ${entity.value}`}
                >
                  <span className="font-semibold">{style.label}:</span>
                  <span className="max-w-[100px] truncate">{entity.value}</span>
                  {copiedValue === entity.value && (
                    <span className="text-green-600 dark:text-green-400 ml-1">Copied!</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Quick Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-xs"
            onClick={() => onQuickAction?.('add_vehicle')}
          >
            <CarIcon />
            <span className="ml-1">Add Vehicle</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-xs"
            onClick={() => onQuickAction?.('add_driver')}
          >
            <UserIcon />
            <span className="ml-1">Add Driver</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-xs"
            onClick={() => onQuickAction?.('new_quote')}
          >
            <PlusIcon />
            <span className="ml-1">New Quote</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-xs"
            onClick={() => onQuickAction?.('schedule_call')}
          >
            <CalendarIcon />
            <span className="ml-1">Schedule</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}

export default CallerContextPanel;
