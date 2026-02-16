'use client';

import { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronRight, Home, Car, Umbrella, Droplets, Heart } from 'lucide-react';

interface CustomerPolicy {
  id: string;
  policyNumber: string;
  lineOfBusiness: string;
  carrier: string | null;
  premium: string | null;
  status: string | null;
}

interface AIRecommendationsCardProps {
  policies: CustomerPolicy[];
}

function normalizeLob(lob: string): string | null {
  const l = lob.toLowerCase();
  if (l.includes('home') || l.includes('dwelling') || l.includes('ho3') || l.includes('ho5') || l.includes('dp3')) return 'Home';
  if (l.includes('auto')) return 'Auto';
  if (l.includes('umbrella')) return 'Umbrella';
  if (l.includes('flood')) return 'Flood';
  if (l.includes('life')) return 'Life';
  return null;
}

const GAP_ICONS: Record<string, React.ReactNode> = {
  Home: <Home className="h-3.5 w-3.5" />,
  Auto: <Car className="h-3.5 w-3.5" />,
  Umbrella: <Umbrella className="h-3.5 w-3.5" />,
  Flood: <Droplets className="h-3.5 w-3.5" />,
  Life: <Heart className="h-3.5 w-3.5" />,
};

const GAP_TIPS: Record<string, string> = {
  Home: 'Multi-policy discount potential with auto',
  Auto: 'Bundle with home for savings',
  Umbrella: 'Extra liability protection — typically $200-400/yr for $1M',
  Flood: 'Standard HO policy excludes flood damage',
  Life: 'Term life — often $20-40/month for $500K',
};

const STANDARD_LOBS = ['Home', 'Auto', 'Umbrella', 'Flood', 'Life'];

export default function AIRecommendationsCard({ policies }: AIRecommendationsCardProps) {
  if (!policies || policies.length === 0) return null;

  const activeLobs = new Set(
    policies.map(p => normalizeLob(p.lineOfBusiness)).filter(Boolean)
  );

  const gaps = STANDARD_LOBS.filter(lob => !activeLobs.has(lob));

  if (gaps.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-violet-200 bg-violet-50/50 p-4">
      <h3 className="text-sm font-semibold uppercase text-violet-700 mb-3 flex items-center gap-1.5">
        <Lightbulb className="h-4 w-4" />
        Cross-Sell Opportunities
      </h3>
      <ul className="space-y-2">
        {gaps.map(lob => (
          <li key={lob} className="flex items-start gap-2 text-xs">
            <span className="mt-0.5 shrink-0 text-violet-500">{GAP_ICONS[lob]}</span>
            <div>
              <span className="font-medium text-gray-800">{lob}</span>
              <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-violet-100 text-violet-600 ml-1.5">
                Missing
              </span>
              <p className="text-gray-500 mt-0.5">{GAP_TIPS[lob]}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
