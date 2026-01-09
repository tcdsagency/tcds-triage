'use client';

import { cn } from '@/lib/utils';

// =============================================================================
// TYPES
// =============================================================================

export interface PolicyNotice {
  id: string;
  adaptNoticeId: string | null;
  noticeType: 'billing' | 'policy' | 'claim' | null;
  urgency: 'low' | 'medium' | 'high' | 'urgent' | null;
  policyNumber: string | null;
  insuredName: string | null;
  carrier: string | null;
  lineOfBusiness: string | null;
  customerId: string | null;
  policyId: string | null;
  title: string;
  description: string | null;
  amountDue: string | null;
  dueDate: string | null;
  gracePeriodEnd: string | null;
  claimNumber: string | null;
  claimDate: string | null;
  claimStatus: string | null;
  reviewStatus: 'pending' | 'assigned' | 'reviewed' | 'actioned' | 'dismissed' | null;
  assignedToId: string | null;
  assignedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  actionTaken: string | null;
  zapierWebhookSent: boolean | null;
  noticeDate: string | null;
  createdAt: string;
  assignedTo?: { id: string; name: string } | null;
  customer?: { id: string; name: string; agencyZoomId: number | null } | null;
}

export interface PolicyNoticeCardProps {
  notice: PolicyNotice;
  isSelected?: boolean;
  onSelect?: () => void;
  onAction?: (action: 'assign' | 'review' | 'action' | 'dismiss' | 'send-zapier') => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const NOTICE_TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  billing: { label: 'Billing', icon: '💳', color: 'text-amber-600 dark:text-amber-400' },
  policy: { label: 'Policy', icon: '📄', color: 'text-blue-600 dark:text-blue-400' },
  claim: { label: 'Claim', icon: '⚠️', color: 'text-red-600 dark:text-red-400' },
};

const URGENCY_CONFIG: Record<string, {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  urgent: {
    label: 'Urgent',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    textColor: 'text-red-800 dark:text-red-200',
    borderColor: 'border-red-300 dark:border-red-700',
  },
  high: {
    label: 'High',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    textColor: 'text-orange-800 dark:text-orange-200',
    borderColor: 'border-orange-300 dark:border-orange-700',
  },
  medium: {
    label: 'Medium',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    textColor: 'text-yellow-800 dark:text-yellow-200',
    borderColor: 'border-yellow-300 dark:border-yellow-700',
  },
  low: {
    label: 'Low',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-800 dark:text-green-200',
    borderColor: 'border-green-300 dark:border-green-700',
  },
};

