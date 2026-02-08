"use client";

import { formatCurrency } from "@/lib/commissions/formatters";
import { cn } from "@/lib/utils";

interface DrawBalanceData {
  agentId: string;
  agentName: string;
  balanceForward: number;
  totalCommissionsEarned: number;
  totalDrawPayments: number;
  endingBalance: number;
  monthlyDrawAmount: number;
}

interface DrawBalanceChartProps {
  data: DrawBalanceData[];
}

export function DrawBalanceChart({ data }: DrawBalanceChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-center text-sm text-gray-500">
        No draw accounts configured
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((agent) => {
        const isPositive = agent.endingBalance >= 0;
        return (
          <div
            key={agent.agentId}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{agent.agentName}</h3>
              <span
                className={cn(
                  "text-lg font-bold",
                  isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                )}
              >
                {formatCurrency(agent.endingBalance)}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Balance Forward</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(agent.balanceForward)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Commissions Earned</p>
                <p className="font-medium text-green-600">{formatCurrency(agent.totalCommissionsEarned)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Draw Payments</p>
                <p className="font-medium text-red-600">{formatCurrency(agent.totalDrawPayments)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Monthly Draw</p>
                <p className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(agent.monthlyDrawAmount)}</p>
              </div>
            </div>

            {/* Visual bar */}
            <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              {agent.totalCommissionsEarned > 0 && (
                <div
                  className={cn(
                    "h-full rounded-full",
                    isPositive ? "bg-green-500" : "bg-red-500"
                  )}
                  style={{
                    width: `${Math.min(100, (agent.totalCommissionsEarned / Math.max(agent.totalDrawPayments, agent.totalCommissionsEarned)) * 100)}%`,
                  }}
                />
              )}
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>{isPositive ? "Agency owes agent" : "Agent owes agency"}</span>
              <span>{formatCurrency(Math.abs(agent.endingBalance))}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
