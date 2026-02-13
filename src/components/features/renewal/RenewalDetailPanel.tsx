'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, TrendingUp, TrendingDown, Minus, FileDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import AZStatusBadge from './AZStatusBadge';
import ComparisonTable from './ComparisonTable';
import AgentActionButtons from './AgentActionButtons';
import NotesPanel from './NotesPanel';
import type { RenewalComparison, RenewalComparisonDetail, RenewalNote } from './types';
import type { RenewalSnapshot, BaselineSnapshot, MaterialChange } from '@/types/renewal.types';

interface RenewalDetailPanelProps {
  renewal: RenewalComparison;
  onClose: () => void;
  onDecision: (renewalId: string, decision: string, notes: string) => Promise<void>;
  onRefresh: () => void;
  userId?: string;
  userName?: string;
}

export default function RenewalDetailPanel({
  renewal,
  onClose,
  onDecision,
  onRefresh,
  userId,
  userName,
}: RenewalDetailPanelProps) {
  const [detail, setDetail] = useState<RenewalComparisonDetail | null>(null);
  const [notes, setNotes] = useState<RenewalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);

  // Fetch full detail
  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/renewals/${renewal.id}`);
      const data = await res.json();
      if (data.success) {
        setDetail(data.renewal);
      }
    } catch (err) {
      console.error('Error fetching renewal detail:', err);
    } finally {
      setLoading(false);
    }
  }, [renewal.id]);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/renewals/${renewal.id}/notes`);
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
  }, [renewal.id]);

  useEffect(() => {
    fetchDetail();
    fetchNotes();
  }, [fetchDetail, fetchNotes]);

  // Handle agent decision
  const handleDecision = async (decision: string, decisionNotes: string) => {
    await onDecision(renewal.id, decision, decisionNotes);
    // Refresh detail and notes after decision
    await fetchDetail();
    await fetchNotes();
    onRefresh();
  };

  // Handle add note
  const handleAddNote = async (content: string) => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/renewals/${renewal.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, userId, userName }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchNotes();
      }
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setNotesLoading(false);
    }
  };

  // Download PDF report
  const handleDownloadReport = () => {
    window.open(`/api/renewals/${renewal.id}/report`, '_blank');
  };

  const premiumChange = renewal.premiumChangePercent ?? 0;
  const materialNegCount = Array.isArray(renewal.materialChanges)
    ? renewal.materialChanges.filter((c) => c.severity === 'material_negative').length
    : 0;

  const premiumColor =
    premiumChange < 0
      ? 'text-green-600 dark:text-green-400'
      : premiumChange <= 5
        ? 'text-yellow-600 dark:text-yellow-400'
        : premiumChange <= 15
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-red-600 dark:text-red-400';

  return (
    <div className="w-[480px] bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate pr-2">
            {renewal.customerName || 'Unknown Customer'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <span>{renewal.policyNumber}</span>
          <span>-</span>
          <span>{renewal.carrierName}</span>
          {renewal.lineOfBusiness && (
            <>
              <span>-</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                {renewal.lineOfBusiness}
              </span>
            </>
          )}
        </div>

        {/* AZ Status */}
        <div className="mt-3">
          <AZStatusBadge
            status={renewal.status}
            agencyzoomSrId={renewal.agencyzoomSrId}
          />
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {/* Premium Summary */}
            <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
                Premium Change
              </h4>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {premiumChange > 0 ? (
                    <TrendingUp className={cn('h-5 w-5', premiumColor)} />
                  ) : premiumChange < 0 ? (
                    <TrendingDown className={cn('h-5 w-5', premiumColor)} />
                  ) : (
                    <Minus className="h-5 w-5 text-gray-400" />
                  )}
                  <span className={cn('text-xl font-bold', premiumColor)}>
                    {premiumChange > 0 ? '+' : ''}
                    {premiumChange.toFixed(1)}%
                  </span>
                </div>
                {renewal.premiumChangeAmount != null && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    ({premiumChange > 0 ? '+' : ''}$
                    {Math.abs(renewal.premiumChangeAmount).toFixed(0)})
                  </span>
                )}
                <div className="ml-auto text-right text-sm">
                  <div className="text-gray-500 dark:text-gray-400">
                    {renewal.currentPremium != null
                      ? `$${renewal.currentPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '-'}
                  </div>
                  <div className={cn('font-medium', premiumColor)}>
                    {renewal.renewalPremium != null
                      ? `$${renewal.renewalPremium.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                      : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Material Changes Alert */}
            {materialNegCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    {materialNegCount} Material Concern{materialNegCount > 1 ? 's' : ''} Detected
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {renewal.materialChanges
                      .filter((c) => c.severity === 'material_negative')
                      .slice(0, 5)
                      .map((c, i) => (
                        <li key={i} className="text-xs text-red-600 dark:text-red-400">
                          {c.description || `${c.category}: ${c.field}`}
                        </li>
                      ))}
                    {materialNegCount > 5 && (
                      <li className="text-xs text-red-500 italic">
                        +{materialNegCount - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Agent Decision (if already decided) */}
            {renewal.agentDecision && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <h4 className="text-xs font-medium text-indigo-500 dark:text-indigo-400 uppercase mb-1">
                  Agent Decision
                </h4>
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {renewal.agentDecision.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                {renewal.agentDecisionByName && (
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                    by {renewal.agentDecisionByName}
                    {renewal.agentDecisionAt &&
                      ` on ${new Date(renewal.agentDecisionAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`}
                  </p>
                )}
                {renewal.agentNotes && (
                  <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-2 italic">
                    &ldquo;{renewal.agentNotes}&rdquo;
                  </p>
                )}
              </div>
            )}

            {/* Comparison Table */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Policy Comparison
              </h4>
              <ComparisonTable
                renewalSnapshot={detail?.renewalSnapshot ?? null}
                baselineSnapshot={detail?.baselineSnapshot ?? null}
                materialChanges={renewal.materialChanges || []}
                renewalEffectiveDate={renewal.renewalEffectiveDate}
                carrierName={renewal.carrierName}
                policyNumber={renewal.policyNumber}
                lineOfBusiness={renewal.lineOfBusiness}
                comparisonSummary={renewal.comparisonSummary}
              />
            </div>

            {/* Action Buttons */}
            {(!renewal.agentDecision || renewal.agentDecision === 'needs_more_info' || renewal.agentDecision === 'contact_customer') && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Actions
                </h4>
                <AgentActionButtons
                  renewalId={renewal.id}
                  currentDecision={renewal.agentDecision}
                  status={renewal.status}
                  onDecision={handleDecision}
                />
              </div>
            )}

            {/* Notes Panel */}
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <NotesPanel
                notes={notes}
                onAddNote={handleAddNote}
                loading={notesLoading}
              />
            </div>

            {/* Download Report */}
            <div className="pt-2">
              <button
                onClick={handleDownloadReport}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                <FileDown className="h-4 w-4" />
                Download Report
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
