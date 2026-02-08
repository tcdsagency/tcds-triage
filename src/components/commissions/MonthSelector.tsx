"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthSelectorProps {
  value: string; // YYYY-MM
  onChange: (month: string) => void;
}

function formatMonthDisplay(month: string): string {
  try {
    const [year, m] = month.split("-");
    const date = new Date(parseInt(year), parseInt(m) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return month;
  }
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${mo}`;
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(shiftMonth(value, -1))}
        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        title="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-[160px] text-center">
        <input
          type="month"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent text-sm font-medium text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>
      <button
        onClick={() => onChange(shiftMonth(value, 1))}
        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
        title="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className="text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
        {formatMonthDisplay(value)}
      </span>
    </div>
  );
}
