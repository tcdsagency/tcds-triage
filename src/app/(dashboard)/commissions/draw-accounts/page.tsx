"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, RefreshCw, Plus, X, DollarSign, Calendar, FileText } from "lucide-react";
import { toast } from "sonner";
import { MonthSelector } from "@/components/commissions/MonthSelector";
import { DrawBalanceChart } from "@/components/commissions/DrawBalanceChart";
import { AgentSelector } from "@/components/commissions/AgentSelector";
import { formatCurrency, formatDate } from "@/lib/commissions/formatters";

// =============================================================================
// TYPES
// =============================================================================

interface DrawBalanceData {
  agentId: string;
  agentName: string;
  balanceForward: number;
  totalCommissionsEarned: number;
  totalDrawPayments: number;
  endingBalance: number;
  monthlyDrawAmount: number;
}

interface DrawPayment {
  id: string;
  agentId: string;
  agentName: string;
  amount: number;
  paymentDate: string;
  reportingMonth: string;
  notes: string | null;
  createdAt: string;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DrawAccountsPage() {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [balances, setBalances] = useState<DrawBalanceData[]>([]);
  const [payments, setPayments] = useState<DrawPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recalculating, setRecalculating] = useState(false);

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAgentId, setPaymentAgentId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [paymentNotes, setPaymentNotes] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // ---------------------------------------------------------------------------
  // FETCH BALANCES
  // ---------------------------------------------------------------------------

  const fetchBalances = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/commissions/draw?month=${encodeURIComponent(month)}`
      );
      if (!res.ok) throw new Error("Failed to load draw balances");
      const json = await res.json();
      if (json.success) {
        setBalances(json.data || []);
      } else {
        throw new Error(json.error || "Unexpected response");
      }
    } catch (err: any) {
      console.error("Draw balances fetch error:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // FETCH PAYMENTS
  // ---------------------------------------------------------------------------

  const fetchPayments = useCallback(async (month: string) => {
    setPaymentsLoading(true);
    try {
      const res = await fetch(
        `/api/commissions/draw/payments?month=${encodeURIComponent(month)}`
      );
      if (!res.ok) throw new Error("Failed to load payments");
      const json = await res.json();
      if (json.success) {
        setPayments(json.data || []);
      } else {
        throw new Error(json.error || "Unexpected response");
      }
    } catch (err: any) {
      console.error("Payments fetch error:", err);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBalances(selectedMonth);
    fetchPayments(selectedMonth);
  }, [selectedMonth, fetchBalances, fetchPayments]);

  // ---------------------------------------------------------------------------
  // RECALCULATE
  // ---------------------------------------------------------------------------

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await fetch(
        `/api/commissions/draw?month=${encodeURIComponent(selectedMonth)}&recalculate=true`
      );
      if (!res.ok) throw new Error("Recalculation failed");
      const json = await res.json();
      if (json.success) {
        toast.success("Draw balances recalculated");
        setBalances(json.data || []);
        fetchPayments(selectedMonth);
      } else {
        throw new Error(json.error || "Recalculation failed");
      }
    } catch (err: any) {
      console.error("Recalculate error:", err);
      toast.error(err.message || "Failed to recalculate balances");
    } finally {
      setRecalculating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RECORD PAYMENT
  // ---------------------------------------------------------------------------

  const openPaymentModal = () => {
    setPaymentAgentId(null);
    setPaymentAmount("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
    setPaymentNotes("");
    setPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setPaymentModalOpen(false);
  };

  const handleSubmitPayment = async () => {
    if (!paymentAgentId) {
      toast.error("Please select an agent");
      return;
    }
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setSubmittingPayment(true);
    try {
      const res = await fetch("/api/commissions/draw/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: paymentAgentId,
          amount: parseFloat(paymentAmount),
          paymentDate: paymentDate,
          reportingMonth: selectedMonth,
          notes: paymentNotes || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to record payment");
      const json = await res.json();
      if (json.success) {
        toast.success("Draw payment recorded");
        closePaymentModal();
        fetchBalances(selectedMonth);
        fetchPayments(selectedMonth);
      } else {
        throw new Error(json.error || "Failed to record payment");
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
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
              Draw Accounts
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Track agent draw balances, payments, and repayments
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
              Recalculate Balances
            </button>
          </div>
        </div>

        {/* BALANCES */}
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
        ) : (
          <DrawBalanceChart data={balances} />
        )}

        {/* RECORD PAYMENT BUTTON */}
        <div className="flex justify-end">
          <button
            onClick={openPaymentModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Record Draw Payment
          </button>
        </div>

        {/* RECENT PAYMENTS TABLE */}
        <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Recent Draw Payments
            </h2>
          </div>

          {paymentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : payments.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <DollarSign className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No draw payments recorded for this month.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Agent
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Payment Date
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {payment.agentName}
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-3 text-gray-600 dark:text-gray-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gray-400" />
                          {formatDate(payment.paymentDate)}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                        {payment.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ===================================================================== */}
      {/* PAYMENT MODAL                                                          */}
      {/* ===================================================================== */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Record Draw Payment
              </h3>
              <button
                onClick={closePaymentModal}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Agent */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent
                </label>
                <AgentSelector
                  value={paymentAgentId}
                  onChange={(id) => setPaymentAgentId(id)}
                  placeholder="Select agent..."
                  allowClear={false}
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  placeholder="Payment details..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closePaymentModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPayment}
                disabled={submittingPayment}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingPayment && <Loader2 className="h-4 w-4 animate-spin" />}
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
