'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileDown, Loader2, Phone, Mail, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
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
import PropertyInspectionCard from './PropertyInspectionCard';
import type { RenewalComparisonDetail, RenewalNote } from './types';
import type { CheckResult } from '@/types/check-rules.types';

interface RenewalDetailPageProps {
  renewalId: string;
}

export default function RenewalDetailPage({ renewalId }: RenewalDetailPageProps) {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id;
  const userName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : undefined;

  const [detail, setDetail] = useState<RenewalComparisonDetail | null>(null);
  const [notes, setNotes] = useState<RenewalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);

  // Fetch full detail
  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/renewals/${renewalId}`);
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
  }, [renewalId]);

  // Fetch notes
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/renewals/${renewalId}/notes`);
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
  }, [renewalId]);

  useEffect(() => {
    fetchDetail();
    fetchNotes();
  }, [fetchDetail, fetchNotes]);

  // Handle agent decision
  const handleDecision = async (decision: string, decisionNotes: string) => {
    try {
      if (!userId) {
        toast.error('User profile not loaded — please refresh the page');
        return;
      }
      const res = await fetch(`/api/renewals/${renewalId}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          notes: decisionNotes,
          userId,
          userName,
        }),
      });
      if (!res.ok && res.status !== 409) {
        toast.error('Failed to record decision');
        return;
      }
      const data = await res.json();

      if (data.success) {
        toast.success(`Decision recorded: ${decision.replace(/_/g, ' ')}`);
        await fetchDetail();
        await fetchNotes();
      } else if (res.status === 409) {
        toast.error('Decision already recorded by another agent');
        await fetchDetail();
      } else {
        toast.error(data.error || 'Failed to record decision');
      }
    } catch (err) {
      console.error('Error recording decision:', err);
      toast.error('Failed to record decision');
    }
  };

  // Handle add note
  const handleAddNote = async (content: string) => {
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/renewals/${renewalId}/notes`, {
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
    setCheckResults(prev =>
      prev.map(r =>
        r.ruleId === ruleId && r.field === field
          ? { ...r, reviewed, reviewedBy: reviewed ? (userName || userId || null) : null, reviewedAt: reviewed ? new Date().toISOString() : null }
          : r
      )
    );

    try {
      const res = await fetch(`/api/renewals/${renewalId}/check-review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId, reviewed, reviewedBy: userName || userId }),
      });
      if (!res.ok) {
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
    window.open(`/api/renewals/${renewalId}/report`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <p className="text-lg font-medium">Renewal not found</p>
        <button
          onClick={() => router.push('/renewal-review')}
          className="mt-4 text-emerald-600 hover:text-emerald-700 text-sm flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Renewals
        </button>
      </div>
    );
  }

  const current = detail;
  const premiumChange = current.premiumChangePercent ?? 0;
  const checkSummary = current.checkSummary ?? null;
  const comparisonSummary = current.comparisonSummary ?? null;
  const materialChanges = current.materialChanges || [];

  // Review progress
  const reviewable = checkResults.filter(r => r.severity !== 'unchanged');
  const reviewedCount = reviewable.filter(r => r.reviewed).length;
  const reviewProgress = reviewable.length > 0
    ? Math.round((reviewedCount / reviewable.length) * 100)
    : 100;

  // Claims from snapshots
  const claims = detail.renewalSnapshot?.claims || detail.baselineSnapshot?.claims || [];

  // Discounts
  const renewalDiscounts = detail.renewalSnapshot?.discounts || [];
  const baselineDiscounts = detail.baselineSnapshot?.discounts || [];

  // Property context
  const propertyContext = detail.baselineSnapshot?.propertyContext;

  const premiumColor =
    premiumChange < 0
      ? 'text-green-600 dark:text-green-400'
      : premiumChange <= 5
        ? 'text-yellow-600 dark:text-yellow-400'
        : premiumChange <= 15
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-red-600 dark:text-red-400';

  const fmtPremium = (val: number | null | undefined) =>
    val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-';

  return (
    <div className="-my-6 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* ==================== HEADER ==================== */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        {/* Back link */}
        <button
          onClick={() => router.push('/renewal-review')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-3 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Renewals
        </button>

        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {current.customerName || 'Unknown Customer'}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-base text-gray-500 dark:text-gray-400">
              <span>{current.policyNumber}</span>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span>{current.carrierName || 'Unknown Carrier'}</span>
              {current.lineOfBusiness && (
                <>
                  <span className="text-gray-300 dark:text-gray-600">|</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-sm">
                    {current.lineOfBusiness}
                  </span>
                </>
              )}
            </div>
            {/* Customer Contact */}
            {(current.customerPhone || current.customerEmail) && (
              <div className="flex items-center gap-4 mt-2 text-sm">
                {current.customerPhone && (
                  <a
                    href={`tel:${current.customerPhone}`}
                    className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {current.customerPhone}
                  </a>
                )}
                {current.customerEmail && (
                  <a
                    href={`mailto:${current.customerEmail}`}
                    className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {current.customerEmail}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Premium flow */}
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
      <div className="h-[calc(100vh-16rem)] flex flex-col lg:flex-row">
        {/* ============ LEFT COLUMN (260px) ============ */}
        <div className="lg:w-[260px] lg:shrink-0 lg:border-r border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-800">
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
              {detail.renewalSnapshot?.insuredName && (
                <p className="font-medium">{detail.renewalSnapshot.insuredName}</p>
              )}
              {detail.renewalSnapshot?.insuredAddress && (
                <p>{detail.renewalSnapshot.insuredAddress}</p>
              )}
              {(detail.renewalSnapshot?.insuredCity || detail.renewalSnapshot?.insuredState) && (
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
                {propertyContext.squareFeet && <p>Sq Ft: {propertyContext.squareFeet.toLocaleString()}</p>}
                {propertyContext.constructionType && <p>Construction: {propertyContext.constructionType}</p>}
                {propertyContext.roofType && <p>Roof: {propertyContext.roofType}</p>}
                {propertyContext.roofAge != null && <p>Roof Age: {propertyContext.roofAge} years</p>}
              </div>
            </div>
          )}

          {/* Mortgagees */}
          {((detail.renewalSnapshot?.mortgagees || []).length > 0 || (detail.baselineSnapshot?.mortgagees || []).length > 0) && (
            <div>
              <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2">
                Mortgagees
              </h4>
              <div className="space-y-2">
                {[...(detail.renewalSnapshot?.mortgagees || []), ...(detail.baselineSnapshot?.mortgagees || [])]
                  .filter((m, i, arr) => arr.findIndex(x => x.name === m.name) === i)
                  .map((m) => (
                    <div key={m.name} className="text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center gap-1.5">
                        {m.type && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                            {m.type.replace('_', ' ')}
                          </span>
                        )}
                        <span className="font-medium">{m.name}</span>
                      </div>
                      {m.loanNumber && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Loan: {m.loanNumber}
                        </p>
                      )}
                    </div>
                  ))}
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-gray-50 dark:bg-gray-900">
          {/* Talk Points — moved here from right column for prominence */}
          <TalkPoints
            checkResults={checkResults}
            materialChanges={materialChanges}
            comparisonSummary={comparisonSummary}
          />

          {/* Property Inspection (home policies only) */}
          <PropertyInspectionCard
            renewalId={renewalId}
            lineOfBusiness={current.lineOfBusiness ?? null}
          />

          {/* Baseline status banners */}
          {!detail.baselineSnapshot && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                No baseline policy found — comparison data unavailable. Premium change shown is renewal-only.
              </p>
            </div>
          )}
          {comparisonSummary?.baselineStatus === 'current_term' && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Baseline was captured from current term — changes may not reflect prior term differences.
              </p>
            </div>
          )}

          {/* 0. Premium Change Summary */}
          <PremiumChangeSummary
            checkResults={checkResults}
            materialChanges={materialChanges}
            renewalSnapshot={detail.renewalSnapshot ?? null}
            baselineSnapshot={detail.baselineSnapshot ?? null}
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
            renewalSnapshot={detail.renewalSnapshot ?? null}
            baselineSnapshot={detail.baselineSnapshot ?? null}
          />

          {/* 3. Claims & Violations Aging */}
          {claims.length > 0 && (
            <ClaimsAgingSection claims={claims} />
          )}

          {/* 4. Deductibles */}
          <DeductiblesSection
            renewalSnapshot={detail.renewalSnapshot ?? null}
            baselineSnapshot={detail.baselineSnapshot ?? null}
          />

          {/* 5. Discounts */}
          <DiscountPills discounts={renewalDiscounts} baselineDiscounts={baselineDiscounts} />

          {/* 6. Review Action Bar */}
          <ReviewActionBar
            renewalId={renewalId}
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
        <div className="lg:w-[300px] lg:shrink-0 lg:border-l border-gray-200 dark:border-gray-700 overflow-y-auto p-4 space-y-4 bg-white dark:bg-gray-800">
          {/* Review Progress */}
          <ReviewProgress
            checkSummary={checkSummary}
            checkResults={checkResults}
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
    </div>
  );
}
