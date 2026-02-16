'use client';

import { Home, Building } from 'lucide-react';

interface Mortgagee {
  name: string;
  type?: string;
  loanNumber?: string;
}

interface PropertyCardProps {
  propertyContext: Record<string, any> | undefined;
  mortgagees: Mortgagee[];
  mciPaymentData: any;
  policyId: string | null;
  fetchDetail?: () => void;
}

export default function PropertyCard({ propertyContext, mortgagees, mciPaymentData }: PropertyCardProps) {
  if (!propertyContext && mortgagees.length === 0 && !mciPaymentData) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Property Details */}
      {propertyContext && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2 flex items-center gap-1.5">
            <Home className="h-3.5 w-3.5" />
            Property
          </h4>
          <div className="space-y-1">
            {propertyContext.yearBuilt && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Year Built</span>
                <span className="font-medium text-gray-700">{propertyContext.yearBuilt}</span>
              </div>
            )}
            {propertyContext.squareFeet && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Sq Ft</span>
                <span className="font-medium text-gray-700">{propertyContext.squareFeet.toLocaleString()}</span>
              </div>
            )}
            {propertyContext.constructionType && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Construction</span>
                <span className="font-medium text-gray-700">{propertyContext.constructionType}</span>
              </div>
            )}
            {propertyContext.roofType && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Roof Type</span>
                <span className="font-medium text-gray-700">{propertyContext.roofType}</span>
              </div>
            )}
            {propertyContext.roofAge != null && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Roof Age</span>
                <span className="font-medium text-gray-700">{propertyContext.roofAge} years</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mortgagees */}
      {mortgagees.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2 flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5" />
            Mortgagees
          </h4>
          <div className="space-y-2">
            {mortgagees.map((m) => (
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

      {/* MCI Payment Status */}
      {mciPaymentData && (
        <div>
          <h4 className="text-xs font-semibold uppercase text-gray-400 mb-2">MCI Payment</h4>
          <div className="space-y-1">
            {mciPaymentData.paymentStatus && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Status</span>
                <span className={`font-medium px-1 py-0.5 rounded text-[10px] ${
                  mciPaymentData.paymentStatus === 'current' ? 'bg-green-50 text-green-600' :
                  mciPaymentData.paymentStatus === 'late' || mciPaymentData.paymentStatus === 'lapsed' ? 'bg-red-50 text-red-600' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  {mciPaymentData.paymentStatus.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
            )}
            {mciPaymentData.premiumAmount != null && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Premium</span>
                <span className="font-medium text-gray-700">${mciPaymentData.premiumAmount.toLocaleString()}</span>
              </div>
            )}
            {mciPaymentData.paidThroughDate && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Paid Through</span>
                <span className="font-medium text-gray-700">
                  {new Date(mciPaymentData.paidThroughDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
