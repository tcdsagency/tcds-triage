"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, PlayCircle, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { MonthSelector } from "@/components/commissions/MonthSelector";
import { MonthCloseChecklist } from "@/components/commissions/MonthCloseChecklist";
import type { ValidationCheckResult, CommissionMonthCloseStatusType } from "@/types/commission.types";

// =============================================================================
// TYPES
// =============================================================================

interface MonthCloseData {
  id: string;
  reportingMonth: string;
  status: CommissionMonthCloseStatusType;
  lockedAt: string | null;
  unlockedAt: string | null;
  validationResults: ValidationCheckResult[] | null;
  notes: string | null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MonthClosePage() {
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [data, setData] = useState<MonthCloseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [locking, setLocking] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // ---------------------------------------------------------------------------
  // FETCH STATUS
  // ---------------------------------------------------------------------------

  const fetchStatus = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/commissions/month-close?month=${encodeURIComponent(month)}`
      );
      if (!res.ok) throw new Error("Failed to load month-close status");
      const json = await res.json();
      if (json.success) {
        setData(json.data || null);
      } else {
        throw new Error(json.error || "Unexpected response");
      }
    } catch (err: any) {
      console.error("Month-close fetch error:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(selectedMonth);
  }, [selectedMonth, fetchStatus]);

  // ---------------------------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------------------------

  const handleValidate = async () => {
    setValidating(true);
    try {
      const res = await fetch("/api/commissions/month-close/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      if (!res.ok) throw new Error("Validation failed");
      const json = await res.json();
      if (json.success) {
        toast.success("Validation complete");
        fetchStatus(selectedMonth);
      } else {
        throw new Error(json.error || "Validation failed");
      }
    } catch (err: any) {
      console.error("Validation error:", err);
      toast.error(err.message || "Failed to run validation");
    } finally {
      setValidating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // LOCK / UNLOCK
  // ---------------------------------------------------------------------------

  const handleLock = async () => {
    setLocking(true);
    try {
      const res = await fetch("/api/commissions/month-close/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      if (!res.ok) throw new Error("Failed to lock month");
      const json = await res.json();
      if (json.success) {
        toast.success("Month locked successfully");
        fetchStatus(selectedMonth);
      } else {
        throw new Error(json.error || "Failed to lock");
      }
    } catch (err: any) {
      console.error("Lock error:", err);
      toast.error(err.message || "Failed to lock month");
    } finally {
      setLocking(false);
    }
  };

  const handleUnlock = async () => {
    setUnlocking(true);
    try {
      const res = await fetch("/api/commissions/month-close/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: selectedMonth }),
      });
      if (!res.ok) throw new Error("Failed to unlock month");
      const json = await res.json();
      if (json.success) {
        toast.success("Month unlocked");
        fetchStatus(selectedMonth);
      } else {
        throw new Error(json.error || "Failed to unlock");
      }
    } catch (err: any) {
      console.error("Unlock error:", err);
      toast.error(err.message || "Failed to unlock month");
    } finally {
      setUnlocking(false);
    }
  };

  // ---------------------------------------------------------------------------
  // DERIVED STATE
  // ---------------------------------------------------------------------------

  const isLocked = data?.status === "locked";
  const checks = data?.validationResults || [];
  const allPassed = checks.length > 0 && checks.every((c) => c.passed);

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
              Month Close
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Validate and finalize monthly commission processing
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthSelector value={selectedMonth} onChange={setSelectedMonth} />
          </div>
        </div>

        {/* STATUS BANNER */}
        {!loading && data && (
          <div
            className={`rounded-lg border p-4 ${
              isLocked
                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              {isLocked ? (
                <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              ) : (
                <Unlock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              )}
              <p
                className={`text-sm font-medium ${
                  isLocked
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-blue-800 dark:text-blue-300"
                }`}
              >
                {isLocked
                  ? `Month is locked${data.lockedAt ? ` (locked ${new Date(data.lockedAt).toLocaleDateString()})` : ""}`
                  : `Month is ${data.status === "in_review" ? "in review" : "open"}`}
              </p>
            </div>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {validating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlayCircle className="h-4 w-4" />
            )}
            Run Validation
          </button>

          {!isLocked && (
            <button
              onClick={handleLock}
              disabled={locking || !allPassed}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={!allPassed ? "All validation checks must pass before locking" : ""}
            >
              {locking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              Lock Month
            </button>
          )}

          {isLocked && (
            <button
              onClick={handleUnlock}
              disabled={unlocking}
              className="inline-flex items-center gap-2 px-4 py-2 text-red-600 border border-red-300 dark:border-red-700 rounded-md text-sm font-medium hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {unlocking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlock className="h-4 w-4" />
              )}
              Unlock Month
            </button>
          )}
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
        ) : (
          <MonthCloseChecklist
            checks={checks}
            isRunning={validating}
            onLock={handleLock}
            canLock={allPassed && !locking}
            isLocked={isLocked}
            onUnlock={handleUnlock}
          />
        )}
      </div>
    </div>
  );
}
