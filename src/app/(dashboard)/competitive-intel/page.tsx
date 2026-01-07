"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  PieChart,
  DollarSign,
  Award,
  Users,
  Building2,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  RefreshCw,
  Zap,
  Shield,
  Car,
  Home,
  ChevronRight,
  Info,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface CarrierData {
  id: string;
  name: string;
  logo?: string;
  marketShare: number;
  avgPremium: number;
  competitiveScore: number;
  strengths: string[];
  weaknesses: string[];
  winRate: number;
  lossRate: number;
  avgPremiumDiff: number; // % difference from our quotes
  trend: "up" | "down" | "stable";
}

interface RateComparison {
  scenario: string;
  coverageType: string;
  ourRate: number;
  competitors: {
    carrier: string;
    rate: number;
    diff: number;
  }[];
  recommendation: string;
}

interface WinLossRecord {
  id: string;
  date: string;
  customerName: string;
  coverageType: string;
  result: "won" | "lost";
  ourQuote: number;
  competitorQuote?: number;
  competitor?: string;
  reason?: string;
}

type CoverageFilter = "all" | "auto" | "home" | "commercial";

// =============================================================================
// DATA
// =============================================================================

const CARRIERS: CarrierData[] = [
  {
    id: "progressive",
    name: "Progressive",
    marketShare: 14.2,
    avgPremium: 1450,
    competitiveScore: 85,
    strengths: ["Brand recognition", "Online presence", "Bundling discounts"],
    weaknesses: ["Limited agent support", "Claims process"],
    winRate: 42,
    lossRate: 35,
    avgPremiumDiff: -3.2,
    trend: "up",
  },
  {
    id: "statefarm",
    name: "State Farm",
    marketShare: 16.8,
    avgPremium: 1520,
    competitiveScore: 82,
    strengths: ["Agent network", "Customer loyalty", "Multi-line discounts"],
    weaknesses: ["Higher premiums", "Slow innovation"],
    winRate: 38,
    lossRate: 40,
    avgPremiumDiff: 2.1,
    trend: "stable",
  },
  {
    id: "geico",
    name: "GEICO",
    marketShare: 13.5,
    avgPremium: 1380,
    competitiveScore: 88,
    strengths: ["Low prices", "Easy online quotes", "Quick claims"],
    weaknesses: ["No local agents", "Limited advice"],
    winRate: 35,
    lossRate: 45,
    avgPremiumDiff: -5.8,
    trend: "up",
  },
  {
    id: "allstate",
    name: "Allstate",
    marketShare: 10.4,
    avgPremium: 1580,
    competitiveScore: 76,
    strengths: ["Full service", "Roadside assistance", "Safe driver rewards"],
    weaknesses: ["Premium pricing", "Complex policies"],
    winRate: 48,
    lossRate: 28,
    avgPremiumDiff: 4.5,
    trend: "down",
  },
  {
    id: "liberty",
    name: "Liberty Mutual",
    marketShare: 9.2,
    avgPremium: 1490,
    competitiveScore: 74,
    strengths: ["Customization options", "Accident forgiveness"],
    weaknesses: ["Customer service", "Mobile app"],
    winRate: 44,
    lossRate: 32,
    avgPremiumDiff: 1.2,
    trend: "stable",
  },
  {
    id: "nationwide",
    name: "Nationwide",
    marketShare: 7.1,
    avgPremium: 1420,
    competitiveScore: 79,
    strengths: ["Pet coverage", "Vanishing deductible", "Farm coverage"],
    weaknesses: ["Limited markets", "Brand awareness"],
    winRate: 52,
    lossRate: 26,
    avgPremiumDiff: -2.4,
    trend: "up",
  },
];

