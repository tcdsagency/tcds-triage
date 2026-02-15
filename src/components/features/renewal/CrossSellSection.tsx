'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Home, Car, Umbrella, Droplets, Heart, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import CollapsibleSection from './CollapsibleSection';

interface CustomerPolicy {
  id: string;
  policyNumber: string;
  lineOfBusiness: string;
  carrier: string | null;
  premium: string | null;
  status: string | null;
}

interface CrossSellSectionProps {
  policies: CustomerPolicy[];
}

interface GapOpportunity {
  product: string;
  icon: React.ReactNode;
  reasoning: string;
  talkingPoints: string[];
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

const GAP_DETAILS: Record<string, { icon: React.ReactNode; reasoning: string; talkingPoints: string[] }> = {
  Home: {
    icon: <Home className="h-4 w-4" />,
    reasoning: 'Customer has no active homeowners policy — potential for bundling discount with existing lines.',
    talkingPoints: [
      'Multi-policy discount when bundled with auto',
      'Ask about homeownership status or renting situation',
      'If renting, consider renters insurance instead',
    ],
  },
  Auto: {
    icon: <Car className="h-4 w-4" />,
    reasoning: 'Customer has no active auto policy — bundling with home could save them money.',
    talkingPoints: [
      'Multi-policy discount when bundled with home',
      'Ask how many vehicles in household',
      'Review current auto carrier for comparison quote',
    ],
  },
  Umbrella: {
    icon: <Umbrella className="h-4 w-4" />,
    reasoning: 'No umbrella policy in place — extra liability protection is recommended for customers with home and auto.',
    talkingPoints: [
      'Typically $200-400/yr for $1M in additional coverage',
      'Protects assets beyond home/auto liability limits',
      'Especially important if customer has a pool, trampoline, or teenage drivers',
    ],
  },
  Flood: {
    icon: <Droplets className="h-4 w-4" />,
    reasoning: 'No flood insurance on file — standard homeowners policies exclude flood damage.',
    talkingPoints: [
      'Homeowners insurance does NOT cover flood damage',
      'Even low-risk zones can flood — 25% of claims come from outside high-risk areas',
      'Private flood options may be cheaper than NFIP',
    ],
  },
  Life: {
    icon: <Heart className="h-4 w-4" />,
    reasoning: 'No life insurance on file — worth discussing if customer has dependents or a mortgage.',
    talkingPoints: [
      'Term life is affordable — often $20-40/month for $500K',
      'Mortgage protection ensures family keeps the home',
      'Ask about dependents, income replacement needs',
    ],
  },
};

const STANDARD_LOBS = ['Home', 'Auto', 'Umbrella', 'Flood', 'Life'];

function OpportunityCard({ opp }: { opp: GapOpportunity }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-amber-500">{opp.icon}</span>
        <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{opp.product}</span>
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
          Missing
        </span>
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-400">{opp.reasoning}</p>

      {opp.talkingPoints.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {expanded ? 'Hide' : 'Show'} talking points
        </button>
      )}

      {expanded && (
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5 pl-4 list-disc">
          {opp.talkingPoints.map((tp, i) => (
            <li key={i}>{tp}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CrossSellSection({ policies }: CrossSellSectionProps) {
  if (!policies || policies.length === 0) return null;

  const activeLobs = new Set(
    policies.map(p => normalizeLob(p.lineOfBusiness)).filter(Boolean)
  );

  const opportunities: GapOpportunity[] = STANDARD_LOBS
    .filter(lob => !activeLobs.has(lob))
    .map(lob => ({
      product: lob,
      ...GAP_DETAILS[lob],
    }));

  if (opportunities.length === 0) {
    return (
      <CollapsibleSection title="Cross-Sell Opportunities" badge="0" defaultOpen={false}>
        <div className="p-4">
          <p className="text-xs text-gray-400">Customer has all standard policy types covered</p>
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Cross-Sell Opportunities"
      badge={`${opportunities.length}`}
      defaultOpen={opportunities.length > 0}
    >
      <div className="p-4 space-y-2">
        {opportunities.map(opp => (
          <OpportunityCard key={opp.product} opp={opp} />
        ))}
      </div>
    </CollapsibleSection>
  );
}
