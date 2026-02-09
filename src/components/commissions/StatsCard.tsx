"use client";

import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
  valueClassName?: string;
  iconClassName?: string;
}

export function StatsCard({ title, value, subtitle, icon: Icon, trend, className, valueClassName, iconClassName }: StatsCardProps) {
  return (
    <div className={cn("bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <p className={cn("mt-1 text-2xl font-semibold text-gray-900 dark:text-gray-100", valueClassName)}>{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-1 flex items-center gap-1">
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.value > 0
                    ? "text-green-600 dark:text-green-400"
                    : trend.value < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-500"
                )}
              >
                {trend.value > 0 ? "+" : ""}
                {trend.value.toFixed(1)}%
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className="ml-4 flex-shrink-0">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg",
              iconClassName || "bg-emerald-50 dark:bg-emerald-900/30"
            )}>
              <Icon className={cn(
                "h-6 w-6",
                iconClassName ? "text-inherit" : "text-emerald-600 dark:text-emerald-400"
              )} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
