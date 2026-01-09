"use client";

import { useState } from "react";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  DollarSign,
  Target,
  Heart,
  Star,
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import type {
  DonnaCustomerData,
  DonnaSentimentDisplay,
  DonnaChurnRiskDisplay,
} from "@/types/donna.types";
import { getSentimentDisplay, getChurnRiskLevel } from "@/types/donna.types";

interface DonnaInsightsCardProps {
  customerId: string;
  donnaData: DonnaCustomerData | null;
  lastSyncedAt?: string | Date | null;
  onRefresh?: () => Promise<void>;
  compact?: boolean;
}

const SENTIMENT_COLORS: Record<
  DonnaSentimentDisplay["color"],
  { bg: string; text: string }
> = {
  green: {
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-300",
  },
  lime: {
    bg: "bg-lime-50 dark:bg-lime-900/20",
    text: "text-lime-700 dark:text-lime-300",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    text: "text-yellow-700 dark:text-yellow-300",
  },
  orange: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-700 dark:text-orange-300",
  },
  red: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
  },
};

const CHURN_COLORS: Record<
  DonnaChurnRiskDisplay["level"],
  { bg: string; text: string }
> = {
  low: {
    bg: "bg-green-50 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-300",
  },
  medium: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    text: "text-yellow-700 dark:text-yellow-300",
  },
  high: {
    bg: "bg-orange-50 dark:bg-orange-900/20",
    text: "text-orange-700 dark:text-orange-300",
  },
  critical: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
  },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: {
    bg: "bg-red-50 dark:bg-red-900/20",
    text: "text-red-800 dark:text-red-200",
  },
  medium: {
    bg: "bg-yellow-50 dark:bg-yellow-900/20",
    text: "text-yellow-800 dark:text-yellow-200",
  },
  low: {
    bg: "bg-gray-50 dark:bg-gray-900/50",
    text: "text-gray-800 dark:text-gray-200",
  },
};

export function DonnaInsightsCard({
  customerId,
  donnaData,
  lastSyncedAt,
  onRefresh,
  compact = false,
}: DonnaInsightsCardProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["metrics"])
  );

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const formatDate = (date: string | Date | null | undefined): string => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // No Donna data yet
  if (!donnaData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Donna AI Insights
            </h3>
          </div>
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Fetch
                </>
              )}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No Donna AI data available. Click &quot;Fetch&quot; to sync insights
          for this customer.
        </p>
      </div>
    );
  }

  const sentiment = getSentimentDisplay(donnaData.sentimentScore);
  const churnRisk = getChurnRiskLevel(donnaData.retentionProbability);
  const isVIP = donnaData.isPersonalVIP || donnaData.isCommercialVIP;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-pink-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            Donna AI Insights
          </h3>
          {isVIP && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
              <Star className="w-3 h-3 mr-1" />
              VIP
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastSyncedAt && (
            <span className="text-xs text-gray-500">
              {formatDate(lastSyncedAt)}
            </span>
          )}
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              title="Refresh Donna data"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Sentiment & Churn Risk - Always Visible */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Sentiment Score */}
        <div
          className={`p-3 rounded-lg ${SENTIMENT_COLORS[sentiment.color].bg}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Sentiment
            </span>
            <span className="text-lg">{sentiment.emoji}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {donnaData.sentimentScore}
          </div>
          <div className={`text-xs font-medium ${SENTIMENT_COLORS[sentiment.color].text}`}>
            {sentiment.label}
          </div>
        </div>

        {/* Churn Risk */}
        <div className={`p-3 rounded-lg ${CHURN_COLORS[churnRisk.level].bg}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Retention
            </span>
            {churnRisk.level === "low" ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown
                className={`w-4 h-4 ${
                  churnRisk.level === "medium"
                    ? "text-yellow-500"
                    : churnRisk.level === "high"
                      ? "text-orange-500"
                      : "text-red-500"
                }`}
              />
            )}
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(donnaData.retentionProbability * 100)}%
          </div>
          <div className={`text-xs font-medium ${CHURN_COLORS[churnRisk.level].text}`}>
            {churnRisk.label}
          </div>
        </div>
      </div>

      {/* Financial Metrics */}
      {!compact && (
        <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Current Premium
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              ${donnaData.currentAnnualPremium.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Est. Wallet
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              ${donnaData.estimatedWalletSize.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Gap / Opportunity
            </div>
            <div
              className={`text-sm font-semibold ${
                donnaData.potentialGap > 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-gray-500"
              }`}
            >
              {donnaData.potentialGap > 0 ? "+" : ""}$
              {donnaData.potentialGap.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Cross-Sell Probability */}
      {donnaData.crossSellProbability > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                Cross-Sell Opportunity
              </span>
            </div>
            <span className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {Math.round(donnaData.crossSellProbability * 100)}%
            </span>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            High probability of purchasing additional coverage
          </p>
        </div>
      )}

      {/* Recommendations Section */}
      {donnaData.recommendations.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <button
            onClick={() => toggleSection("recommendations")}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                Recommendations ({donnaData.recommendations.length})
              </span>
            </div>
            {expandedSections.has("recommendations") ? (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {expandedSections.has("recommendations") && (
            <div className="mt-3 space-y-2">
              {donnaData.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={`p-3 rounded-lg text-sm ${PRIORITY_COLORS[rec.priority]?.bg || PRIORITY_COLORS.medium.bg}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span
                      className={`font-medium ${PRIORITY_COLORS[rec.priority]?.text || PRIORITY_COLORS.medium.text}`}
                    >
                      {rec.title}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded capitalize">
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {rec.description}
                  </p>
                  {rec.suggestedAction && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                      {rec.suggestedAction}
                    </p>
                  )}
                  {rec.estimatedPremium && rec.estimatedPremium > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      Est. premium: ${rec.estimatedPremium.toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Warning for high churn risk */}
      {churnRisk.level === "high" || churnRisk.level === "critical" ? (
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                High Churn Risk Alert
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                This customer has a{" "}
                {Math.round((1 - donnaData.retentionProbability) * 100)}%
                probability of churning. Consider proactive outreach.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
