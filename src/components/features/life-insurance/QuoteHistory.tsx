"use client";

import { useState } from "react";
import {
  Clock,
  Mail,
  Eye,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Building2,
  DollarSign,
  Calendar,
  Shield,
} from "lucide-react";
import {
  QuoteHistoryProps,
  QuoteHistoryItem,
  LifeQuoteStatus,
  formatCurrency,
  formatCurrencyWithCents,
} from "@/types/lifeInsurance.types";

const statusConfig: Record<
  LifeQuoteStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  [LifeQuoteStatus.QUOTED]: {
    label: "Quoted",
    icon: <FileText className="w-3 h-3" />,
    className: "bg-blue-100 text-blue-700",
  },
  [LifeQuoteStatus.EMAILED]: {
    label: "Emailed",
    icon: <Mail className="w-3 h-3" />,
    className: "bg-purple-100 text-purple-700",
  },
  [LifeQuoteStatus.APPLICATION_STARTED]: {
    label: "App Started",
    icon: <AlertCircle className="w-3 h-3" />,
    className: "bg-amber-100 text-amber-700",
  },
  [LifeQuoteStatus.APPLICATION_SUBMITTED]: {
    label: "App Submitted",
    icon: <CheckCircle2 className="w-3 h-3" />,
    className: "bg-emerald-100 text-emerald-700",
  },
  [LifeQuoteStatus.POLICY_ISSUED]: {
    label: "Policy Issued",
    icon: <Shield className="w-3 h-3" />,
    className: "bg-green-100 text-green-700",
  },
  [LifeQuoteStatus.DECLINED]: {
    label: "Declined",
    icon: <XCircle className="w-3 h-3" />,
    className: "bg-red-100 text-red-700",
  },
  [LifeQuoteStatus.EXPIRED]: {
    label: "Expired",
    icon: <Clock className="w-3 h-3" />,
    className: "bg-gray-100 text-gray-600",
  },
};

export function QuoteHistory({
  customerId,
  history,
  onViewQuote,
  onEmailQuote,
}: QuoteHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpanded = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (history.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center">
        <Clock className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">No quote history yet</p>
        <p className="text-xs text-gray-400 mt-1">
          Quotes will appear here once generated
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">Quote History</h3>
        <span className="text-xs text-gray-500">
          {history.length} quote{history.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-2">
        {history.map((item) => (
          <HistoryCard
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggleExpand={() => toggleExpanded(item.id)}
            onView={() => onViewQuote(item.id)}
            onEmail={() => onEmailQuote(item.id)}
            formatDate={formatDate}
            formatTime={formatTime}
          />
        ))}
      </div>
    </div>
  );
}

interface HistoryCardProps {
  item: QuoteHistoryItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onView: () => void;
  onEmail: () => void;
  formatDate: (date: string) => string;
  formatTime: (date: string) => string;
}

function HistoryCard({
  item,
  isExpanded,
  onToggleExpand,
  onView,
  onEmail,
  formatDate,
  formatTime,
}: HistoryCardProps) {
  const status = statusConfig[item.status] || statusConfig[LifeQuoteStatus.QUOTED];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Main Row */}
      <div
        className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Carrier Logo/Icon */}
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              {item.bestQuote.carrier.logoUrl ? (
                <img
                  src={item.bestQuote.carrier.logoUrl}
                  alt={item.bestQuote.carrier.name}
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.parentElement!.innerHTML = `<span class="text-xs font-bold text-gray-400">${item.bestQuote.carrier.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}</span>`;
                  }}
                />
              ) : (
                <Building2 className="w-5 h-5 text-gray-400" />
              )}
            </div>

            {/* Quote Info */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(item.requestParams.coverageAmount)}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600">
                  {item.requestParams.termLength}yr Term
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${status.className}`}
                >
                  {status.icon}
                  {status.label}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">
                  {item.bestQuote.carrier.name}
                </span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">
                  {formatDate(item.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* Premium & Expand Icon */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-semibold text-gray-900">
                {formatCurrencyWithCents(item.bestQuote.monthlyPremium)}
              </div>
              <div className="text-xs text-gray-500">/mo</div>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-100">
          {/* Quote Details Grid */}
          <div className="grid grid-cols-3 gap-3 py-3">
            <div>
              <span className="text-xs text-gray-500 block">Health Class</span>
              <span className="text-sm text-gray-900 capitalize">
                {item.requestParams.healthClass}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Tobacco</span>
              <span className="text-sm text-gray-900 capitalize">
                {item.requestParams.tobaccoUse === "never"
                  ? "Non-smoker"
                  : item.requestParams.tobaccoUse}
              </span>
            </div>
            <div>
              <span className="text-xs text-gray-500 block">Quotes</span>
              <span className="text-sm text-gray-900">
                {item.allQuotes.length} carriers
              </span>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center gap-3 py-2 border-t border-gray-100">
            {item.emailedToCustomer && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                <Mail className="w-3 h-3 text-purple-500" />
                Emailed to customer
              </span>
            )}
            {item.applicationStarted && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                <FileText className="w-3 h-3 text-emerald-500" />
                Application started
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onView();
              }}
              className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
            >
              <Eye className="w-3 h-3" />
              View Details
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEmail();
              }}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
            >
              <Mail className="w-3 h-3" />
              Email Quote
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuoteHistory;
