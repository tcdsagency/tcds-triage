'use client';

import InsuredCard from './InsuredCard';
import PolicyDetailsCard from './PolicyDetailsCard';
import PropertyCard from './PropertyCard';
import VehiclesCard from './VehiclesCard';
import CustomerPoliciesSection from './CustomerPoliciesSection';
import type { RenewalComparisonDetail } from './types';

interface LeftSidebarProps {
  detail: RenewalComparisonDetail;
  isHome: boolean;
  allMortgagees: { name: string; type?: string; loanNumber?: string }[];
  mciPaymentData: any;
  customerPolicies: any[];
}

export default function LeftSidebar({
  detail,
  isHome,
  allMortgagees,
  mciPaymentData,
  customerPolicies,
}: LeftSidebarProps) {
  return (
    <div className="lg:w-[260px] lg:shrink-0 overflow-y-auto p-3 space-y-3 bg-gray-50 border-r border-gray-200">
      <InsuredCard detail={detail} snapshot={detail.renewalSnapshot} />
      <PolicyDetailsCard detail={detail} />

      {isHome && (
        <PropertyCard
          propertyContext={detail.baselineSnapshot?.propertyContext}
          mortgagees={allMortgagees}
          mciPaymentData={mciPaymentData}
          policyId={detail.policyId}
        />
      )}

      {!isHome && (
        <VehiclesCard
          renewalSnapshot={detail.renewalSnapshot}
          baselineSnapshot={detail.baselineSnapshot}
        />
      )}

      {/* Mortgagees for auto */}
      {!isHome && allMortgagees.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">Mortgagees</h4>
          <div className="space-y-2">
            {allMortgagees.map((m) => (
              <div key={m.name} className="text-xs text-gray-700">
                <div className="flex items-center gap-1.5">
                  {m.type && (
                    <span className="px-1 py-0.5 rounded bg-gray-100 text-[10px] text-gray-500">
                      {m.type.replace('_', ' ')}
                    </span>
                  )}
                  <span className="font-medium">{m.name}</span>
                </div>
                {m.loanNumber && (
                  <p className="text-[10px] text-gray-400 mt-0.5">Loan: {m.loanNumber}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <CustomerPoliciesSection
        policies={customerPolicies}
        currentPolicyId={detail.policyId}
      />
    </div>
  );
}
