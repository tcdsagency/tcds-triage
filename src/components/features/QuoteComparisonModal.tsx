"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Shield,
  Star,
  Clock,
  Building2,
  Car,
  Home,
  Loader2,
} from "lucide-react";

interface Coverage {
  type: string;
  limit: string;
  deductible?: string;
}

interface CarrierQuote {
  name: string;
  premium: number;
  quoteNumber?: string;
  expiresAt?: string;
  coverages: Coverage[];
  selected: boolean;
}

interface QuoteComparisonProps {
  quoteId: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (carrier: string, premium: number) => void;
}

interface ComparisonData {
  quote: {
    id: string;
    type: string;
    status: string;
    selectedCarrier: string | null;
    selectedPremium: string | null;
  };
  customer: {
    name: string;
    phone?: string;
    email?: string;
  } | null;
  subject: string;
  carriers: CarrierQuote[];
  comparisonMatrix: Array<{
    coverageType: string;
    [carrier: string]: { limit: string; deductible?: string } | string | null;
  }>;
  rankings: Array<{
    carrier: string;
    premium: number;
    quoteNumber?: string;
    selected: boolean;
  }>;
  coverageTypes: string[];
}

export function QuoteComparisonModal({
  quoteId,
  isOpen,
  onClose,
  onSelect,
}: QuoteComparisonProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCoverages, setExpandedCoverages] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/quotes/${quoteId}/compare`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to load comparison");
      }

      setData(result.comparison);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (isOpen && quoteId) {
      fetchComparison();
    }
  }, [isOpen, quoteId, fetchComparison]);

  const handleSelectCarrier = async (carrier: string, premium: number) => {
    try {
      setSelecting(carrier);
      const response = await fetch(`/api/quotes/${quoteId}/compare`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, premium }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to select carrier");
      }

      // Update local state
      setData((prev) =>
        prev
          ? {
              ...prev,
              quote: {
                ...prev.quote,
                selectedCarrier: carrier,
                selectedPremium: premium.toString(),
                status: "presented",
              },
              carriers: prev.carriers.map((c) => ({
                ...c,
                selected: c.name === carrier,
              })),
            }
          : null
      );

      onSelect?.(carrier, premium);
    } catch (err) {
      console.error("Error selecting carrier:", err);
    } finally {
      setSelecting(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCoverageType = (type: string) => {
    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getTypeIcon = (type: string) => {
    if (type.includes("auto") || type === "motorcycle") {
      return <Car className="w-5 h-5" />;
    }
    if (type.includes("home") || type === "renters" || type === "mobile_home") {
      return <Home className="w-5 h-5" />;
    }
    return <Building2 className="w-5 h-5" />;
  };

  const getDaysUntilExpiry = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const days = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1f2e] rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                Quote Comparison
              </h2>
              {data && (
                <p className="text-sm text-gray-400">
                  {data.subject} • {formatCoverageType(data.quote.type)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-red-400">
              <AlertCircle className="w-12 h-12 mb-3" />
              <p>{error}</p>
            </div>
          ) : data && data.carriers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Building2 className="w-12 h-12 mb-3" />
              <p>No carrier quotes available yet</p>
              <p className="text-sm mt-1">
                Submit the quote to carriers to get comparison data
              </p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Customer Info */}
              {data.customer && (
                <div className="bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    {getTypeIcon(data.quote.type)}
                    <div>
                      <p className="font-medium text-white">
                        {data.customer.name}
                      </p>
                      <p className="text-sm text-gray-400">
                        {data.customer.phone} • {data.customer.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Carrier Cards - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.carriers.map((carrier, idx) => {
                  const isLowest =
                    carrier.premium ===
                    Math.min(...data.carriers.map((c) => c.premium));
                  const daysLeft = getDaysUntilExpiry(carrier.expiresAt);
                  const isExpiringSoon = daysLeft !== null && daysLeft <= 7;

                  return (
                    <div
                      key={carrier.name}
                      className={`relative rounded-xl border-2 transition-all ${
                        carrier.selected
                          ? "border-green-500 bg-green-500/10"
                          : isLowest
                          ? "border-blue-500 bg-blue-500/5"
                          : "border-gray-700 bg-gray-800/50"
                      }`}
                    >
                      {/* Badges */}
                      <div className="absolute -top-3 left-4 flex gap-2">
                        {carrier.selected && (
                          <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded-full">
                            Selected
                          </span>
                        )}
                        {isLowest && !carrier.selected && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-semibold rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3" /> Lowest
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-semibold rounded-full flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {daysLeft}d left
                          </span>
                        )}
                      </div>

                      <div className="p-5 pt-6">
                        {/* Carrier Name & Premium */}
                        <div className="text-center mb-4">
                          <h3 className="text-lg font-semibold text-white mb-1">
                            {carrier.name}
                          </h3>
                          <p className="text-3xl font-bold text-white">
                            {formatCurrency(carrier.premium)}
                          </p>
                          <p className="text-sm text-gray-400">per year</p>
                          {carrier.quoteNumber && (
                            <p className="text-xs text-gray-500 mt-1">
                              Quote #{carrier.quoteNumber}
                            </p>
                          )}
                        </div>

                        {/* Coverages Summary */}
                        <div className="border-t border-gray-700 pt-4 mb-4">
                          <p className="text-sm text-gray-400 mb-2">
                            {carrier.coverages.length} coverages included
                          </p>
                          <div className="space-y-2 max-h-32 overflow-y-auto">
                            {carrier.coverages.slice(0, 4).map((cov, i) => (
                              <div
                                key={i}
                                className="flex justify-between text-sm"
                              >
                                <span className="text-gray-400 truncate pr-2">
                                  {formatCoverageType(cov.type)}
                                </span>
                                <span className="text-white font-medium">
                                  {cov.limit}
                                </span>
                              </div>
                            ))}
                            {carrier.coverages.length > 4 && (
                              <p className="text-xs text-gray-500">
                                +{carrier.coverages.length - 4} more
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Select Button */}
                        {!carrier.selected && (
                          <button
                            onClick={() =>
                              handleSelectCarrier(carrier.name, carrier.premium)
                            }
                            disabled={selecting !== null}
                            className={`w-full py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                              selecting === carrier.name
                                ? "bg-gray-600 text-gray-300"
                                : "bg-blue-600 hover:bg-blue-500 text-white"
                            }`}
                          >
                            {selecting === carrier.name ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <DollarSign className="w-4 h-4" />
                            )}
                            Select This Quote
                          </button>
                        )}
                        {carrier.selected && (
                          <div className="w-full py-2.5 rounded-lg bg-green-600/20 text-green-400 font-medium flex items-center justify-center gap-2">
                            <Check className="w-4 h-4" />
                            Selected Quote
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed Coverage Comparison Table */}
              {data.comparisonMatrix.length > 0 && (
                <div className="bg-gray-800/50 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedCoverages(!expandedCoverages)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                  >
                    <span className="font-semibold text-white">
                      Detailed Coverage Comparison
                    </span>
                    {expandedCoverages ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  {expandedCoverages && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-t border-gray-700">
                            <th className="px-4 py-3 text-left text-sm font-medium text-gray-400 bg-gray-800/50 sticky left-0">
                              Coverage
                            </th>
                            {data.carriers.map((carrier) => (
                              <th
                                key={carrier.name}
                                className={`px-4 py-3 text-center text-sm font-medium ${
                                  carrier.selected
                                    ? "text-green-400 bg-green-500/10"
                                    : "text-gray-400"
                                }`}
                              >
                                {carrier.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.comparisonMatrix.map((row, idx) => (
                            <tr
                              key={row.coverageType}
                              className={`border-t border-gray-700/50 ${
                                idx % 2 === 0 ? "bg-gray-800/30" : ""
                              }`}
                            >
                              <td className="px-4 py-3 text-sm text-white font-medium sticky left-0 bg-inherit">
                                {formatCoverageType(row.coverageType)}
                              </td>
                              {data.carriers.map((carrier) => {
                                const coverage = row[carrier.name] as
                                  | { limit: string; deductible?: string }
                                  | null;
                                return (
                                  <td
                                    key={carrier.name}
                                    className={`px-4 py-3 text-center text-sm ${
                                      carrier.selected ? "bg-green-500/5" : ""
                                    }`}
                                  >
                                    {coverage ? (
                                      <div>
                                        <p className="text-white font-medium">
                                          {coverage.limit}
                                        </p>
                                        {coverage.deductible && (
                                          <p className="text-xs text-gray-500">
                                            Ded: {coverage.deductible}
                                          </p>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-600">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          {/* Premium Row */}
                          <tr className="border-t-2 border-gray-600 bg-gray-800/50">
                            <td className="px-4 py-3 text-sm font-semibold text-white sticky left-0 bg-gray-800/50">
                              Annual Premium
                            </td>
                            {data.carriers.map((carrier) => (
                              <td
                                key={carrier.name}
                                className={`px-4 py-3 text-center ${
                                  carrier.selected ? "bg-green-500/10" : ""
                                }`}
                              >
                                <span
                                  className={`text-lg font-bold ${
                                    carrier.selected
                                      ? "text-green-400"
                                      : "text-white"
                                  }`}
                                >
                                  {formatCurrency(carrier.premium)}
                                </span>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
