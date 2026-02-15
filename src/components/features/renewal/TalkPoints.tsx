'use client';

import { cn } from '@/lib/utils';
import { MessageSquare } from 'lucide-react';
import { resolveFieldDisplayName } from '@/lib/coverage-display-names';
import type { CheckResult, CheckSeverity } from '@/types/check-rules.types';
import type { MaterialChange, ComparisonSummary } from '@/types/renewal.types';

interface TalkPointsProps {
  checkResults: CheckResult[];
  materialChanges?: MaterialChange[];
  comparisonSummary?: ComparisonSummary | null;
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
      const action = r.agentAction ? ` ${r.agentAction}` : '';
      points.push({ text: `Premium ${r.change}.${action}`, severity: r.severity });
    }
  }

  // Coverage changes (limits)
  const coverageChanges = results.filter(
    r => r.category === 'Coverages' && (r.severity === 'warning' || r.severity === 'critical')
  );
  for (const r of coverageChanges) {
    const change = r.change && r.change !== 'No change' ? r.change : r.message || 'changed';
    const action = r.agentAction ? ` ${r.agentAction}` : '';
    points.push({ text: `${resolveFieldDisplayName(r.field)}: ${change}.${action}`, severity: r.severity });
  }

  // Deductible changes
  const deductibleChanges = results.filter(
    r => r.category === 'Deductibles' && r.severity !== 'unchanged'
  );
  for (const r of deductibleChanges) {
    const change = r.change && r.change !== 'No change' ? r.change : r.message || 'changed';
    points.push({ text: `${resolveFieldDisplayName(r.field)}: ${change}.`, severity: r.severity });
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
    const change = r.change && r.change !== 'No change' ? r.change : r.message || 'flagged';
    points.push({ text: `${r.field}: ${change}.`, severity: r.severity });
  }

  return points;
}

/** Build talk points from materialChanges when checkResults are unavailable */
function buildFallbackTalkPoints(changes: MaterialChange[]): TalkPoint[] {
  const points: TalkPoint[] = [];

  // Vehicle changes
  const vehiclesRemoved = changes.filter(m => m.category === 'vehicle_removed');
  const vehiclesAdded = changes.filter(m => m.category === 'vehicle_added');
  if (vehiclesRemoved.length > 0) {
    for (const v of vehiclesRemoved) {
      points.push({ text: `Vehicle removed: ${v.description}`, severity: 'removed' });
    }
  }
  if (vehiclesAdded.length > 0) {
    for (const v of vehiclesAdded) {
      points.push({ text: `Vehicle added: ${v.description}`, severity: 'added' });
    }
  }

  // Driver changes
  const driversRemoved = changes.filter(m => m.category === 'driver_removed');
  const driversAdded = changes.filter(m => m.category === 'driver_added');
  if (driversRemoved.length > 0) {
    for (const d of driversRemoved) {
      points.push({ text: `Driver removed: ${d.description}`, severity: 'removed' });
    }
  }
  if (driversAdded.length > 0) {
    for (const d of driversAdded) {
      points.push({ text: `Driver added: ${d.description}`, severity: 'added' });
    }
  }

  // Premium changes
  const premiumChanges = changes.filter(m => m.category === 'premium');
  for (const p of premiumChanges) {
    const severity: CheckSeverity = p.classification === 'material_negative' ? 'warning' : 'info';
    points.push({ text: p.description, severity });
  }

  // Coverage changes
  const coverageLimit = changes.filter(m => m.category === 'coverage_limit');
  const coverageRemoved = changes.filter(m => m.category === 'coverage_removed');
  const coverageAdded = changes.filter(m => m.category === 'coverage_added');
  for (const c of coverageLimit) {
    const severity: CheckSeverity = c.classification === 'material_negative' ? 'warning' : 'info';
    points.push({ text: `${resolveFieldDisplayName(c.field)}: ${c.description}`, severity });
  }
  for (const c of coverageRemoved) {
    points.push({ text: `Coverage removed: ${c.description}`, severity: 'removed' });
  }
  for (const c of coverageAdded) {
    points.push({ text: `Coverage added: ${c.description}`, severity: 'added' });
  }

  // Deductible changes
  const deductibles = changes.filter(m => m.category === 'deductible');
  for (const d of deductibles) {
    const severity: CheckSeverity = d.classification === 'material_negative' ? 'warning' : 'info';
    points.push({ text: `${resolveFieldDisplayName(d.field)}: ${d.description}`, severity });
  }

  // Discount changes
  const discountsRemoved = changes.filter(m => m.category === 'discount_removed');
  const discountsAdded = changes.filter(m => m.category === 'discount_added');
  if (discountsRemoved.length > 0) {
    const names = discountsRemoved.map(d => d.description).join(', ');
    points.push({ text: `Discount${discountsRemoved.length !== 1 ? 's' : ''} removed: ${names}`, severity: 'warning' });
  }
  if (discountsAdded.length > 0) {
    const names = discountsAdded.map(d => d.description).join(', ');
    points.push({ text: `Discount${discountsAdded.length !== 1 ? 's' : ''} added: ${names}`, severity: 'info' });
  }

  // Endorsement changes
  const endorsementChanges = changes.filter(m =>
    m.category === 'endorsement' || m.category === 'endorsement_removed' || m.category === 'endorsement_added'
  );
  for (const e of endorsementChanges) {
    const severity: CheckSeverity = e.category === 'endorsement_removed' ? 'warning' : 'info';
    points.push({ text: e.description, severity });
  }

  return points;
}

export default function TalkPoints({ checkResults, materialChanges, comparisonSummary }: TalkPointsProps) {
  // Try checkResults first, fall back to materialChanges
  let points = buildTalkPoints(checkResults);
  if (points.length === 0 && materialChanges && materialChanges.length > 0) {
    points = buildFallbackTalkPoints(materialChanges);
  }

  if (points.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          Talk Points
        </h3>
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          No significant changes to discuss.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
      <h3 className="text-sm font-semibold uppercase text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-1.5">
        <MessageSquare className="h-4 w-4" />
        Talk Points
      </h3>
      {/* AI Summary headline */}
      {comparisonSummary?.headline && (
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
          {comparisonSummary.headline}
        </p>
      )}
      <ul className="space-y-2.5">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
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
