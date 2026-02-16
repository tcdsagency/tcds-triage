'use client';

import { Sparkles, AlertTriangle } from 'lucide-react';
import type { ComparisonSummary, MaterialChange } from '@/types/renewal.types';

interface AIAnalysisSectionProps {
  comparisonSummary: ComparisonSummary | null;
  materialChanges: MaterialChange[];
}

export default function AIAnalysisSection({ comparisonSummary, materialChanges }: AIAnalysisSectionProps) {
  if (!comparisonSummary?.headline && materialChanges.length === 0) return null;

  const materialNegative = materialChanges.filter(m => m.classification === 'material_negative');
  const materialPositive = materialChanges.filter(m => m.classification === 'material_positive');

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
      <h3 className="text-sm font-semibold uppercase text-blue-600 mb-3 flex items-center gap-1.5">
        <Sparkles className="h-4 w-4" />
        AI Analysis
      </h3>

      {comparisonSummary?.headline && (
        <p className="text-sm font-medium text-gray-800 mb-3">
          {comparisonSummary.headline}
        </p>
      )}

      {materialNegative.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-red-600 uppercase">Concerns ({materialNegative.length})</span>
          <ul className="mt-1 space-y-0.5">
            {materialNegative.map((m, i) => (
              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                {m.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {materialPositive.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-green-600 uppercase">Improvements ({materialPositive.length})</span>
          <ul className="mt-1 space-y-0.5">
            {materialPositive.map((m, i) => (
              <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 mt-1.5 shrink-0" />
                {m.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mandatory AI disclaimer */}
      <div className="mt-3 pt-2 border-t border-blue-200">
        <p className="text-[10px] text-blue-400 italic">
          AI-generated analysis for agent review. Verify all details before making decisions.
        </p>
      </div>
    </div>
  );
}
