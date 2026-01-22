'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { ServiceTicketItem } from '@/app/api/service-pipeline/route';
import { SERVICE_RESOLUTIONS } from '@/lib/api/agencyzoom-service-tickets';

// Resolution options
const RESOLUTION_OPTIONS = [
  { id: SERVICE_RESOLUTIONS.STANDARD, name: 'Standard' },
  { id: SERVICE_RESOLUTIONS.SPECIAL, name: 'Special' },
];

interface CompleteTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CompleteTicketFormData) => Promise<void>;
  ticket: ServiceTicketItem;
  isLoading?: boolean;
}

export interface CompleteTicketFormData {
  resolutionId: number;
  resolutionDesc: string;
  cancelRelatedTasks: boolean;
}

export default function CompleteTicketModal({
  isOpen,
  onClose,
  onSubmit,
  ticket,
  isLoading = false,
}: CompleteTicketModalProps) {
  const [resolutionId, setResolutionId] = useState<number>(SERVICE_RESOLUTIONS.STANDARD);
  const [resolutionDesc, setResolutionDesc] = useState('');
  const [cancelRelatedTasks, setCancelRelatedTasks] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      resolutionId,
      resolutionDesc: resolutionDesc.trim(),
      cancelRelatedTasks,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-green-500 to-emerald-600">
          <h2 className="text-lg font-bold text-white">Complete Service Ticket</h2>
          <p className="text-sm text-green-100 mt-1 line-clamp-1">
            {ticket.subject}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Ticket Info */}
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Customer:</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ticket.customerName || 'Unknown'}
                </span>
              </div>
              {ticket.categoryName && (
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500 dark:text-gray-400">Category:</span>
                  <span className="text-gray-700 dark:text-gray-300">{ticket.categoryName}</span>
                </div>
              )}
            </div>

            {/* Resolution */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resolution <span className="text-red-500">*</span>
              </label>
              <select
                value={resolutionId}
                onChange={(e) => setResolutionId(parseInt(e.target.value))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {RESOLUTION_OPTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Resolution Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resolution Notes
              </label>
              <textarea
                value={resolutionDesc}
                onChange={(e) => setResolutionDesc(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                placeholder="Describe how this was resolved..."
              />
            </div>

            {/* Cancel Related Tasks */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={cancelRelatedTasks}
                onChange={(e) => setCancelRelatedTasks(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Cancel related tasks
              </span>
            </label>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'px-6 py-2 rounded-lg font-medium text-white transition-colors',
                isLoading
                  ? 'bg-green-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              )}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin">⏳</span>
                  Completing...
                </span>
              ) : (
                'Complete Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
