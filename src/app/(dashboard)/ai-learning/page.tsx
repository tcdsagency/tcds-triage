'use client';

import { useState, useEffect } from 'react';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  BarChart3,
  RefreshCw,
  ChevronRight,
  FileText,
  Zap,
  History,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

type TabType = 'overview' | 'corrections' | 'prompts' | 'evaluations';

interface CorrectionStats {
  totalCorrections: number;
  byField: Array<{ field: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  topMistakes: Array<{ field: string; aiValue: string; count: number }>;
  estimatedFieldAccuracies: Record<string, number>;
}

interface PromptVersion {
  id: string;
  version: number;
  name: string;
  promptType: string;
  status: 'draft' | 'testing' | 'active' | 'archived';
  evaluationResults?: {
    overall_accuracy: number;
    field_accuracies: Record<string, number>;
    sample_size: number;
    tested_at: string;
  };
  suggestedImprovements?: string;
  createdAt: string;
  activatedAt?: string;
}

interface EvaluationRun {
  id: string;
  promptVersionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  evaluationDatasetSize: number;
  overallAccuracy?: number;
  improvementDelta?: number;
  triggerType: string;
  createdAt: string;
  completedAt?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function AILearningPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [stats, setStats] = useState<CorrectionStats | null>(null);
  const [prompts, setPrompts] = useState<PromptVersion[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringCron, setTriggeringCron] = useState(false);

  // Fetch data
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch correction stats
      const statsRes = await fetch('/api/ai-corrections?stats=true');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.data);
      }

      // TODO: Add API endpoints for prompts and evaluations
      // For now, use placeholder data
      setPrompts([]);
      setEvaluations([]);
    } catch (error) {
      console.error('Failed to fetch AI learning data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function triggerManualRun() {
    setTriggeringCron(true);
    try {
      const res = await fetch('/api/ai-learning/cron');
      const data = await res.json();
      if (data.success) {
        toast.success('Weekly learning job completed');
        fetchData(); // Refresh data
      } else {
        toast.error(data.message || 'Learning job failed');
      }
    } catch (error) {
      console.error('Failed to trigger learning job:', error);
      toast.error('Failed to run learning job');
    } finally {
      setTriggeringCron(false);
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'corrections', label: 'Corrections', icon: FileText },
    { id: 'prompts', label: 'Prompt Versions', icon: Brain },
    { id: 'evaluations', label: 'Evaluation History', icon: History },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Brain className="h-7 w-7 text-purple-600" />
              AI Learning Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Monitor AI accuracy and manage prompt improvements
            </p>
          </div>
          <button
            onClick={triggerManualRun}
            disabled={triggeringCron}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              triggeringCron
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            )}
          >
            {triggeringCron ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Run Learning Job
              </>
            )}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === id
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab stats={stats} />}
            {activeTab === 'corrections' && <CorrectionsTab stats={stats} />}
            {activeTab === 'prompts' && <PromptsTab prompts={prompts} />}
            {activeTab === 'evaluations' && <EvaluationsTab evaluations={evaluations} />}
          </>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// TAB COMPONENTS
// =============================================================================

