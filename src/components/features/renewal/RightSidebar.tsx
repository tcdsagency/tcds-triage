'use client';

import ReviewProgress from './ReviewProgress';
import TalkPoints from './TalkPoints';
import WaysToSaveCard from './WaysToSaveCard';
import AIRecommendationsCard from './AIRecommendationsCard';
import EzlynxCard from './EzlynxCard';
import NotesPanel from './NotesPanel';
import type { RenewalNote } from './types';
import type { CheckResult, CheckSummary } from '@/types/check-rules.types';
import type { MaterialChange, ComparisonSummary, CanonicalClaim } from '@/types/renewal.types';
import { AgencyZoomLink, getAgencyZoomUrl } from '@/components/ui/agencyzoom-link';
import { HawkSoftLink } from '@/components/ui/hawksoft-link';
import { User } from 'lucide-react';

interface RightSidebarProps {
  checkResults: CheckResult[];
  checkSummary: CheckSummary | null;
  comparisonSummary: ComparisonSummary | null;
  materialChanges: MaterialChange[];
  claims: CanonicalClaim[];
  notes: RenewalNote[];
  notesLoading: boolean;
  onAddNote: (content: string) => Promise<void>;
  customerPolicies: any[];
  reviewedCount: number;
  totalReviewable: number;
  // Agent decision display
  detail: {
    agentDecision: string | null;
    agentDecisionByName?: string;
    agentDecisionAt?: string | null;
    agentNotes?: string | null;
  };
  // EZLynx integration (optional — passed when available)
  ezlynxAccountId?: string | null;
  ezlynxSyncedAt?: string | null;
  insuredName?: string;
  customerId?: string;
  renewalSnapshot?: any;
  lineOfBusiness?: string;
  customerProfile?: any;
  comparisonId?: string;
  agencyzoomId?: string | null;
  hawksoftClientCode?: string | null;
}

export default function RightSidebar({
  checkResults,
  checkSummary,
  comparisonSummary,
  materialChanges,
  claims,
  notes,
  notesLoading,
  onAddNote,
  customerPolicies,
  reviewedCount,
  totalReviewable,
  detail,
  ezlynxAccountId,
  ezlynxSyncedAt,
  insuredName,
  customerId,
  renewalSnapshot,
  lineOfBusiness,
  customerProfile,
  comparisonId,
  agencyzoomId,
  hawksoftClientCode,
}: RightSidebarProps) {
  return (
    <div className="lg:w-[320px] lg:shrink-0 overflow-y-auto p-3 space-y-3 bg-white border-l border-gray-200 pb-24">
      {/* Review Progress */}
      <ReviewProgress
        checkSummary={checkSummary}
        checkResults={checkResults}
        materialChangesCount={materialChanges.length}
        overrideReviewed={reviewedCount}
        overrideTotal={totalReviewable}
      />

      {/* Ways to Save */}
      <WaysToSaveCard checkResults={checkResults} claims={claims} />

      {/* AI Recommendations / Cross-Sell */}
      <AIRecommendationsCard policies={customerPolicies} />

      {/* External Links */}
      {(agencyzoomId || hawksoftClientCode || true) && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Profiles</h4>
          <div className="flex items-center gap-3">
            {agencyzoomId && (
              <AgencyZoomLink href={getAgencyZoomUrl(agencyzoomId, 'customer')} size="sm" />
            )}
            {hawksoftClientCode && (
              <HawkSoftLink clientCode={hawksoftClientCode} showText size="sm" />
            )}
            {customerId && (
              <a
                href={`/customers/${customerId}`}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <User className="h-3.5 w-3.5" />
                Profile
              </a>
            )}
            {!agencyzoomId && !hawksoftClientCode && !customerId && (
              <p className="text-xs text-gray-400">No linked profiles</p>
            )}
          </div>
        </div>
      )}

      {/* EZLynx Integration */}
      <EzlynxCard
        ezlynxAccountId={ezlynxAccountId}
        ezlynxSyncedAt={ezlynxSyncedAt}
        insuredName={insuredName}
        customerId={customerId}
        renewalSnapshot={renewalSnapshot}
        lineOfBusiness={lineOfBusiness}
        customerProfile={customerProfile}
        comparisonId={comparisonId}
      />

      {/* Talk Points */}
      <TalkPoints
        checkResults={checkResults}
        materialChanges={materialChanges}
        comparisonSummary={comparisonSummary}
      />

      {/* Agent Decision (if already decided) */}
      {detail.agentDecision && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <h4 className="text-xs font-medium text-indigo-500 uppercase mb-1">
            Agent Decision
          </h4>
          <p className="text-sm font-medium text-indigo-700">
            {detail.agentDecision.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
          {detail.agentDecisionByName && (
            <p className="text-xs text-indigo-500 mt-0.5">
              by {detail.agentDecisionByName}
              {detail.agentDecisionAt &&
                ` on ${new Date(detail.agentDecisionAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}`}
            </p>
          )}
          {detail.agentNotes && (
            <p className="text-sm text-indigo-600 mt-2 italic">
              &ldquo;{detail.agentNotes}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Notes Panel */}
      <NotesPanel
        notes={notes}
        onAddNote={onAddNote}
        loading={notesLoading}
      />
    </div>
  );
}
