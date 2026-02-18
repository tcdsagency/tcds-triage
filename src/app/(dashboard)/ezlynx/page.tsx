"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  Zap,
  RefreshCw,
  Loader2,
  ExternalLink,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Link2,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface BotStatus {
  success: boolean;
  state: string;
  error?: string;
}

interface SearchResult {
  applicantFirstName: string;
  applicantLastName: string;
  accountId: string;
  created: string;
  dateOfBirth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface ActivityLog {
  id: number;
  action: string;
  target: string;
  status: string;
  details?: string;
  createdAt: string;
}

interface ApplicantDetail {
  success: boolean;
  applicant?: any;
  error?: string;
}

// =============================================================================
// STATUS CARD
// =============================================================================

function StatusCard({ status, onRefresh, refreshing }: {
  status: BotStatus | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const stateConfig: Record<string, { color: string; icon: any; label: string }> = {
    authenticated: { color: "text-green-600 bg-green-50 border-green-200", icon: CheckCircle2, label: "Connected" },
    idle: { color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: AlertTriangle, label: "Idle" },
    launching: { color: "text-blue-600 bg-blue-50 border-blue-200", icon: Loader2, label: "Launching" },
    awaiting_2fa: { color: "text-orange-600 bg-orange-50 border-orange-200", icon: AlertTriangle, label: "Awaiting 2FA" },
    error: { color: "text-red-600 bg-red-50 border-red-200", icon: XCircle, label: "Error" },
    disconnected: { color: "text-gray-600 bg-gray-50 border-gray-200", icon: XCircle, label: "Disconnected" },
  };

  const state = status?.state || "disconnected";
  const config = stateConfig[state] || stateConfig.disconnected;
  const Icon = config.icon;

  return (
    <div className={cn("rounded-xl border p-4 flex items-center justify-between", config.color)}>
      <div className="flex items-center gap-3">
        <Icon className={cn("w-5 h-5", state === "launching" && "animate-spin")} />
        <div>
          <div className="font-semibold text-sm">EZLynx Bot: {config.label}</div>
          {status?.error && <div className="text-xs mt-0.5 opacity-75">{status.error}</div>}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
      </Button>
    </div>
  );
}

// =============================================================================
// SEARCH PANEL
// =============================================================================

function SearchPanel({ onSelectResult }: {
  onSelectResult: (result: SearchResult) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [state, setState] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!firstName && !lastName) {
      toast.error("Enter at least a first or last name");
      return;
    }
    setSearching(true);
    setSearched(true);
    setSearchError(null);
    try {
      const params = new URLSearchParams();
      if (firstName) params.set("firstName", firstName);
      if (lastName) params.set("lastName", lastName);
      if (dob) params.set("dateOfBirth", dob);
      if (state) params.set("state", state);

      const res = await fetch(`/api/ezlynx/search?${params}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        const isBotDown = res.status === 502 || res.status === 503 ||
          (data.error && /connect|ECONNREFUSED|timeout|socket|auth/i.test(data.error));
        setSearchError(isBotDown ? "Bot not connected — is the EZLynx bot running?" : (data.error || "Search failed"));
        setResults([]);
        return;
      }

      setResults(data.results || []);
    } catch (err: any) {
      setSearchError(err.message || "Search failed");
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <Search className="w-4 h-4" />
        Search EZLynx
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <Input
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Input
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Input
          type="date"
          placeholder="DOB"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            placeholder="State"
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="w-20"
            maxLength={2}
          />
          <Button onClick={handleSearch} disabled={searching} className="shrink-0">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
          {searchError ? (
            <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No results found</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.accountId}
                  onClick={() => onSelectResult(r)}
                  className="w-full text-left p-3 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                        {r.applicantFirstName} {r.applicantLastName}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span className="font-mono">ID: {r.accountId}</span>
                        {r.dateOfBirth && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {r.dateOfBirth}
                          </span>
                        )}
                        {(r.city || r.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {[r.city, r.state].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// APPLICANT DETAIL SHEET
// =============================================================================

function ApplicantDetailSheet({ accountId, onClose }: {
  accountId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linkCustomerId, setLinkCustomerId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ezlynx/applicant/${accountId}`);
        const data = await res.json();
        if (data.success) {
          setDetail(data.applicant || data);
        } else {
          setError(data.error || "Failed to load details");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [accountId]);

  const handleLink = async () => {
    if (!linkCustomerId.trim()) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/customers/${linkCustomerId.trim()}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ezlynxAccountId: accountId }),
      });
      if (res.ok) {
        toast.success("Linked to customer successfully");
        setLinkCustomerId("");
      } else {
        toast.error("Failed to link customer");
      }
    } catch {
      toast.error("Failed to link customer");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-gray-800 h-full overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">EZLynx Applicant</h3>
          <div className="flex items-center gap-2">
            <a
              href={`https://app.ezlynx.com/web/account/${accountId}/details`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Open in EZLynx <ExternalLink className="w-3 h-3" />
            </a>
            <Button variant="ghost" size="sm" onClick={onClose}>
              &times;
            </Button>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500 text-sm">{error}</div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-2">
                  <User className="w-6 h-6" />
                </div>
                <div className="font-semibold text-lg text-gray-900 dark:text-white">
                  {detail?.firstName} {detail?.lastName}
                </div>
                <Badge variant="secondary" className="font-mono text-xs mt-1">
                  {accountId}
                </Badge>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-sm">
                {detail?.emailAddresses?.[0]?.emailAddress && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Mail className="w-4 h-4" />
                    {detail.emailAddresses[0].emailAddress}
                  </div>
                )}
                {detail?.phoneNumbers?.[0]?.number && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Phone className="w-4 h-4" />
                    {detail.phoneNumbers[0].number}
                  </div>
                )}
                {detail?.primaryAddress && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <MapPin className="w-4 h-4" />
                    {[
                      detail.primaryAddress.streetAddress,
                      detail.primaryAddress.city,
                      detail.primaryAddress.state,
                      detail.primaryAddress.zipCode,
                    ].filter(Boolean).join(", ")}
                  </div>
                )}
                {detail?.dateOfBirth && (
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Calendar className="w-4 h-4" />
                    DOB: {detail.dateOfBirth}
                  </div>
                )}
              </div>

              {/* Contacts/Co-Applicants */}
              {detail?.contacts && detail.contacts.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Co-Applicants</h4>
                  {detail.contacts.map((c: any, i: number) => (
                    <div key={i} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-sm mb-1">
                      {c.firstName} {c.lastName}
                      {c.relationship?.description && (
                        <span className="text-gray-400 ml-1">({c.relationship.description})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Link to Customer */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  Link to TCDS Customer
                </h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Customer ID"
                    value={linkCustomerId}
                    onChange={(e) => setLinkCustomerId(e.target.value)}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={handleLink} disabled={linking || !linkCustomerId.trim()}>
                    {linking ? <Loader2 className="w-3 h-3 animate-spin" /> : "Link"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// RECENT ACTIVITY
// =============================================================================

function RecentActivity({ logs, loading }: { logs: ActivityLog[]; loading: boolean }) {
  const statusColor: Record<string, string> = {
    success: "text-green-600",
    error: "text-red-600",
    processing: "text-blue-600",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Recent Bot Activity
      </h3>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No recent activity</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-3 text-sm p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <div className={cn("mt-0.5", statusColor[log.status] || "text-gray-400")}>
                {log.status === "success" ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : log.status === "error" ? (
                  <XCircle className="w-4 h-4" />
                ) : (
                  <Loader2 className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white">{log.action}</div>
                <div className="text-gray-500 truncate">{log.target}</div>
                {log.details && <div className="text-xs text-gray-400 mt-0.5">{log.details}</div>}
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(log.createdAt).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function EzlynxPage() {
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/ezlynx/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ success: false, state: "disconnected", error: "Could not reach bot" });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/ezlynx/status"); // We'll get logs from the bot directly
      // Actually fetch logs from a dedicated endpoint
      const botUrl = "/api/ezlynx/logs";
      // Since we don't have a logs proxy yet, we'll skip for now
      // and show placeholder. The bot logs would need a proxy route.
    } catch {
      // ignore
    } finally {
      setLogsLoading(false);
      setLogs([]); // placeholder
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchLogs();
  }, [fetchStatus, fetchLogs]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-500" />
            EZLynx Bot
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Search, create, and manage EZLynx applicants
          </p>
        </div>
        <a
          href="https://app.ezlynx.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          Open EZLynx Portal <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Bot Status */}
      <StatusCard
        status={status}
        onRefresh={fetchStatus}
        refreshing={statusLoading}
      />

      {/* Search */}
      <SearchPanel
        onSelectResult={(r) => setSelectedAccountId(r.accountId)}
      />

      {/* Recent Activity */}
      <RecentActivity logs={logs} loading={logsLoading} />

      {/* Detail Sheet */}
      {selectedAccountId && (
        <ApplicantDetailSheet
          accountId={selectedAccountId}
          onClose={() => setSelectedAccountId(null)}
        />
      )}
    </div>
  );
}