const STATUS_CONFIG: Record<string, {
  label: string;
  bgColor: string;
  textColor: string;
  icon: string;
}> = {
  pending: {
    label: 'Pending',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-700 dark:text-gray-300',
    icon: '⏳',
  },
  assigned: {
    label: 'Assigned',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    icon: '👤',
  },
  reviewed: {
    label: 'Reviewed',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    icon: '✓',
  },
  actioned: {
    label: 'Actioned',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    icon: '✅',
  },
  dismissed: {
    label: 'Dismissed',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    textColor: 'text-gray-500 dark:text-gray-400',
    icon: '✕',
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getDaysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount: string | null): string {
  if (!amount) return '';
  const num = parseFloat(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function PolicyNoticeCard({
  notice,
  isSelected = false,
  onSelect,
  onAction,
}: PolicyNoticeCardProps) {
  const typeConfig = NOTICE_TYPE_CONFIG[notice.noticeType || 'billing'];
  const urgencyConfig = URGENCY_CONFIG[notice.urgency || 'medium'];
  const statusConfig = STATUS_CONFIG[notice.reviewStatus || 'pending'];
  const daysUntilDue = getDaysUntilDue(notice.dueDate);

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-all cursor-pointer',
        'hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600',
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      )}
      onClick={onSelect}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Type Icon */}
          <span className={cn('text-lg', typeConfig.color)}>
            {typeConfig.icon}
          </span>

          {/* Urgency Badge */}
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full border',
              urgencyConfig.bgColor,
              urgencyConfig.textColor,
              urgencyConfig.borderColor
            )}
          >
            {urgencyConfig.label}
          </span>

          {/* Status Badge */}
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              statusConfig.bgColor,
              statusConfig.textColor
            )}
          >
            {statusConfig.icon} {statusConfig.label}
          </span>
        </div>

        {/* Due Date / Claim Badge */}
        {notice.noticeType === 'billing' && notice.dueDate && (
          <span
            className={cn(
              'px-2 py-0.5 text-xs font-medium rounded',
              daysUntilDue !== null && daysUntilDue < 0
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : daysUntilDue !== null && daysUntilDue <= 3
                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            )}
          >
            {daysUntilDue !== null && daysUntilDue < 0
              ? `${Math.abs(daysUntilDue)}d overdue`
              : daysUntilDue === 0
              ? 'Due today'
              : `Due in ${daysUntilDue}d`}
          </span>
        )}

        {notice.noticeType === 'claim' && notice.claimNumber && (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            {notice.claimNumber}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {notice.title}
      </h3>

      {/* Insured Name & Policy */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
        <span className="font-medium">{notice.insuredName || 'Unknown'}</span>
        {notice.policyNumber && (
          <>
            <span className="text-gray-400">•</span>
            <span>{notice.policyNumber}</span>
          </>
        )}
      </div>

      {/* Carrier & Line of Business */}
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
        {notice.carrier && <span>{notice.carrier}</span>}
        {notice.carrier && notice.lineOfBusiness && (
          <span className="text-gray-400">•</span>
        )}
        {notice.lineOfBusiness && <span>{notice.lineOfBusiness}</span>}
      </div>

      {/* Amount Due (for billing) */}
      {notice.noticeType === 'billing' && notice.amountDue && (
        <div className="flex items-center gap-2 text-sm mb-2">
          <span className="text-gray-600 dark:text-gray-400">Amount Due:</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(notice.amountDue)}
          </span>
        </div>
      )}

      {/* Customer Match Badge */}
      {notice.customer && (
        <div className="flex items-center gap-2 text-xs mb-2">
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            Linked: {notice.customer.name}
            {notice.customer.agencyZoomId && ` (AZ#${notice.customer.agencyZoomId})`}
          </span>
        </div>
      )}

      {/* Assigned To */}
      {notice.assignedTo && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <span>Assigned to:</span>
          <span className="font-medium">{notice.assignedTo.name}</span>
        </div>
      )}

      {/* Review Notes Preview */}
      {notice.reviewNotes && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 truncate">
          Note: {notice.reviewNotes}
        </div>
      )}

      {/* Footer Row - Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <span className="text-xs text-gray-400">
          {formatDate(notice.noticeDate || notice.createdAt)}
        </span>

        <div className="flex items-center gap-1">
          {/* Quick Actions */}
          {notice.reviewStatus === 'pending' && onAction && (
            <button
              className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onAction('assign');
              }}
            >
              Assign
            </button>
          )}

          {(notice.reviewStatus === 'assigned' || notice.reviewStatus === 'reviewed') && onAction && (
            <button
              className="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onAction('action');
              }}
            >
              Take Action
            </button>
          )}

          {notice.reviewStatus === 'actioned' && !notice.zapierWebhookSent && onAction && (
            <button
              className="px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-900/20 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onAction('send-zapier');
              }}
            >
              Send to Zapier
            </button>
          )}

          {notice.zapierWebhookSent && (
            <span className="px-2 py-1 text-xs text-green-600 dark:text-green-400">
              Sent to AZ
            </span>
          )}

          {notice.reviewStatus !== 'dismissed' && notice.reviewStatus !== 'actioned' && onAction && (
            <button
              className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 rounded"
              onClick={(e) => {
                e.stopPropagation();
                onAction('dismiss');
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
