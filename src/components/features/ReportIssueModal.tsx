'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { PendingItem } from './PendingItemCard';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PendingItem;
  lastError?: string;
}

const ISSUE_TYPES = [
  { value: 'match_failed', label: 'Customer match failed' },
  { value: 'wrong_customer', label: 'Matched to wrong customer' },
  { value: 'missing_data', label: 'Missing or incorrect data' },
  { value: 'action_failed', label: 'Action failed (note/ticket/etc)' },
  { value: 'display_issue', label: 'Display or UI issue' },
  { value: 'other', label: 'Other issue' },
];

export default function ReportIssueModal({
  isOpen,
  onClose,
  item,
  lastError,
}: ReportIssueModalProps) {
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [corrections, setCorrections] = useState({
    correctCustomerName: '',
    correctPhone: '',
    correctEmail: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);
  const [showCorrections, setShowCorrections] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!issueType) {
      toast.error('Please select an issue type');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/reported-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: item.type,
          itemId: item.id,
          issueType,
          description,
          userCorrections: showCorrections ? corrections : null,
          errorMessage: lastError,
          requestPayload: {
            matchStatus: item.matchStatus,
            contactName: item.contactName,
            contactPhone: item.contactPhone,
            contactEmail: item.contactEmail,
            agencyzoomCustomerId: item.agencyzoomCustomerId,
            agencyzoomLeadId: item.agencyzoomLeadId,
            summary: item.summary,
            timestamp: item.timestamp,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Issue reported successfully');
        onClose();
      } else {
        toast.error(data.error || 'Failed to report issue');
      }
    } catch (err) {
      console.error('Report issue error:', err);
      toast.error('Failed to report issue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-amber-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🐛</span>
              <h2 className="text-lg font-semibold text-gray-900">
                Report Issue
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Help us fix this issue by providing details below
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Item Info */}
          <div className="p-3 bg-gray-50 rounded-lg text-sm">
            <div className="font-medium text-gray-700 mb-1">Item Details:</div>
            <div className="text-gray-600 space-y-0.5">
              <div>Type: {item.type}</div>
              <div>Contact: {item.contactName || item.contactPhone || 'Unknown'}</div>
              <div>Status: {item.matchStatus}</div>
              {item.agencyzoomCustomerId && <div>AZ Customer ID: {item.agencyzoomCustomerId}</div>}
              {item.agencyzoomLeadId && <div>AZ Lead ID: {item.agencyzoomLeadId}</div>}
            </div>
          </div>

          {/* Last Error */}
          {lastError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="font-medium text-red-700 text-sm mb-1">Last Error:</div>
              <div className="text-red-600 text-xs font-mono break-all">{lastError}</div>
            </div>
          )}

          {/* Issue Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              What type of issue occurred? *
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            >
              <option value="">Select issue type...</option>
              {ISSUE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Describe the issue
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened? What did you expect to happen?"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Corrections Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowCorrections(!showCorrections)}
              className="text-sm text-amber-600 hover:text-amber-700 font-medium"
            >
              {showCorrections ? '▼' : '▶'} Add corrections (optional)
            </button>
          </div>

          {/* Corrections Form */}
          {showCorrections && (
            <div className="space-y-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="text-sm font-medium text-amber-700 mb-2">
                What should the correct information be?
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Correct Customer Name</label>
                <input
                  type="text"
                  value={corrections.correctCustomerName}
                  onChange={(e) => setCorrections({ ...corrections, correctCustomerName: e.target.value })}
                  placeholder="e.g., John Smith"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Correct Phone</label>
                <input
                  type="text"
                  value={corrections.correctPhone}
                  onChange={(e) => setCorrections({ ...corrections, correctPhone: e.target.value })}
                  placeholder="e.g., (205) 555-1234"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Correct Email</label>
                <input
                  type="email"
                  value={corrections.correctEmail}
                  onChange={(e) => setCorrections({ ...corrections, correctEmail: e.target.value })}
                  placeholder="e.g., john@example.com"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Additional Notes</label>
                <textarea
                  value={corrections.notes}
                  onChange={(e) => setCorrections({ ...corrections, notes: e.target.value })}
                  placeholder="Any other corrections or details..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !issueType}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              loading || !issueType
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-amber-600 text-white hover:bg-amber-700'
            )}
          >
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