const RATE_COMPARISONS: RateComparison[] = [
  {
    scenario: "Young Driver (18-25)",
    coverageType: "auto",
    ourRate: 2450,
    competitors: [
      { carrier: "GEICO", rate: 2280, diff: -6.9 },
      { carrier: "Progressive", rate: 2380, diff: -2.9 },
      { carrier: "State Farm", rate: 2620, diff: 6.9 },
    ],
    recommendation: "Emphasize safe driver programs and multi-policy discounts",
  },
  {
    scenario: "Family (2 cars, home)",
    coverageType: "bundle",
    ourRate: 3200,
    competitors: [
      { carrier: "State Farm", rate: 3450, diff: 7.8 },
      { carrier: "Allstate", rate: 3380, diff: 5.6 },
      { carrier: "Progressive", rate: 3150, diff: -1.6 },
    ],
    recommendation: "Strong position - highlight bundling value",
  },
  {
    scenario: "New Homeowner",
    coverageType: "home",
    ourRate: 1850,
    competitors: [
      { carrier: "Liberty Mutual", rate: 1920, diff: 3.8 },
      { carrier: "Allstate", rate: 2100, diff: 13.5 },
      { carrier: "State Farm", rate: 1780, diff: -3.8 },
    ],
    recommendation: "Competitive - emphasize coverage breadth",
  },
  {
    scenario: "SR-22 Required",
    coverageType: "auto",
    ourRate: 3800,
    competitors: [
      { carrier: "Progressive", rate: 3650, diff: -3.9 },
      { carrier: "GEICO", rate: 4200, diff: 10.5 },
      { carrier: "State Farm", rate: 4100, diff: 7.9 },
    ],
    recommendation: "Progressive typically wins on price - match if possible",
  },
  {
    scenario: "Clean Record (45+)",
    coverageType: "auto",
    ourRate: 980,
    competitors: [
      { carrier: "GEICO", rate: 920, diff: -6.1 },
      { carrier: "Progressive", rate: 950, diff: -3.1 },
      { carrier: "Nationwide", rate: 1050, diff: 7.1 },
    ],
    recommendation: "GEICO competitive - emphasize service and claims support",
  },
];

const WIN_LOSS_RECORDS: WinLossRecord[] = [
  {
    id: "1",
    date: "2024-01-15",
    customerName: "John Smith",
    coverageType: "Auto",
    result: "won",
    ourQuote: 1420,
    competitorQuote: 1580,
    competitor: "State Farm",
    reason: "Better price + bundling",
  },
  {
    id: "2",
    date: "2024-01-14",
    customerName: "Mary Johnson",
    coverageType: "Home",
    result: "lost",
    ourQuote: 1850,
    competitorQuote: 1720,
    competitor: "GEICO",
    reason: "Competitor lower price",
  },
  {
    id: "3",
    date: "2024-01-14",
    customerName: "Robert Williams",
    coverageType: "Auto + Home",
    result: "won",
    ourQuote: 3200,
    reason: "Strong bundle discount",
  },
  {
    id: "4",
    date: "2024-01-13",
    customerName: "Patricia Brown",
    coverageType: "Auto",
    result: "lost",
    ourQuote: 2450,
    competitorQuote: 2180,
    competitor: "Progressive",
    reason: "Young driver - competitor specialty",
  },
  {
    id: "5",
    date: "2024-01-13",
    customerName: "James Davis",
    coverageType: "Commercial",
    result: "won",
    ourQuote: 5200,
    competitorQuote: 5800,
    competitor: "Liberty Mutual",
    reason: "Better coverage options",
  },
  {
    id: "6",
    date: "2024-01-12",
    customerName: "Linda Martinez",
    coverageType: "Auto",
    result: "won",
    ourQuote: 1180,
    reason: "Existing customer - loyalty discount",
  },
  {
    id: "7",
    date: "2024-01-12",
    customerName: "Michael Lee",
    coverageType: "Home",
    result: "lost",
    ourQuote: 2400,
    competitorQuote: 2100,
    competitor: "Allstate",
    reason: "Competitor offered claim forgiveness",
  },
];

// =============================================================================
// COMPONENTS
// =============================================================================

