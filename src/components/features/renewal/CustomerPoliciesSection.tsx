'use client';

import React, { useState, useCallback } from 'react';
import { Home, Car, Umbrella, Droplets, Heart, Shield, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// LOB icon helper
const LOB_ICONS: Record<string, React.ReactNode> = {
  home: <Home className="h-3.5 w-3.5" />,
  homeowners: <Home className="h-3.5 w-3.5" />,
  dwelling: <Home className="h-3.5 w-3.5" />,
  ho3: <Home className="h-3.5 w-3.5" />,
  ho5: <Home className="h-3.5 w-3.5" />,
  dp3: <Home className="h-3.5 w-3.5" />,
  auto: <Car className="h-3.5 w-3.5" />,
  'personal auto': <Car className="h-3.5 w-3.5" />,
  umbrella: <Umbrella className="h-3.5 w-3.5" />,
  flood: <Droplets className="h-3.5 w-3.5" />,
  life: <Heart className="h-3.5 w-3.5" />,
};

function getLobIcon(lob: string) {
  const key = lob.toLowerCase();
  for (const [k, icon] of Object.entries(LOB_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return <Shield className="h-3.5 w-3.5" />;
}

const STANDARD_LOBS = ['Home', 'Auto', 'Umbrella', 'Flood', 'Life'];

function normalizeLob(lob: string): string | null {
  const l = lob.toLowerCase();
  if (l.includes('home') || l.includes('dwelling') || l.includes('ho3') || l.includes('ho5') || l.includes('dp3')) return 'Home';
  if (l.includes('auto')) return 'Auto';
  if (l.includes('umbrella')) return 'Umbrella';
  if (l.includes('flood')) return 'Flood';
  if (l.includes('life')) return 'Life';
  return null;
}

interface PolicyItem {
  id: string;
  policyNumber: string;
  lineOfBusiness: string;
  carrier: string;
  premium: string | number | null;
  effectiveDate?: string;
  expirationDate?: string;
  status: string;
  renewalComparisonId?: string | null;
}

export default function CustomerPoliciesSection({
  policies,
  currentPolicyId,
  ezlynxAccountId,
}: {
  policies: PolicyItem[];
  currentPolicyId: string | null;
  ezlynxAccountId?: string | null;
}) {
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = useCallback(async (comparisonId: string, lob: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!ezlynxAccountId) {
      toast.error('Link EZLynx account first');
      return;
    }
    setSyncingId(comparisonId);
    const type = lob.toLowerCase().includes('auto') ? 'auto' : 'home';
    const toastId = toast.loading(`Syncing ${type} to EZLynx...`);
    try {
      const res = await fetch('/api/ezlynx/reshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparisonId }),
      });
      const data = await res.json();
      if (data.success) {
        const report = data.syncReport;
        const parts: string[] = [];
        if (report?.drivers?.matched?.length) parts.push(`${report.drivers.matched.length} drivers matched`);
        if (report?.drivers?.added?.length) parts.push(`${report.drivers.added.length} drivers added`);
        if (report?.vehicles?.matched?.length) parts.push(`${report.vehicles.matched.length} vehicles matched`);
        if (report?.vehicles?.added?.length) parts.push(`${report.vehicles.added.length} vehicles added`);
        if (report?.coverages?.updated?.length) parts.push(`${report.coverages.updated.length} coverages updated`);
        if (report?.dwelling?.updated?.length) parts.push(`${report.dwelling.updated.length} dwelling fields`);
        const summary = parts.length > 0 ? parts.join(', ') : `${type} application updated`;
        toast.success('Synced to EZLynx', { id: toastId, description: summary, duration: 8000 });
      } else {
        toast.error('Sync failed', { id: toastId, description: data.error });
      }
    } catch (err: any) {
      toast.error('Sync error', { id: toastId, description: err.message });
    } finally {
      setSyncingId(null);
    }
  }, [ezlynxAccountId]);

  if (!policies || policies.length === 0) return null;

  const activeLobs = new Set(policies.map(p => normalizeLob(p.lineOfBusiness)).filter(Boolean));
  const missingLobs = STANDARD_LOBS.filter(l => !activeLobs.has(l));

  return (
    <div>
      <h4 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
        Policies
        <span className="text-[10px] font-medium bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full px-1.5 py-0.5 leading-none">
          {policies.length}
        </span>
      </h4>
      <div className="space-y-1.5">
        {policies.map(p => {
          const isCurrent = p.id === currentPolicyId;
          const hasRenewal = !!p.renewalComparisonId;
          const isSyncing = syncingId === p.renewalComparisonId;

          const content = (
            <div
              className={cn(
                'flex items-center gap-2 text-sm rounded px-1.5 py-1 group',
                isCurrent
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 font-medium'
                  : 'text-gray-700 dark:text-gray-300',
                hasRenewal && !isCurrent && 'hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer',
              )}
            >
              <span className="text-gray-400 dark:text-gray-500 shrink-0">
                {getLobIcon(p.lineOfBusiness)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-xs font-medium">{p.carrier || 'Unknown'}</span>
                  {hasRenewal && !isCurrent && (
                    <ExternalLink className="w-2.5 h-2.5 text-gray-300 group-hover:text-blue-400 shrink-0" />
                  )}
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {p.policyNumber}
                  {p.premium != null && (
                    <span className="ml-1">&middot; ${Number(p.premium).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  )}
                </div>
              </div>
              {/* Sync button for policies with renewals */}
              {hasRenewal && ezlynxAccountId && (
                <button
                  onClick={(e) => handleSync(p.renewalComparisonId!, p.lineOfBusiness, e)}
                  disabled={isSyncing}
                  title="Sync to EZLynx for reshop"
                  className="shrink-0 p-1 rounded hover:bg-emerald-100 text-gray-400 hover:text-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {isSyncing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>
          );

          // Wrap in link if it has a renewal and it's not the current one
          if (hasRenewal && !isCurrent) {
            return (
              <a
                key={p.id}
                href={`/renewal-review/${p.renewalComparisonId}`}
                className="block no-underline"
              >
                {content}
              </a>
            );
          }

          return <div key={p.id}>{content}</div>;
        })}
      </div>
      {missingLobs.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">Missing:</span>
          {missingLobs.map(l => (
            <span
              key={l}
              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
            >
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
