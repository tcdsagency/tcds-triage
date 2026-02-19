'use client';

import { User, MapPin, Phone, Mail, ExternalLink } from 'lucide-react';
import type { RenewalComparisonDetail } from './types';
import type { RenewalSnapshot } from '@/types/renewal.types';

function buildZillowUrl(snapshot: RenewalSnapshot | null): string | null {
  const street = snapshot?.insuredAddress;
  if (!street) return null;
  const parts = [street, snapshot?.insuredCity, snapshot?.insuredState, snapshot?.insuredZip].filter(Boolean).join(' ');
  return `https://www.zillow.com/homes/${encodeURIComponent(parts)}`;
}

interface InsuredCardProps {
  detail: RenewalComparisonDetail;
  snapshot: RenewalSnapshot | null;
}

export default function InsuredCard({ detail, snapshot }: InsuredCardProps) {
  const name = detail.customerName || snapshot?.insuredName || 'Unknown';
  const customerId = detail.customerId;
  const address = [
    snapshot?.insuredAddress,
    snapshot?.insuredCity && snapshot?.insuredState
      ? `${snapshot.insuredCity}, ${snapshot.insuredState} ${snapshot.insuredZip || ''}`
      : null,
  ].filter(Boolean).join('\n');
  const zillowUrl = buildZillowUrl(snapshot);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="text-xs font-semibold uppercase text-gray-400 mb-3 flex items-center gap-1.5">
        <User className="h-3.5 w-3.5" />
        Insured
      </h4>
      {customerId ? (
        <a
          href={`/customers/${customerId}`}
          className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline mb-1 block"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          {name}
        </a>
      ) : (
        <p className="text-sm font-semibold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
          {name}
        </p>
      )}
      {address && (
        <div className="flex items-start gap-1.5 text-xs text-gray-500 mb-2">
          <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="whitespace-pre-line flex-1">{address}</span>
          {zillowUrl && (
            <a
              href={zillowUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 mt-0.5 text-blue-500 hover:text-blue-700"
              title="View on Zillow"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
      <div className="space-y-1">
        {detail.customerPhone && (
          <a
            href={`tel:${detail.customerPhone}`}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <Phone className="h-3 w-3" />
            {detail.customerPhone}
          </a>
        )}
        {detail.customerEmail && (
          <a
            href={`mailto:${detail.customerEmail}`}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
          >
            <Mail className="h-3 w-3" />
            {detail.customerEmail}
          </a>
        )}
      </div>
    </div>
  );
}
