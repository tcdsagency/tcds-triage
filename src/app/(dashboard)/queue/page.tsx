"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  RefreshCw,
  PhoneIncoming,
  PhoneOutgoing,
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
  Loader2,
  Volume2,
  AlertCircle,
  BarChart3,
  Copy,
  ChevronDown,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import CustomerSearchModal from "@/components/features/CustomerSearchModal";
import CreateTicketModal from "@/components/features/wrapup/CreateTicketModal";
import CreateLeadModal from "@/components/features/wrapup/CreateLeadModal";
import DeleteWrapupModal from "@/components/features/wrapup/DeleteWrapupModal";

// =============================================================================
// TYPES
// =============================================================================

interface QueueItem {
  id: string;
  callId: string;
  direction: string;
  status: string;
  source: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerId: string | null;
  agentName: string | null;
  agentExtension: string | null;
  durationSeconds: number | null;
  startedAt: string | null;
  summary: string | null;
  requestType: string | null;
  insuranceType: string | null;
  policyNumbers: string[] | null;
  sentiment: string | null;
  sentimentScore: number | null;
  completionAction: string | null;
  outcome: string | null;
  isAutoVoided: boolean;
  autoVoidReason: string | null;
  agencyzoomTicketId: string | null;
  agencyzoomNoteId: string | null;
  threecxRecordingId: number | null;
  recordingUrl: string | null;
  hasTranscript: boolean;
  matchStatus: string | null;
  createdAt: string;
  completedAt: string | null;
  linkedTicket: {
    azTicketId: number;
    subject: string;
    status: string;
    stageName: string | null;
  } | null;
}

interface QueueStats {
  pending: number;
  completed: number;
  autoVoided: number;
  ticketsCreated: number;
}

type ViewTab = "pending" | "completed" | "all";
type DirectionFilter = "all" | "inbound" | "outbound";

// =============================================================================
// HELPERS
// =============================================================================

function formatDuration(seconds: number | null): string {
  if (!seconds) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "-";
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
  });
}

function formatPhoneNumber(phone: string | null): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/^\+1/, "").replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

