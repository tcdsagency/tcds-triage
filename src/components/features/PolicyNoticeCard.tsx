'use client';

import { cn } from '@/lib/utils';

export interface PolicyNotice {
  id: string;
  adaptNoticeId?: string | null;
  noticeType?: 'billing' | 'policy' | 'claim' | null;
  urgency?: 'low' | 'medium' | 'high' | 'urgent' | null;
  policyNumber?: string | null;
  insuredName?: string | null;
  carrier?: string | null;
  lineOfBusiness?: string | null;
  customerId?: string | null;
  policyId?: string | null;
  title: string;
  description?: string | null;
  amountDue?: string | null;
  dueDate?: string | null;
  gracePeriodEnd?: string | null;
  claimNumber?: string | null;
  claimDate?: string | null;
  claimStatus?: string | null;
  reviewStatus?: 'pending' | 'assigned' | 'reviewed' | 'actioned' | 'dismissed' | null;
  assignedToId?: string | null;
  assignedAt?: string | null;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  actionTaken?: string | null;
  zapierWebhookSent?: boolean | null;
  noticeDate?: string | null;
  createdAt: string;
  assignedTo?: { id: string; name: string } | null;
  customer?: { id: string; name: string; agencyZoomId?: number | null } | null;
}

interface PolicyNoticeCardProps {
  notice: PolicyNotice;
  isSelected?: boolean;
  onSelect?: () => void;
  onAction?: (action: 'assign' | 'review' | 'action' | 'dismiss' | 'send-zapier') => void;
}

const NOTICE_TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  billing: { icon: '💳', color: 'text-amber-600' },
  policy: { icon: '📄', color: 'text-blue-600' },
  claim: { icon: '⚠️', color: 'text-red-600' },
};

const URGENCY_CONFIG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  urgent: { label: 'Urgent', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  high: { label: 'High', bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  medium: { label: 'Medium', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  low: { label: 'Low', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  pending: { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-700', icon: '⏳' },
  assigned: { label: 'Assigned', bg: 'bg-blue-100', text: 'text-blue-700', icon: '👤' },
  reviewed: { label: 'Reviewed', bg: 'bg-purple-100', text: 'text-purple-700', icon: '✓' },
  actioned: { label: 'Actioned', bg: 'bg-green-100', text: 'text-green-700', icon: '✅' },
  dismissed: { label: 'Dismissed', bg: 'bg-gray-100', text: 'text-gray-500', icon: '✕' },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDaysUntilDue(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatCurrency(amount: string | null | undefined): string {
  if (!amount) return '';
  const num = parseFloat(amount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

export default function PolicyNoticeCard({ notice, isSelected, onSelect, onAction }: PolicyNoticeCardProps) {
  const typeConfig = NOTICE_TYPE_CONFIG[notice.noticeType || 'billing'] || NOTICE_TYPE_CONFIG.billing;
  const urgencyConfig = URGENCY_CONFIG[notice.urgency || 'medium'] || URGENCY_CONFIG.medium;
  const statusConfig = STATUS_CONFIG[notice.reviewStatus || 'pending'] || STATUS_CONFIG.pending;
  const daysUntilDue = getDaysUntilDue(notice.dueDate);

  return (
    <div
      onClick={onSelect}
      className={cn(
        'rounded-lg border p-4 transition-all cursor-pointer hover:shadow-md',
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-blue-300'
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={cn('text-lg', typeConfig.color)}>{typeConfig.icon}</span>
          <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full border', urgencyConfig.bg, urgencyConfig.text, urgencyConfig.border)}>
            {urgencyConfig.label}
          </span>
          <span className={cn('px-2 py-0.5 text-xs font-medium rounded-full', statusConfig.bg, statusConfig.text)}>
            {statusConfig.icon} {statusConfig.label}
          </span>
        </div>

        {notice.noticeType === 'billing' && notice.dueDate && daysUntilDue !== null && (
          <span className={cn('px-2 py-0.5 text-xs font-medium rounded',
            daysUntilDue < 0 ? 'bg-red-100 text-red-700' :
            daysUntilDue <= 3 ? 'bg-orange-100 text-orange-700' :
            'bg-gray-100 text-gray-700'
          )}>
            {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? 'Due today' : `Due in ${daysUntilDue}d`}
          </span>
        )}

        {notice.noticeType === 'claim' && notice.claimNumber && (
          <span className="px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">{notice.claimNumber}</span>
        )}
      </div>

      <h3 className="font-semibold text-gray-900 mb-1">{notice.title}</h3>

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <span className="font-medium">{notice.insuredName || 'Unknown'}</span>
        {notice.policyNumber && (<><span className="text-gray-400">•</span><span>{notice.policyNumber}</span></>)}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
        {notice.carrier && <span>{notice.carrier}</span>}
        {notice.carrier && notice.lineOfBusiness && <span className="text-gray-400">•</span>}
        {notice.lineOfBusiness && <span>{notice.lineOfBusiness}</span>}
      </div>

      {notice.noticeType === 'billing' && notice.amountDue && (
        <div className="flex items-center gap-2 text-sm mb-2">
          <span className="text-gray-600">Amount Due:</span>
          <span className="font-semibold text-gray-900">{formatCurrency(notice.amountDue)}</span>
        </div>
      )}

      {notice.customer && (
        <div className="flex items-center gap-2 text-xs mb-2">
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            Linked: {notice.customer.name}
            {notice.customer.agencyZoomId && ` (AZ#${notice.customer.agencyZoomId})`}
          </span>
        </div>
      )}

      {notice.assignedTo && (
        <div className="text-xs text-gray-500 mb-2">Assigned to: <span className="font-medium">{notice.assignedTo.name}</span></div>
      )}

      {notice.reviewNotes && (
        <div className="text-xs text-gray-500 mb-2 truncate">Note: {notice.reviewNotes}</div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-xs text-gray-400">{formatDate(notice.noticeDate || notice.createdAt)}</span>

        <div className="flex items-center gap-1">
          {notice.reviewStatus === 'pending' && onAction && (
            <button className="px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded" onClick={(e) => { e.stopPropagation(); onAction('assign'); }}>Assign</button>
          )}

          {(notice.reviewStatus === 'assigned' || notice.reviewStatus === 'reviewed') && onAction && (
            <button className="px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 rounded" onClick={(e) => { e.stopPropagation(); onAction('action'); }}>Take Action</button>
          )}

          {notice.reviewStatus === 'actioned' && !notice.zapierWebhookSent && onAction && (
            <button className="px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded" onClick={(e) => { e.stopPropagation(); onAction('send-zapier'); }}>Send to Zapier</button>
          )}

          {notice.zapierWebhookSent && (
            <span className="px-2 py-1 text-xs text-green-600">Sent to AZ</span>
          )}

          {notice.reviewStatus !== 'dismissed' && notice.reviewStatus !== 'actioned' && onAction && (
            <button className="px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded" onClick={(e) => { e.stopPropagation(); onAction('dismiss'); }}>Dismiss</button>
          )}
        </div>
      </div>
    </div>
  );
}
