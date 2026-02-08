"use client";

import { useState, useEffect } from "react";
import { Upload, MapPin, Eye, Play, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportWizardProps {
  onComplete: () => void;
}

type Step = "upload" | "map" | "preview" | "execute" | "done";

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "upload", label: "Upload CSV", icon: Upload },
  { key: "map", label: "Map Fields", icon: MapPin },
  { key: "preview", label: "Preview", icon: Eye },
  { key: "execute", label: "Import", icon: Play },
  { key: "done", label: "Complete", icon: CheckCircle },
];

interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
}

export function ImportWizard({ onComplete }: ImportWizardProps) {
  const [step, setStep] = useState<Step>("upload");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [carrierId, setCarrierId] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/commissions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, csvText: text, carrierId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.details || data.error || "Upload failed");
      setBatchId(data.data.id);
      setHeaders(data.data.parsedHeaders || []);
      setStep("map");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const handleMap = async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/commissions/import/${batchId}/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping, carrierId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Load preview
      const prevRes = await fetch(`/api/commissions/import/${batchId}/preview`);
      const prevData = await prevRes.json();
      if (prevData.success) {
        setPreview(prevData.data || []);
      }
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mapping failed");
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/commissions/import/${batchId}/execute`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setResult(data.data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const SYSTEM_FIELDS = [
    { key: "policyNumber", label: "Policy Number", required: true, patterns: ["policy number", "policy no", "policy #", "policy_number"] },
    { key: "carrierName", label: "Carrier Name", required: false, patterns: ["carrier", "carrier name", "company", "insurance company"] },
    { key: "insuredName", label: "Insured Name", required: false, patterns: ["client name", "insured name", "named insured", "insured", "customer name", "name"] },
    { key: "transactionType", label: "Transaction Type", required: false, patterns: ["transaction type", "trans type", "type"] },
    { key: "lineOfBusiness", label: "Line of Business", required: false, patterns: ["lob", "line of business", "line_of_business"] },
    { key: "effectiveDate", label: "Effective Date", required: false, patterns: ["effective date", "eff date", "effective"] },
    { key: "statementDate", label: "Statement Date", required: false, patterns: ["statement date"] },
    { key: "agentPaidDate", label: "Agent Paid Date", required: false, patterns: ["agent paid date", "paid date", "payment date"] },
    { key: "grossPremium", label: "Gross Premium", required: false, patterns: ["commissionable premium", "gross premium", "written premium", "premium"] },
    { key: "commissionRate", label: "Commission Rate", required: false, patterns: ["agency commission %", "commission rate", "commission %", "comm rate", "comm %"] },
    { key: "commissionAmount", label: "Commission Amount", required: true, patterns: ["commission paid", "commission amount", "commission amt", "comm amount", "comm paid"] },
    { key: "agentCode", label: "Agent Code", required: false, patterns: ["agent code", "agent_code", "producer code"] },
  ];

  // fieldMapping: systemFieldKey -> csvHeader (reverse of what we send to API)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  // Auto-detect mappings when headers change
  useEffect(() => {
    if (headers.length === 0) return;
    const autoMap: Record<string, string> = {};
    const usedHeaders = new Set<string>();

    for (const field of SYSTEM_FIELDS) {
      const headerLower = headers.map((h) => h.toLowerCase());
      for (const pattern of field.patterns) {
        const idx = headerLower.findIndex((h) => h === pattern && !usedHeaders.has(headers[idx]));
        if (idx >= 0) {
          autoMap[field.key] = headers[idx];
          usedHeaders.add(headers[idx]);
          break;
        }
      }
      // Fuzzy match: check if any header contains the pattern
      if (!autoMap[field.key]) {
        for (const pattern of field.patterns) {
          const idx = headerLower.findIndex((h) => h.includes(pattern) && !usedHeaders.has(headers[idx]));
          if (idx >= 0) {
            autoMap[field.key] = headers[idx];
            usedHeaders.add(headers[idx]);
            break;
          }
        }
      }
    }

    setFieldMapping(autoMap);
    // Build the API mapping format: { csvHeader: systemFieldKey }
    const apiMapping: Record<string, string> = {};
    for (const [sysKey, csvHeader] of Object.entries(autoMap)) {
      apiMapping[csvHeader] = sysKey;
    }
    setMapping(apiMapping);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headers]);

  const updateFieldMapping = (systemKey: string, csvHeader: string) => {
    setFieldMapping((prev) => {
      const next = { ...prev };
      if (csvHeader) {
        next[systemKey] = csvHeader;
      } else {
        delete next[systemKey];
      }
      // Rebuild API mapping
      const apiMapping: Record<string, string> = {};
      for (const [sysKey, header] of Object.entries(next)) {
        apiMapping[header] = sysKey;
      }
      setMapping(apiMapping);
      return next;
    });
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center">
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium",
                i <= stepIndex
                  ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
              )}
            >
              <s.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("w-8 h-0.5 mx-1", i < stepIndex ? "bg-emerald-400" : "bg-gray-200 dark:bg-gray-700")} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step content */}
      {step === "upload" && (
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Upload a commission statement CSV file
          </p>
          <input
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
            className="block mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
            disabled={loading}
          />
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Map CSV Columns</h3>
          <p className="text-sm text-gray-500">
            Select which CSV column maps to each system field. Auto-detected matches are pre-filled.
          </p>
          <div className="grid gap-3">
            {SYSTEM_FIELDS.map((field) => {
              const usedHeaders = new Set(
                Object.entries(fieldMapping)
                  .filter(([k]) => k !== field.key)
                  .map(([, v]) => v)
              );
              return (
                <div key={field.key} className="flex items-center gap-4">
                  <span className={cn(
                    "w-48 text-sm font-medium truncate",
                    field.required ? "text-gray-900 dark:text-gray-100" : "text-gray-700 dark:text-gray-300"
                  )}>
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  <span className="text-gray-400">←</span>
                  <select
                    value={fieldMapping[field.key] || ""}
                    onChange={(e) => updateFieldMapping(field.key, e.target.value)}
                    className={cn(
                      "flex-1 text-sm border rounded-md px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500",
                      fieldMapping[field.key]
                        ? "border-emerald-300 dark:border-emerald-700"
                        : field.required
                          ? "border-red-300 dark:border-red-700"
                          : "border-gray-300 dark:border-gray-600"
                    )}
                  >
                    <option value="">-- None --</option>
                    {headers.map((h) => (
                      <option key={h} value={h} disabled={usedHeaders.has(h)}>
                        {h}{usedHeaders.has(h) ? " (used)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {Object.keys(fieldMapping).length} of {SYSTEM_FIELDS.length} fields mapped
            </span>
            <button
              onClick={handleMap}
              disabled={loading || !fieldMapping.policyNumber || !fieldMapping.commissionAmount}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Processing..." : "Continue to Preview"}
            </button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Preview Import</h3>
          <p className="text-sm text-gray-500">Review the first {preview.length} rows before importing.</p>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Row</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Policy</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Insured</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {preview.map((row, i) => (
                  <tr key={i} className={row.isDuplicate ? "bg-yellow-50 dark:bg-yellow-900/10" : ""}>
                    <td className="px-3 py-2 text-gray-500">{(row.rowNumber as number) || i + 1}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{String(row.policyNumber || "")}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{String(row.insuredName || "")}</td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{String(row.commissionAmount || "")}</td>
                    <td className="px-3 py-2">
                      {row.isDuplicate ? (
                        <span className="text-yellow-600 text-xs font-medium">Duplicate</span>
                      ) : (row.errors as string[])?.length > 0 ? (
                        <span className="text-red-600 text-xs font-medium">Error</span>
                      ) : (
                        <span className="text-green-600 text-xs font-medium">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setStep("map")}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back
            </button>
            <button
              onClick={handleExecute}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "Importing..." : "Execute Import"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="text-center py-8">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Import Complete</h3>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
            <p>Imported: <strong>{result.imported}</strong></p>
            <p>Skipped: <strong>{result.skipped}</strong></p>
            <p>Duplicates: <strong>{result.duplicates}</strong></p>
            {result.errors > 0 && <p className="text-red-600">Errors: <strong>{result.errors}</strong></p>}
          </div>
          <button
            onClick={onComplete}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