function getActionBadge(item: QueueItem) {
  if (item.isAutoVoided) {
    return { label: "Auto-Voided", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
  }
  if (item.agencyzoomTicketId) {
    return { label: "Ticket Created", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
  }
  if (item.agencyzoomNoteId) {
    return { label: "Note Posted", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
  }
  if (item.completionAction === 'deleted') {
    return { label: "Deleted", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
  }
  if (item.completionAction === 'skipped') {
    return { label: "Skipped", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  }
  if (item.status === 'pending_review' || item.status === 'pending_ai_processing') {
    return { label: "Needs Review", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" };
  }
  return { label: item.status, color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" };
}

const SENTIMENT_EMOJI: Record<string, Record<number, string>> = {
  positive: { 5: "🤩 Thrilled", 4: "😄 Happy" },
  neutral: { 3: "😐 Neutral" },
  negative: { 2: "😢 Upset", 1: "🤬 Angry" },
};
const SENTIMENT_DEFAULTS: Record<string, string> = {
  positive: "😄 Happy",
  neutral: "😐 Neutral",
  negative: "😢 Upset",
};

function getSentimentDisplay(sentiment: string | null, score: number | null): string | null {
  if (!sentiment) return null;
  const key = sentiment.toLowerCase();
  return (score != null && SENTIMENT_EMOJI[key]?.[score]) || SENTIMENT_DEFAULTS[key] || null;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({ pending: 0, completed: 0, autoVoided: 0, ticketsCreated: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewTab>("pending");
  const [direction, setDirection] = useState<DirectionFilter>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  // Modals
  const [showCustomerSearch, setShowCustomerSearch] = useState<string | null>(null);
  const [showTicketModal, setShowTicketModal] = useState<string | null>(null);
  const [showLeadModal, setShowLeadModal] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const LIMIT = 50;

  // ─── Data Fetching ──────────────────────────────────────────────

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view,
        page: String(page),
        limit: String(LIMIT),
        sort: "newest",
      });
      if (direction !== "all") params.set("direction", direction);
      if (search) params.set("search", search);

      const res = await fetch(`/api/queue?${params}`);
      const data = await res.json();

      setItems(data.items || []);
      setTotal(data.total || 0);
      setHasMore(data.hasMore || false);
      setStats(data.stats || { pending: 0, completed: 0, autoVoided: 0, ticketsCreated: 0 });
    } catch (error) {
      console.error("Failed to fetch queue:", error);
    } finally {
      setLoading(false);
    }
  }, [view, direction, search, page]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchQueue, 30_000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchInput]);

  // ─── Actions ────────────────────────────────────────────────────

  async function handleComplete(id: string, action: string, extra?: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/queue/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.ok) {
        fetchQueue();
        setSelectedId(null);
      }
    } catch (error) {
      console.error("Action failed:", error);
    }
  }

  async function handleBulkAction(action: string) {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/queue/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds], action }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchQueue();
      }
    } catch (error) {
      console.error("Bulk action failed:", error);
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleMatch(wrapupId: string, customerId: string) {
    try {
      await fetch(`/api/queue/${wrapupId}/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      setShowCustomerSearch(null);
      fetchQueue();
    } catch (error) {
      console.error("Match failed:", error);
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItem = items.find(i => i.id === selectedId);

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <StatBadge icon={<Clock className="w-4 h-4" />} label="Pending" value={stats.pending} color="text-orange-600" />
        <StatBadge icon={<CheckCircle2 className="w-4 h-4" />} label="Completed Today" value={stats.completed} color="text-green-600" />
        <StatBadge icon={<XCircle className="w-4 h-4" />} label="Auto-Voided" value={stats.autoVoided} color="text-gray-500" />
        <StatBadge icon={<ClipboardList className="w-4 h-4" />} label="Tickets" value={stats.ticketsCreated} color="text-blue-600" />
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => fetchQueue()}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        {/* Direction toggle */}
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-xs">
          {(["all", "inbound", "outbound"] as DirectionFilter[]).map(d => (
            <button
              key={d}
              onClick={() => { setDirection(d); setPage(1); }}
              className={`px-3 py-1.5 capitalize ${direction === d
                ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search name, phone, summary..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(""); setSearch(""); }}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
            <button
              onClick={() => handleBulkAction("skip")}
              disabled={bulkLoading}
              className="px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
            >
              Skip All
            </button>
            <button
              onClick={() => handleBulkAction("void")}
              disabled={bulkLoading}
              className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Void All
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-6">
        {([
          { key: "pending", label: "Needs Review", count: stats.pending },
          { key: "completed", label: "Completed", count: stats.completed },
          { key: "all", label: "All", count: total },
        ] as { key: ViewTab; label: string; count: number }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setView(tab.key); setPage(1); setSelectedId(null); }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 ${view === tab.key
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Item List */}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="w-12 h-12" />}
              title={view === "pending" ? "Queue is clear" : "No items found"}
              description={view === "pending" ? "All calls have been processed." : "Try adjusting your filters."}
            />
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map(item => (
                <QueueItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  isChecked={selectedIds.has(item.id)}
                  onSelect={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  onCheck={() => toggleSelect(item.id)}
                  isPending={view === "pending"}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs text-gray-500">
                Showing {(page - 1) * LIMIT + 1}-{Math.min(page * LIMIT, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!hasMore}
                  className="px-3 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Slide-out */}
        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            onClose={() => setSelectedId(null)}
            onAction={(action, extra) => handleComplete(selectedItem.id, action, extra)}
            onMatch={() => setShowCustomerSearch(selectedItem.id)}
            onCreateTicket={() => setShowTicketModal(selectedItem.id)}
            onCreateLead={() => setShowLeadModal(selectedItem.id)}
            onDelete={() => setShowDeleteModal(selectedItem.id)}
          />
        )}
      </div>

      {/* Modals */}
      {showCustomerSearch && (
        <CustomerSearchModal
          isOpen={true}
          onClose={() => setShowCustomerSearch(null)}
          onSelect={(customer: { id: string }) => handleMatch(showCustomerSearch, customer.id)}
        />
      )}
      {showTicketModal && (
        <CreateTicketModal
          isOpen={true}
          onClose={() => { setShowTicketModal(null); fetchQueue(); }}
          onConfirm={async (ticketType, assignedToId, summary) => {
            await fetch(`/api/queue/${showTicketModal}/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "ticket", ticketType, assignedToId, summary }),
            });
            setShowTicketModal(null);
            fetchQueue();
          }}
        />
      )}
      {showLeadModal && (
        <CreateLeadModal
          isOpen={true}
          onClose={() => { setShowLeadModal(null); fetchQueue(); }}
          onConfirm={async (leadType, assignedToId, summary) => {
            await fetch(`/api/queue/${showLeadModal}/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "lead", leadType, assignedToId, summary }),
            });
            setShowLeadModal(null);
            fetchQueue();
          }}
        />
      )}
      {showDeleteModal && (
        <DeleteWrapupModal
          isOpen={true}
          onClose={() => { setShowDeleteModal(null); fetchQueue(); }}
          onConfirm={async (reason, notes) => {
            await fetch(`/api/queue/${showDeleteModal}/complete`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete", deleteReason: reason, deleteNotes: notes }),
            });
            setShowDeleteModal(null);
            fetchQueue();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function StatBadge({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={color}>{icon}</span>
      <span className="text-xs text-gray-500">{label}:</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function QueueItemRow({ item, isSelected, isChecked, onSelect, onCheck, isPending }: {
  item: QueueItem;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: () => void;
  isPending: boolean;
}) {
  const badge = getActionBadge(item);
  const sentimentDisplay = getSentimentDisplay(item.sentiment, item.sentimentScore);

  return (
    <div
      className={`flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
        isSelected ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-600" : ""
      }`}
      onClick={onSelect}
    >
      {/* Checkbox (pending view only) */}
      {isPending && (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={e => { e.stopPropagation(); onCheck(); }}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300"
        />
      )}

      {/* Direction icon */}
      <div className="flex-shrink-0">
        {item.direction === "Inbound" ? (
          <PhoneIncoming className="w-4 h-4 text-green-600" />
        ) : (
          <PhoneOutgoing className="w-4 h-4 text-blue-600" />
        )}
      </div>

      {/* Contact info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {item.customerName || formatPhoneNumber(item.customerPhone) || "Unknown Caller"}
          </span>
          {sentimentDisplay && (
            <span className="text-xs text-gray-500" title={`Sentiment: ${sentimentDisplay}`}>
              {sentimentDisplay}
            </span>
          )}
          {item.source === 'twilio_fallback' && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              Forwarded
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate max-w-md">
          {item.summary || "No summary available"}
        </p>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 flex-shrink-0 text-xs text-gray-500">
        {item.agentName && (
          <span className="hidden sm:inline">{item.agentName}</span>
        )}
        <span>{formatDuration(item.durationSeconds)}</span>
        <span>{formatTime(item.startedAt)}</span>
        <span className="text-[10px] text-gray-400">{formatDate(item.createdAt)}</span>
      </div>

      {/* Action badge */}
      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${badge.color}`}>
        {badge.label}
      </span>

      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
    </div>
  );
}

function DetailPanel({ item, onClose, onAction, onMatch, onCreateTicket, onCreateLead, onDelete }: {
  item: QueueItem;
  onClose: () => void;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
  onMatch: () => void;
  onCreateTicket: () => void;
  onCreateLead: () => void;
  onDelete: () => void;
}) {
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const loadTranscript = async () => {
    if (transcript) {
      setShowTranscript(!showTranscript);
      return;
    }
    setLoadingTranscript(true);
    try {
      const res = await fetch(`/api/wrapups/${item.callId}`);
      const data = await res.json();
      setTranscript(data?.call?.transcription || data?.call?.threecxTranscription || "No transcript available");
      setShowTranscript(true);
    } catch {
      setTranscript("Failed to load transcript");
      setShowTranscript(true);
    } finally {
      setLoadingTranscript(false);
    }
  };

  const isPending = item.status === "pending_review" || item.status === "pending_ai_processing";

  return (
    <div className="w-[420px] border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {item.direction === "Inbound" ? (
            <PhoneIncoming className="w-4 h-4 text-green-600" />
          ) : (
            <PhoneOutgoing className="w-4 h-4 text-blue-600" />
          )}
          <span className="text-sm font-semibold">
            {item.direction} Call
          </span>
          {item.source === 'twilio_fallback' && (
            <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-600">
              Forwarded
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Contact */}
      <div className="px-4 py-3 space-y-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium">
            {item.customerName || "Unknown Caller"}
          </span>
          {!item.customerId && isPending && (
            <button
              onClick={onMatch}
              className="text-xs text-blue-600 hover:underline"
            >
              Match
            </button>
          )}
        </div>
        {item.customerPhone && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{formatPhoneNumber(item.customerPhone)}</span>
            <button
              onClick={() => navigator.clipboard.writeText(item.customerPhone!)}
              className="p-0.5 rounded hover:bg-gray-100"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>
        )}
        {item.agentName && (
          <div className="text-xs text-gray-500">
            Agent: {item.agentName} {item.agentExtension ? `(ext ${item.agentExtension})` : ""}
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{formatDuration(item.durationSeconds)}</span>
          <span>{item.startedAt ? formatTime(item.startedAt) : "-"}</span>
          <span>{formatDate(item.createdAt)}</span>
        </div>
        {getSentimentDisplay(item.sentiment, item.sentimentScore) && (
          <div className="text-xs text-gray-500">
            Sentiment: {getSentimentDisplay(item.sentiment, item.sentimentScore)}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="px-4 py-3 space-y-2 border-b border-gray-100 dark:border-gray-800">
        <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</h4>
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {item.summary || "No summary available"}
        </p>
        {item.requestType && (
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {item.requestType.replace(/_/g, " ")}
            </span>
            {item.insuranceType && item.insuranceType !== "unknown" && (
              <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                {item.insuranceType}
              </span>
            )}
          </div>
        )}
        {item.policyNumbers && item.policyNumbers.length > 0 && (
          <div className="text-xs text-gray-500">
            Policies: {item.policyNumbers.join(", ")}
          </div>
        )}
      </div>

      {/* Recording & Transcript */}
      <div className="px-4 py-3 space-y-2 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {item.recordingUrl && (
            <a
              href={item.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              <Volume2 className="w-3 h-3" /> Play Recording
            </a>
          )}
          {item.hasTranscript && (
            <button
              onClick={loadTranscript}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              {loadingTranscript ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FileText className="w-3 h-3" />
              )}
              {showTranscript ? "Hide" : "Show"} Transcript
            </button>
          )}
        </div>
        {showTranscript && transcript && (
          <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
            {transcript}
          </div>
        )}
      </div>

      {/* Linked Ticket */}
      {item.linkedTicket && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 text-xs">
            <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
            <span className="font-medium text-blue-600">
              Ticket #{item.linkedTicket.azTicketId}
            </span>
            <span className="text-gray-500">
              {item.linkedTicket.stageName || item.linkedTicket.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 truncate">
            {item.linkedTicket.subject}
          </p>
        </div>
      )}

      {/* Actions (only for pending items) */}
      {isPending && (
        <div className="px-4 py-4 space-y-2">
          <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Actions</h4>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAction("note")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              <FileText className="w-3.5 h-3.5" /> Post Note
            </button>
            <button
              onClick={onCreateTicket}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Create Ticket
            </button>
            <button
              onClick={onCreateLead}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <User className="w-3.5 h-3.5" /> Create Lead
            </button>
            <button
              onClick={() => onAction("skip")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip
            </button>
          </div>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium rounded-lg text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
