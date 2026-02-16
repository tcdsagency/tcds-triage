'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useUser } from '@/hooks/useUser';
import type { RenewalComparisonDetail, RenewalNote } from '@/components/features/renewal/types';
import type { CheckResult } from '@/types/check-rules.types';

function isHomeLob(lob: string | null): boolean {
  const l = (lob || '').toLowerCase();
  return l.includes('home') || l.includes('dwelling') ||
    l.includes('ho3') || l.includes('ho5') || l.includes('dp3');
}

export function useRenewalDetail(renewalId: string) {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id;
  const userName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : undefined;

  const [detail, setDetail] = useState<RenewalComparisonDetail | null>(null);
  const [notes, setNotes] = useState<RenewalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [mciPaymentData, setMciPaymentData] = useState<any>(null);
  const [customerPolicies, setCustomerPolicies] = useState<any[]>([]);
  const [publicData, setPublicData] = useState<Record<string, any> | null>(null);
  const [riskData, setRiskData] = useState<Record<string, any> | null>(null);
  const [verificationSources, setVerificationSources] = useState<{ rpr: boolean; propertyApi: boolean; nearmap: boolean; orion180: boolean } | null>(null);

  // Coverage-level review state (local only, not API-persisted)
  const [coverageReviewed, setCoverageReviewed] = useState<Set<string>>(new Set());

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
        setCheckResults(Array.isArray(data.renewal.checkResults) ? data.renewal.checkResults : []);
        if (data.mciPaymentData) setMciPaymentData(data.mciPaymentData);
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

  // Fetch customer policies
  useEffect(() => {
    if (!detail?.customerId) return;
    fetch(`/api/customers/${detail.customerId}/policies`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setCustomerPolicies(data.policies || []);
      })
      .catch(console.error);
  }, [detail?.customerId]);

  // Property verification (home policies only)
  useEffect(() => {
    if (!detail) return;
    if (!isHomeLob(detail.lineOfBusiness)) return;

    setVerificationLoading(true);
    fetch(`/api/renewals/${renewalId}/property-verification`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (data.verification?.checkResults?.length > 0) {
            setCheckResults(prev => {
              const nonPV = prev.filter((r: CheckResult) => !r.ruleId.startsWith('PV-'));
              return [...nonPV, ...data.verification.checkResults];
            });
          }
          if (data.verification?.publicData) {
            setPublicData(data.verification.publicData);
          }
          if (data.verification?.sources) {
            setVerificationSources(data.verification.sources);
          }
          if (data.verification?.riskData) {
            setRiskData(data.verification.riskData);
          }
        }
      })
      .catch(console.error)
      .finally(() => setVerificationLoading(false));
  }, [detail, renewalId]);

  // Handle agent decision
  const handleDecision = useCallback(async (decision: string, decisionNotes: string) => {
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
  }, [renewalId, userId, userName, fetchDetail, fetchNotes]);

  // Handle add note
  const handleAddNote = useCallback(async (content: string) => {
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
  }, [renewalId, userId, userName, fetchNotes]);

  // Handle check review toggle (optimistic update + PATCH)
  const handleCheckReview = useCallback(async (ruleId: string, field: string, reviewed: boolean) => {
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
  }, [renewalId, userName, userId]);

  // Toggle coverage-level review checkbox (local only)
  const handleCoverageReview = useCallback((key: string, reviewed: boolean) => {
    setCoverageReviewed(prev => {
      const next = new Set(prev);
      if (reviewed) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }, []);

  // Download PDF report
  const handleDownloadReport = useCallback(() => {
    window.open(`/api/renewals/${renewalId}/report`, '_blank');
  }, [renewalId]);

  // Derived values
  const isHome = detail ? isHomeLob(detail.lineOfBusiness) : false;
  const premiumChange = detail?.premiumChangePercent ?? 0;
  const checkSummary = detail?.checkSummary ?? null;
  const comparisonSummary = detail?.comparisonSummary ?? null;
  const materialChanges = useMemo(
    () => Array.isArray(detail?.materialChanges) ? detail!.materialChanges : [],
    [detail?.materialChanges]
  );

  // Review progress (check results + coverage level combined)
  const reviewable = useMemo(() => checkResults.filter(r => r.severity !== 'unchanged'), [checkResults]);
  const reviewedCount = useMemo(() => reviewable.filter(r => r.reviewed).length, [reviewable]);
  const totalCheckReviewable = reviewable.length;

  // Combined review progress
  const totalReviewable = totalCheckReviewable;
  const totalReviewed = reviewedCount;
  const reviewProgress = totalReviewable > 0
    ? Math.round((totalReviewed / totalReviewable) * 100)
    : 0;

  // Claims from snapshots
  const claims = useMemo(() => {
    if (detail?.renewalSnapshot && !Array.isArray(detail.renewalSnapshot.coverages)) {
      detail.renewalSnapshot.coverages = [];
    }
    if (detail?.baselineSnapshot && !Array.isArray(detail.baselineSnapshot.coverages)) {
      detail.baselineSnapshot.coverages = [];
    }
    return detail?.renewalSnapshot?.claims || detail?.baselineSnapshot?.claims || [];
  }, [detail]);

  // Discounts
  const renewalDiscounts = useMemo(() => detail?.renewalSnapshot?.discounts || [], [detail]);
  const baselineDiscounts = useMemo(() => detail?.baselineSnapshot?.discounts || [], [detail]);

  // Property context
  const propertyContext = detail?.baselineSnapshot?.propertyContext;

  // Mortgagees (deduplicated)
  const allMortgagees = useMemo(() =>
    [...(detail?.renewalSnapshot?.mortgagees || []), ...(detail?.baselineSnapshot?.mortgagees || [])]
      .filter((m, i, arr) => arr.findIndex(x => x.name === m.name) === i),
    [detail]
  );

  // Build Quotamation URL
  const quotamationUrl = useMemo(() => {
    if (!detail) return undefined;
    const snap = detail.renewalSnapshot;
    if (!snap?.insuredName) return undefined;
    const nameParts = snap.insuredName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const lob = (detail.lineOfBusiness || '').toLowerCase().includes('auto') ? 'auto' : 'home';
    const params = new URLSearchParams();
    if (firstName) params.set('firstName', firstName);
    if (lastName) params.set('lastName', lastName);
    if (snap.insuredAddress) params.set('address', snap.insuredAddress);
    if (snap.insuredCity) params.set('city', snap.insuredCity);
    if (snap.insuredState) params.set('state', snap.insuredState);
    if (snap.insuredZip) params.set('zip', snap.insuredZip);
    params.set('lob', lob);
    if (detail.carrierName) params.set('currentCarrier', detail.carrierName);
    if (detail.renewalPremium) params.set('currentPremium', String(detail.renewalPremium));
    return `https://quote.quotamation.com/direct-quote/TCDSInsuranceAgency?${params.toString()}`;
  }, [detail]);

  return {
    // State
    detail,
    notes,
    loading,
    notesLoading,
    checkResults,
    verificationLoading,
    mciPaymentData,
    customerPolicies,
    publicData,
    riskData,
    verificationSources,
    coverageReviewed,

    // Derived
    isHome,
    premiumChange,
    checkSummary,
    comparisonSummary,
    materialChanges,
    claims,
    renewalDiscounts,
    baselineDiscounts,
    propertyContext,
    allMortgagees,
    quotamationUrl,

    // Review progress
    reviewable,
    reviewedCount,
    totalReviewable,
    totalReviewed,
    reviewProgress,

    // Actions
    handleDecision,
    handleAddNote,
    handleCheckReview,
    handleCoverageReview,
    handleDownloadReport,
    fetchDetail,
    router,
  };
}
