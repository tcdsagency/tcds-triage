"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  RefreshCw,
  ChevronRight,
  X,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Activity,
  Loader2,
  Copy,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Eye,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// =============================================================================
// TYPES
// =============================================================================

interface WebhookLogEntry {
  id: string;
  tenantId: string;
  callSid: string;
  callStatus: string;
  direction: string | null;
  fromNumber: string | null;
  toNumber: string | null;
  callDuration: number | null;
  callerName: string | null;
  matchedCallId: string | null;
  processingResult: string;
  errorMessage: string | null;
  rawPayload: Record<string, unknown>;
  receivedAt: string;
}

interface LogStats {
  total: number;
  byResult: Record<string, number>;
  byStatus: Record<string, number>;
}

type DateFilter = "today" | "yesterday" | "7d" | "30d";

// =============================================================================
// HELPERS
// =============================================================================

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatPhoneNumber(phone: string | undefined | null): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/^\+1/, "").replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function truncateCallSid(sid: string): string {
  if (sid.length <= 16) return sid;
  return `${sid.slice(0, 8)}...${sid.slice(-6)}`;
}

// =============================================================================
// BADGE COMPONENTS
// =============================================================================

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    initiated: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-700 dark:text-gray-300" },
    ringing: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
    "in-progress": { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
    answered: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
    completed: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300" },
    busy: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-300" },
    "no-answer": { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
    canceled: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
    failed: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  };
  const c = config[status] || config.initiated;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {status}
    </span>
  );
}

function ResultBadge({ result }: { result: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
    anchor_created: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300", icon: CheckCircle2 },
    anchor_updated: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", icon: RefreshCw },
    completed: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", icon: CheckCircle2 },
    ignored: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-400", icon: Eye },
    error: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300", icon: AlertCircle },
  };
  const c = config[result] || config.ignored;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <Icon className="h-3 w-3" />
      {result.replace(/_/g, " ")}
    </span>
  );
}

// =============================================================================
// DETAIL SIDEBAR
// =============================================================================

function DetailSidebar({
  entry,
  onClose,
}: {
  entry: WebhookLogEntry;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(entry.rawPayload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Webhook Event</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{entry.callSid}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</label>
            <div className="mt-1"><StatusBadge status={entry.callStatus} /></div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Result</label>
            <div className="mt-1"><ResultBadge result={entry.processingResult} /></div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Direction</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{entry.direction || "-"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duration</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{entry.callDuration != null ? `${entry.callDuration}s` : "-"}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">From</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatPhoneNumber(entry.fromNumber)}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">To</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatPhoneNumber(entry.toNumber)}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Received</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{new Date(entry.receivedAt).toLocaleString()}</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Caller Name</label>
            <p className="mt-1 text-sm text-gray-900 dark:text-white">{entry.callerName || "-"}</p>
          </div>
        </div>

        {/* Matched Call */}
        {entry.matchedCallId && (
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Matched Call</label>
            <p className="mt-1 text-sm font-mono text-indigo-600 dark:text-indigo-400">{entry.matchedCallId}</p>
          </div>
        )}

        {/* Error Message */}
        {entry.errorMessage && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <label className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Error / Note</label>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{entry.errorMessage}</p>
          </div>
        )}

        {/* Raw Payload */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Raw Payload</label>
            <button
              onClick={copyPayload}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto max-h-80">
            {JSON.stringify(entry.rawPayload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function TwilioLogsPage() {
  const [entries, setEntries] = useState<WebhookLogEntry[]>([]);
  const [stats, setStats] = useState<LogStats>({ total: 0, byResult: {}, byStatus: {} });
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<WebhookLogEntry | null>(null);

  // Filters
  const [dateRange, setDateRange] = useState<DateFilter>("today");
  const [statusFilter, setStatusFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dateRange,
        limit: "200",
        offset: "0",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (resultFilter !== "all") params.set("result", resultFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/twilio-logs?${params}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.entries);
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch twilio logs:", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, statusFilter, resultFilter, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const dateOptions: { value: DateFilter; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
  ];

  const statusOptions = ["all", "initiated", "ringing", "in-progress", "answered", "completed", "busy", "no-answer", "canceled", "failed"];
  const resultOptions = ["all", "anchor_created", "anchor_updated", "completed", "ignored", "error"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Twilio Webhook Log</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Every voice-status webhook event received from Twilio
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Events</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        {[
          { key: "anchor_created", label: "Anchors Created", color: "text-green-600 dark:text-green-400" },
          { key: "anchor_updated", label: "Anchors Updated", color: "text-blue-600 dark:text-blue-400" },
          { key: "completed", label: "Completed", color: "text-emerald-600 dark:text-emerald-400" },
          { key: "ignored", label: "Ignored", color: "text-gray-500 dark:text-gray-400" },
          { key: "error", label: "Errors", color: "text-red-600 dark:text-red-400" },
        ].map((item) => (
          <div key={item.key} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>{stats.byResult[item.key] || 0}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
        {/* Date Range */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
          {dateOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDateRange(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                dateRange === opt.value
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s === "all" ? "All Statuses" : s}</option>
          ))}
        </select>

        {/* Result Filter */}
        <select
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          {resultOptions.map((r) => (
            <option key={r} value={r}>{r === "all" ? "All Results" : r.replace(/_/g, " ")}</option>
          ))}
        </select>

        {/* Search */}
        <div className="flex-1 min-w-[200px] flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search CallSid, phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          {search && (
            <button
              onClick={() => { setSearch(""); setSearchInput(""); }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
            <span className="ml-2 text-sm text-gray-500">Loading...</span>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-12 w-12 text-gray-400" />}
            title="No webhook events"
            description="No Twilio webhook events found for the selected filters."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">CallSid</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">From</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">To</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dir</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Result</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => setSelectedEntry(entry)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-gray-900 dark:text-white">{formatTime(entry.receivedAt)}</div>
                      {dateRange !== "today" && dateRange !== "yesterday" && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{formatDate(entry.receivedAt)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-600 dark:text-gray-300">
                      {truncateCallSid(entry.callSid)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {formatPhoneNumber(entry.fromNumber)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {formatPhoneNumber(entry.toNumber)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {entry.direction === "inbound" ? (
                        <PhoneIncoming className="h-4 w-4 text-blue-500" />
                      ) : entry.direction ? (
                        <PhoneOutgoing className="h-4 w-4 text-green-500" />
                      ) : (
                        <Phone className="h-4 w-4 text-gray-400" />
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={entry.callStatus} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ResultBadge result={entry.processingResult} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {entry.callDuration != null ? `${entry.callDuration}s` : "-"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Sidebar */}
      {selectedEntry && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setSelectedEntry(null)}
          />
          <DetailSidebar entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
        </>
      )}
    </div>
  );
}
