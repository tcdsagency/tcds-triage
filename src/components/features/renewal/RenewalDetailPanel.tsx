'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, AlertTriangle, TrendingUp, TrendingDown, Minus, FileDown, Loader2, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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
      if (!res.ok) {
        console.error('Detail fetch error:', res.status);
        return;
      }
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
      if (!res.ok) {
        console.error('Notes fetch error:', res.status);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    }
  }, [renewal.id]);

  // Clear stale data immediately when switching renewals, then fetch fresh
  useEffect(() => {
    setDetail(null);
    setNotes([]);
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
      if (!res.ok) {
        console.error('Note post error:', res.status);
        toast.error('Failed to save note');
        return;
      }
      const data = await res.json();
      if (data.success) {
        await fetchNotes();
      } else {
        toast.error(data.error || 'Failed to save note');
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

  // Use detail (fetched) as source of truth once loaded, fall back to list-level prop
  const current = detail ?? renewal;

  const premiumChange = current.premiumChangePercent ?? 0;
  const materialChanges = current.materialChanges || [];
  const materialNegCount = Array.isArray(materialChanges)
    ? materialChanges.filter((c) => c.severity === 'material_negative').length
    : 0;

  const premiumColor =
    premiumChange < 0
      ? 'text-green-600 dark:text-green-400'
      : premiumChange <= 5
        ? 'text-yellow-600 dark:text-yellow-400'
        : premiumChange <= 15
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-red-600 dark:text-red-400';

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fmtPremium = (val: number | null | undefined) =>
    val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-5xl mx-4 mt-8 mb-8 max-h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {renewal.customerName || 'Unknown Customer'}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span>{renewal.policyNumber}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{renewal.carrierName || 'Unknown Carrier'}</span>
                {renewal.lineOfBusiness && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                      {renewal.lineOfBusiness}
                    </span>
                  </>
                )}
              </div>
              {/* Customer Contact */}
              {(renewal.customerPhone || renewal.customerEmail) && (
                <div className="flex items-center gap-4 mt-2 text-sm">
                  {renewal.customerPhone && (
                    <a
                      href={`tel:${renewal.customerPhone}`}
                      className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {renewal.customerPhone}
                    </a>
                  )}
                  {renewal.customerEmail && (
                    <a
                      href={`mailto:${renewal.customerEmail}`}
                      className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      {renewal.customerEmail}
                    </a>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* AZ Status + Premium Summary — side by side */}
          <div className="flex items-center justify-between mt-3">
            <AZStatusBadge
              status={current.status}
              agencyzoomSrId={current.agencyzoomSrId}
            />
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {fmtPremium(current.currentPremium)}
              </span>
              <span className="text-gray-400">→</span>
              <span className={cn('text-lg font-bold', premiumColor)}>
                {fmtPremium(current.renewalPremium)}
              </span>
              {current.premiumChangeAmount != null && (
                <span className={cn('text-sm font-semibold', premiumColor)}>
                  ({premiumChange > 0 ? '+' : ''}${Math.abs(current.premiumChangeAmount).toFixed(0)}, {premiumChange > 0 ? '+' : ''}{premiumChange.toFixed(1)}%)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="p-5 space-y-5">

            {/* Material Changes Alert */}
            {materialNegCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">
                    {materialNegCount} Material Concern{materialNegCount > 1 ? 's' : ''} Detected
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {materialChanges
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
            {current.agentDecision && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                <h4 className="text-xs font-medium text-indigo-500 dark:text-indigo-400 uppercase mb-1">
                  Agent Decision
                </h4>
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  {current.agentDecision.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                {current.agentDecisionByName && (
                  <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                    by {current.agentDecisionByName}
                    {current.agentDecisionAt &&
                      ` on ${new Date(current.agentDecisionAt).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`}
                  </p>
                )}
                {current.agentNotes && (
                  <p className="text-sm text-indigo-600 dark:text-indigo-300 mt-2 italic">
                    &ldquo;{current.agentNotes}&rdquo;
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
                materialChanges={materialChanges}
                renewalEffectiveDate={current.renewalEffectiveDate}
                carrierName={current.carrierName}
                policyNumber={current.policyNumber}
                lineOfBusiness={current.lineOfBusiness}
                comparisonSummary={current.comparisonSummary}
              />
            </div>

            {/* Action Buttons */}
            {(!current.agentDecision || current.agentDecision === 'needs_more_info' || current.agentDecision === 'contact_customer' || current.agentDecision === 'reshop') && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Actions
                </h4>
                <AgentActionButtons
                  renewalId={renewal.id}
                  currentDecision={current.agentDecision}
                  status={current.status}
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
    </div>
  );
}
