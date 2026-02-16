'use client';

import { ArrowLeft, FileDown, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import AZStatusBadge from './AZStatusBadge';
import SeverityBadge from './SeverityBadge';
import type { RenewalComparisonDetail } from './types';

interface StickyHeaderProps {
  detail: RenewalComparisonDetail;
  premiumChange: number;
  onBack: () => void;
  onDownloadReport: () => void;
}

function fmtPremium(val: number | null | undefined) {
  return val != null ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '-';
}

function getSeverityLevel(pct: number): 'critical' | 'warning' | 'info' | 'unchanged' {
  if (pct > 20) return 'critical';
  if (pct > 10) return 'warning';
  if (pct > 0) return 'info';
  return 'unchanged';
}

export default function StickyHeader({ detail, premiumChange, onBack, onDownloadReport }: StickyHeaderProps) {
  const premiumColor =
    premiumChange < 0
      ? 'text-green-600'
      : premiumChange <= 5
        ? 'text-yellow-600'
        : premiumChange <= 15
          ? 'text-orange-600'
          : 'text-red-600';

  const premiumBg =
    premiumChange < 0
      ? 'bg-green-50'
      : premiumChange <= 5
        ? 'bg-yellow-50'
        : premiumChange <= 15
          ? 'bg-orange-50'
          : 'bg-red-50';

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-6 py-3">
      {/* Top row: back + download */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Renewals
        </button>
        <button
          onClick={onDownloadReport}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <FileDown className="h-4 w-4" />
          PDF Report
        </button>
      </div>

      {/* Main row: customer info + premium at-a-glance */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 truncate" style={{ fontFamily: 'var(--font-heading)' }}>
                {detail.customerName || 'Unknown Customer'}
              </h1>
              <AZStatusBadge
                status={detail.status}
                agencyzoomSrId={detail.agencyzoomSrId}
              />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500">
              <span className="font-medium">{detail.policyNumber}</span>
              <span className="text-gray-300">|</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-100 text-xs font-medium">
                {detail.carrierName || 'Unknown Carrier'}
              </span>
              {detail.lineOfBusiness && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-xs">
                    {detail.lineOfBusiness}
                  </span>
                </>
              )}
              {(detail.customerPhone || detail.customerEmail) && (
                <>
                  <span className="text-gray-300">|</span>
                  {detail.customerPhone && (
                    <a href={`tel:${detail.customerPhone}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <Phone className="h-3 w-3" />
                      {detail.customerPhone}
                    </a>
                  )}
                  {detail.customerEmail && (
                    <a href={`mailto:${detail.customerEmail}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                      <Mail className="h-3 w-3" />
                      {detail.customerEmail}
                    </a>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Premium at-a-glance */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <span className="text-[10px] uppercase text-gray-400 block">Current</span>
            <span className="text-sm text-gray-500">
              {fmtPremium(detail.currentPremium)}
            </span>
          </div>
          <span className="text-gray-400">&rarr;</span>
          <div className="text-right">
            <span className="text-[10px] uppercase text-gray-400 block">Renewal</span>
            <span className={cn('text-lg font-bold', premiumColor)}>
              {fmtPremium(detail.renewalPremium)}
            </span>
          </div>
          {detail.premiumChangeAmount != null && (
            <span className={cn('text-sm font-semibold px-2 py-1 rounded-md', premiumColor, premiumBg)}>
              {premiumChange > 0 ? '+' : ''}{premiumChange.toFixed(1)}%
              {' '}({premiumChange > 0 ? '+' : ''}${Math.abs(detail.premiumChangeAmount).toFixed(0)})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
