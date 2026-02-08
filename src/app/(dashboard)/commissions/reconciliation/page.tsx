"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { MonthSelector } from "@/components/commissions/MonthSelector";
import { ReconciliationCard } from "@/components/commissions/ReconciliationCard";

// =============================================================================
// TYPES
// =============================================================================

interface ReconciliationRecord {
  id: string;
  carrierId: string;
  carrierName: string;
  carrierStatementTotal: number | null;
  bankDepositTotal: number;
  systemTransactionTotal: number;
  statementVsDeposit: number | null;
  statementVsSystem: number | null;
  depositVsSystem: number;
  status: string;
  resolutionNotes: string | null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function ReconciliationPage() {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [records, setRecords] = useState<ReconciliationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  // Resolve modal state
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<ReconciliationRecord | null>(null);
  const [resolveStatus, setResolveStatus] = useState("resolved");
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolveCarrierTotal, setResolveCarrierTotal] = useState("");
  const [resolving, setResolving] = useState(false);

  // ---------------------------------------------------------------------------
  // FETCH DATA
  // ---------------------------------------------------------------------------

  const fetchReconciliation = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/commissions/reconciliation?month=${encodeURIComponent(month)}`
      );
      if (!res.ok) throw new Error("Failed to load reconciliation data");
      const json = await res.json();
      if (json.success) {
        setRecords(json.data || []);
      } else {
        throw new Error(json.error || "Unexpected response");
      }
    } catch (err: any) {
      console.error("Reconciliation fetch error:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReconciliation(selectedMonth);
  }, [selectedMonth, fetchReconciliation]);

  // ---------------------------------------------------------------------------
  // RECALCULATE
  // ---------------------------------------------------------------------------

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch("/api/commissions/reconciliation/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      if (!res.ok) throw new Error("Recalculation failed");
      const json = await res.json();
      if (json.success) {
        toast.success("Reconciliation recalculated successfully");
        fetchReconciliation(selectedMonth);
      } else {
        throw new Error(json.error || "Recalculation failed");
      }
    } catch (err: any) {
      console.error("Recalculation error:", err);
      toast.error(err.message || "Failed to recalculate");
    } finally {
      setRecalculating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RESOLVE MODAL
  // ---------------------------------------------------------------------------

  const openResolveModal = (record: ReconciliationRecord) => {
    setResolveTarget(record);
    setResolveStatus("resolved");
    setResolveNotes(record.resolutionNotes || "");
    setResolveCarrierTotal(
      record.carrierStatementTotal !== null
        ? String(record.carrierStatementTotal)
        : ""
    );
    setResolveModalOpen(true);
  };

  const closeResolveModal = () => {
    setResolveModalOpen(false);
    setResolveTarget(null);
    setResolveNotes("");
    setResolveCarrierTotal("");
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setResolving(true);
    try {
      const body: Record<string, any> = {
        status: resolveStatus,
        resolutionNotes: resolveNotes,
      };
      if (resolveCarrierTotal.trim() !== "") {
        body.carrierStatementTotal = parseFloat(resolveCarrierTotal);
      }
      const res = await fetch(
        `/api/commissions/reconciliation/${resolveTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Failed to resolve discrepancy");
      const json = await res.json();
      if (json.success) {
        toast.success("Discrepancy resolved");
        closeResolveModal();
        fetchReconciliation(selectedMonth);
      } else {
        throw new Error(json.error || "Failed to resolve");
      }
    } catch (err: any) {
      console.error("Resolve error:", err);
      toast.error(err.message || "Failed to resolve discrepancy");
    } finally {
      setResolving(false);
    }
  };

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
              Reconciliation
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Match carrier statements, bank deposits, and system transactions
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
            <button
              onClick={handleRecalculate}
              disabled={recalculating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {recalculating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Recalculate
            </button>
          </div>
        </div>

        {/* CONTENT */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No reconciliation records for this month. Click &quot;Recalculate&quot; to
              generate.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {records.map((record) => (
              <ReconciliationCard
                key={record.id}
                carrierName={record.carrierName}
                carrierStatementTotal={record.carrierStatementTotal}
                bankDepositTotal={record.bankDepositTotal}
                systemTransactionTotal={record.systemTransactionTotal}
                statementVsDeposit={record.statementVsDeposit}
                statementVsSystem={record.statementVsSystem}
                depositVsSystem={record.depositVsSystem}
                status={record.status}
                onResolve={
                  record.status === "discrepancy"
                    ? () => openResolveModal(record)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* RESOLVE MODAL                                                          */}
      {/* ===================================================================== */}
      {resolveModalOpen && resolveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Resolve Discrepancy - {resolveTarget.carrierName}
              </h3>
              <button
                onClick={closeResolveModal}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={resolveStatus}
                  onChange={(e) => setResolveStatus(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="resolved">Resolved</option>
                  <option value="matched">Matched</option>
                  <option value="partial_match">Partial Match</option>
                  <option value="discrepancy">Discrepancy</option>
                </select>
              </div>

              {/* Resolution Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Resolution Notes
                </label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  rows={3}
                  placeholder="Describe how this discrepancy was resolved..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Carrier Statement Total */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Carrier Statement Total{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={resolveCarrierTotal}
                  onChange={(e) => setResolveCarrierTotal(e.target.value)}
                  placeholder="e.g. 12345.67"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeResolveModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={resolving}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
