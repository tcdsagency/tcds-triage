"use client";

import { SYSTEM_FIELDS } from "@/lib/commissions/csv-parser";

interface FieldMapperProps {
  headers: string[];
  mapping: Record<string, string>;
  onChange: (mapping: Record<string, string>) => void;
}

export function FieldMapper({ headers, mapping, onChange }: FieldMapperProps) {
  const handleChange = (csvHeader: string, systemField: string) => {
    const updated = { ...mapping };
    if (systemField) {
      updated[csvHeader] = systemField;
    } else {
      delete updated[csvHeader];
    }
    onChange(updated);
  };

  // Auto-detect mappings based on header similarity
  const autoMap = () => {
    const newMapping: Record<string, string> = {};
    for (const header of headers) {
      const normalized = header.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const field of SYSTEM_FIELDS) {
        const fieldNorm = field.key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalized.includes(fieldNorm) || fieldNorm.includes(normalized)) {
          if (!Object.values(newMapping).includes(field.key)) {
            newMapping[header] = field.key;
            break;
          }
        }
      }
    }
    onChange(newMapping);
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const requiredMapped = SYSTEM_FIELDS
    .filter((f) => f.required)
    .every((f) => Object.values(mapping).includes(f.key));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {mappedCount} of {headers.length} columns mapped
          </p>
          {!requiredMapped && (
            <p className="text-xs text-red-500 mt-0.5">
              Required fields: Policy Number, Commission Amount
            </p>
          )}
        </div>
        <button
          onClick={autoMap}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
        >
          Auto-detect
        </button>
      </div>

      <div className="grid gap-2">
        {headers.map((header) => (
          <div key={header} className="flex items-center gap-3 py-1">
            <span className="w-1/3 text-sm font-mono text-gray-700 dark:text-gray-300 truncate" title={header}>
              {header}
            </span>
            <span className="text-gray-300 dark:text-gray-600 text-lg">→</span>
            <select
              value={mapping[header] || ""}
              onChange={(e) => handleChange(header, e.target.value)}
              className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Skip --</option>
              {SYSTEM_FIELDS.map((f) => (
                <option
                  key={f.key}
                  value={f.key}
                  disabled={Object.values(mapping).includes(f.key) && mapping[header] !== f.key}
                >
                  {f.label}{f.required ? " *" : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
