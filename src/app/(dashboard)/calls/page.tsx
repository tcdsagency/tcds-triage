"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  ChevronRight,
  Star,
  MessageSquare,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Mic,
  X,
} from "lucide-react";
import CallPopup from "@/components/features/CallPopup";

// =============================================================================
// TYPES
// =============================================================================

interface CallRecord {
  id: string;
  direction: "inbound" | "outbound";
  status: "completed" | "missed" | "voicemail" | "transferred" | "ringing" | "in_progress";
  phoneNumber: string; // Customer's phone (external number)
  agentPhone?: string; // Agent's phone (our number)
  fromNumber?: string;
  toNumber?: string;
  customerName: string;
  customerId?: string;
  agentName: string;
  agentId: string;
  startTime: string;
  endTime?: string;
  duration: number; // seconds
  disposition?: string;
  sentiment?: number; // -1 to 1
  qaScore?: number; // 0-100
  hasRecording: boolean;
  hasTranscript: boolean;
  transcript?: string; // Actual transcript content
  summary?: string;
  tags?: string[];
}

type DateFilter = "today" | "yesterday" | "7d" | "30d" | "custom";
type DirectionFilter = "all" | "inbound" | "outbound";
type StatusFilter = "all" | "completed" | "missed" | "voicemail";

// Agents loaded from API
interface Agent {
  id: string;
  name: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number): string {
  if (seconds === 0) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSentimentColor(sentiment: number | undefined): string {
  if (sentiment === undefined) return "text-gray-400";
  if (sentiment >= 0.5) return "text-green-600";
  if (sentiment >= 0) return "text-yellow-600";
  return "text-red-600";
}

function getSentimentLabel(sentiment: number | undefined): string {
  if (sentiment === undefined) return "N/A";
  if (sentiment >= 0.5) return "Positive";
  if (sentiment >= 0) return "Neutral";
  return "Negative";
}

function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return "-";
  // Remove +1 prefix and format as (XXX) XXX-XXXX
  const cleaned = phone.replace(/^\+1/, '').replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  // If not 10 digits, just return cleaned without +1
  return phone.replace(/^\+1/, '');
}

// =============================================================================
// COMPONENTS
// =============================================================================

