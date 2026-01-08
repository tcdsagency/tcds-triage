"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Headphones,
  Mic,
  Users,
  Clock,
  Activity,
  RefreshCw,
  Volume2,
  VolumeX,
  PhoneOff,
  AlertCircle,
  CheckCircle,
  Pause,
  Play,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// =============================================================================
// Types
// =============================================================================

interface ActiveCall {
  id: string;
  sessionId: string;
  direction: "inbound" | "outbound";
  status: "ringing" | "connected" | "on_hold" | "wrap_up";
  agentId: string;
  agentName: string;
  agentExtension: string;
  customerName: string;
  customerPhone: string;
  startTime: string;
  duration: number;
  queueTime?: number;
  isRecording: boolean;
}

interface AgentStatus {
  id: string;
  name: string;
  extension: string;
  status: "available" | "on_call" | "wrap_up" | "away" | "offline";
  currentCallId?: string;
  callsHandled: number;
  avgHandleTime: number;
  avgTalkTime: number;
}

interface QueueStats {
  callsWaiting: number;
  longestWait: number;
  avgWaitTime: number;
  abandonedToday: number;
  serviceLevelPct: number;
}

interface Stats {
  totalCallsToday: number;
  answeredCalls: number;
  missedCalls: number;
  activeNow: number;
  avgHandleTime: number;
  agentsOnline: number;
  agentsOnCall: number;
}

interface TranscriptSegment {
  id: string;
  speaker: "agent" | "customer" | "system";
  text: string;
  timestamp: string;
  confidence: number;
  sequenceNumber: number;
}

// =============================================================================
// Component
// =============================================================================

