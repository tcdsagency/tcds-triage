"use client";

import { useState } from "react";
import {
  Sparkles,
  X,
  Phone,
  ListTodo,
  ChevronRight,
  Copy,
  Check,
  Calendar,
  User,
  DollarSign,
  Activity,
  ShieldAlert,
  Info,
  TrendingUp,
} from "lucide-react";
import {
  AICrossSellCardProps,
  OpportunityConfidence,
  IndicatorTrigger,
  formatCurrency,
  getConfidenceBadgeColor,
} from "@/types/lifeInsurance.types";

export function AICrossSellCard({
  opportunity,
  onDismiss,
  onGetQuotes,
  onCallCustomer,
  onCreateTask,
}: AICrossSellCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [scriptCopied, setScriptCopied] = useState(false);

  const handleCopyScript = async () => {
    if (opportunity.suggestedScript) {
      await navigator.clipboard.writeText(opportunity.suggestedScript);
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    }
  };

  const getIndicatorIcon = (type: IndicatorTrigger["type"]) => {
    switch (type) {
      case "life_event":
        return <Calendar className="w-3 h-3" />;
      case "demographic":
        return <User className="w-3 h-3" />;
      case "financial":
        return <DollarSign className="w-3 h-3" />;
      case "behavioral":
        return <Activity className="w-3 h-3" />;
      case "policy_gap":
        return <ShieldAlert className="w-3 h-3" />;
      default:
        return <Info className="w-3 h-3" />;
    }
  };

  const confidenceConfig = {
    [OpportunityConfidence.HIGH]: {
      gradient: "from-emerald-500 to-emerald-600",
      bgGradient: "from-emerald-50 to-white",
      border: "border-emerald-200",
      badge: "bg-emerald-100 text-emerald-700",
      icon: "text-emerald-500",
      label: "High Confidence",
    },
    [OpportunityConfidence.MEDIUM]: {
      gradient: "from-amber-500 to-amber-600",
      bgGradient: "from-amber-50 to-white",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-700",
      icon: "text-amber-500",
      label: "Medium Confidence",
    },
    [OpportunityConfidence.LOW]: {
      gradient: "from-gray-400 to-gray-500",
      bgGradient: "from-gray-50 to-white",
      border: "border-gray-200",
      badge: "bg-gray-100 text-gray-700",
      icon: "text-gray-500",
      label: "Low Confidence",
    },
  };

  const config = confidenceConfig[opportunity.confidence];

  return (
    <div
      className={`rounded-lg border ${config.border} overflow-hidden bg-gradient-to-br ${config.bgGradient} shadow-sm`}
    >
      {/* Header */}
      <div
        className={`bg-gradient-to-r ${config.gradient} px-4 py-3 text-white`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">AI Cross-Sell Opportunity</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-white/20`}
            >
              {config.label}
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Summary */}
        <p className="text-sm text-gray-700 leading-relaxed">
          {opportunity.summary}
        </p>

        {/* Confidence Score */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-500">Confidence Score</span>
              <span className="font-medium text-gray-700">
                {opportunity.confidenceScore}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500`}
                style={{ width: `${opportunity.confidenceScore}%` }}
              />
            </div>
          </div>
        </div>

        {/* Key Indicators */}
        {opportunity.indicators.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-gray-700 mb-2">
              Key Indicators
            </h4>
            <div className="space-y-2">
              {opportunity.indicators.map((indicator, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 p-2 bg-white rounded-md border border-gray-100"
                >
                  <div
                    className={`p-1 rounded ${config.badge} flex-shrink-0 mt-0.5`}
                  >
                    {getIndicatorIcon(indicator.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-700">
                        {indicator.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {indicator.value}
                    </p>
                    {indicator.source && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {indicator.source}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-md border border-gray-100 p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <TrendingUp className="w-3 h-3" />
              Recommended Coverage
            </div>
            <div className="text-sm font-medium text-gray-900">
              {formatCurrency(opportunity.recommendedCoverage.min)} -{" "}
              {formatCurrency(opportunity.recommendedCoverage.max)}
            </div>
          </div>
          <div className="bg-white rounded-md border border-gray-100 p-3">
            <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
              <Calendar className="w-3 h-3" />
              Recommended Term
            </div>
            <div className="text-sm font-medium text-gray-900">
              {opportunity.recommendedTermLength} Years
            </div>
          </div>
        </div>

        {/* Best Time to Call */}
        {opportunity.bestTimeToCall && (
          <div className="flex items-center gap-2 text-xs text-gray-600 bg-blue-50 px-3 py-2 rounded-md">
            <Phone className="w-3 h-3 text-blue-500" />
            Best time to call: <strong>{opportunity.bestTimeToCall}</strong>
          </div>
        )}

        {/* Suggested Script */}
        {opportunity.suggestedScript && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-medium text-gray-700">
                Suggested Script
              </h4>
              <button
                onClick={handleCopyScript}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                {scriptCopied ? (
                  <>
                    <Check className="w-3 h-3" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy Script
                  </>
                )}
              </button>
            </div>
            <div className="bg-white rounded-md border border-gray-200 p-3 text-xs text-gray-600 whitespace-pre-wrap max-h-32 overflow-y-auto">
              {opportunity.suggestedScript}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={onGetQuotes}
            className={`flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-md bg-gradient-to-r ${config.gradient} hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5`}
          >
            Get Quotes
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onCallCustomer}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <Phone className="w-4 h-4" />
            Call
          </button>
          <button
            onClick={onCreateTask}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <ListTodo className="w-4 h-4" />
            Task
          </button>
        </div>
      </div>
    </div>
  );
}

export default AICrossSellCard;
