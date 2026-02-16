'use client';

import { FileText } from 'lucide-react';
import type { RenewalComparisonDetail } from './types';

interface PolicyDetailsCardProps {
  detail: RenewalComparisonDetail;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PolicyDetailsCard({ detail }: PolicyDetailsCardProps) {
  const rows: [string, string | null | undefined][] = [
    ['Policy #', detail.policyNumber],
    ['Carrier', detail.carrierName],
    ['LOB', detail.lineOfBusiness],
    ['Effective', detail.renewalEffectiveDate ? fmtDate(detail.renewalEffectiveDate) : null],
    ['Expiration', detail.renewalExpirationDate ? fmtDate(detail.renewalExpirationDate) : null],
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-xs font-semibold uppercase text-gray-400 mb-3 flex items-center gap-1.5">
        <FileText className="h-3.5 w-3.5" />
        Policy Details
      </h4>
      <div className="space-y-1.5">
        {rows.map(([label, value]) =>
          value ? (
            <div key={label} className="flex justify-between text-xs">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-700">{value}</span>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
}
