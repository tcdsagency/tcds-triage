"use client";

import { useState, useCallback } from "react";
import {
  Loader2,
  AlertTriangle,
  FileText,
  Building2,
  Download,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { MonthSelector } from "@/components/commissions/MonthSelector";
import { AgentSelector } from "@/components/commissions/AgentSelector";
import { formatCurrency } from "@/lib/commissions/formatters";

// =============================================================================
// TYPES
// =============================================================================

interface AgentStatementData {
  agentName: string;
  totalCommission: number;
  totalDrawPayments: number;
  netPayable: number;
  transactions: AgentTransaction[];
}

interface AgentTransaction {
  id: string;
  policyNumber: string;
  carrierName: string | null;
  insuredName: string | null;
  transactionType: string | null;
  commissionAmount: number;
  effectiveDate: string | null;
}

interface CarrierSummaryRow {
  carrierId: string;
  carrierName: string;
  transactionCount: number;
  totalCommission: number;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  // Agent Statement state
  const [agentId, setAgentId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentStatement, setAgentStatement] = useState<AgentStatementData | null>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  // Carrier Summary state
  const [carrierSummary, setCarrierSummary] = useState<CarrierSummaryRow[]>([]);
  const [carrierLoading, setCarrierLoading] = useState(false);
  const [carrierError, setCarrierError] = useState<string | null>(null);

  // Export state
  const [exportType, setExportType] = useState("transactions");
  const [exporting, setExporting] = useState(false);

  // ---------------------------------------------------------------------------
  // AGENT STATEMENT
  // ---------------------------------------------------------------------------

  const handleGenerateAgentStatement = useCallback(async () => {
    if (!agentId) {
      toast.error("Please select an agent");
      return;
    }
    setAgentLoading(true);
    setAgentError(null);
    setAgentStatement(null);
    try {
      const res = await fetch(
        `/api/commissions/reports/agent-statement?agentId=${encodeURIComponent(agentId)}&month=${encodeURIComponent(selectedMonth)}`
      );
      if (!res.ok) throw new Error("Failed to generate agent statement");
      const json = await res.json();
      if (json.success && json.data) {
        setAgentStatement(json.data);
        toast.success("Agent statement generated");
      } else {
        throw new Error(json.error || "No data returned");
      }
    } catch (err: any) {
      console.error("Agent statement error:", err);
      setAgentError(err.message || "Failed to generate statement");
      toast.error(err.message || "Failed to generate agent statement");
    } finally {
      setAgentLoading(false);
    }
  }, [agentId, selectedMonth]);

  // ---------------------------------------------------------------------------
  // CARRIER SUMMARY
  // ---------------------------------------------------------------------------

  const handleGenerateCarrierSummary = useCallback(async () => {
    setCarrierLoading(true);
    setCarrierError(null);
    setCarrierSummary([]);
    try {
      const res = await fetch(
        `/api/commissions/reports/carrier-summary?month=${encodeURIComponent(selectedMonth)}`
      );
      if (!res.ok) throw new Error("Failed to generate carrier summary");
      const json = await res.json();
      if (json.success && json.data) {
        setCarrierSummary(json.data);
        toast.success("Carrier summary generated");
      } else {
        throw new Error(json.error || "No data returned");
      }
    } catch (err: any) {
      console.error("Carrier summary error:", err);
      setCarrierError(err.message || "Failed to generate summary");
      toast.error(err.message || "Failed to generate carrier summary");
    } finally {
      setCarrierLoading(false);
    }
  }, [selectedMonth]);

  // ---------------------------------------------------------------------------
  // EXPORT
  // ---------------------------------------------------------------------------

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(
        `/api/commissions/reports/export?month=${encodeURIComponent(selectedMonth)}&type=${encodeURIComponent(exportType)}`
      );
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commissions-${exportType}-${selectedMonth}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Export downloaded");
    } catch (err: any) {
      console.error("Export error:", err);
      toast.error(err.message || "Failed to export");
    } finally {
      setExporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // FORMAT HELPERS
  // ---------------------------------------------------------------------------

  function formatTransactionType(type: string | null): string {
    if (!type) return "Other";
    return type
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Commission Reports
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Generate agent statements, carrier summaries, and data exports
            </p>
          </div>
          <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
        </div>

        {/* ================================================================= */}
        {/* AGENT STATEMENT                                                    */}
        {/* ================================================================= */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Agent Statement
              </h2>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="w-full sm:w-64">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent
                </label>
                <AgentSelector
                  value={agentId}
                  onChange={(id, name) => {
                    setAgentId(id);
                    setAgentName(name || null);
                  }}
                  placeholder="Select agent..."
                />
              </div>
              <button
                onClick={handleGenerateAgentStatement}
                disabled={agentLoading || !agentId}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {agentLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                Generate
              </button>
            </div>

            {agentError && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-800 dark:text-red-300">{agentError}</p>
                </div>
              </div>
            )}

            {agentStatement && (
              <div className="mt-6 space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Agent</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                      {agentStatement.agentName}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Commission</p>
                    <p className="text-sm font-semibold text-green-600 mt-0.5">
                      {formatCurrency(agentStatement.totalCommission)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Draw Payments</p>
                    <p className="text-sm font-semibold text-red-600 mt-0.5">
                      {formatCurrency(agentStatement.totalDrawPayments)}
                    </p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Net Payable</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                      {formatCurrency(agentStatement.netPayable)}
                    </p>
                  </div>
                </div>

                {/* Transactions */}
                {agentStatement.transactions.length > 0 && (
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Policy
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Carrier
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Insured
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Type
                          </th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {agentStatement.transactions.map((txn) => (
                          <tr
                            key={txn.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                              {txn.policyNumber}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                              {txn.carrierName || "-"}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                              {txn.insuredName || "-"}
                            </td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">
                              {formatTransactionType(txn.transactionType)}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                              {formatCurrency(txn.commissionAmount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {agentStatement.transactions.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No transactions found for this agent and month.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ================================================================= */}
        {/* CARRIER SUMMARY                                                    */}
        {/* ================================================================= */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Carrier Summary
                </h2>
              </div>
              <button
                onClick={handleGenerateCarrierSummary}
                disabled={carrierLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {carrierLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
                Generate
              </button>
            </div>
          </div>

          <div className="px-6 py-4">
            {carrierError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-800 dark:text-red-300">{carrierError}</p>
                </div>
              </div>
            )}

            {carrierSummary.length > 0 ? (
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Carrier
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Transactions
                      </th>
                      <th className="text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Total Commission
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {carrierSummary.map((row) => (
                      <tr
                        key={row.carrierId}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                          {row.carrierName}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                          {row.transactionCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">
                          {formatCurrency(row.totalCommission)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr className="bg-gray-50 dark:bg-gray-700/50 font-semibold">
                      <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">
                        Total
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-900 dark:text-gray-100">
                        {carrierSummary
                          .reduce((sum, r) => sum + r.transactionCount, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-900 dark:text-gray-100">
                        {formatCurrency(
                          carrierSummary.reduce((sum, r) => sum + r.totalCommission, 0)
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              !carrierLoading && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  Click &quot;Generate&quot; to create a carrier summary for this month.
                </p>
              )
            )}

            {carrierLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </section>

        {/* ================================================================= */}
        {/* EXPORT                                                             */}
        {/* ================================================================= */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Export
              </h2>
            </div>
          </div>

          <div className="px-6 py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="w-full sm:w-64">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Export Type
                </label>
                <select
                  value={exportType}
                  onChange={(e) => setExportType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="transactions">Transactions</option>
                  <option value="agent-statement">Agent Statement</option>
                  <option value="carrier-summary">Carrier Summary</option>
                </select>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download CSV
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
