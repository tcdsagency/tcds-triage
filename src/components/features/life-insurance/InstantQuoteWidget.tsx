"use client";

import { useState, useCallback } from "react";
import {
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { QuoteForm } from "./QuoteForm";
import { QuoteResults } from "./QuoteResults";
import {
  InstantQuoteWidgetProps,
  QuoteRequestParams,
  QuoteResponse,
} from "@/types/lifeInsurance.types";
import { generateLifeQuotes, saveQuoteToHistory } from "@/lib/api/lifeInsuranceApi";

type WidgetState = "form" | "loading" | "results" | "error";

export function InstantQuoteWidget({
  customerData,
  prefilledOpportunity,
  onQuoteSuccess,
  onQuoteError,
}: InstantQuoteWidgetProps) {
  const [state, setState] = useState<WidgetState>("form");
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequestParams, setLastRequestParams] = useState<QuoteRequestParams | null>(null);

  const handleSubmit = useCallback(async (params: QuoteRequestParams) => {
    setState("loading");
    setError(null);
    setLastRequestParams(params);

    try {
      const response = await generateLifeQuotes(params);

      if (!response.success) {
        throw new Error(response.error || "Failed to generate quotes");
      }

      setQuoteResponse(response);
      setState("results");
      onQuoteSuccess(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      setState("error");
      onQuoteError(errorMessage);
    }
  }, [onQuoteSuccess, onQuoteError]);

  const handleRetry = useCallback(() => {
    if (lastRequestParams) {
      handleSubmit(lastRequestParams);
    } else {
      setState("form");
    }
  }, [lastRequestParams, handleSubmit]);

  const handleEditQuote = useCallback(() => {
    setState("form");
  }, []);

  const handleViewIllustration = useCallback((quoteId: string) => {
    const quote = quoteResponse?.quotes.find((q) => q.id === quoteId);
    if (quote?.illustrationUrl) {
      window.open(quote.illustrationUrl, "_blank");
    }
  }, [quoteResponse]);

  const handleStartApplication = useCallback((quoteId: string) => {
    const quote = quoteResponse?.quotes.find((q) => q.id === quoteId);
    if (quote?.applicationUrl) {
      window.open(quote.applicationUrl, "_blank");
    } else {
      // For demo purposes, show an alert
      alert(`Application flow would start for ${quote?.carrier.name}`);
    }
  }, [quoteResponse]);

  const handleEmailResults = useCallback(() => {
    // TODO: Implement email functionality
    alert("Email functionality coming soon!");
  }, []);

  const handleSaveToHistory = useCallback(async () => {
    if (!quoteResponse) return;

    try {
      await saveQuoteToHistory(customerData.id, quoteResponse);
    } catch (err) {
      console.error("Failed to save quote to history:", err);
      throw err;
    }
  }, [customerData.id, quoteResponse]);

  // Generate prefilled values from AI opportunity if available
  const prefilledValues = prefilledOpportunity
    ? {
        coverageAmount: Math.round(
          (prefilledOpportunity.recommendedCoverage.min +
            prefilledOpportunity.recommendedCoverage.max) /
            2 /
            50000
        ) * 50000,
        termLength: prefilledOpportunity.recommendedTermLength,
      }
    : undefined;

  return (
    <div className="h-full">
      {state === "form" && (
        <QuoteForm
          customerData={customerData}
          prefilledValues={prefilledValues}
          onSubmit={handleSubmit}
          isLoading={false}
        />
      )}

      {state === "loading" && <LoadingState />}

      {state === "results" && quoteResponse && (
        <QuoteResults
          quotes={quoteResponse.quotes}
          requestParams={quoteResponse.requestParams}
          onViewIllustration={handleViewIllustration}
          onStartApplication={handleStartApplication}
          onEditQuote={handleEditQuote}
          onEmailResults={handleEmailResults}
          onSaveToHistory={handleSaveToHistory}
        />
      )}

      {state === "error" && (
        <ErrorState
          message={error || "An error occurred"}
          onRetry={handleRetry}
          onEditQuote={handleEditQuote}
        />
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
          <Shield className="w-10 h-10 text-blue-600" />
        </div>
        <div className="absolute inset-0 w-20 h-20">
          <svg className="w-20 h-20 animate-spin" viewBox="0 0 80 80">
            <circle
              className="text-blue-200"
              strokeWidth="4"
              stroke="currentColor"
              fill="transparent"
              r="36"
              cx="40"
              cy="40"
            />
            <circle
              className="text-blue-600"
              strokeWidth="4"
              strokeDasharray={226}
              strokeDashoffset={170}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="36"
              cx="40"
              cy="40"
            />
          </svg>
        </div>
      </div>

      <h3 className="mt-6 text-lg font-semibold text-gray-900">
        Getting Your Quotes
      </h3>
      <p className="mt-2 text-sm text-gray-500 text-center max-w-xs">
        Comparing rates from top-rated carriers to find you the best coverage...
      </p>

      <div className="mt-6 space-y-2">
        <LoadingStep label="Analyzing profile" done />
        <LoadingStep label="Contacting carriers" inProgress />
        <LoadingStep label="Comparing rates" />
      </div>
    </div>
  );
}

function LoadingStep({
  label,
  done,
  inProgress,
}: {
  label: string;
  done?: boolean;
  inProgress?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      ) : inProgress ? (
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
      ) : (
        <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
      )}
      <span
        className={`text-sm ${
          done
            ? "text-emerald-600"
            : inProgress
            ? "text-blue-600"
            : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
  onEditQuote: () => void;
}

function ErrorState({ message, onRetry, onEditQuote }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>

      <h3 className="mt-4 text-lg font-semibold text-gray-900">
        Unable to Get Quotes
      </h3>
      <p className="mt-2 text-sm text-gray-500 text-center max-w-xs">
        {message}
      </p>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
        <button
          onClick={onEditQuote}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Edit Quote
        </button>
      </div>
    </div>
  );
}

export default InstantQuoteWidget;
