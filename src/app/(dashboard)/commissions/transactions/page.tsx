"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { CommissionTable } from "@/components/commissions/CommissionTable";
import { MonthSelector } from "@/components/commissions/MonthSelector";
import { CarrierSelector } from "@/components/commissions/CarrierSelector";
import { AllocationEditor } from "@/components/commissions/AllocationEditor";
import {
  formatCurrency,
  formatTransactionType,
  formatDate,
} from "@/lib/commissions/formatters";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface Transaction {
  id: string;
  policyNumber: string;
  carrierName: string | null;
  carrierId: string | null;
  insuredName: string | null;
  transactionType: string;
  commissionAmount: number;
  effectiveDate: string | null;
  reportingMonth: string | null;
  source: string;
  lineOfBusiness: string | null;
  statementDate: string | null;
  agentPaidDate: string | null;
  grossPremium: number | null;
  commissionRate: number | null;
  notes: string | null;
  [key: string]: unknown;
}

interface FetchResponse {
  success: boolean;
  data: Transaction[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
  error?: string;
}

interface FormData {
  policyNumber: string;
  commissionAmount: string;
  carrierId: string | null;
  carrierName: string;
  insuredName: string;
  transactionType: string;
  lineOfBusiness: string;
  effectiveDate: string;
  statementDate: string;
  agentPaidDate: string;
  grossPremium: string;
  commissionRate: string;
  notes: string;
}

const EMPTY_FORM: FormData = {
  policyNumber: "",
  commissionAmount: "",
  carrierId: null,
  carrierName: "",
  insuredName: "",
  transactionType: "new_business",
  lineOfBusiness: "",
  effectiveDate: "",
  statementDate: "",
  agentPaidDate: "",
  grossPremium: "",
  commissionRate: "",
  notes: "",
};

const TRANSACTION_TYPES = [
  { value: "new_business", label: "New Business" },
  { value: "renewal", label: "Renewal" },
  { value: "cancellation", label: "Cancellation" },
  { value: "endorsement", label: "Endorsement" },
  { value: "return_premium", label: "Return Premium" },
  { value: "bonus", label: "Bonus" },
  { value: "override", label: "Override" },
  { value: "contingency", label: "Contingency" },
  { value: "other", label: "Other" },
];

const FILTER_TRANSACTION_TYPES = [
  { value: "", label: "All Types" },
  ...TRANSACTION_TYPES,
];

// =============================================================================
// HELPERS
// =============================================================================

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function TransactionsPage() {
  // ---- Data state ----
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ---- Filter state ----
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(getCurrentMonth());
  const [carrierId, setCarrierId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 50;

  // ---- Expanded row state ----
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ---- Modal state ----
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ---- Delete state ----
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---- Fetch transactions ----
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (carrierId) params.set("carrierId", carrierId);
      if (month) params.set("month", month);
      if (typeFilter) params.set("type", typeFilter);
      params.set("page", String(page));
      params.set("limit", String(limit));

      const res = await fetch(
        `/api/commissions/transactions?${params.toString()}`
      );
      const json: FetchResponse = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Failed to load transactions");
      }

      setTransactions(json.data);
      setTotalPages(json.totalPages);
      setTotalCount(json.count);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load transactions"
      );
    } finally {
      setLoading(false);
    }
  }, [search, carrierId, month, typeFilter, page, limit]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, carrierId, month, typeFilter]);

  // ---- Modal helpers ----
  const openAddModal = () => {
    setEditingTransaction(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (txn: Transaction) => {
    setEditingTransaction(txn);
    setForm({
      policyNumber: txn.policyNumber || "",
      commissionAmount: txn.commissionAmount != null ? String(txn.commissionAmount) : "",
      carrierId: txn.carrierId || null,
      carrierName: txn.carrierName || "",
      insuredName: txn.insuredName || "",
      transactionType: txn.transactionType || "other",
      lineOfBusiness: txn.lineOfBusiness || "",
      effectiveDate: txn.effectiveDate ? txn.effectiveDate.slice(0, 10) : "",
      statementDate: txn.statementDate ? txn.statementDate.slice(0, 10) : "",
      agentPaidDate: txn.agentPaidDate ? txn.agentPaidDate.slice(0, 10) : "",
      grossPremium: txn.grossPremium != null ? String(txn.grossPremium) : "",
      commissionRate: txn.commissionRate != null ? String(txn.commissionRate) : "",
      notes: txn.notes || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingTransaction(null);
    setForm(EMPTY_FORM);
  };

  const updateForm = (field: keyof FormData, value: string | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // ---- Save (Add / Edit) ----
  const handleSave = async () => {
    if (!form.policyNumber.trim()) {
      toast.error("Policy number is required");
      return;
    }
    if (!form.commissionAmount || isNaN(parseFloat(form.commissionAmount))) {
      toast.error("A valid commission amount is required");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        policyNumber: form.policyNumber.trim(),
        commissionAmount: parseFloat(form.commissionAmount),
        transactionType: form.transactionType,
        source: "manual",
      };
      if (form.carrierId) body.carrierId = form.carrierId;
      if (form.carrierName.trim()) body.carrierName = form.carrierName.trim();
      if (form.insuredName.trim()) body.insuredName = form.insuredName.trim();
      if (form.lineOfBusiness.trim())
        body.lineOfBusiness = form.lineOfBusiness.trim();
      if (form.effectiveDate) body.effectiveDate = form.effectiveDate;
      if (form.statementDate) body.statementDate = form.statementDate;
      if (form.agentPaidDate) body.agentPaidDate = form.agentPaidDate;
      if (form.grossPremium && !isNaN(parseFloat(form.grossPremium)))
        body.grossPremium = parseFloat(form.grossPremium);
      if (form.commissionRate && !isNaN(parseFloat(form.commissionRate)))
        body.commissionRate = parseFloat(form.commissionRate);
      if (form.notes.trim()) body.notes = form.notes.trim();

      const isEdit = !!editingTransaction;
      const url = isEdit
        ? `/api/commissions/transactions?id=${editingTransaction!.id}`
        : "/api/commissions/transactions";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || "Failed to save transaction");
      }

      toast.success(
        isEdit ? "Transaction updated" : "Transaction created"
      );
      closeModal();
      fetchTransactions();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save transaction"
      );
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete ----
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/commissions/transactions?id=${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete");
      toast.success("Transaction deleted");
      if (expandedId === id) setExpandedId(null);
      fetchTransactions();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete transaction"
      );
    } finally {
      setDeletingId(null);
    }
  };

  // ---- Row click to expand ----
  const handleRowClick = (row: Transaction) => {
    setExpandedId(expandedId === row.id ? null : row.id);
  };

  // ---- Table columns ----
  const columns = [
    {
      key: "policyNumber",
      label: "Policy #",
      sortable: true,
    },
    {
      key: "carrierName",
      label: "Carrier",
      sortable: true,
      render: (row: Transaction) => row.carrierName || "-",
    },
    {
      key: "insuredName",
      label: "Insured",
      sortable: true,
      render: (row: Transaction) => row.insuredName || "-",
    },
    {
      key: "transactionType",
      label: "Type",
      sortable: true,
      render: (row: Transaction) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
          {formatTransactionType(row.transactionType)}
        </span>
      ),
    },
    {
      key: "commissionAmount",
      label: "Amount",
      sortable: true,
      className: "text-right",
      render: (row: Transaction) => {
        const val = row.commissionAmount ?? 0;
        const isNeg = val < 0;
        return (
          <span className={isNeg ? "text-red-600 dark:text-red-400" : ""}>
            {formatCurrency(val)}
          </span>
        );
      },
    },
    {
      key: "effectiveDate",
      label: "Eff. Date",
      sortable: true,
      render: (row: Transaction) => formatDate(row.effectiveDate),
    },
    {
      key: "reportingMonth",
      label: "Reporting Month",
      sortable: true,
      render: (row: Transaction) => row.reportingMonth || "-",
    },
    {
      key: "source",
      label: "Source",
      sortable: true,
      render: (row: Transaction) => {
        const isManual = row.source === "manual";
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              isManual
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
            }`}
          >
            {isManual ? "Manual" : "Imported"}
          </span>
        );
      },
    },
    {
      key: "_actions",
      label: "Actions",
      render: (row: Transaction) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
            title="View / Edit"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            disabled={deletingId === row.id}
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50"
            title="Delete"
          >
            {deletingId === row.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      ),
    },
  ];

  // ---- Build table rows with expansion ----
  const tableRows: React.ReactNode[] = [];

  return (
    <div className="space-y-6">
      {/* ================================================================ */}
      {/* HEADER                                                           */}
      {/* ================================================================ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Commission Transactions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalCount.toLocaleString()} transaction{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Transaction
        </button>
      </div>

      {/* ================================================================ */}
      {/* FILTER BAR                                                       */}
      {/* ================================================================ */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search policy, insured, carrier..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Month */}
        <MonthSelector value={month} onChange={setMonth} />

        {/* Carrier */}
        <div className="w-48">
          <CarrierSelector
            value={carrierId}
            onChange={(id) => setCarrierId(id)}
            placeholder="All Carriers"
          />
        </div>

        {/* Transaction Type */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          {FILTER_TRANSACTION_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* ================================================================ */}
      {/* TABLE                                                            */}
      {/* ================================================================ */}
      <CommissionTable
        columns={columns}
        data={transactions}
        onRowClick={handleRowClick}
        isLoading={loading}
        emptyMessage="No transactions found for the selected filters."
      />

      {/* Expanded Allocation Editor */}
      {expandedId && (
        <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 -mt-2">
          {(() => {
            const txn = transactions.find((t) => t.id === expandedId);
            if (!txn) return null;
            return (
              <AllocationEditor
                transactionId={txn.id}
                commissionAmount={txn.commissionAmount ?? 0}
                onSave={() => fetchTransactions()}
              />
            );
          })()}
        </div>
      )}

      {/* ================================================================ */}
      {/* PAGINATION                                                       */}
      {/* ================================================================ */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ADD / EDIT MODAL                                                 */}
      {/* ================================================================ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingTransaction ? "Edit Transaction" : "Add Transaction"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Row: Policy # + Commission Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Policy Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.policyNumber}
                    onChange={(e) => updateForm("policyNumber", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., HO-12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Commission Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.commissionAmount}
                    onChange={(e) =>
                      updateForm("commissionAmount", e.target.value)
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Row: Carrier + Carrier Name */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Carrier
                  </label>
                  <CarrierSelector
                    value={form.carrierId}
                    onChange={(id, name) => {
                      updateForm("carrierId", id);
                      if (name) updateForm("carrierName", name);
                    }}
                    placeholder="Select carrier..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Carrier Name
                  </label>
                  <input
                    type="text"
                    value={form.carrierName}
                    onChange={(e) => updateForm("carrierName", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Override carrier name"
                  />
                </div>
              </div>

              {/* Row: Insured Name + Transaction Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Insured Name
                  </label>
                  <input
                    type="text"
                    value={form.insuredName}
                    onChange={(e) => updateForm("insuredName", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transaction Type
                  </label>
                  <select
                    value={form.transactionType}
                    onChange={(e) =>
                      updateForm("transactionType", e.target.value)
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {TRANSACTION_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row: Line of Business + Effective Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Line of Business
                  </label>
                  <input
                    type="text"
                    value={form.lineOfBusiness}
                    onChange={(e) =>
                      updateForm("lineOfBusiness", e.target.value)
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., Homeowners"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={form.effectiveDate}
                    onChange={(e) =>
                      updateForm("effectiveDate", e.target.value)
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Row: Statement Date + Agent Paid Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Statement Date
                  </label>
                  <input
                    type="date"
                    value={form.statementDate}
                    onChange={(e) =>
                      updateForm("statementDate", e.target.value)
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Agent Paid Date
                  </label>
                  <input
                    type="date"
                    value={form.agentPaidDate}
                    onChange={(e) =>
                      updateForm("agentPaidDate", e.target.value)
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Row: Gross Premium + Commission Rate */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gross Premium
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.grossPremium}
                    onChange={(e) => updateForm("grossPremium", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Commission Rate
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={form.commissionRate}
                    onChange={(e) =>
                      updateForm("commissionRate", e.target.value)
                    }
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="e.g., 0.15"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingTransaction ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
