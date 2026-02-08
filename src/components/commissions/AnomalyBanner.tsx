"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";

export function AnomalyBanner() {
  const [count, setCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/commissions/anomalies?resolved=false")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setCount(d.data?.length || 0);
      })
      .catch(() => {});
  }, []);

  if (count === 0 || dismissed) return null;

  return (
    <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm text-amber-800 dark:text-amber-300">
          {count} unresolved anomaly{count !== 1 ? "ies" : "y"} detected
        </span>
        <Link
          href="/commissions/transactions"
          className="text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline ml-1"
        >
          View details
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
