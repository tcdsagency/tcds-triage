"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  User,
  ChevronRight,
  X,
  CheckCircle2,
  ClipboardList,
  XCircle,
  Clock,
  Trash2,
  SkipForward,
  FileText,
  Link2,
  ScrollText,
  Loader2,
  Minus,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// =============================================================================
// TYPES
// =============================================================================

type TriageAction =
  | "auto_posted"
  | "ticket_created"
  | "lead_created"
  | "auto_voided"
  | "pending"
  | "deleted"
  | "skipped"
  | "no_wrapup";

interface TriageEntry {
  id: string;
  direction: string;
  status: string;
  customerName: string;
  customerPhone: string | null;
  agentName: string;
  agentId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  summary: string | null;
  disposition: string | null;
  action: TriageAction;
  matchStatus: string | null;
  hasWrapup: boolean;
  isAutoVoided: boolean;
  autoVoidReason: string | null;
  noteAutoPosted: boolean;
  noteAutoPostedAt: string | null;
  completionAction: string | null;
  agencyzoomNoteId: string | null;
  agencyzoomTicketId: string | null;
  agencyzoomLeadId: string | null;
  deleteReason: string | null;
  deleteNotes: string | null;
  requestType: string | null;
  ticketType: string | null;
  leadType: string | null;
}

interface TriageStats {
  total: number;
  autoPosted: number;
  ticketCreated: number;
  leadCreated: number;
  autoVoided: number;
  pending: number;
  deleted: number;
  skipped: number;
  noWrapup: number;
}

interface Agent {
  id: string;
  name: string;
}

type DateFilter = "today" | "yesterday" | "7d" | "30d";

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

function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/^\+1/, "").replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone.replace(/^\+1/, "");
}

// =============================================================================
// ACTION BADGE
// =============================================================================

const ACTION_CONFIG: Record<
  TriageAction,
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  auto_posted: {
    label: "Auto-Posted",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    icon: CheckCircle2,
  },
  ticket_created: {
    label: "Ticket Created",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    icon: ClipboardList,
  },
  lead_created: {
    label: "Lead Created",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    icon: User,
  },
  auto_voided: {
    label: "Auto-Voided",
    bg: "bg-gray-100 dark:bg-gray-700",
    text: "text-gray-600 dark:text-gray-300",
    icon: XCircle,
  },
  pending: {
    label: "Pending",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  deleted: {
    label: "Deleted",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: Trash2,
  },
  skipped: {
    label: "Skipped",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    icon: SkipForward,
  },
  no_wrapup: {
    label: "No Wrapup",
    bg: "bg-gray-50 dark:bg-gray-800",
    text: "text-gray-400 dark:text-gray-500",
    icon: Minus,
  },
};

function ActionBadge({ action }: { action: TriageAction }) {
  const config = ACTION_CONFIG[action];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
}

// =============================================================================
// DIRECTION ICON
// =============================================================================

