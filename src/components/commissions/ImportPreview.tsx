"use client";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/commissions/formatters";

interface PreviewRow {
  rowNumber: number;
  policyNumber: string;
  carrierName: string;
  insuredName: string;
  commissionAmount: number;
  effectiveDate: string;
  isDuplicate: boolean;
  errors: string[];
}

interface ImportPreviewProps {
  rows: PreviewRow[];
}

export function ImportPreview({ rows }: ImportPreviewProps) {
  const duplicates = rows.filter((r) => r.isDuplicate).length;
  const errors = rows.filter((r) => r.errors.length > 0).length;
  const ready = rows.filter((r) => !r.isDuplicate && r.errors.length === 0).length;

  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-sm">
        <span className="text-green-600 font-medium">{ready} ready</span>
        {duplicates > 0 && <span className="text-yellow-600 font-medium">{duplicates} duplicates</span>}
        {errors > 0 && <span className="text-red-600 font-medium">{errors} errors</span>}
      </div>

      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Policy #</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Carrier</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Insured</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Eff. Date</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {rows.map((row) => (
              <tr
                key={row.rowNumber}
                className={cn(
                  row.isDuplicate && "bg-yellow-50 dark:bg-yellow-900/10",
                  row.errors.length > 0 && "bg-red-50 dark:bg-red-900/10"
                )}
              >
                <td className="px-3 py-2 text-gray-500">{row.rowNumber}</td>
                <td className="px-3 py-2 font-mono text-gray-900 dark:text-gray-100">{row.policyNumber}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.carrierName}</td>
                <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.insuredName}</td>
                <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">{formatCurrency(row.commissionAmount)}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{row.effectiveDate}</td>
                <td className="px-3 py-2">
                  {row.isDuplicate ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Dup</span>
                  ) : row.errors.length > 0 ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={row.errors.join(", ")}>Error</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ready</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
