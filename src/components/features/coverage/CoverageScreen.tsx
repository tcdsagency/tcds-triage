/**
 * Agent-Focused Coverage Screen Component
 *
 * Purpose: Display insurance coverage details with comprehensive explanations,
 * sales talking points, and educational content to help agents during customer calls.
 *
 * Features:
 * - Detailed coverage explanations with real-world examples
 * - Red flag indicators for inadequate coverage
 * - Upsell opportunities and recommendations
 * - Objection handling tips
 * - Coverage gap identification
 * - Interactive tooltips and modals
 */

'use client';

import React, { useState } from 'react';
import {
  Shield, Home, Car, Heart, Star, AlertTriangle, TrendingUp,
  Info, ChevronDown, ChevronUp, DollarSign, CheckCircle,
  XCircle, AlertCircle, Phone, Mail, ExternalLink, X
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface Coverage {
  code: string;
  fullName: string;
  shortDescription: string;
  longDescription: string;
  category: CoverageCategory;
  icon: string;
  limit: string | number;
  deductible?: number;
  premium?: number;

  // Agent-focused fields
  whatItCovers: string[];
  whatItDoesNotCover: string[];
  whyCustomersNeedIt: string;
  realClaimExample: string;
  commonObjections: Objection[];
  recommendedLimits: RecommendedLimit[];
  redFlags: string[];
  upsellOpportunities: string[];
  talkingPoints: string[];
}

export interface Objection {
  objection: string;
  response: string;
}

export interface RecommendedLimit {
  level: 'minimum' | 'better' | 'best';
  value: string;
  description: string;
}

export enum CoverageCategory {
  Liability = 'liability',
  Property = 'property',
  PhysicalDamage = 'physical_damage',
  Medical = 'medical',
  Additional = 'additional'
}

export enum CoverageStatus {
  Adequate = 'adequate',
  BelowRecommended = 'below_recommended',
  Critical = 'critical',
  Excellent = 'excellent'
}

export interface Policy {
  policyNumber: string;
  carrier: string;
  effectiveDate: string;
  expirationDate: string;
  premium: number;
  type: 'auto' | 'home';
  coverages: Coverage[];
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CoverageScreen: React.FC<{ policy: Policy }> = ({ policy }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['liability', 'property'])
  );
  const [selectedCoverage, setSelectedCoverage] = useState<Coverage | null>(null);
  const [showModal, setShowModal] = useState(false);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  const openCoverageModal = (coverage: Coverage) => {
    setSelectedCoverage(coverage);
    setShowModal(true);
  };

  const groupedCoverages = groupCoveragesByCategory(policy.coverages);
  const coverageInsights = analyzeCoverageGaps(policy);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Policy Header */}
      <PolicyHeader policy={policy} />

      {/* Coverage Insights - Red Flags & Opportunities */}
      {coverageInsights.length > 0 && (
        <CoverageInsights insights={coverageInsights} />
      )}

      {/* Coverage Summary by Category */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Coverage Summary
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Click any coverage for detailed explanation, talking points, and objection handling
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {Object.entries(groupedCoverages).map(([category, coverages]) => (
            <CoverageCategorySection
              key={category}
              category={category as CoverageCategory}
              coverages={coverages}
              isExpanded={expandedCategories.has(category)}
              onToggle={() => toggleCategory(category)}
              onCoverageClick={openCoverageModal}
            />
          ))}
        </div>
      </div>

      {/* Agent Quick Actions */}
      <AgentQuickActions policy={policy} />

      {/* Coverage Detail Modal */}
      {showModal && selectedCoverage && (
        <CoverageModal
          coverage={selectedCoverage}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// ============================================================================
// POLICY HEADER COMPONENT
// ============================================================================

const PolicyHeader: React.FC<{ policy: Policy }> = ({ policy }) => {
  const isPolicyExpiringSoon = isExpiringSoon(policy.expirationDate);

  return (
    <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-lg shadow-lg p-6 text-white">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {policy.type === 'auto' ? (
            <Car className="w-12 h-12" />
          ) : (
            <Home className="w-12 h-12" />
          )}
          <div>
            <h1 className="text-3xl font-bold">
              {policy.type === 'auto' ? 'Auto Insurance' : 'Home Insurance'}
            </h1>
            <p className="text-blue-100 text-lg mt-1">
              {policy.carrier} • {policy.policyNumber}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold">${policy.premium.toLocaleString()}/yr</div>
          <div className="text-blue-100 text-sm mt-1">
            ${(policy.premium / 12).toFixed(2)}/month
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-blue-500 dark:border-blue-600">
        <div>
          <div className="text-blue-200 text-sm">Policy Number</div>
          <div className="font-semibold text-lg">{policy.policyNumber}</div>
        </div>
        <div>
          <div className="text-blue-200 text-sm">Carrier</div>
          <div className="font-semibold text-lg">{policy.carrier}</div>
        </div>
        <div>
          <div className="text-blue-200 text-sm">Effective Date</div>
          <div className="font-semibold text-lg">
            {formatDate(policy.effectiveDate)}
          </div>
        </div>
        <div>
          <div className="text-blue-200 text-sm">Expiration Date</div>
          <div className="font-semibold text-lg flex items-center gap-2">
            {formatDate(policy.expirationDate)}
            {isPolicyExpiringSoon && (
              <AlertTriangle className="w-4 h-4 text-yellow-300" />
            )}
          </div>
        </div>
      </div>

      {isPolicyExpiringSoon && (
        <div className="mt-4 bg-yellow-500 text-yellow-900 px-4 py-2 rounded-md flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-semibold">
            Policy expires in {getDaysUntilExpiration(policy.expirationDate)} days - Time to review and renew!
          </span>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COVERAGE INSIGHTS COMPONENT
// ============================================================================

interface CoverageInsight {
  type: 'critical' | 'warning' | 'opportunity';
  title: string;
  description: string;
  action: string;
  coverage?: Coverage;
}

const CoverageInsights: React.FC<{ insights: CoverageInsight[] }> = ({ insights }) => {
  const criticalInsights = insights.filter(i => i.type === 'critical');
  const warningInsights = insights.filter(i => i.type === 'warning');
  const opportunityInsights = insights.filter(i => i.type === 'opportunity');

  return (
    <div className="space-y-4">
      {/* Critical Issues */}
      {criticalInsights.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-3">
                🚨 Critical Coverage Issues
              </h3>
              <div className="space-y-3">
                {criticalInsights.map((insight, index) => (
                  <InsightCard key={index} insight={insight} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {warningInsights.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-100 mb-3">
                ⚠️ Coverage Below Recommended Levels
              </h3>
              <div className="space-y-3">
                {warningInsights.map((insight, index) => (
                  <InsightCard key={index} insight={insight} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Opportunities */}
      {opportunityInsights.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-green-900 dark:text-green-100 mb-3">
                💡 Upsell Opportunities
              </h3>
              <div className="space-y-3">
                {opportunityInsights.map((insight, index) => (
                  <InsightCard key={index} insight={insight} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const InsightCard: React.FC<{ insight: CoverageInsight }> = ({ insight }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-md p-4 shadow-sm">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{insight.title}</h4>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{insight.description}</p>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-gray-900 dark:text-gray-100">💬 Say to customer:</span>
        <span className="text-gray-700 dark:text-gray-300 italic">&quot;{insight.action}&quot;</span>
      </div>
    </div>
  );
};

// ============================================================================
// COVERAGE CATEGORY COMPONENT
// ============================================================================

const CoverageCategorySection: React.FC<{
  category: CoverageCategory;
  coverages: Coverage[];
  isExpanded: boolean;
  onToggle: () => void;
  onCoverageClick: (coverage: Coverage) => void;
}> = ({ category, coverages, isExpanded, onToggle, onCoverageClick }) => {
  const categoryConfig = getCategoryConfig(category);

  return (
    <div>
      {/* Category Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', categoryConfig.bgColor)}>
            {categoryConfig.icon}
          </div>
          <div className="text-left">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {categoryConfig.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {coverages.length} coverage{coverages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        )}
      </button>

      {/* Coverage Cards */}
      {isExpanded && (
        <div className="px-6 pb-6 space-y-3">
          {coverages.map((coverage) => (
            <CoverageCard
              key={coverage.code}
              coverage={coverage}
              onClick={() => onCoverageClick(coverage)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COVERAGE CARD COMPONENT
// ============================================================================

const CoverageCard: React.FC<{
  coverage: Coverage;
  onClick: () => void;
}> = ({ coverage, onClick }) => {
  const status = evaluateCoverageStatus(coverage);
  const statusConfig = getStatusConfig(status);

  return (
    <div
      onClick={onClick}
      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border-l-4"
      style={{ borderLeftColor: statusConfig.color }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Coverage Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">{coverage.icon}</span>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-gray-100 text-lg">
                {coverage.fullName}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Code: {coverage.code}
              </p>
            </div>
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-3">{coverage.shortDescription}</p>

          {/* Coverage Limit/Value */}
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600">
              <span className="text-xs text-gray-600 dark:text-gray-400 uppercase font-medium">Limit</span>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {formatLimit(coverage.limit)}
              </div>
            </div>

            {coverage.deductible && (
              <div className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-600 dark:text-gray-400 uppercase font-medium">Deductible</span>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  ${coverage.deductible.toLocaleString()}
                </div>
              </div>
            )}

            {coverage.premium && (
              <div className="bg-white dark:bg-gray-800 px-3 py-1.5 rounded-md border border-gray-200 dark:border-gray-600">
                <span className="text-xs text-gray-600 dark:text-gray-400 uppercase font-medium">Premium</span>
                <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  ${coverage.premium.toLocaleString()}/yr
                </div>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
              style={{
                backgroundColor: statusConfig.bgColor,
                color: statusConfig.textColor
              }}
            >
              {statusConfig.icon}
              {statusConfig.label}
            </div>

            {status === CoverageStatus.Critical && (
              <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                ⚠️ Address immediately with customer
              </span>
            )}

            {status === CoverageStatus.BelowRecommended && (
              <span className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                💡 Upsell opportunity
              </span>
            )}
          </div>
        </div>

        {/* Info Button */}
        <button
          className="flex-shrink-0 p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <Info className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </button>
      </div>

      {/* Quick Talking Points */}
      {coverage.talkingPoints && coverage.talkingPoints.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-1.5">
            💬 Quick Talking Points
          </div>
          <ul className="space-y-1">
            {coverage.talkingPoints.slice(0, 2).map((point, index) => (
              <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// COVERAGE MODAL COMPONENT
// ============================================================================

const CoverageModal: React.FC<{
  coverage: Coverage;
  onClose: () => void;
}> = ({ coverage, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'objections' | 'examples'>('overview');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="text-4xl">{coverage.icon}</span>
              <div>
                <h2 className="text-2xl font-bold">{coverage.fullName}</h2>
                <p className="text-blue-100 mt-1">Code: {coverage.code}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-800 dark:hover:bg-blue-900 rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Coverage Value */}
          <div className="mt-4 flex items-center gap-4">
            <div className="bg-blue-800 bg-opacity-50 px-4 py-2 rounded-lg">
              <div className="text-blue-200 text-sm">Limit</div>
              <div className="text-xl font-bold">{formatLimit(coverage.limit)}</div>
            </div>
            {coverage.deductible && (
              <div className="bg-blue-800 bg-opacity-50 px-4 py-2 rounded-lg">
                <div className="text-blue-200 text-sm">Deductible</div>
                <div className="text-xl font-bold">${coverage.deductible.toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              label="Overview & Details"
            />
            <TabButton
              active={activeTab === 'objections'}
              onClick={() => setActiveTab('objections')}
              label="Objection Handling"
            />
            <TabButton
              active={activeTab === 'examples'}
              onClick={() => setActiveTab('examples')}
              label="Real Examples"
            />
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <OverviewTab coverage={coverage} />
          )}
          {activeTab === 'objections' && (
            <ObjectionsTab coverage={coverage} />
          )}
          {activeTab === 'examples' && (
            <ExamplesTab coverage={coverage} />
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            💡 <span className="font-medium">Pro Tip:</span> Use these talking points to confidently explain coverage
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const TabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
}> = ({ active, onClick, label }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-6 py-3 font-medium transition-colors',
        active
          ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-white dark:bg-gray-800'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
      )}
    >
      {label}
    </button>
  );
};

// ============================================================================
// MODAL TAB COMPONENTS
// ============================================================================

const OverviewTab: React.FC<{ coverage: Coverage }> = ({ coverage }) => {
  return (
    <div className="space-y-6">
      {/* What It Is */}
      <Section title="📖 What Is This Coverage?">
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{coverage.longDescription}</p>
      </Section>

      {/* Why Customers Need It */}
      <Section title="💰 Why Customers Need It">
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed italic">
          &quot;{coverage.whyCustomersNeedIt}&quot;
        </p>
        <div className="mt-3 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Agent Tip:</strong> Use this exact language when explaining the value to customers.
          </p>
        </div>
      </Section>

      {/* What It Covers */}
      <Section title="✅ What It Covers">
        <ul className="space-y-2">
          {coverage.whatItCovers.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* What It Doesn't Cover */}
      <Section title="❌ What It Doesn't Cover">
        <ul className="space-y-2">
          {coverage.whatItDoesNotCover.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 dark:text-gray-300">{item}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Recommended Limits */}
      <Section title="📊 Recommended Limits">
        <div className="grid grid-cols-3 gap-4">
          {coverage.recommendedLimits.map((rec, index) => (
            <div
              key={index}
              className={cn(
                'p-4 rounded-lg border-2',
                rec.level === 'best'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                  : rec.level === 'better'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                  : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
              )}
            >
              <div className="text-xs font-semibold uppercase mb-1">
                {rec.level === 'best' ? '⭐ Best' : rec.level === 'better' ? '👍 Better' : '✓ Minimum'}
              </div>
              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">{rec.value}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{rec.description}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Red Flags */}
      {coverage.redFlags && coverage.redFlags.length > 0 && (
        <Section title="🚨 Red Flags - Coverage Too Low">
          <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <ul className="space-y-2">
              {coverage.redFlags.map((flag, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-red-900 dark:text-red-100">{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}

      {/* Upsell Opportunities */}
      {coverage.upsellOpportunities && coverage.upsellOpportunities.length > 0 && (
        <Section title="💡 Upsell Opportunities">
          <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <ul className="space-y-2">
              {coverage.upsellOpportunities.map((opp, index) => (
                <li key={index} className="flex items-start gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-green-900 dark:text-green-100">{opp}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>
      )}
    </div>
  );
};

const ObjectionsTab: React.FC<{ coverage: Coverage }> = ({ coverage }) => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-blue-900 dark:text-blue-100">
          <strong>How to Use:</strong> When a customer raises an objection, use these proven responses to address their concerns and build confidence in the coverage.
        </p>
      </div>

      {coverage.commonObjections.map((objection, index) => (
        <div key={index} className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              Customer Says:
            </div>
            <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-400 p-3 rounded">
              <p className="text-red-900 dark:text-red-100 italic">&quot;{objection.objection}&quot;</p>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase mb-2">
              You Respond:
            </div>
            <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-400 p-3 rounded">
              <p className="text-green-900 dark:text-green-100">&quot;{objection.response}&quot;</p>
            </div>
          </div>
        </div>
      ))}

      <div className="bg-yellow-50 dark:bg-yellow-900/30 border-l-4 border-yellow-500 p-4 rounded">
        <p className="text-yellow-900 dark:text-yellow-100">
          <strong>💡 Pro Tip:</strong> Always acknowledge the customer&apos;s concern first, then educate with facts and examples. End with a recommendation based on their specific situation.
        </p>
      </div>
    </div>
  );
};

const ExamplesTab: React.FC<{ coverage: Coverage }> = ({ coverage }) => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-blue-900 dark:text-blue-100">
          <strong>How to Use:</strong> Share these real-world examples to illustrate the value of coverage. Stories are more powerful than statistics.
        </p>
      </div>

      <Section title="📖 Real Claim Example">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
          <p className="text-gray-800 dark:text-gray-200 leading-relaxed italic text-lg">
            &quot;{coverage.realClaimExample}&quot;
          </p>
        </div>
      </Section>

      <Section title="💬 How to Tell This Story">
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Step 1: Set the Scene</h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              &quot;Let me tell you about a real situation we handled last year...&quot;
            </p>
          </div>

          <div className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Step 2: Share the Example</h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm italic">
              {coverage.realClaimExample}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Step 3: Connect to Customer</h4>
            <p className="text-gray-700 dark:text-gray-300 text-sm">
              &quot;This could happen to anyone. That&apos;s why we recommend having adequate coverage to protect yourself.&quot;
            </p>
          </div>
        </div>
      </Section>

      <Section title="🎯 When to Use This Example">
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="text-gray-700 dark:text-gray-300">When customer questions the value of this coverage</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="text-gray-700 dark:text-gray-300">When customer thinks &quot;it won&apos;t happen to me&quot;</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="text-gray-700 dark:text-gray-300">When customer is price-shopping and considering lower limits</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">•</span>
            <span className="text-gray-700 dark:text-gray-300">When recommending an increase in coverage</span>
          </li>
        </ul>
      </Section>
    </div>
  );
};

const Section: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  return (
    <div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
        {title}
      </h3>
      {children}
    </div>
  );
};

// ============================================================================
// AGENT QUICK ACTIONS COMPONENT
// ============================================================================

const AgentQuickActions: React.FC<{ policy: Policy }> = ({ policy }) => {
  return (
    <div className="bg-gradient-to-r from-purple-600 to-purple-700 dark:from-purple-700 dark:to-purple-800 rounded-lg shadow-lg p-6 text-white">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Star className="w-6 h-6" />
        Agent Quick Actions
      </h3>

      <div className="grid grid-cols-3 gap-4">
        <QuickActionButton
          icon={<Phone className="w-5 h-5" />}
          label="Request Quote"
          description="Get updated quote with recommended changes"
        />
        <QuickActionButton
          icon={<Mail className="w-5 h-5" />}
          label="Email Summary"
          description="Send coverage summary to customer"
        />
        <QuickActionButton
          icon={<ExternalLink className="w-5 h-5" />}
          label="View in HawkSoft"
          description="Open full policy in HawkSoft"
        />
      </div>
    </div>
  );
};

const QuickActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
}> = ({ icon, label, description }) => {
  return (
    <button className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg p-4 text-left transition-colors">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="font-semibold">{label}</span>
      </div>
      <p className="text-sm text-purple-100">{description}</p>
    </button>
  );
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function groupCoveragesByCategory(coverages: Coverage[]): Record<string, Coverage[]> {
  return coverages.reduce((acc, coverage) => {
    const category = coverage.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(coverage);
    return acc;
  }, {} as Record<string, Coverage[]>);
}

function analyzeCoverageGaps(policy: Policy): CoverageInsight[] {
  const insights: CoverageInsight[] = [];

  // Example analysis logic - customize based on your business rules
  policy.coverages.forEach(coverage => {
    const status = evaluateCoverageStatus(coverage);

    if (status === CoverageStatus.Critical) {
      insights.push({
        type: 'critical',
        title: `${coverage.fullName} is critically low`,
        description: `Current limit: ${formatLimit(coverage.limit)}. This leaves the customer significantly underinsured.`,
        action: `I noticed your ${coverage.fullName} is below recommended levels. Let's discuss increasing this to protect you better.`,
        coverage
      });
    } else if (status === CoverageStatus.BelowRecommended) {
      insights.push({
        type: 'warning',
        title: `${coverage.fullName} below recommended`,
        description: `Current limit: ${formatLimit(coverage.limit)}. Consider recommending an increase.`,
        action: `Your ${coverage.fullName} is good, but increasing it would give you even better protection for just a few dollars more per month.`,
        coverage
      });
    }
  });

  return insights;
}

function evaluateCoverageStatus(coverage: Coverage): CoverageStatus {
  // Implement your business logic here
  // This is a simplified example

  // For demonstration, using coverage code patterns
  if (coverage.code === 'BI' && typeof coverage.limit === 'string') {
    const limits = coverage.limit.split('/').map(l => parseInt(l.replace(/\D/g, '')));
    if (limits[0] < 100000) return CoverageStatus.Critical;
    if (limits[0] < 250000) return CoverageStatus.BelowRecommended;
    if (limits[0] >= 500000) return CoverageStatus.Excellent;
  }

  return CoverageStatus.Adequate;
}

function getCategoryConfig(category: CoverageCategory) {
  const configs = {
    [CoverageCategory.Liability]: {
      title: 'Liability Coverages',
      icon: <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />,
      bgColor: 'bg-blue-100 dark:bg-blue-900/50'
    },
    [CoverageCategory.Property]: {
      title: 'Property Coverages',
      icon: <Home className="w-6 h-6 text-green-600 dark:text-green-400" />,
      bgColor: 'bg-green-100 dark:bg-green-900/50'
    },
    [CoverageCategory.PhysicalDamage]: {
      title: 'Physical Damage Coverages',
      icon: <Car className="w-6 h-6 text-orange-600 dark:text-orange-400" />,
      bgColor: 'bg-orange-100 dark:bg-orange-900/50'
    },
    [CoverageCategory.Medical]: {
      title: 'Medical Coverages',
      icon: <Heart className="w-6 h-6 text-red-600 dark:text-red-400" />,
      bgColor: 'bg-red-100 dark:bg-red-900/50'
    },
    [CoverageCategory.Additional]: {
      title: 'Additional Coverages',
      icon: <Star className="w-6 h-6 text-purple-600 dark:text-purple-400" />,
      bgColor: 'bg-purple-100 dark:bg-purple-900/50'
    }
  };

  return configs[category];
}

function getStatusConfig(status: CoverageStatus) {
  const configs = {
    [CoverageStatus.Critical]: {
      label: 'Critical - Too Low',
      icon: <AlertCircle className="w-4 h-4" />,
      color: '#DC2626',
      bgColor: '#FEE2E2',
      textColor: '#991B1B'
    },
    [CoverageStatus.BelowRecommended]: {
      label: 'Below Recommended',
      icon: <AlertTriangle className="w-4 h-4" />,
      color: '#F59E0B',
      bgColor: '#FEF3C7',
      textColor: '#92400E'
    },
    [CoverageStatus.Adequate]: {
      label: 'Adequate',
      icon: <CheckCircle className="w-4 h-4" />,
      color: '#10B981',
      bgColor: '#D1FAE5',
      textColor: '#065F46'
    },
    [CoverageStatus.Excellent]: {
      label: 'Excellent Coverage',
      icon: <Star className="w-4 h-4" />,
      color: '#8B5CF6',
      bgColor: '#EDE9FE',
      textColor: '#5B21B6'
    }
  };

  return configs[status];
}

function formatLimit(limit: string | number): string {
  if (typeof limit === 'number') {
    return `$${limit.toLocaleString()}`;
  }
  return limit;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function isExpiringSoon(expirationDate: string): boolean {
  const days = getDaysUntilExpiration(expirationDate);
  return days <= 30 && days >= 0;
}

function getDaysUntilExpiration(expirationDate: string): number {
  const expDate = new Date(expirationDate);
  const today = new Date();
  const diffTime = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default CoverageScreen;