function CallStatusIcon({ call }: { call: CallRecord }) {
  if (call.status === "missed") {
    return (
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
        <PhoneMissed className="h-5 w-5 text-red-600" />
      </div>
    );
  }

  if (call.direction === "inbound") {
    return (
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
        <PhoneIncoming className="h-5 w-5 text-green-600" />
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
      <PhoneOutgoing className="h-5 w-5 text-blue-600" />
    </div>
  );
}

function CallRow({
  call,
  isSelected,
  onSelect,
}: {
  call: CallRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer transition-colors ${
        isSelected
          ? "bg-indigo-50"
          : "hover:bg-gray-50"
      }`}
    >
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <CallStatusIcon call={call} />
          <div>
            <p className="font-medium text-gray-900">{call.customerName}</p>
            <p className="text-sm text-gray-500">{formatPhoneNumber(call.phoneNumber)}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">{call.agentName}</span>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-gray-600">
        {formatTime(call.startTime)}
      </td>
      <td className="px-4 py-4 text-sm text-gray-600">
        {formatDuration(call.duration)}
      </td>
      <td className="px-4 py-4">
        {call.disposition === "hangup" ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            <PhoneMissed className="h-3 w-3" />
            Hangup
          </span>
        ) : call.disposition ? (
          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
            {call.disposition}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-4">
        <span className={`text-sm font-medium ${getSentimentColor(call.sentiment)}`}>
          {getSentimentLabel(call.sentiment)}
        </span>
      </td>
      <td className="px-4 py-4 text-center">
        {call.qaScore !== undefined ? (
          <span
            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
              call.qaScore >= 90
                ? "bg-green-100 text-green-700"
                : call.qaScore >= 70
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {call.qaScore}
          </span>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          {call.hasRecording && (
            <Volume2 className="h-4 w-4 text-gray-400" />
          )}
          {call.hasTranscript && (
            <MessageSquare className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </td>
      <td className="px-4 py-4">
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </td>
    </tr>
  );
}

function CallDetailsSidebar({
  call,
  onClose,
  onOpenLive,
}: {
  call: CallRecord;
  onClose: () => void;
  onOpenLive: () => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white shadow-xl border-l border-gray-200 z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Call Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Customer Info */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center">
            <User className="h-7 w-7 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {call.customerName}
            </h3>
            <p className="text-gray-600">{formatPhoneNumber(call.phoneNumber)}</p>
          </div>
        </div>

        {/* Call Info Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Direction</p>
            <p className="font-medium text-gray-900 capitalize flex items-center gap-2">
              {call.direction === "inbound" ? (
                <PhoneIncoming className="h-4 w-4 text-green-600" />
              ) : (
                <PhoneOutgoing className="h-4 w-4 text-blue-600" />
              )}
              {call.direction}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <p className="font-medium text-gray-900 capitalize">{call.status}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Customer Phone</p>
            <p className="font-medium text-gray-900">
              {formatPhoneNumber(call.phoneNumber)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Agent Phone</p>
            <p className="font-medium text-gray-900">
              {formatPhoneNumber(call.agentPhone)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Date & Time</p>
            <p className="font-medium text-gray-900">
              {formatDate(call.startTime)} at {formatTime(call.startTime)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Duration</p>
            <p className="font-medium text-gray-900">
              {formatDuration(call.duration)}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Agent</p>
            <p className="font-medium text-gray-900">{call.agentName}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-1">Disposition</p>
            <p className="font-medium text-gray-900">
              {call.disposition || "-"}
            </p>
          </div>
        </div>

        {/* Recording Player */}
        {call.hasRecording && (
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">Recording</h4>
              <button className="text-indigo-600 hover:text-indigo-700 text-sm flex items-center gap-1">
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </button>
              <div className="flex-1">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{ width: `${(playbackPosition / call.duration) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>{formatDuration(playbackPosition)}</span>
                  <span>{formatDuration(call.duration)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Analysis */}
        {(call.sentiment !== undefined || call.qaScore !== undefined) && (
          <div>
            <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              AI Analysis
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {call.sentiment !== undefined && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">Sentiment</p>
                  <p className={`font-medium ${getSentimentColor(call.sentiment)}`}>
                    {getSentimentLabel(call.sentiment)}
                  </p>
                </div>
              )}
              {call.qaScore !== undefined && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-1">QA Score</p>
                  <p
                    className={`font-medium ${
                      call.qaScore >= 90
                        ? "text-green-600"
                        : call.qaScore >= 70
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {call.qaScore}/100
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Summary */}
        {call.summary && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Summary
            </h4>
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
              {call.summary}
            </p>
          </div>
        )}

        {/* Tags */}
        {call.tags && call.tags.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {call.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Transcript */}
        {call.hasTranscript && call.transcript && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Transcript
              </h4>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto text-sm whitespace-pre-wrap">
              <p className="text-gray-700">{call.transcript}</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onOpenLive}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Phone className="h-4 w-4" />
            Call Back
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <User className="h-4 w-4" />
            View Customer
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsBar({ calls }: { calls: CallRecord[] }) {
  // Calculate real statistics from calls data
  const totalCalls = calls.length;
  const answered = calls.filter(c => c.status === "completed" || c.status === "transferred").length;
  const missed = calls.filter(c => c.status === "missed" || c.status === "voicemail").length;

  // Calculate average duration for completed calls
  const completedCalls = calls.filter(c => c.status === "completed" && c.duration > 0);
  const avgDurationSeconds = completedCalls.length > 0
    ? Math.round(completedCalls.reduce((sum, c) => sum + c.duration, 0) / completedCalls.length)
    : 0;
  const avgMins = Math.floor(avgDurationSeconds / 60);
  const avgSecs = avgDurationSeconds % 60;
  const avgDuration = avgDurationSeconds > 0 ? `${avgMins}:${avgSecs.toString().padStart(2, "0")}` : "-";

  const stats = [
    { label: "Total Calls", value: totalCalls.toLocaleString() },
    { label: "Answered", value: answered.toLocaleString() },
    { label: "Missed", value: missed.toLocaleString() },
    { label: "Avg Duration", value: avgDuration },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{stat.label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function CallsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
  const [showLiveCall, setShowLiveCall] = useState(false);
  const [liveCallPhone, setLiveCallPhone] = useState("");

  // Handle new call button - prompt for phone number
  const handleNewCall = () => {
    const phone = window.prompt("Enter phone number to call:");
    if (phone && phone.trim()) {
      setLiveCallPhone(phone.trim());
      setShowLiveCall(true);
    }
  };

  // Live data from API
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [agents, setAgents] = useState<Agent[]>([{ id: "all", name: "All Agents" }]);
  const [loading, setLoading] = useState(true);

  // Fetch calls from API
  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (directionFilter !== "all") params.set("direction", directionFilter);
      // Default to excluding ringing/in_progress - only show completed calls
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      } else {
        // When "all" is selected, exclude ringing and in_progress calls
        params.set("status", "completed,missed,voicemail,transferred");
      }
      if (agentFilter !== "all") params.set("agentId", agentFilter);
      if (dateFilter !== "custom") params.set("dateRange", dateFilter);

      const res = await fetch(`/api/calls?${params}`);
      const data = await res.json();

      if (data.success) {
        setCalls(data.calls || []);
        if (data.agents) {
          setAgents(data.agents);
        }
      }
    } catch (error) {
      console.error("Failed to fetch calls:", error);
    } finally {
      setLoading(false);
    }
  }, [directionFilter, statusFilter, agentFilter, dateFilter]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  // Filter calls by search (client-side for instant feedback)
  const filteredCalls = calls.filter((call) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !call.customerName.toLowerCase().includes(query) &&
        !call.phoneNumber.includes(query)
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Call History</h1>
          <p className="text-gray-600 mt-1">
            View and analyze all calls with recordings and transcripts
          </p>
        </div>
        <button
          onClick={handleNewCall}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Phone className="h-4 w-4" />
          New Call
        </button>
      </div>

      {/* Stats */}
      <StatsBar calls={calls} />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="custom">Custom Range</option>
          </select>

          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as DirectionFilter)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="missed">Missed</option>
            <option value="voicemail">Voicemail</option>
          </select>

          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Call List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Customer
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Agent
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Duration
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Disposition
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Sentiment
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                QA
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Media
              </th>
              <th className="px-4 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredCalls.map((call) => (
              <CallRow
                key={call.id}
                call={call}
                isSelected={selectedCall?.id === call.id}
                onSelect={() => setSelectedCall(call)}
              />
            ))}
          </tbody>
        </table>

        {filteredCalls.length === 0 && (
          <div className="text-center py-12">
            <Phone className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No calls found matching your filters</p>
          </div>
        )}
      </div>

      {/* Call Details Sidebar */}
      {selectedCall && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedCall(null)}
          />
          <CallDetailsSidebar
            call={selectedCall}
            onClose={() => setSelectedCall(null)}
            onOpenLive={() => {
              setSelectedCall(null);
              setShowLiveCall(true);
            }}
          />
        </>
      )}

      {/* Live Call Popup */}
      {showLiveCall && liveCallPhone && (
        <CallPopup
          sessionId={`call-${Date.now()}`}
          phoneNumber={liveCallPhone}
          direction="outbound"
          isVisible={showLiveCall}
          onClose={() => {
            setShowLiveCall(false);
            setLiveCallPhone("");
          }}
          onMinimize={() => {}}
        />
      )}
    </div>
  );
}
