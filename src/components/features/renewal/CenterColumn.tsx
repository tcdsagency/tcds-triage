'use client';

import { Info, Loader2 } from 'lucide-react';
import PremiumChangeSummary from './PremiumChangeSummary';
import ReasonsForChange from './ReasonsForChange';
import CoverageComparisonTable from './CoverageComparisonTable';
import DeductiblesSection from './DeductiblesSection';
import DiscountPills from './DiscountPills';
import ClaimsAgingSection from './ClaimsAgingSection';
import AIAnalysisSection from './AIAnalysisSection';
import PropertyViewerCard from './PropertyViewerCard';
import PublicRecordsCard from './PublicRecordsCard';
import RenewalPdfUpload from './RenewalPdfUpload';
import type { RenewalComparisonDetail } from './types';
import type { CheckResult, CheckSummary } from '@/types/check-rules.types';
import type { MaterialChange, ComparisonSummary, CanonicalClaim } from '@/types/renewal.types';

interface CenterColumnProps {
  detail: RenewalComparisonDetail;
  renewalId: string;
  checkResults: CheckResult[];
  checkSummary: CheckSummary | null;
  comparisonSummary: ComparisonSummary | null;
  materialChanges: MaterialChange[];
  claims: CanonicalClaim[];
  renewalDiscounts: any[];
  baselineDiscounts: any[];
  isHome: boolean;
  onReviewToggle: (ruleId: string, field: string, reviewed: boolean) => Promise<void>;
  // Property verification
  verificationLoading: boolean;
  publicData: Record<string, any> | null;
  riskData: Record<string, any> | null;
  verificationSources: { rpr: boolean; propertyApi: boolean; nearmap: boolean; orion180: boolean } | null;
  // Refresh callback for PDF upload flow
  onRefresh?: () => void;
}

export default function CenterColumn({
  detail,
  renewalId,
  checkResults,
  checkSummary,
  comparisonSummary,
  materialChanges,
  claims,
  renewalDiscounts,
  baselineDiscounts,
  isHome,
  onReviewToggle,
  verificationLoading,
  publicData,
  riskData,
  verificationSources,
  onRefresh,
}: CenterColumnProps) {
  const isPendingManualRenewal = detail.status === 'pending_manual_renewal';

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-gray-50 pb-24">
      <div className="p-5 space-y-5 max-w-4xl mx-auto">
        {/* PDF Upload Section for non-AL3 renewals */}
        {isPendingManualRenewal && (
          <RenewalPdfUpload
            renewalId={renewalId}
            hasRenewalSnapshot={!!detail.renewalSnapshot}
            onUploadComplete={() => onRefresh?.()}
            onComparisonComplete={() => onRefresh?.()}
          />
        )}

        {/* AI Analysis */}
        <AIAnalysisSection
          comparisonSummary={comparisonSummary}
          materialChanges={materialChanges}
        />

        {/* Premium Change Summary */}
        <PremiumChangeSummary
          checkResults={checkResults}
          materialChanges={materialChanges}
          renewalSnapshot={detail.renewalSnapshot ?? null}
          baselineSnapshot={detail.baselineSnapshot ?? null}
          premiumChangePercent={detail.premiumChangePercent ?? null}
          premiumChangeAmount={detail.premiumChangeAmount ?? null}
          lineOfBusiness={detail.lineOfBusiness ?? null}
        />

        {/* Baseline status banners */}
        {!detail.baselineSnapshot && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              No baseline policy found — comparison data unavailable. Premium change shown is renewal-only.
            </p>
          </div>
        )}
        {comparisonSummary?.baselineStatus === 'current_term' && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              Baseline was captured from current term — changes may not reflect prior term differences.
            </p>
          </div>
        )}

        {/* Reasons for Change */}
        {checkResults.length > 0 && (
          <ReasonsForChange
            checkResults={checkResults}
            checkSummary={checkSummary}
            onReviewToggle={onReviewToggle}
          />
        )}

        {/* Coverage Comparison */}
        <CoverageComparisonTable
          renewalSnapshot={detail.renewalSnapshot ?? null}
          baselineSnapshot={detail.baselineSnapshot ?? null}
        />

        {/* Deductibles */}
        <DeductiblesSection
          renewalSnapshot={detail.renewalSnapshot ?? null}
          baselineSnapshot={detail.baselineSnapshot ?? null}
        />

        {/* Discounts */}
        <DiscountPills discounts={renewalDiscounts} baselineDiscounts={baselineDiscounts} />

        {/* Claims */}
        {claims.length > 0 && (
          <ClaimsAgingSection claims={claims} />
        )}

        {/* Property Viewer + Public Records (home policies) */}
        {isHome && (
          <>
            <PropertyViewerCard
              renewalId={renewalId}
              lineOfBusiness={detail.lineOfBusiness ?? null}
              address={{
                street: detail.renewalSnapshot?.insuredAddress,
                city: detail.renewalSnapshot?.insuredCity,
                state: detail.renewalSnapshot?.insuredState,
                zip: detail.renewalSnapshot?.insuredZip,
              }}
            />

            {verificationLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying property against public records...
              </div>
            )}

            <PublicRecordsCard
              publicData={publicData}
              riskData={riskData}
              sources={verificationSources}
              lineOfBusiness={detail.lineOfBusiness ?? null}
            />
          </>
        )}
      </div>
    </div>
  );
}