function DirectionIcon({ entry }: { entry: TriageEntry }) {
  if (entry.status === "missed") {
    return (
      <div className="w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <PhoneMissed className="h-4 w-4 text-red-600 dark:text-red-400" />
      </div>
    );
  }
  if (entry.direction === "inbound") {
    return (
      <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <PhoneIncoming className="h-4 w-4 text-green-600 dark:text-green-400" />
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
      <PhoneOutgoing className="h-4 w-4 text-blue-600 dark:text-blue-400" />
    </div>
  );
}

// =============================================================================
// MATCH STATUS BADGE
// =============================================================================

function MatchBadge({ status }: { status: string | null }) {
  if (!status || status === "unprocessed") {
    return <span className="text-xs text-gray-400 dark:text-gray-500">-</span>;
  }
  const isMatched = status === "matched" || status === "confirmed";
  return (
    <span
      className={`text-xs font-medium ${
        isMatched
          ? "text-green-600 dark:text-green-400"
          : "text-amber-600 dark:text-amber-400"
      }`}
    >
      {status === "matched" || status === "confirmed"
        ? "Matched"
        : status === "new_customer"
        ? "New"
        : status}
    </span>
  );
}

// =============================================================================
// STATS BAR
// =============================================================================

function StatsBar({ stats }: { stats: TriageStats }) {
  const items = [
    { label: "Total Calls", value: stats.total },
    { label: "Auto-Posted", value: stats.autoPosted, color: "text-green-600 dark:text-green-400" },
    { label: "Tickets", value: stats.ticketCreated, color: "text-blue-600 dark:text-blue-400" },
    { label: "Auto-Voided", value: stats.autoVoided, color: "text-gray-500" },
    { label: "Pending", value: stats.pending, color: "text-amber-600 dark:text-amber-400" },
    {
      label: "Deleted/Skipped",
      value: stats.deleted + stats.skipped,
      color: "text-red-600 dark:text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4"
        >
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {item.label}
          </p>
          <p className={`text-2xl font-bold mt-1 ${item.color || "text-gray-900 dark:text-white"}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// TABLE ROW
// =============================================================================

function EntryRow({
  entry,
  isSelected,
  onSelect,
}: {
  entry: TriageEntry;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer transition-colors ${
        isSelected
          ? "bg-indigo-50 dark:bg-indigo-900/20"
          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <DirectionIcon entry={entry} />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(entry.startedAt)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(entry.startedAt)}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {entry.customerName}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {formatPhoneNumber(entry.customerPhone)}
        </p>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-700 dark:text-gray-300">{entry.agentName}</span>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {formatDuration(entry.durationSeconds)}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
          {entry.summary || "-"}
        </p>
      </td>
      <td className="px-4 py-3">
        <ActionBadge action={entry.action} />
      </td>
      <td className="px-4 py-3">
        <MatchBadge status={entry.matchStatus} />
      </td>
      <td className="px-4 py-3">
        <ChevronRight className="h-4 w-4 text-gray-400" />
      </td>
    </tr>
  );
}

// =============================================================================
// DETAIL SIDEBAR
// =============================================================================

function DetailSidebar({
  entry,
  onClose,
}: {
  entry: TriageEntry;
  onClose: () => void;
}) {
  return (
    <div className="fixed right-0 top-0 bottom-0 w-[480px] bg-white dark:bg-gray-800 shadow-xl border-l border-gray-200 dark:border-gray-700 z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Call Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Customer Info */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
            <User className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {entry.customerName}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {formatPhoneNumber(entry.customerPhone)}
            </p>
          </div>
        </div>

        {/* Action Taken */}
        <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Action:
          </span>
          <ActionBadge action={entry.action} />
        </div>

        {/* Call Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Direction</p>
            <p className="font-medium text-gray-900 dark:text-white capitalize flex items-center gap-2">
              {entry.direction === "inbound" ? (
                <PhoneIncoming className="h-4 w-4 text-green-600" />
              ) : (
                <PhoneOutgoing className="h-4 w-4 text-blue-600" />
              )}
              {entry.direction}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Duration</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatDuration(entry.durationSeconds)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Date & Time</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatDate(entry.startedAt)} at {formatTime(entry.startedAt)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Agent</p>
            <p className="font-medium text-gray-900 dark:text-white">{entry.agentName}</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Match Status</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {entry.matchStatus || "N/A"}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Disposition</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {entry.disposition || "-"}
            </p>
          </div>
        </div>

        {/* Summary */}
        {entry.summary && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              AI Summary
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 whitespace-pre-wrap">
              {entry.summary}
            </p>
          </div>
        )}

        {/* Auto-Void Reason */}
        {entry.isAutoVoided && entry.autoVoidReason && (
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Auto-Void Reason</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {entry.autoVoidReason}
            </p>
          </div>
        )}

        {/* Delete Reason */}
        {entry.action === "deleted" && (entry.deleteReason || entry.deleteNotes) && (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            <p className="text-xs text-red-600 dark:text-red-400 mb-1">Delete Reason</p>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              {entry.deleteReason || "No reason specified"}
            </p>
            {entry.deleteNotes && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {entry.deleteNotes}
              </p>
            )}
          </div>
        )}

        {/* AgencyZoom Links */}
        {(entry.agencyzoomNoteId || entry.agencyzoomTicketId || entry.agencyzoomLeadId) && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              AgencyZoom References
            </h4>
            <div className="space-y-2">
              {entry.agencyzoomNoteId && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Note ID</p>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {entry.agencyzoomNoteId}
                  </p>
                </div>
              )}
              {entry.agencyzoomTicketId && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ticket ID</p>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {entry.agencyzoomTicketId}
                  </p>
                </div>
              )}
              {entry.agencyzoomLeadId && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Lead ID</p>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {entry.agencyzoomLeadId}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Auto-Posted timestamp */}
        {entry.noteAutoPosted && entry.noteAutoPostedAt && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <p className="text-xs text-green-600 dark:text-green-400 mb-1">Auto-Posted At</p>
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {formatDate(entry.noteAutoPostedAt)} at {formatTime(entry.noteAutoPostedAt)}
            </p>
          </div>
        )}

        {/* Request/Ticket/Lead Type */}
        {(entry.requestType || entry.ticketType || entry.leadType) && (
          <div className="grid grid-cols-2 gap-3">
            {entry.requestType && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Request Type</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {entry.requestType}
                </p>
              </div>
            )}
            {entry.ticketType && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Ticket Type</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {entry.ticketType}
                </p>
              </div>
            )}
            {entry.leadType && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lead Type</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {entry.leadType}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TriageLogPage() {
  const [entries, setEntries] = useState<TriageEntry[]>([]);
  const [stats, setStats] = useState<TriageStats>({
    total: 0,
    autoPosted: 0,
    ticketCreated: 0,
    leadCreated: 0,
    autoVoided: 0,
    pending: 0,
    deleted: 0,
    skipped: 0,
    noWrapup: 0,
  });
  const [agents, setAgents] = useState<Agent[]>([{ id: "all", name: "All Agents" }]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<TriageEntry | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("dateRange", dateFilter);
      if (directionFilter !== "all") params.set("direction", directionFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (agentFilter !== "all") params.set("agentId", agentFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/triage-log?${params}`);
      const data = await res.json();

      if (data.success) {
        setEntries(data.entries || []);
        setStats(data.stats || stats);
        if (data.agents) setAgents(data.agents);
      }
    } catch (error) {
      console.error("Failed to fetch triage log:", error);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, directionFilter, actionFilter, agentFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <ScrollText className="h-7 w-7 text-emerald-600" />
          Triage Log
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View every call and what the system did with it
        </p>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or phone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Date */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          {/* Direction */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>

          {/* Action */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Actions</option>
            <option value="auto_posted">Auto-Posted</option>
            <option value="ticket_created">Ticket Created</option>
            <option value="lead_created">Lead Created</option>
            <option value="auto_voided">Auto-Voided</option>
            <option value="pending">Pending</option>
            <option value="deleted">Deleted</option>
            <option value="skipped">Skipped</option>
            <option value="no_wrapup">No Wrapup</option>
          </select>

          {/* Agent */}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchData}
            className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-gray-400 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            <span className="ml-3 text-gray-500 dark:text-gray-400">Loading triage log...</span>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Date/Time
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Agent
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Summary
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Match
                </th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {entries.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  isSelected={selectedEntry?.id === entry.id}
                  onSelect={() => setSelectedEntry(entry)}
                />
              ))}
            </tbody>
          </table>
        )}

        {entries.length === 0 && !loading && (
          <EmptyState
            icon="calls"
            title={
              searchQuery || directionFilter !== "all" || actionFilter !== "all" || agentFilter !== "all"
                ? "No entries found"
                : "No calls yet"
            }
            description={
              searchQuery || directionFilter !== "all" || actionFilter !== "all" || agentFilter !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Call triage activity will appear here once calls come through."
            }
            size="md"
            className="py-12"
          />
        )}
      </div>

      {/* Detail Sidebar */}
      {selectedEntry && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-40"
            onClick={() => setSelectedEntry(null)}
          />
          <DetailSidebar
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
          />
        </>
      )}
    </div>
  );
}
