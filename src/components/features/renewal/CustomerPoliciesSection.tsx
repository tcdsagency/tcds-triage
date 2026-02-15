'use client';

import React from 'react';
import { Home, Car, Umbrella, Droplets, Heart, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function CustomerPoliciesSection({ policies, currentPolicyId }: { policies: any[]; currentPolicyId: string | null }) {
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
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-2 text-sm rounded px-1.5 py-1',
                isCurrent ? 'bg-emerald-50 dark:bg-emerald-900/20 font-medium' : 'text-gray-700 dark:text-gray-300'
              )}
            >
              <span className="text-gray-400 dark:text-gray-500 shrink-0">
                {getLobIcon(p.lineOfBusiness)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="truncate text-xs font-medium">{p.carrier || 'Unknown'}</span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                  {p.policyNumber}
                  {p.premium != null && (
                    <span className="ml-1">&middot; ${Number(p.premium).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  )}
                </div>
              </div>
            </div>
          );
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
