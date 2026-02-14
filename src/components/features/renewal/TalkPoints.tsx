'use client';

import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';
import type { CheckResult, CheckSeverity } from '@/types/check-rules.types';

interface TalkPointsProps {
  checkResults: CheckResult[];
}

interface TalkPoint {
  text: string;
  severity: CheckSeverity;
}

const severityDotColor: Record<CheckSeverity, string> = {
  critical: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
  unchanged: 'bg-gray-400',
  added: 'bg-violet-500',
  removed: 'bg-rose-400',
};

function buildTalkPoints(results: CheckResult[]): TalkPoint[] {
  const points: TalkPoint[] = [];

  // Premium changes
  const premiumResults = results.filter(r => r.category === 'Premium' && r.severity !== 'unchanged');
  for (const r of premiumResults) {
    if (r.change && r.change !== 'No change') {
      points.push({ text: `Premium ${r.change}. ${r.agentAction}`, severity: r.severity });
    }
  }

  // Coverage changes (limits)
  const coverageChanges = results.filter(
    r => r.category === 'Coverages' && (r.severity === 'warning' || r.severity === 'critical')
  );
  for (const r of coverageChanges) {
    points.push({ text: `${r.field}: ${r.change}. ${r.agentAction}`, severity: r.severity });
  }

  // Deductible changes
  const deductibleChanges = results.filter(
    r => r.category === 'Deductibles' && r.severity !== 'unchanged'
  );
  for (const r of deductibleChanges) {
    points.push({ text: `${r.field}: ${r.change}.`, severity: r.severity });
  }

  // Removed items
  const removedItems = results.filter(r => r.severity === 'removed');
  const removedVehicles = removedItems.filter(r => r.category === 'Vehicles');
  const removedDrivers = removedItems.filter(r => r.category === 'Drivers');
  const removedDiscounts = removedItems.filter(r => r.category === 'Endorsements' || r.field.toLowerCase().includes('discount'));

  if (removedVehicles.length > 0) {
    points.push({
      text: `${removedVehicles.length} vehicle${removedVehicles.length !== 1 ? 's' : ''} removed from policy.`,
      severity: 'removed',
    });
  }
  if (removedDrivers.length > 0) {
    points.push({
      text: `${removedDrivers.length} driver${removedDrivers.length !== 1 ? 's' : ''} removed from policy.`,
      severity: 'removed',
    });
  }
  if (removedDiscounts.length > 0) {
    const names = removedDiscounts.map(r => r.field).join(', ');
    points.push({
      text: `${removedDiscounts.length} discount${removedDiscounts.length !== 1 ? 's' : ''} removed: ${names}.`,
      severity: 'warning',
    });
  }

  // Added items
  const addedItems = results.filter(r => r.severity === 'added');
  const addedVehicles = addedItems.filter(r => r.category === 'Vehicles');
  const addedDrivers = addedItems.filter(r => r.category === 'Drivers');

  if (addedVehicles.length > 0) {
    points.push({
      text: `${addedVehicles.length} vehicle${addedVehicles.length !== 1 ? 's' : ''} added to policy.`,
      severity: 'added',
    });
  }
  if (addedDrivers.length > 0) {
    points.push({
      text: `${addedDrivers.length} driver${addedDrivers.length !== 1 ? 's' : ''} added to policy.`,
      severity: 'added',
    });
  }

  // Property changes
  const propertyChanges = results.filter(
    r => r.category === 'Property' && r.severity !== 'unchanged'
  );
  for (const r of propertyChanges) {
    points.push({ text: `${r.field}: ${r.change}.`, severity: r.severity });
  }

  return points;
}

export default function TalkPoints({ checkResults }: TalkPointsProps) {
  const points = buildTalkPoints(checkResults);

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          Talk Points
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          No significant changes to discuss.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
        <MessageSquare className="h-3.5 w-3.5" />
        Talk Points
      </h3>
      <ul className="space-y-2">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
            <span
              className={cn(
                'mt-1.5 h-2 w-2 rounded-full shrink-0',
                severityDotColor[point.severity],
              )}
            />
            <span>{point.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
