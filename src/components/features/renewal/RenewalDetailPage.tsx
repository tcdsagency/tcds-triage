'use client';

import React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useRenewalDetail } from '@/hooks/useRenewalDetail';
import StickyHeader from './StickyHeader';
import FixedBottomBar from './FixedBottomBar';
import LeftSidebar from './LeftSidebar';
import CenterColumn from './CenterColumn';
import RightSidebar from './RightSidebar';

interface RenewalDetailPageProps {
  renewalId: string;
}

// Error boundary to catch rendering crashes
class RenewalErrorBoundary extends React.Component<
  { children: React.ReactNode; renewalId: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; renewalId: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[RenewalDetailPage] Render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <p className="text-lg font-medium">Something went wrong loading this renewal</p>
          <p className="text-sm text-gray-400 mt-1">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="text-emerald-600 hover:text-emerald-700 text-sm"
            >
              Try Again
            </button>
            <a
              href="/renewal-review"
              className="text-emerald-600 hover:text-emerald-700 text-sm flex items-center gap-1"
            >
              Back to Renewals
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function RenewalDetailPage({ renewalId }: RenewalDetailPageProps) {
  return (
    <RenewalErrorBoundary renewalId={renewalId}>
      <RenewalDetailPageInner renewalId={renewalId} />
    </RenewalErrorBoundary>
  );
}

function RenewalDetailPageInner({ renewalId }: RenewalDetailPageProps) {
  const {
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
    isHome,
    premiumChange,
    checkSummary,
    comparisonSummary,
    materialChanges,
    claims,
    renewalDiscounts,
    baselineDiscounts,
    allMortgagees,
    quotamationUrl,
    reviewedCount,
    totalReviewable,
    reviewProgress,
    handleDecision,
    handleAddNote,
    handleCheckReview,
    handleDownloadReport,
    fetchDetail,
    router,
  } = useRenewalDetail(renewalId);

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

  return (
    <div className="-my-6 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Sticky Header */}
      <StickyHeader
        detail={detail}
        premiumChange={premiumChange}
        onBack={() => router.push('/renewal-review')}
        onDownloadReport={handleDownloadReport}
      />

      {/* 3-Column Layout */}
      <div className="h-[calc(100vh-10rem)] flex flex-col lg:flex-row">
        {/* Left Sidebar */}
        <LeftSidebar
          detail={detail}
          isHome={isHome}
          allMortgagees={allMortgagees}
          mciPaymentData={mciPaymentData}
          customerPolicies={customerPolicies}
        />

        {/* Center Column */}
        <CenterColumn
          detail={detail}
          renewalId={renewalId}
          checkResults={checkResults}
          checkSummary={checkSummary}
          comparisonSummary={comparisonSummary}
          materialChanges={materialChanges}
          claims={claims}
          renewalDiscounts={renewalDiscounts}
          baselineDiscounts={baselineDiscounts}
          isHome={isHome}
          onReviewToggle={handleCheckReview}
          verificationLoading={verificationLoading}
          publicData={publicData}
          riskData={riskData}
          verificationSources={verificationSources}
          onRefresh={fetchDetail}
        />

        {/* Right Sidebar */}
        <RightSidebar
          checkResults={checkResults}
          checkSummary={checkSummary}
          comparisonSummary={comparisonSummary}
          materialChanges={materialChanges}
          claims={claims}
          notes={notes}
          notesLoading={notesLoading}
          onAddNote={handleAddNote}
          customerPolicies={customerPolicies}
          reviewedCount={reviewedCount}
          totalReviewable={totalReviewable}
          detail={detail}
        />
      </div>

      {/* Fixed Bottom Bar */}
      <FixedBottomBar
        renewalId={renewalId}
        currentDecision={detail.agentDecision}
        status={detail.status}
        onDecision={handleDecision}
        reviewProgress={reviewProgress}
        reviewedCount={reviewedCount}
        totalReviewable={totalReviewable}
        materialChangesCount={materialChanges.length}
        quotamationUrl={quotamationUrl}
      />
    </div>
  );
}
