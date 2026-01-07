"use client";

import { useState } from "react";
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
  status: "completed" | "missed" | "voicemail" | "transferred";
  phoneNumber: string;
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
  summary?: string;
  tags?: string[];
}

type DateFilter = "today" | "yesterday" | "7d" | "30d" | "custom";
type DirectionFilter = "all" | "inbound" | "outbound";
type StatusFilter = "all" | "completed" | "missed" | "voicemail";

// =============================================================================
// DATA
// =============================================================================

const SAMPLE_CALLS: CallRecord[] = [
  {
    id: "call-001",
    direction: "inbound",
    status: "completed",
    phoneNumber: "(205) 555-1234",
    customerName: "John Smith",
    customerId: "cust-123",
    agentName: "Sarah Mitchell",
    agentId: "agent-1",
    startTime: "2024-01-15T10:23:00",
    endTime: "2024-01-15T10:31:45",
    duration: 525,
    disposition: "Quoted - Auto",
    sentiment: 0.7,
    qaScore: 92,
    hasRecording: true,
    hasTranscript: true,
    summary:
      "Customer called for auto insurance quote. Quoted $142/mo for full coverage. Customer to review and call back.",
    tags: ["new-quote", "auto"],
  },
  {
    id: "call-002",
    direction: "outbound",
    status: "completed",
    phoneNumber: "(205) 555-5678",
    customerName: "Mary Johnson",
    customerId: "cust-456",
    agentName: "Mike Rodriguez",
    agentId: "agent-2",
    startTime: "2024-01-15T09:45:00",
    endTime: "2024-01-15T09:58:30",
    duration: 810,
    disposition: "Bound - Home",
    sentiment: 0.9,
    qaScore: 88,
    hasRecording: true,
    hasTranscript: true,
    summary:
      "Follow-up call on home insurance quote. Customer decided to proceed. Policy bound - HO3 $1,450/yr.",
    tags: ["follow-up", "home", "bound"],
  },
  {
    id: "call-003",
    direction: "inbound",
    status: "missed",
    phoneNumber: "(205) 555-9012",
    customerName: "Robert Williams",
    customerId: "cust-789",
    agentName: "Unassigned",
    agentId: "",
    startTime: "2024-01-15T09:30:00",
    duration: 0,
    hasRecording: false,
    hasTranscript: false,
    tags: ["callback-needed"],
  },
  {
    id: "call-004",
    direction: "inbound",
    status: "completed",
    phoneNumber: "(205) 555-3456",
    customerName: "Patricia Brown",
    customerId: "cust-012",
    agentName: "Lisa Chen",
    agentId: "agent-3",
    startTime: "2024-01-15T11:15:00",
    endTime: "2024-01-15T11:22:00",
    duration: 420,
    disposition: "Service - Billing",
    sentiment: -0.3,
    qaScore: 78,
    hasRecording: true,
    hasTranscript: true,
    summary:
      "Customer called about billing discrepancy. Issue resolved - double charge was refunded. Customer still seemed frustrated.",
    tags: ["billing", "complaint"],
  },
  {
    id: "call-005",
    direction: "outbound",
    status: "voicemail",
    phoneNumber: "(205) 555-7890",
    customerName: "James Davis",
    customerId: "cust-345",
    agentName: "Sarah Mitchell",
    agentId: "agent-1",
    startTime: "2024-01-15T08:30:00",
    duration: 35,
    disposition: "Voicemail Left",
    hasRecording: true,
    hasTranscript: false,
    tags: ["renewal", "voicemail"],
  },
  {
    id: "call-006",
    direction: "inbound",
    status: "completed",
    phoneNumber: "(205) 555-2345",
    customerName: "Jennifer Wilson",
    customerId: "cust-678",
    agentName: "John Davis",
    agentId: "agent-4",
    startTime: "2024-01-15T14:00:00",
    endTime: "2024-01-15T14:25:00",
    duration: 1500,
    disposition: "Claim Filed",
    sentiment: 0.2,
    qaScore: 95,
    hasRecording: true,
    hasTranscript: true,
    summary:
      "Customer reported auto accident. FNOL completed. Claim #CLM-2024-001234 opened. Adjuster to contact within 24 hours.",
    tags: ["claim", "auto"],
  },
  {
    id: "call-007",
    direction: "inbound",
    status: "transferred",
    phoneNumber: "(205) 555-8901",
    customerName: "Michael Lee",
    customerId: "cust-901",
    agentName: "Emily Park",
    agentId: "agent-5",
    startTime: "2024-01-15T13:30:00",
    endTime: "2024-01-15T13:35:00",
    duration: 300,
    disposition: "Transferred to Commercial",
    sentiment: 0.5,
    hasRecording: true,
    hasTranscript: true,
    summary:
      "Customer inquiring about commercial fleet insurance. Transferred to commercial team.",
    tags: ["commercial", "transferred"],
  },
  {
    id: "call-008",
    direction: "outbound",
    status: "completed",
    phoneNumber: "(205) 555-4567",
    customerName: "Linda Martinez",
    customerId: "cust-234",
    agentName: "Mike Rodriguez",
    agentId: "agent-2",
    startTime: "2024-01-15T15:45:00",
    endTime: "2024-01-15T15:52:00",
    duration: 420,
    disposition: "Retention Save",
    sentiment: 0.8,
    qaScore: 91,
    hasRecording: true,
    hasTranscript: true,
    summary:
      "Renewal call - customer was shopping around. Matched competitor rate and added bundling discount. Customer staying.",
    tags: ["renewal", "retention", "save"],
  },
];

