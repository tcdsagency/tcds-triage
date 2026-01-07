"use client";

import { useState, useEffect } from "react";
import {
  Brain,
  Phone,
  Mail,
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Clock,
  DollarSign,
  ChevronRight,
  RefreshCw,
  User,
  Target,
  Shield,
  Sparkles,
  CheckCircle2,
  XCircle,
  Copy,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface PredictedTask {
  type: string;
  customerId: string;
  customerName: string;
  priority: "urgent" | "high" | "medium" | "low";
  reasoning: string;
  estimatedDuration: number;
  expectedOutcome: {
    success: number;
    revenue?: number;
    retention?: number;
  };
  preparation: string[];
  script?: string;
  dueBy?: string;
}

interface DailyTaskList {
  date: string;
  agentId: string;
  tasks: PredictedTask[];
  summary: {
    totalTasks: number;
    estimatedTime: number;
    expectedRevenue: number;
    retentionImpact: string;
  };
}

// =============================================================================
// PRIORITY COLORS
// =============================================================================

const PRIORITY_COLORS = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const TASK_TYPE_ICONS: Record<string, any> = {
  retention_call: AlertTriangle,
  cross_sell: TrendingUp,
  claim_followup: Shield,
  renewal_review: Clock,
  general_outreach: Phone,
};

const TASK_TYPE_LABELS: Record<string, string> = {
  retention_call: "Retention",
  cross_sell: "Cross-Sell",
  claim_followup: "Claim Follow-up",
  renewal_review: "Renewal Review",
  general_outreach: "Outreach",
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function AITasksPage() {
  const [taskList, setTaskList] = useState<DailyTaskList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());
  const [copiedScript, setCopiedScript] = useState<number | null>(null);

  // Fetch tasks on mount
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai/daily-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });

      const data = await response.json();

      if (data.success) {
        setTaskList(data.tasks);
      } else {
        setError(data.error || "Failed to generate tasks");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskComplete = (index: number) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const copyScript = (script: string, index: number) => {
    navigator.clipboard.writeText(script);
    setCopiedScript(index);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  // Calculate stats (with null-safe access to summary)
  const stats = taskList
    ? {
        total: taskList.tasks?.length ?? 0,
        completed: completedTasks.size,
        remaining: (taskList.tasks?.length ?? 0) - completedTasks.size,
        urgent: taskList.tasks?.filter((t) => t.priority === "urgent").length ?? 0,
        high: taskList.tasks?.filter((t) => t.priority === "high").length ?? 0,
        totalRevenue: taskList.summary?.expectedRevenue ?? 0,
        totalTime: taskList.summary?.estimatedTime ?? 0,
      }
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Who Should I Call Today?</h1>
            <p className="text-zinc-400 text-sm">
              AI-powered task prioritization for{" "}
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <button
          onClick={fetchTasks}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <Target className="w-4 h-4" />
              Total Tasks
            </div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              Completed
            </div>
            <div className="text-2xl font-bold text-green-400">
              {stats.completed}/{stats.total}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              Urgent
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.urgent}</div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <Clock className="w-4 h-4" />
              Est. Time
            </div>
            <div className="text-2xl font-bold">
              {Math.round(stats.totalTime / 60)}h {stats.totalTime % 60}m
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <DollarSign className="w-4 h-4 text-green-400" />
              Potential Revenue
            </div>
            <div className="text-2xl font-bold text-green-400">
              ${stats.totalRevenue.toLocaleString()}
            </div>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
              <Sparkles className="w-4 h-4 text-purple-400" />
              Retention Impact
            </div>
            <div className="text-sm font-medium text-purple-400">
              {taskList?.summary.retentionImpact || "High"}
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mb-4" />
          <p className="text-zinc-400">AI is analyzing your customers...</p>
          <p className="text-zinc-500 text-sm">This may take a few moments</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            Failed to Generate Tasks
          </h3>
          <p className="text-zinc-400 mb-4">{error}</p>
          <button
            onClick={fetchTasks}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Task List */}
      {taskList && !loading && (
        <div className="space-y-4">
          {(!taskList.tasks || taskList.tasks.length === 0) ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
              <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">All Caught Up!</h3>
              <p className="text-zinc-400">No prioritized tasks for today.</p>
            </div>
          ) : (
            taskList.tasks.map((task, index) => {
              const isCompleted = completedTasks.has(index);
              const isExpanded = expandedTask === index;
              const TaskIcon = TASK_TYPE_ICONS[task.type] || Phone;

              return (
                <div
                  key={index}
                  className={`bg-zinc-900/50 border rounded-xl transition-all ${
                    isCompleted
                      ? "border-green-500/30 opacity-60"
                      : "border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Task Header */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer"
                    onClick={() => setExpandedTask(isExpanded ? null : index)}
                  >
                    {/* Completion Toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTaskComplete(index);
                      }}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isCompleted
                          ? "bg-green-500 border-green-500"
                          : "border-zinc-600 hover:border-zinc-500"
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-4 h-4" />}
                    </button>

                    {/* Task Icon */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${PRIORITY_COLORS[task.priority]}`}
                    >
                      <TaskIcon className="w-5 h-5" />
                    </div>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}
                        >
                          {task.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {TASK_TYPE_LABELS[task.type] || task.type}
                        </span>
                        <span className="text-xs text-zinc-600">
                          ~{task.estimatedDuration} min
                        </span>
                      </div>
                      <h3
                        className={`font-medium ${isCompleted ? "line-through text-zinc-500" : ""}`}
                      >
                        {task.customerName}
                      </h3>
                      <p className="text-sm text-zinc-400 truncate">{task.reasoning}</p>
                    </div>

                    {/* Expected Outcome */}
                    <div className="hidden md:flex items-center gap-4 text-sm">
                      {task.expectedOutcome.revenue && task.expectedOutcome.revenue > 0 && (
                        <div className="text-green-400">
                          +${task.expectedOutcome.revenue.toLocaleString()}
                        </div>
                      )}
                      <div className="text-zinc-400">
                        {Math.round(task.expectedOutcome.success * 100)}% success
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `/customer/${task.customerId}`;
                        }}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="View Customer"
                      >
                        <User className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                        title="Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <ChevronRight
                        className={`w-5 h-5 text-zinc-500 transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 p-4 space-y-4">
                      {/* Preparation Steps */}
                      {task.preparation && task.preparation.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-zinc-400 mb-2">
                            Preparation Steps
                          </h4>
                          <ul className="space-y-1">
                            {task.preparation.map((step, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm">
                                <span className="text-purple-400 mt-1">•</span>
                                {step}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Script */}
                      {task.script && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-zinc-400">
                              Suggested Script
                            </h4>
                            <button
                              onClick={() => copyScript(task.script!, index)}
                              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
                            >
                              {copiedScript === index ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                          <div className="bg-zinc-800/50 rounded-lg p-3 text-sm italic text-zinc-300">
                            "{task.script}"
                          </div>
                        </div>
                      )}

                      {/* Expected Outcome Details */}
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-zinc-500">Success Rate: </span>
                          <span className="text-white">
                            {Math.round(task.expectedOutcome.success * 100)}%
                          </span>
                        </div>
                        {task.expectedOutcome.revenue && task.expectedOutcome.revenue > 0 && (
                          <div>
                            <span className="text-zinc-500">Potential Revenue: </span>
                            <span className="text-green-400">
                              ${task.expectedOutcome.revenue.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {task.expectedOutcome.retention && (
                          <div>
                            <span className="text-zinc-500">Retention Impact: </span>
                            <span className="text-blue-400">
                              {Math.round(task.expectedOutcome.retention * 100)}%
                            </span>
                          </div>
                        )}
                        {task.dueBy && (
                          <div>
                            <span className="text-zinc-500">Due: </span>
                            <span className="text-orange-400">{task.dueBy}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-3 pt-2">
                        <button className="flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 rounded-lg transition-colors">
                          <Phone className="w-4 h-4" />
                          Start Call
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                          <Mail className="w-4 h-4" />
                          Send Email
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
                          <MessageSquare className="w-4 h-4" />
                          Send Text
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer Info */}
      {taskList && !loading && (
        <div className="mt-8 text-center text-sm text-zinc-500">
          <p>
            Tasks generated by AI based on customer data, policy expirations, and engagement
            patterns.
          </p>
          <p>Last updated: {new Date().toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  );
}