export default function SupervisorPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([]);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [queue, setQueue] = useState<QueueStats | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Transcript viewing
  const [viewingCall, setViewingCall] = useState<ActiveCall | null>(null);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [transcriptLoading, setTranscriptLoading] = useState(false);

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ==========================================================================
  // Data Fetching
  // ==========================================================================

  const fetchData = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);

      const res = await fetch("/api/supervisor/calls");
      const data = await res.json();

      if (data.success) {
        setActiveCalls(data.activeCalls || []);
        setAgents(data.agents || []);
        setQueue(data.queue || null);
        setStats(data.stats || null);
        setLastUpdated(data.lastUpdated || new Date().toISOString());
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchData();
    }, 5000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  // ==========================================================================
  // Supervisor Actions
  // ==========================================================================

  const handleAction = async (action: string, callId: string) => {
    setActionLoading(`${action}-${callId}`);
    setActionResult(null);

    try {
      const res = await fetch("/api/supervisor/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, callId }),
      });

      const data = await res.json();
      setActionResult({
        id: callId,
        success: data.success,
        message: data.message || (data.success ? "Action completed" : "Action failed"),
      });

      // Clear result after 3 seconds
      setTimeout(() => setActionResult(null), 3000);
    } catch (error: any) {
      setActionResult({
        id: callId,
        success: false,
        message: error.message || "Action failed",
      });
    } finally {
      setActionLoading(null);
    }
  };

  // ==========================================================================
  // Transcript Viewing
  // ==========================================================================

  const openTranscript = (call: ActiveCall) => {
    setViewingCall(call);
    setTranscriptSegments([]);
    setTranscriptLoading(true);
  };

  const closeTranscript = () => {
    setViewingCall(null);
    setTranscriptSegments([]);
  };

  // Fetch transcript segments when viewing a call
  useEffect(() => {
    if (!viewingCall) return;

    const fetchTranscript = async () => {
      try {
        const res = await fetch(`/api/calls/${viewingCall.id}/transcript/segment`);
        const data = await res.json();
        if (data.success && data.segments) {
          setTranscriptSegments(data.segments);
        }
      } catch (error) {
        console.error("Failed to fetch transcript:", error);
      } finally {
        setTranscriptLoading(false);
      }
    };

    fetchTranscript();

    // Poll every 2 seconds for live updates
    const interval = setInterval(fetchTranscript, 2000);
    return () => clearInterval(interval);
  }, [viewingCall]);

  // ==========================================================================
  // Helpers
  // ==========================================================================

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTime = (isoString: string): string => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-emerald-500";
      case "on_call": return "bg-amber-500";
      case "wrap_up": return "bg-purple-500";
      case "away": return "bg-yellow-500";
      case "offline": return "bg-gray-400";
      case "ringing": return "bg-blue-500 animate-pulse";
      case "connected": return "bg-emerald-500";
      case "on_hold": return "bg-amber-500";
      default: return "bg-gray-400";
    }
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading supervisor dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Supervisor Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time call monitoring and agent management
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className={cn("w-2 h-2 rounded-full", autoRefresh ? "bg-emerald-500" : "bg-gray-400")} />
            {autoRefresh ? "Live" : "Paused"}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <StatCard
          label="Active Calls"
          value={stats?.activeNow || 0}
          icon={Phone}
          color="text-emerald-600"
          bgColor="bg-emerald-100 dark:bg-emerald-900/30"
        />
        <StatCard
          label="Calls Today"
          value={stats?.totalCallsToday || 0}
          icon={Activity}
          color="text-blue-600"
          bgColor="bg-blue-100 dark:bg-blue-900/30"
        />
        <StatCard
          label="Answered"
          value={stats?.answeredCalls || 0}
          icon={CheckCircle}
          color="text-emerald-600"
          bgColor="bg-emerald-100 dark:bg-emerald-900/30"
        />
        <StatCard
          label="Missed"
          value={stats?.missedCalls || 0}
          icon={PhoneMissed}
          color="text-red-600"
          bgColor="bg-red-100 dark:bg-red-900/30"
        />
        <StatCard
          label="In Queue"
          value={queue?.callsWaiting || 0}
          icon={Clock}
          color="text-amber-600"
          bgColor="bg-amber-100 dark:bg-amber-900/30"
        />
        <StatCard
          label="Agents Online"
          value={stats?.agentsOnline || 0}
          icon={Users}
          color="text-purple-600"
          bgColor="bg-purple-100 dark:bg-purple-900/30"
        />
        <StatCard
          label="Service Level"
          value={`${queue?.serviceLevelPct || 100}%`}
          icon={Activity}
          color="text-teal-600"
          bgColor="bg-teal-100 dark:bg-teal-900/30"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Calls - Takes 2 columns */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Active Calls</h2>
              {activeCalls.length > 0 && (
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  {activeCalls.length}
                </Badge>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {activeCalls.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Phone className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No active calls</p>
              </div>
            ) : (
              activeCalls.map((call) => (
                <div
                  key={call.id}
                  className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Direction Icon */}
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        call.direction === "inbound"
                          ? "bg-blue-100 dark:bg-blue-900/30"
                          : "bg-emerald-100 dark:bg-emerald-900/30"
                      )}>
                        {call.direction === "inbound" ? (
                          <PhoneIncoming className="w-5 h-5 text-blue-600" />
                        ) : (
                          <PhoneOutgoing className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>

                      {/* Call Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-white">
                            {call.customerName}
                          </span>
                          <span className={cn(
                            "w-2 h-2 rounded-full",
                            getStatusColor(call.status)
                          )} />
                          <span className="text-xs text-gray-500 capitalize">{call.status}</span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {call.customerPhone} → {call.agentName} (ext {call.agentExtension})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Duration */}
                      <div className="text-right">
                        <div className="text-lg font-mono font-semibold text-gray-900 dark:text-white">
                          {formatDuration(call.duration)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Started {formatTime(call.startTime)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openTranscript(call)}
                          title="View Live Transcript"
                          className="text-gray-500 hover:text-emerald-600"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction("listen", call.id)}
                          disabled={actionLoading === `listen-${call.id}`}
                          title="Silent Listen"
                          className="text-gray-500 hover:text-blue-600"
                        >
                          <Headphones className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction("whisper", call.id)}
                          disabled={actionLoading === `whisper-${call.id}`}
                          title="Whisper to Agent"
                          className="text-gray-500 hover:text-amber-600"
                        >
                          <Mic className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction("barge", call.id)}
                          disabled={actionLoading === `barge-${call.id}`}
                          title="Barge Into Call"
                          className="text-gray-500 hover:text-emerald-600"
                        >
                          <Volume2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAction("hangup", call.id)}
                          disabled={actionLoading === `hangup-${call.id}`}
                          title="End Call"
                          className="text-gray-500 hover:text-red-600"
                        >
                          <PhoneOff className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Action Result */}
                  {actionResult && actionResult.id === call.id && (
                    <div className={cn(
                      "mt-2 p-2 rounded text-sm",
                      actionResult.success
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    )}>
                      {actionResult.message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Agent Status - Takes 1 column */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Status</h2>
            </div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[500px] overflow-y-auto">
            {agents.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No agents found</p>
              </div>
            ) : (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Status indicator */}
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                          <span className="text-white text-xs font-medium">
                            {agent.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
                          </span>
                        </div>
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800",
                          getStatusColor(agent.status)
                        )} />
                      </div>

                      <div>
                        <div className="font-medium text-gray-900 dark:text-white text-sm">
                          {agent.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          Ext {agent.extension} • {agent.callsHandled} calls
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs capitalize",
                          agent.status === "available" && "bg-emerald-100 text-emerald-700",
                          agent.status === "on_call" && "bg-amber-100 text-amber-700",
                          agent.status === "wrap_up" && "bg-purple-100 text-purple-700",
                          agent.status === "away" && "bg-yellow-100 text-yellow-700",
                          agent.status === "offline" && "bg-gray-100 text-gray-700"
                        )}
                      >
                        {agent.status.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Legend */}
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex flex-wrap gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Available
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> On Call
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Wrap Up
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-500" /> Away
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Stats */}
      {queue && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Queue Performance</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{queue.callsWaiting}</div>
              <div className="text-sm text-gray-500">Waiting</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatDuration(queue.longestWait)}
              </div>
              <div className="text-sm text-gray-500">Longest Wait</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatDuration(queue.avgWaitTime)}
              </div>
              <div className="text-sm text-gray-500">Avg Wait</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{queue.abandonedToday}</div>
              <div className="text-sm text-gray-500">Abandoned</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
              <div className={cn(
                "text-2xl font-bold",
                queue.serviceLevelPct >= 80 ? "text-emerald-600" : "text-red-600"
              )}>
                {queue.serviceLevelPct}%
              </div>
              <div className="text-sm text-gray-500">Service Level</div>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div className="text-center text-xs text-gray-400">
        Last updated: {new Date(lastUpdated).toLocaleTimeString()}
      </div>

      {/* Live Transcript Modal */}
      {viewingCall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Live Transcript
                  </h2>
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {viewingCall.agentName} (ext {viewingCall.agentExtension}) → {viewingCall.customerPhone}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={closeTranscript}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Transcript Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {transcriptLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Activity className="w-6 h-6 animate-spin text-emerald-500" />
                </div>
              ) : transcriptSegments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No transcript segments yet</p>
                  <p className="text-sm">Waiting for speech...</p>
                </div>
              ) : (
                transcriptSegments.map((segment) => (
                  <div
                    key={segment.id}
                    className={cn(
                      "flex gap-3",
                      segment.speaker === "agent" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[80%] rounded-lg px-4 py-2",
                        segment.speaker === "agent"
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      )}
                    >
                      <div className="text-xs font-medium mb-1 opacity-70">
                        {segment.speaker === "agent" ? "Agent" : "Customer"}
                      </div>
                      <p className="text-sm">{segment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {transcriptSegments.length} segments
              </span>
              <span className="text-xs text-gray-500">
                Duration: {formatDuration(viewingCall.duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", bgColor)}>
          <Icon className={cn("w-5 h-5", color)} />
        </div>
        <div>
          <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
          <div className="text-xs text-gray-500">{label}</div>
        </div>
      </div>
    </div>
  );
}
