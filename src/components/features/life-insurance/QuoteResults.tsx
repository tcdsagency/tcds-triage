"use client";

import { useState } from "react";
import {
  Check,
  Star,
  FileText,
  ArrowRight,
  Edit2,
  Mail,
  Save,
  Award,
  Shield,
  Clock,
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  QuoteResultsProps,
  QuoteDetails,
  formatCurrency,
  formatCurrencyWithCents,
} from "@/types/lifeInsurance.types";

export function QuoteResults({
  quotes,
  requestParams,
  onViewIllustration,
  onStartApplication,
  onEditQuote,
  onEmailResults,
  onSaveToHistory,
}: QuoteResultsProps) {
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);
  const [savingToHistory, setSavingToHistory] = useState(false);
  const [savedToHistory, setSavedToHistory] = useState(false);

  // Find the best value (lowest premium)
  const bestValueQuote = quotes.length > 0 ? quotes[0] : null;

  const handleSaveToHistory = async () => {
    setSavingToHistory(true);
    try {
      await onSaveToHistory();
      setSavedToHistory(true);
    } finally {
      setSavingToHistory(false);
    }
  };

  const toggleExpanded = (quoteId: string) => {
    setExpandedQuoteId((prev) => (prev === quoteId ? null : quoteId));
  };

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {quotes.length} Quote{quotes.length !== 1 ? "s" : ""} Found
            </h3>
            <p className="text-blue-100 text-sm mt-1">
              {formatCurrency(requestParams.coverageAmount)} •{" "}
              {requestParams.termLength}-Year Term
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEditQuote}
              className="px-3 py-1.5 text-xs font-medium bg-white/20 rounded-md hover:bg-white/30 transition-colors flex items-center gap-1"
            >
              <Edit2 className="w-3 h-3" />
              Edit Quote
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onEmailResults}
          className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
        >
          <Mail className="w-3 h-3" />
          Email to Customer
        </button>
        <button
          onClick={handleSaveToHistory}
          disabled={savingToHistory || savedToHistory}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
            savedToHistory
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
          }`}
        >
          {savedToHistory ? (
            <>
              <Check className="w-3 h-3" />
              Saved
            </>
          ) : savingToHistory ? (
            <>
              <svg
                className="animate-spin h-3 w-3"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Saving...
            </>
          ) : (
            <>
              <Save className="w-3 h-3" />
              Save to History
            </>
          )}
        </button>
      </div>

      {/* Quote Cards */}
      <div className="space-y-3">
        {quotes.map((quote, index) => (
          <QuoteCard
            key={quote.id}
            quote={quote}
            isBestValue={index === 0}
            isExpanded={expandedQuoteId === quote.id}
            onToggleExpand={() => toggleExpanded(quote.id)}
            onViewIllustration={() => onViewIllustration(quote.id)}
            onStartApplication={() => onStartApplication(quote.id)}
          />
        ))}
      </div>

      {quotes.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Shield className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No quotes available for the selected criteria.</p>
          <button
            onClick={onEditQuote}
            className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Try different options
          </button>
        </div>
      )}
    </div>
  );
}

interface QuoteCardProps {
  quote: QuoteDetails;
  isBestValue: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onViewIllustration: () => void;
  onStartApplication: () => void;
}

function QuoteCard({
  quote,
  isBestValue,
  isExpanded,
  onToggleExpand,
  onViewIllustration,
  onStartApplication,
}: QuoteCardProps) {
  return (
    <div
      className={`bg-white rounded-lg border ${
        isBestValue ? "border-emerald-300 ring-1 ring-emerald-100" : "border-gray-200"
      } overflow-hidden transition-all duration-200`}
    >
      {/* Main Content */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          {/* Carrier Info */}
          <div className="flex items-center gap-3">
            {/* Carrier Logo */}
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
              {quote.carrier.logoUrl ? (
                <img
                  src={quote.carrier.logoUrl}
                  alt={quote.carrier.name}
                  className="w-10 h-10 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.parentElement!.innerHTML = `<span class="text-xs font-bold text-gray-400">${quote.carrier.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}</span>`;
                  }}
                />
              ) : (
                <Building2 className="w-6 h-6 text-gray-400" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">
                  {quote.carrier.name}
                </h4>
                {isBestValue && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                    <Award className="w-3 h-3 mr-1" />
                    Best Value
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-gray-500">
                  {quote.productName}
                </span>
                {quote.carrier.amBestRating && (
                  <span className="inline-flex items-center text-xs text-amber-600">
                    <Star className="w-3 h-3 mr-0.5 fill-amber-400" />
                    {quote.carrier.amBestRating}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Premium */}
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrencyWithCents(quote.monthlyPremium)}
            </div>
            <div className="text-xs text-gray-500">/month</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Shield className="w-3 h-3 text-blue-500" />
            {formatCurrency(quote.deathBenefit)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            <Clock className="w-3 h-3 text-blue-500" />
            {quote.termLength} Years
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-600">
            Annual: {formatCurrencyWithCents(quote.annualPremium)}
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={onToggleExpand}
          className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              View Details & Features
            </>
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Features */}
          {quote.features && quote.features.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-3">
              <h5 className="text-xs font-medium text-gray-700 mb-2">
                Policy Features
              </h5>
              <ul className="space-y-1">
                {quote.features.map((feature, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-gray-600"
                  >
                    <Check className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {quote.illustrationUrl && (
              <button
                onClick={onViewIllustration}
                className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
              >
                <FileText className="w-3 h-3" />
                View Illustration
              </button>
            )}
            <button
              onClick={onStartApplication}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
            >
              Start Application
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuoteResults;