function MarketOverview() {
  const totalWins = WIN_LOSS_RECORDS.filter((r) => r.result === "won").length;
  const totalLosses = WIN_LOSS_RECORDS.filter((r) => r.result === "lost").length;
  const winRate = Math.round((totalWins / (totalWins + totalLosses)) * 100);

  const stats = [
    {
      label: "Win Rate",
      value: `${winRate}%`,
      change: "+5.2%",
      positive: true,
      icon: <Target className="h-5 w-5" />,
    },
    {
      label: "Avg Quote vs Market",
      value: "-2.1%",
      change: "Competitive",
      positive: true,
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      label: "Quotes This Week",
      value: "142",
      change: "+18%",
      positive: true,
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      label: "Top Competitor",
      value: "GEICO",
      change: "Most lost to",
      positive: false,
      icon: <Building2 className="h-5 w-5" />,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl border border-gray-200 p-5"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              {stat.icon}
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p
                className={`text-xs ${
                  stat.positive ? "text-green-600" : "text-amber-600"
                }`}
              >
                {stat.change}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CarrierCard({ carrier }: { carrier: CarrierData }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{carrier.name}</h3>
          <p className="text-sm text-gray-500">{carrier.marketShare}% market share</p>
        </div>
        <div
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            carrier.trend === "up"
              ? "bg-green-100 text-green-700"
              : carrier.trend === "down"
              ? "bg-red-100 text-red-700"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {carrier.trend === "up" ? (
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Growing
            </span>
          ) : carrier.trend === "down" ? (
            <span className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Declining
            </span>
          ) : (
            "Stable"
          )}
        </div>
      </div>

      {/* Competitive Score */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Competitive Score</span>
          <span className="font-medium text-gray-900">{carrier.competitiveScore}/100</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              carrier.competitiveScore >= 85
                ? "bg-green-500"
                : carrier.competitiveScore >= 75
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
            style={{ width: `${carrier.competitiveScore}%` }}
          />
        </div>
      </div>

      {/* Win/Loss Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{carrier.winRate}%</p>
          <p className="text-xs text-green-700">Win Rate</p>
        </div>
        <div className="bg-red-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{carrier.lossRate}%</p>
          <p className="text-xs text-red-700">Loss Rate</p>
        </div>
      </div>

      {/* Price Comparison */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Avg Premium Diff</span>
          <span
            className={`font-medium ${
              carrier.avgPremiumDiff > 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {carrier.avgPremiumDiff > 0 ? "+" : ""}
            {carrier.avgPremiumDiff}%
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {carrier.avgPremiumDiff > 0
            ? "Their rates are higher"
            : "Their rates are lower"}
        </p>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">STRENGTHS</p>
          <div className="flex flex-wrap gap-1">
            {carrier.strengths.map((s, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">WEAKNESSES</p>
          <div className="flex flex-wrap gap-1">
            {carrier.weaknesses.map((w, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"
              >
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RateComparisonTable() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Rate Comparisons by Scenario</h3>
        <p className="text-sm text-gray-500 mt-1">
          See how our quotes compare across common scenarios
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Scenario
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Our Rate
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Top Competitors
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Recommendation
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {RATE_COMPARISONS.map((comparison, idx) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-4">
                  <span className="font-medium text-gray-900">
                    {comparison.scenario}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-full text-xs text-gray-700">
                    {comparison.coverageType === "auto" && (
                      <Car className="h-3 w-3" />
                    )}
                    {comparison.coverageType === "home" && (
                      <Home className="h-3 w-3" />
                    )}
                    {comparison.coverageType === "bundle" && (
                      <Shield className="h-3 w-3" />
                    )}
                    {comparison.coverageType}
                  </span>
                </td>
                <td className="px-4 py-4 text-center">
                  <span className="font-bold text-gray-900">
                    ${comparison.ourRate.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="space-y-1">
                    {comparison.competitors.map((comp, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600 w-24">{comp.carrier}</span>
                        <span className="text-gray-900">
                          ${comp.rate.toLocaleString()}
                        </span>
                        <span
                          className={`text-xs ${
                            comp.diff > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          ({comp.diff > 0 ? "+" : ""}
                          {comp.diff}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-start gap-2 max-w-xs">
                    <Info className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-600">
                      {comparison.recommendation}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WinLossTable() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Recent Win/Loss Analysis</h3>
          <p className="text-sm text-gray-500 mt-1">
            Learn from competitive outcomes
          </p>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            {WIN_LOSS_RECORDS.filter((r) => r.result === "won").length} Wins
          </span>
          <span className="flex items-center gap-1 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {WIN_LOSS_RECORDS.filter((r) => r.result === "lost").length} Losses
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Coverage
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Result
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Our Quote
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                Competitor
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {WIN_LOSS_RECORDS.map((record) => (
              <tr key={record.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(record.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">
                  {record.customerName}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {record.coverageType}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      record.result === "won"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {record.result === "won" ? "Won" : "Lost"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center font-medium text-gray-900">
                  ${record.ourQuote.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center text-sm">
                  {record.competitor ? (
                    <div>
                      <span className="text-gray-700">{record.competitor}</span>
                      {record.competitorQuote && (
                        <span className="block text-xs text-gray-500">
                          ${record.competitorQuote.toLocaleString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {record.reason || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompetitiveInsights() {
  const insights = [
    {
      type: "opportunity",
      title: "Bundle Advantage",
      description:
        "Our bundle pricing is 4.2% lower than State Farm and Allstate. Emphasize bundling in multi-policy discussions.",
      icon: <Zap className="h-5 w-5" />,
      color: "bg-green-100 text-green-700",
    },
    {
      type: "threat",
      title: "Young Driver Segment",
      description:
        "Losing 45% of quotes for drivers under 25 to GEICO and Progressive. Consider targeted discount programs.",
      icon: <AlertTriangle className="h-5 w-5" />,
      color: "bg-red-100 text-red-700",
    },
    {
      type: "opportunity",
      title: "Claims Reputation",
      description:
        "Our claims satisfaction is 12% higher than GEICO. Use this in competitive discussions.",
      icon: <Award className="h-5 w-5" />,
      color: "bg-green-100 text-green-700",
    },
    {
      type: "info",
      title: "Market Trend",
      description:
        "Direct-to-consumer carriers growing 8% faster than agency channel. Focus on service differentiation.",
      icon: <TrendingUp className="h-5 w-5" />,
      color: "bg-blue-100 text-blue-700",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-4">Competitive Insights</h3>
      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <div className={`p-2 rounded-lg ${insight.color}`}>{insight.icon}</div>
            <div>
              <p className="font-medium text-gray-900">{insight.title}</p>
              <p className="text-sm text-gray-600">{insight.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function CompetitiveIntelPage() {
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [activeTab, setActiveTab] = useState<"overview" | "carriers" | "rates" | "winloss">(
    "overview"
  );

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "carriers", label: "Carrier Analysis" },
    { id: "rates", label: "Rate Comparison" },
    { id: "winloss", label: "Win/Loss" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Competitive Intelligence</h1>
          <p className="text-gray-600 mt-1">
            Analyze competitors and optimize your competitive positioning
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-indigo-100 text-indigo-700"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <MarketOverview />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RateComparisonTable />
            </div>
            <CompetitiveInsights />
          </div>
        </div>
      )}

      {/* Carriers Tab */}
      {activeTab === "carriers" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CARRIERS.map((carrier) => (
            <CarrierCard key={carrier.id} carrier={carrier} />
          ))}
        </div>
      )}

      {/* Rates Tab */}
      {activeTab === "rates" && (
        <div className="space-y-6">
          <RateComparisonTable />
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white">
            <h3 className="text-lg font-semibold mb-4">Quick Rate Check</h3>
            <p className="text-white/80 mb-4">
              Enter customer details to see instant competitive rate comparisons
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="Age"
                className="px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <select className="px-4 py-2 rounded-lg bg-white/20 text-white focus:outline-none focus:ring-2 focus:ring-white/50">
                <option value="">Coverage Type</option>
                <option value="auto">Auto</option>
                <option value="home">Home</option>
                <option value="bundle">Bundle</option>
              </select>
              <input
                type="text"
                placeholder="ZIP Code"
                className="px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <button className="px-4 py-2 bg-white text-indigo-600 rounded-lg font-medium hover:bg-white/90 transition-colors">
                Compare Rates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Win/Loss Tab */}
      {activeTab === "winloss" && (
        <div className="space-y-6">
          <WinLossTable />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-4">Top Reasons for Wins</h4>
              <div className="space-y-3">
                {[
                  { reason: "Better bundle pricing", count: 28 },
                  { reason: "Existing customer loyalty", count: 23 },
                  { reason: "Coverage options", count: 18 },
                  { reason: "Service reputation", count: 15 },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.reason}</span>
                    <span className="text-sm font-medium text-green-600">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-4">Top Reasons for Losses</h4>
              <div className="space-y-3">
                {[
                  { reason: "Competitor lower price", count: 34 },
                  { reason: "Young driver segment", count: 21 },
                  { reason: "Online-only competitor", count: 16 },
                  { reason: "Claims concern", count: 8 },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{item.reason}</span>
                    <span className="text-sm font-medium text-red-600">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h4 className="font-semibold text-gray-900 mb-4">Lost to (Carrier)</h4>
              <div className="space-y-3">
                {[
                  { carrier: "GEICO", count: 24, percentage: 38 },
                  { carrier: "Progressive", count: 18, percentage: 28 },
                  { carrier: "State Farm", count: 12, percentage: 19 },
                  { carrier: "Other", count: 9, percentage: 15 },
                ].map((item, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">{item.carrier}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
