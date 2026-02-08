"use client";

import { cn } from "@/lib/utils";
import { formatCurrency, getReconciliationStatusInfo } from "@/lib/commissions/formatters";

interface ReconciliationCardProps {
  carrierName: string;
  carrierStatementTotal: number | null;
  bankDepositTotal: number;
  systemTransactionTotal: number;
  statementVsDeposit: number | null;
  statementVsSystem: number | null;
  depositVsSystem: number;
  status: string;
  onResolve?: () => void;
}

export function ReconciliationCard({
  carrierName,
  carrierStatementTotal,
  bankDepositTotal,
  systemTransactionTotal,
  statementVsDeposit,
  statementVsSystem,
  depositVsSystem,
  status,
  onResolve,
}: ReconciliationCardProps) {
  const statusInfo = getReconciliationStatusInfo(status);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{carrierName}</h3>
        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium", statusInfo.color)}>
          {statusInfo.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Carrier Statement</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {carrierStatementTotal !== null ? formatCurrency(carrierStatementTotal) : "Not entered"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bank Deposits</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(bankDepositTotal)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">System Transactions</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(systemTransactionTotal)}
          </p>
        </div>
      </div>

      {/* Differences */}
      <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
        <DiffRow label="Deposit vs System" value={depositVsSystem} />
        {statementVsDeposit !== null && (
          <DiffRow label="Statement vs Deposit" value={statementVsDeposit} />
        )}
        {statementVsSystem !== null && (
          <DiffRow label="Statement vs System" value={statementVsSystem} />
        )}
      </div>

      {status === "discrepancy" && onResolve && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onResolve}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
          >
            Resolve Discrepancy
          </button>
        </div>
      )}
    </div>
  );
}

function DiffRow({ label, value }: { label: string; value: number }) {
  const isZero = Math.abs(value) < 0.01;
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={cn(
          "font-medium",
          isZero
            ? "text-green-600 dark:text-green-400"
            : "text-red-600 dark:text-red-400"
        )}
      >
        {isZero ? "$0.00" : formatCurrency(value)}
      </span>
    </div>
  );
}
