"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Heart,
  Clock,
  Sparkles,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { InstantQuoteWidget } from "./InstantQuoteWidget";
import { AICrossSellCard } from "./AICrossSellCard";
import { QuoteHistory } from "./QuoteHistory";
import {
  LifeInsuranceTabProps,
  QuoteResponse,
  QuoteHistoryItem,
  AICrossSellOpportunity,
} from "@/types/lifeInsurance.types";
import {
  getQuoteHistory,
  getAICrossSellOpportunity,
  dismissAIOpportunity,
} from "@/lib/api/lifeInsuranceApi";

export function LifeInsuranceTab({
  customerId,
  customerData,
  onQuoteGenerated,
  onApplicationStarted,
}: LifeInsuranceTabProps) {
  // State
  const [aiOpportunity, setAIOpportunity] = useState<AICrossSellOpportunity | null>(null);
  const [quoteHistory, setQuoteHistory] = useState<QuoteHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingOpportunity, setLoadingOpportunity] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [opportunityDismissed, setOpportunityDismissed] = useState(false);
  const [useAIOpportunity, setUseAIOpportunity] = useState(false);

  // Fetch AI opportunity on mount
  useEffect(() => {
    const fetchOpportunity = async () => {
      try {
        setLoadingOpportunity(true);
        const opportunity = await getAICrossSellOpportunity(customerId);
        setAIOpportunity(opportunity);
      } catch (err) {
        console.error("Failed to fetch AI opportunity:", err);
      } finally {
        setLoadingOpportunity(false);
      }
    };

    fetchOpportunity();
  }, [customerId]);

  // Fetch quote history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        setLoadingHistory(true);
        const history = await getQuoteHistory(customerId);
        setQuoteHistory(history);
      } catch (err) {
        console.error("Failed to fetch quote history:", err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [customerId]);

  // Refresh history after a quote is generated
  const refreshHistory = useCallback(async () => {
    try {
      const history = await getQuoteHistory(customerId);
      setQuoteHistory(history);
    } catch (err) {
      console.error("Failed to refresh history:", err);
    }
  }, [customerId]);

  // Handlers
  const handleQuoteSuccess = useCallback(
    (response: QuoteResponse) => {
      onQuoteGenerated?.(response);
      // Refresh history to include the new quote
      refreshHistory();
    },
    [onQuoteGenerated, refreshHistory]
  );

  const handleQuoteError = useCallback((error: string) => {
    console.error("Quote error:", error);
  }, []);

  const handleDismissOpportunity = useCallback(async () => {
    setOpportunityDismissed(true);
    try {
      await dismissAIOpportunity(customerId, "dismissed_by_user");
    } catch (err) {
      console.error("Failed to dismiss opportunity:", err);
    }
  }, [customerId]);

  const handleGetQuotesFromOpportunity = useCallback(() => {
    setUseAIOpportunity(true);
    setOpportunityDismissed(true);
  }, []);

  const handleCallCustomer = useCallback(() => {
    // TODO: Integrate with calling system
    alert("Call functionality coming soon!");
  }, []);

  const handleCreateTask = useCallback(() => {
    // TODO: Integrate with task system
    alert("Task creation coming soon!");
  }, []);

  const handleViewQuote = useCallback((historyId: string) => {
    const item = quoteHistory.find((h) => h.id === historyId);
    if (item) {
      // TODO: Show quote details modal
      console.log("View quote:", item);
    }
  }, [quoteHistory]);

  const handleEmailQuote = useCallback((historyId: string) => {
    // TODO: Implement email functionality
    alert("Email functionality coming soon!");
  }, []);

  return (
    <div className="space-y-4">
      {/* AI Cross-Sell Opportunity */}
      {!opportunityDismissed && aiOpportunity && !loadingOpportunity && (
        <AICrossSellCard
          opportunity={aiOpportunity}
          onDismiss={handleDismissOpportunity}
          onGetQuotes={handleGetQuotesFromOpportunity}
          onCallCustomer={handleCallCustomer}
          onCreateTask={handleCreateTask}
        />
      )}

      {/* Main Quote Widget */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-red-50 rounded-lg">
              <Heart className="w-4 h-4 text-red-500" />
            </div>
            <h2 className="text-sm font-medium text-gray-900">
              Life Insurance Quotes
            </h2>
          </div>
          {useAIOpportunity && aiOpportunity && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
              <Sparkles className="w-3 h-3" />
              AI Recommended
            </span>
          )}
        </div>

        <div className="p-4">
          <InstantQuoteWidget
            customerData={customerData}
            prefilledOpportunity={useAIOpportunity ? aiOpportunity || undefined : undefined}
            onQuoteSuccess={handleQuoteSuccess}
            onQuoteError={handleQuoteError}
          />
        </div>
      </div>

      {/* Quote History Section */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <h2 className="text-sm font-medium text-gray-900">Quote History</h2>
            {quoteHistory.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                {quoteHistory.length}
              </span>
            )}
          </div>
          {showHistory ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showHistory && (
          <div className="px-4 pb-4 border-t border-gray-100">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
              </div>
            ) : (
              <div className="pt-4">
                <QuoteHistory
                  customerId={customerId}
                  history={quoteHistory}
                  onViewQuote={handleViewQuote}
                  onEmailQuote={handleEmailQuote}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Powered By Badge */}
      <div className="flex items-center justify-center">
        <span className="text-xs text-gray-400">
          Powered by Back9 Insurance
        </span>
      </div>
    </div>
  );
}

export default LifeInsuranceTab;
