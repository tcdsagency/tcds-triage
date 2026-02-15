'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import CollapsibleSection from './CollapsibleSection';

interface CrossSellOpportunity {
  product: string;
  probability: number;
  expectedRevenue: number;
  confidence: number;
  reasoning: string;
  timing: 'immediate' | 'renewal' | 'next_contact' | 'future';
  approach: string;
  talkingPoints: string[];
}

interface CrossSellSectionProps {
  customerId: string | null;
}

const TIMING_LABELS: Record<string, { label: string; color: string }> = {
  immediate: { label: 'Immediate', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  renewal: { label: 'At Renewal', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  next_contact: { label: 'Next Contact', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  future: { label: 'Future', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
};

function probabilityBadge(probability: number) {
  if (probability >= 0.7) return { label: 'High', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' };
  if (probability >= 0.4) return { label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' };
  return { label: 'Low', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' };
}

function OpportunityCard({ opp }: { opp: CrossSellOpportunity }) {
  const [expanded, setExpanded] = useState(false);
  const prob = probabilityBadge(opp.probability);
  const timing = TIMING_LABELS[opp.timing] || TIMING_LABELS.future;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-800 dark:text-gray-200">{opp.product}</span>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', prob.color)}>
            {prob.label}
          </span>
          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', timing.color)}>
            {timing.label}
          </span>
        </div>
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">{opp.reasoning}</p>

      {opp.talkingPoints.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {expanded ? 'Hide' : 'Show'} talking points
        </button>
      )}

      {expanded && opp.talkingPoints.length > 0 && (
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5 pl-4 list-disc">
          {opp.talkingPoints.map((tp, i) => (
            <li key={i}>{tp}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CrossSellSection({ customerId }: CrossSellSectionProps) {
  const [opportunities, setOpportunities] = useState<CrossSellOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch('/api/ai/cross-sell', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId }),
    })
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        if (data.success) {
          setOpportunities(data.opportunities || []);
        } else {
          setError(data.error || 'Failed to load cross-sell opportunities');
        }
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load cross-sell opportunities');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [customerId]);

  if (!customerId) return null;

  if (loading) {
    return (
      <CollapsibleSection title="Cross-Sell Opportunities" defaultOpen={false}>
        <div className="p-4 space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
          ))}
        </div>
      </CollapsibleSection>
    );
  }

  if (error) {
    return (
      <CollapsibleSection title="Cross-Sell Opportunities" defaultOpen={false}>
        <div className="p-4">
          <p className="text-xs text-gray-400">{error}</p>
        </div>
      </CollapsibleSection>
    );
  }

  if (opportunities.length === 0) {
    return (
      <CollapsibleSection title="Cross-Sell Opportunities" badge="0" defaultOpen={false}>
        <div className="p-4">
          <p className="text-xs text-gray-400">No cross-sell opportunities identified</p>
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      title="Cross-Sell Opportunities"
      badge={`${opportunities.length}`}
      defaultOpen={false}
      headerRight={
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
      }
    >
      <div className="p-4 space-y-2">
        {opportunities.map((opp, i) => (
          <OpportunityCard key={i} opp={opp} />
        ))}
      </div>
    </CollapsibleSection>
  );
}