function OverviewTab({ stats }: { stats: CorrectionStats | null }) {
  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        No correction data available yet
      </div>
    );
  }

  // Calculate overall accuracy estimate
  const accuracies = Object.values(stats.estimatedFieldAccuracies);
  const avgAccuracy =
    accuracies.length > 0
      ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length
      : 0;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Corrections"
          value={stats.totalCorrections}
          subtitle="Last 30 days"
          icon={<FileText className="h-5 w-5" />}
          color="blue"
        />
        <MetricCard
          title="Estimated Accuracy"
          value={`${(avgAccuracy * 100).toFixed(1)}%`}
          subtitle="Across all fields"
          icon={<Target className="h-5 w-5" />}
          color="green"
        />
        <MetricCard
          title="Most Corrected Field"
          value={stats.byField[0]?.field || 'N/A'}
          subtitle={`${stats.byField[0]?.count || 0} corrections`}
          icon={<AlertCircle className="h-5 w-5" />}
          color="yellow"
        />
        <MetricCard
          title="Common Error Type"
          value={formatCorrectionType(stats.byType[0]?.type || '')}
          subtitle={`${stats.byType[0]?.count || 0} occurrences`}
          icon={<Brain className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Daily trend chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Correction Trend (14 days)
        </h3>
        <div className="h-48 flex items-end gap-1">
          {stats.dailyTrend.map((day, i) => {
            const maxCount = Math.max(...stats.dailyTrend.map((d) => d.count), 1);
            const height = (day.count / maxCount) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-purple-500 rounded-t"
                  style={{ height: `${height}%`, minHeight: day.count > 0 ? '4px' : '0' }}
                />
                <span className="text-xs text-gray-500 rotate-45 origin-left">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Field accuracies */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Estimated Accuracy by Field
        </h3>
        <div className="space-y-3">
          {Object.entries(stats.estimatedFieldAccuracies).map(([field, accuracy]) => (
            <div key={field} className="flex items-center gap-4">
              <span className="w-32 text-sm text-gray-600 dark:text-gray-400 truncate">
                {formatFieldName(field)}
              </span>
              <div className="flex-1 h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    accuracy >= 0.9
                      ? 'bg-green-500'
                      : accuracy >= 0.7
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  )}
                  style={{ width: `${accuracy * 100}%` }}
                />
              </div>
              <span className="w-16 text-sm font-medium text-gray-900 dark:text-white text-right">
                {(accuracy * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CorrectionsTab({ stats }: { stats: CorrectionStats | null }) {
  if (!stats) {
    return (
      <div className="text-center py-12 text-gray-500">
        No correction data available yet
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* By Field */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Corrections by Field
        </h3>
        <div className="space-y-2">
          {stats.byField.map((item) => (
            <div key={item.field} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {formatFieldName(item.field)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* By Type */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Corrections by Type
        </h3>
        <div className="space-y-2">
          {stats.byType.map((item) => (
            <div key={item.type} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {formatCorrectionType(item.type)}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {item.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Mistakes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Common AI Mistakes
        </h3>
        <div className="space-y-3">
          {stats.topMistakes.map((mistake, i) => (
            <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatFieldName(mistake.field)}
                </span>
                <span className="text-xs text-gray-500">{mistake.count}x</span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                AI said: "{mistake.aiValue || '(empty)'}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PromptsTab({ prompts }: { prompts: PromptVersion[] }) {
  if (prompts.length === 0) {
    return (
      <div className="text-center py-12">
        <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No prompt versions yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Prompt versions will be created by the weekly learning job
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prompts.map((prompt) => (
        <div
          key={prompt.id}
          className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {prompt.name}
                </h3>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    prompt.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : prompt.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-700'
                      : prompt.status === 'testing'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-700'
                  )}
                >
                  {prompt.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Version {prompt.version} | {prompt.promptType}
              </p>
            </div>
            {prompt.evaluationResults && (
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(prompt.evaluationResults.overall_accuracy * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500">accuracy</p>
              </div>
            )}
          </div>
          {prompt.suggestedImprovements && (
            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm text-purple-700 dark:text-purple-400 line-clamp-3">
                {prompt.suggestedImprovements}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EvaluationsTab({ evaluations }: { evaluations: EvaluationRun[] }) {
  if (evaluations.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No evaluation runs yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Run the learning job to generate evaluations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evaluations.map((run) => (
        <div
          key={run.id}
          className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm flex items-center gap-4"
        >
          <div
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              run.status === 'completed'
                ? 'bg-green-100 text-green-600'
                : run.status === 'running'
                ? 'bg-blue-100 text-blue-600'
                : run.status === 'failed'
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {run.status === 'completed' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : run.status === 'running' ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : run.status === 'failed' ? (
              <AlertCircle className="h-5 w-5" />
            ) : (
              <Clock className="h-5 w-5" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-white">
              Evaluation Run
            </p>
            <p className="text-sm text-gray-500">
              {run.evaluationDatasetSize} examples | {run.triggerType}
            </p>
          </div>
          {run.overallAccuracy !== undefined && (
            <div className="text-right">
              <p className="font-semibold text-gray-900 dark:text-white">
                {(Number(run.overallAccuracy) * 100).toFixed(1)}%
              </p>
              {run.improvementDelta !== undefined && (
                <p
                  className={cn(
                    'text-xs',
                    Number(run.improvementDelta) > 0
                      ? 'text-green-600'
                      : Number(run.improvementDelta) < 0
                      ? 'text-red-600'
                      : 'text-gray-500'
                  )}
                >
                  {Number(run.improvementDelta) > 0 ? '+' : ''}
                  {(Number(run.improvementDelta) * 100).toFixed(2)}%
                </p>
              )}
            </div>
          )}
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function MetricCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', colorClasses[color])}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatCorrectionType(type: string): string {
  const typeLabels: Record<string, string> = {
    wrong_value: 'Wrong Value',
    missing_value: 'Missing Value',
    extra_value: 'Extra Value',
    format_issue: 'Format Issue',
    context_error: 'Context Error',
  };
  return typeLabels[type] || type;
}