const AGENTS = [
  { id: "all", name: "All Agents" },
  { id: "agent-1", name: "Sarah Mitchell" },
  { id: "agent-2", name: "Mike Rodriguez" },
  { id: "agent-3", name: "Lisa Chen" },
  { id: "agent-4", name: "John Davis" },
  { id: "agent-5", name: "Emily Park" },
];

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
            <p className="text-sm text-gray-500">{call.phoneNumber}</p>
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
        {call.disposition ? (
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
            <p className="text-gray-600">{call.phoneNumber}</p>
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

        {/* Transcript Preview */}
        {call.hasTranscript && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Transcript
              </h4>
              <button className="text-indigo-600 hover:text-indigo-700 text-sm">
                View Full
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3 max-h-48 overflow-y-auto text-sm">
              <div>
                <span className="text-xs text-gray-400">Agent</span>
                <p className="text-gray-700">
                  Thank you for calling. How can I help you today?
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-400">Customer</span>
                <p className="text-gray-700">
                  Hi, I&apos;m looking to get a quote for auto insurance...
                </p>
              </div>
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

function StatsBar() {
  const stats = [
    { label: "Total Calls", value: "2,847", trend: "+12%" },
    { label: "Answered", value: "2,456", trend: "+8%" },
    { label: "Missed", value: "391", trend: "-5%" },
    { label: "Avg Duration", value: "4:32", trend: "-15s" },
  ];

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">{stat.label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
            <span
              className={`text-xs font-medium ${
                stat.trend.startsWith("+")
                  ? stat.label === "Missed"
                    ? "text-red-600"
                    : "text-green-600"
                  : stat.label === "Missed"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {stat.trend}
            </span>
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

  // Filter calls
  const filteredCalls = SAMPLE_CALLS.filter((call) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !call.customerName.toLowerCase().includes(query) &&
        !call.phoneNumber.includes(query)
      ) {
        return false;
      }
    }
    if (directionFilter !== "all" && call.direction !== directionFilter) {
      return false;
    }
    if (statusFilter !== "all" && call.status !== statusFilter) {
      return false;
    }
    if (agentFilter !== "all" && call.agentId !== agentFilter) {
      return false;
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
          onClick={() => setShowLiveCall(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Phone className="h-4 w-4" />
          New Call
        </button>
      </div>

      {/* Stats */}
      <StatsBar />

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
            {AGENTS.map((agent) => (
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
      {showLiveCall && (
        <CallPopup
          sessionId={`call-${Date.now()}`}
          phoneNumber="(205) 555-1234"
          direction="outbound"
          isVisible={showLiveCall}
          onClose={() => setShowLiveCall(false)}
          onMinimize={() => {}}
        />
      )}
    </div>
  );
}
