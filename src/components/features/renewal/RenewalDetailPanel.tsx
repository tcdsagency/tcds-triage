'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, FileDown, Loader2, Phone, Mail, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import AZStatusBadge from './AZStatusBadge';
import NotesPanel from './NotesPanel';
import ReviewProgress from './ReviewProgress';
import TalkPoints from './TalkPoints';
import ReasonsForChange from './ReasonsForChange';
import CoverageComparisonTable from './CoverageComparisonTable';
import ClaimsAgingSection from './ClaimsAgingSection';
import DeductiblesSection from './DeductiblesSection';
import DiscountPills from './DiscountPills';
import ReviewActionBar from './ReviewActionBar';
import PremiumChangeSummary from './PremiumChangeSummary';
import type { RenewalComparison, RenewalComparisonDetail, RenewalNote } from './types';
import type { CheckResult } from '@/types/check-rules.types';

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
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);

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
        setCheckResults(data.renewal.checkResults || []);
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
    setCheckResults([]);
    fetchDetail();
    fetchNotes();
  }, [fetchDetail, fetchNotes]);

  // Handle agent decision
  const handleDecision = async (decision: string, decisionNotes: string) => {
    await onDecision(renewal.id, decision, decisionNotes);
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

  // Handle check review toggle (optimistic update + PATCH)
  const handleCheckReview = async (ruleId: string, field: string, reviewed: boolean) => {
    // Optimistic update
    setCheckResults(prev =>
      prev.map(r =>
        r.ruleId === ruleId && r.field === field
          ? { ...r, reviewed, reviewedBy: reviewed ? (userName || userId || null) : null, reviewedAt: reviewed ? new Date().toISOString() : null }
          : r
      )
    );

    try {
      const res = await fetch(`/api/renewals/${renewal.id}/check-review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, reviewed, reviewedBy: userName || userId }),
      });
      if (!res.ok) {
        // Revert on failure
        setCheckResults(prev =>
          prev.map(r =>
            r.ruleId === ruleId && r.field === field
              ? { ...r, reviewed: !reviewed, reviewedBy: null, reviewedAt: null }
              : r
          )
        );
        toast.error('Failed to update review status');
      }
    } catch {
      // Revert on error
      setCheckResults(prev =>
        prev.map(r =>
          r.ruleId === ruleId && r.field === field
            ? { ...r, reviewed: !reviewed, reviewedBy: null, reviewedAt: null }
            : r
        )
      );
      toast.error('Failed to update review status');
    }
  };

  // Download PDF report
  const handleDownloadReport = () => {
    window.open(`/api/renewals/${renewal.id}/report`, '_blank');
  };

  // Use detail (fetched) as source of truth once loaded, fall back to list-level prop
  const current = detail ?? renewal;

  const premiumChange = current.premiumChangePercent ?? 0;
  const checkSummary = detail?.checkSummary ?? current.checkSummary ?? null;
  const comparisonSummary = current.comparisonSummary ?? null;
  const materialChanges = current.materialChanges || [];

  // Compute review progress from live checkResults state
  const reviewable = checkResults.filter(r => r.severity !== 'unchanged');
  const reviewedCount = reviewable.filter(r => r.reviewed).length;
  const reviewProgress = reviewable.length > 0
    ? Math.round((reviewedCount / reviewable.length) * 100)
    : 100;

  // Collect claims from snapshots for aging tracker
  const claims = detail?.renewalSnapshot?.claims || detail?.baselineSnapshot?.claims || [];

  // Collect discounts for pills
  const renewalDiscounts = detail?.renewalSnapshot?.discounts || [];

  // Property context for left column
  const propertyContext = detail?.baselineSnapshot?.propertyContext;

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

      {/* Panel — max-w-7xl */}
      <div className="relative w-full max-w-7xl mx-4 mt-8 mb-8 max-h-[calc(100vh-4rem)] bg-white dark:bg-gray-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* ==================== HEADER ==================== */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {renewal.customerName || 'Unknown Customer'}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-base text-gray-500 dark:text-gray-400">
                <span>{renewal.policyNumber}</span>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span>{renewal.carrierName || 'Unknown Carrier'}</span>
                {renewal.lineOfBusiness && (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">|</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-sm">
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
                      <Phone className="h-4 w-4" />
                      {renewal.customerPhone}
                    </a>
                  )}
                  {renewal.customerEmail && (
                    <a
                      href={`mailto:${renewal.customerEmail}`}
                      className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <Mail className="h-4 w-4" />
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

          {/* Premium flow — prominent */}
          <div className="flex items-center justify-between mt-3">
            <AZStatusBadge
              status={current.status}
              agencyzoomSrId={current.agencyzoomSrId}
            />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-xs uppercase text-gray-400 block">Current</span>
                <span className="text-base text-gray-500 dark:text-gray-400">
                  {fmtPremium(current.currentPremium)}
                </span>
              </div>
              <span className="text-gray-400 text-lg">&rarr;</span>
              <div className="text-right">
                <span className="text-xs uppercase text-gray-400 block">Renewal</span>
                <span className={cn('text-xl font-bold', premiumColor)}>
                  {fmtPremium(current.renewalPremium)}
                </span>
              </div>
              {current.premiumChangeAmount != null && (
                <span className={cn('text-base font-semibold px-2 py-1 rounded-md', premiumColor,
                  premiumChange < 0 ? 'bg-green-50 dark:bg-green-900/20' :
                  premiumChange <= 5 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                  premiumChange <= 15 ? 'bg-orange-50 dark:bg-orange-900/20' :
                  'bg-red-50 dark:bg-red-900/20'
                )}>
                  {premiumChange > 0 ? '+' : ''}{premiumChange.toFixed(1)}% ({premiumChange > 0 ? '+' : ''}${Math.abs(current.premiumChangeAmount).toFixed(0)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ==================== BODY — 3-column ==================== */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="h-full flex flex-col lg:flex-row">
              {/* ============ LEFT COLUMN (260px) ============ */}
              <div className="lg:w-[260px] lg:shrink-0 lg:border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-4">
                {/* Policy Details */}
                <div>
                  <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                    Policy Details
                  </h4>
                  <div className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
                    {current.carrierName && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Carrier</span>
                        <span className="font-medium">{current.carrierName}</span>
                      </div>
                    )}
                    {current.lineOfBusiness && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">LOB</span>
                        <span className="font-medium">{current.lineOfBusiness}</span>
                      </div>
                    )}
                    {current.policyNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Policy #</span>
                        <span className="font-medium">{current.policyNumber}</span>
                      </div>
                    )}
                    {current.renewalEffectiveDate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Effective</span>
                        <span className="font-medium">
                          {new Date(current.renewalEffectiveDate).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Customer Info */}
                <div>
                  <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                    Customer
                  </h4>
                  <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                    {detail?.renewalSnapshot?.insuredName && (
                      <p className="font-medium">{detail.renewalSnapshot.insuredName}</p>
                    )}
                    {detail?.renewalSnapshot?.insuredAddress && (
                      <p>{detail.renewalSnapshot.insuredAddress}</p>
                    )}
                    {(detail?.renewalSnapshot?.insuredCity || detail?.renewalSnapshot?.insuredState) && (
                      <p>
                        {[detail.renewalSnapshot.insuredCity, detail.renewalSnapshot.insuredState, detail.renewalSnapshot.insuredZip]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Property Details (homeowners only) */}
                {propertyContext && (
                  <div>
                    <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                      Property
                    </h4>
                    <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      {propertyContext.yearBuilt && <p>Built: {propertyContext.yearBuilt}</p>}
                      {propertyContext.constructionType && <p>Construction: {propertyContext.constructionType}</p>}
                      {propertyContext.roofType && <p>Roof: {propertyContext.roofType}</p>}
                      {propertyContext.roofAge != null && <p>Roof Age: {propertyContext.roofAge} years</p>}
                    </div>
                  </div>
                )}

                {/* AZ Status (compact) */}
                <div>
                  <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                    AZ Status
                  </h4>
                  <AZStatusBadge
                    status={current.status}
                    agencyzoomSrId={current.agencyzoomSrId}
                    compact
                  />
                </div>

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
              </div>

              {/* ============ CENTER COLUMN (flex-1, scrolls) ============ */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* AI Summary Banner */}
                {comparisonSummary?.headline && (
                  <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-indigo-500 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-semibold text-indigo-800 dark:text-indigo-200">
                        AI Summary
                      </h3>
                      <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                        {comparisonSummary.headline}
                      </p>
                      <div className="flex gap-4 mt-2 text-sm text-indigo-600 dark:text-indigo-400">
                        {comparisonSummary.materialNegativeCount > 0 && (
                          <span>{comparisonSummary.materialNegativeCount} concern{comparisonSummary.materialNegativeCount !== 1 ? 's' : ''}</span>
                        )}
                        {comparisonSummary.materialPositiveCount > 0 && (
                          <span>{comparisonSummary.materialPositiveCount} improvement{comparisonSummary.materialPositiveCount !== 1 ? 's' : ''}</span>
                        )}
                        {comparisonSummary.nonMaterialCount > 0 && (
                          <span>{comparisonSummary.nonMaterialCount} minor</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 0. Premium Change Summary */}
                <PremiumChangeSummary
                  checkResults={checkResults}
                  materialChanges={materialChanges}
                  renewalSnapshot={detail?.renewalSnapshot ?? null}
                  baselineSnapshot={detail?.baselineSnapshot ?? null}
                  premiumChangePercent={current.premiumChangePercent ?? null}
                  premiumChangeAmount={current.premiumChangeAmount ?? null}
                  lineOfBusiness={current.lineOfBusiness ?? null}
                />

                {/* 1. Reasons for Premium Change */}
                {checkResults.length > 0 && (
                  <ReasonsForChange
                    checkResults={checkResults}
                    checkSummary={checkSummary}
                    onReviewToggle={handleCheckReview}
                  />
                )}

                {/* 2. Coverage Comparison Table */}
                <CoverageComparisonTable
                  renewalSnapshot={detail?.renewalSnapshot ?? null}
                  baselineSnapshot={detail?.baselineSnapshot ?? null}
                />

                {/* 3. Claims & Violations Aging */}
                {claims.length > 0 && (
                  <ClaimsAgingSection claims={claims} />
                )}

                {/* 4. Deductibles */}
                <DeductiblesSection
                  renewalSnapshot={detail?.renewalSnapshot ?? null}
                  baselineSnapshot={detail?.baselineSnapshot ?? null}
                />

                {/* 5. Discounts */}
                {renewalDiscounts.length > 0 && (
                  <DiscountPills discounts={renewalDiscounts} />
                )}

                {/* 6. Review Action Bar */}
                <ReviewActionBar
                  renewalId={renewal.id}
                  currentDecision={current.agentDecision}
                  status={current.status}
                  onDecision={handleDecision}
                  reviewProgress={reviewProgress}
                  reviewedCount={reviewedCount}
                  totalReviewable={reviewable.length}
                />

                {/* 7. Notes Panel */}
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <NotesPanel
                    notes={notes}
                    onAddNote={handleAddNote}
                    loading={notesLoading}
                  />
                </div>
              </div>

              {/* ============ RIGHT COLUMN (300px) ============ */}
              <div className="lg:w-[300px] lg:shrink-0 lg:border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-4">
                {/* Review Progress */}
                <ReviewProgress
                  checkSummary={checkSummary}
                  checkResults={checkResults}
                />

                {/* Talk Points for Customer */}
                <TalkPoints
                  checkResults={checkResults}
                  materialChanges={materialChanges}
                  comparisonSummary={comparisonSummary}
                />

                {/* Download Report */}
                <button
                  onClick={handleDownloadReport}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-base"
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
