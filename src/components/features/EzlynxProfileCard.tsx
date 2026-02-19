'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Zap, ExternalLink, Search, Loader2, RefreshCw,
  AlertTriangle, X, Hash, Check, ArrowRight, Eye, Unlink,
} from 'lucide-react';
import { useUser } from '@/hooks/useUser';

interface EzlynxProfileCardProps {
  ezlynxAccountId?: string | null;
  insuredName?: string;
  customerId?: string;
  hawksoftClientId?: string | number | null;
  /** Renewal comparison IDs for policies that can be synced */
  syncableRenewals?: { comparisonId: string; lob: string; label: string }[];
  /** Called after linking to refresh parent state */
  onLinked?: (accountId: string) => void;
  /** Called when user clicks "Sync Profile" to push customer data to EZLynx */
  onSyncProfile?: () => Promise<void>;
  /** Whether a profile sync is in progress */
  syncingProfile?: boolean;
}

function normalizeResult(r: any) {
  return {
    accountId: String(r.accountId || r.applicantId || ''),
    firstName: r.applicantFirstName || '',
    lastName: r.applicantLastName || '',
    address: r.address || r.addressLine1 || '',
    city: r.city || '',
    state: r.state || r.stateCode || '',
    zip: r.zip || r.zipCode || '',
    dateOfBirth: r.dateOfBirth || '',
  };
}

export default function EzlynxProfileCard({
  ezlynxAccountId,
  insuredName,
  customerId,
  hawksoftClientId,
  syncableRenewals,
  onLinked,
  onSyncProfile,
  syncingProfile,
}: EzlynxProfileCardProps) {
  const { user } = useUser();
  const userName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'System';

  const [linkedId, setLinkedId] = useState(ezlynxAccountId);
  const [creating, setCreating] = useState(false);

  // Search modal
  const [showSearch, setShowSearch] = useState(false);
  const [searchFirstName, setSearchFirstName] = useState('');
  const [searchLastName, setSearchLastName] = useState('');
  const [searchAccountId, setSearchAccountId] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Sync state
  const [syncing, setSyncing] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    comparisonId: string;
    lob: string;
    beforeAfter: { field: string; before: string; after: string }[];
    syncReport: any;
  } | null>(null);

  const ezlynxUrl = (id: string) => `https://app.ezlynx.com/web/account/${id}/details`;

  // Post a note to HawkSoft
  const postNote = useCallback(async (note: string) => {
    if (!hawksoftClientId) return;
    try {
      await fetch('/api/hawksoft/clients/note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: String(hawksoftClientId), note }),
      });
    } catch {
      // Non-critical — don't block the flow
    }
  }, [hawksoftClientId]);

  const openSearch = useCallback(() => {
    const parts = (insuredName || '').trim().split(/\s+/);
    setSearchFirstName(parts[0] || '');
    setSearchLastName(parts.slice(1).join(' ') || '');
    setSearchAccountId('');
    setSearchResults([]);
    setSearched(false);
    setSearchError(null);
    setShowSearch(true);
  }, [insuredName]);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setSearched(true);
    setSearchError(null);
    try {
      if (searchAccountId.trim()) {
        await handleLink(searchAccountId.trim());
        return;
      }
      const params = new URLSearchParams();
      if (searchFirstName.trim()) params.set('firstName', searchFirstName.trim());
      if (searchLastName.trim()) params.set('lastName', searchLastName.trim());
      if (!searchFirstName.trim() && !searchLastName.trim()) {
        setSearchError('Enter a name or account ID');
        return;
      }
      const res = await fetch(`/api/ezlynx/search?${params}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        const errMsg = data.error || `Search failed (${res.status})`;
        if (
          errMsg.toLowerCase().includes('auth') ||
          errMsg.toLowerCase().includes('connect') ||
          errMsg.toLowerCase().includes('econnrefused') ||
          errMsg.toLowerCase().includes('timeout') ||
          errMsg.toLowerCase().includes('bot') ||
          res.status === 502 || res.status === 503
        ) {
          setSearchError('Bot not connected — start EZLynx bot and retry');
        } else {
          setSearchError(errMsg);
        }
        setSearchResults([]);
        return;
      }
      setSearchResults((data.results || []).map(normalizeResult));
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchFirstName, searchLastName, searchAccountId]);

  const handleLink = useCallback(async (accountId: string) => {
    if (!customerId) return;
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ezlynxAccountId: accountId }),
      });
      if (res.ok) {
        setLinkedId(accountId);
        setShowSearch(false);
        toast.success('Linked to EZLynx', { description: `Account: ${accountId}` });
        onLinked?.(accountId);
        // Post a note
        await postNote(`[TCDS] EZLynx account linked: ${accountId} by ${userName}`);
      }
    } catch {
      toast.error('Failed to link');
    }
  }, [customerId, onLinked, postNote, userName]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    const toastId = toast.loading('Creating applicant in EZLynx...', { description: insuredName });
    try {
      const parts = (insuredName || '').trim().split(/\s+/);
      const profile = {
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
      };
      const res = await fetch('/api/ezlynx/applicant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, customerId }),
      });
      const data = await res.json();
      if (data.success && data.ezlynxId) {
        setLinkedId(data.ezlynxId);
        toast.success('Created in EZLynx', {
          id: toastId,
          description: `Account: ${data.ezlynxId}`,
          action: { label: 'Open', onClick: () => window.open(ezlynxUrl(data.ezlynxId), '_blank') },
          duration: 10000,
        });
        onLinked?.(data.ezlynxId);
        await postNote(`[TCDS] EZLynx account created: ${data.ezlynxId} by ${userName}`);
      } else {
        toast.error('Creation failed', { id: toastId, description: data.error });
      }
    } catch (err: any) {
      toast.error('EZLynx error', { id: toastId, description: err.message });
    } finally {
      setCreating(false);
    }
  }, [insuredName, customerId, onLinked, postNote, userName]);

  // Preview sync (dry run)
  const handlePreviewSync = useCallback(async (comparisonId: string, lob: string) => {
    setSyncing(comparisonId);
    try {
      const res = await fetch('/api/ezlynx/reshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparisonId, dryRun: true }),
      });
      const data = await res.json();
      if (data.success && data.beforeAfter) {
        setPreviewData({ comparisonId, lob, beforeAfter: data.beforeAfter, syncReport: data.syncReport });
      } else {
        toast.error('Preview failed', { description: data.error || 'Could not generate preview' });
      }
    } catch (err: any) {
      toast.error('Preview error', { description: err.message });
    } finally {
      setSyncing(null);
    }
  }, []);

  // Confirm sync (actually apply)
  const handleConfirmSync = useCallback(async () => {
    if (!previewData) return;
    const { comparisonId, lob } = previewData;
    setSyncing(comparisonId);
    const type = lob.toLowerCase().includes('auto') ? 'auto' : 'home';
    const toastId = toast.loading(`Syncing ${type} to EZLynx...`);
    try {
      const res = await fetch('/api/ezlynx/reshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparisonId }),
      });
      const data = await res.json();
      if (data.success) {
        const report = data.syncReport;
        const parts: string[] = [];
        if (report?.drivers?.matched?.length) parts.push(`${report.drivers.matched.length} drivers matched`);
        if (report?.drivers?.added?.length) parts.push(`${report.drivers.added.length} drivers added`);
        if (report?.vehicles?.matched?.length) parts.push(`${report.vehicles.matched.length} vehicles matched`);
        if (report?.vehicles?.added?.length) parts.push(`${report.vehicles.added.length} vehicles added`);
        if (report?.coverages?.updated?.length) parts.push(`${report.coverages.updated.length} coverages updated`);
        if (report?.dwelling?.updated?.length) parts.push(`${report.dwelling.updated.length} dwelling fields`);
        const summary = parts.length > 0 ? parts.join(', ') : `${type} application updated`;
        toast.success('Synced to EZLynx', {
          id: toastId,
          description: summary,
          action: linkedId ? { label: 'Open', onClick: () => window.open(ezlynxUrl(linkedId), '_blank') } : undefined,
          duration: 10000,
        });
        // Post note about sync
        await postNote(`[TCDS] EZLynx ${type} application synced from renewal data by ${userName}. Changes: ${summary}`);
        setPreviewData(null);
      } else {
        toast.error('Sync failed', { id: toastId, description: data.error });
      }
    } catch (err: any) {
      toast.error('Sync error', { id: toastId, description: err.message });
    } finally {
      setSyncing(null);
    }
  }, [previewData, linkedId, postNote, userName]);

  const handleUnlink = useCallback(async () => {
    if (!customerId) return;
    if (!confirm('Unlink this EZLynx account? This does not delete the EZLynx account.')) return;
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ezlynxAccountId: null, ezlynxSyncedAt: null }),
      });
      if (res.ok) {
        const oldId = linkedId;
        setLinkedId(null);
        toast.success('EZLynx account unlinked');
        await postNote(`[TCDS] EZLynx account unlinked: ${oldId} by ${userName}`);
        onLinked?.('');
      }
    } catch {
      toast.error('Failed to unlink');
    }
  }, [customerId, linkedId, postNote, userName, onLinked]);

  // === LINKED STATE ===
  if (linkedId) {
    return (
      <>
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-emerald-700 uppercase flex items-center gap-1">
              <Zap className="w-3 h-3" />
              EZLynx
            </h4>
            <a
              href={ezlynxUrl(linkedId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5"
            >
              Open <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-emerald-600 font-mono">{linkedId}</p>
            <button
              onClick={handleUnlink}
              className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5"
              title="Unlink EZLynx account"
            >
              <Unlink className="w-3 h-3" />
              Unlink
            </button>
          </div>

          {/* Sync Profile button */}
          {onSyncProfile && (
            <button
              onClick={onSyncProfile}
              disabled={syncingProfile}
              className="w-full px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {syncingProfile ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              {syncingProfile ? 'Syncing profile...' : 'Sync Profile to EZLynx'}
            </button>
          )}

          {/* Sync buttons per policy renewal */}
          {syncableRenewals && syncableRenewals.length > 0 && (
            <div className="space-y-1.5">
              {syncableRenewals.map(r => (
                <button
                  key={r.comparisonId}
                  onClick={() => handlePreviewSync(r.comparisonId, r.lob)}
                  disabled={syncing === r.comparisonId}
                  className="w-full px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {syncing === r.comparisonId ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                  {syncing === r.comparisonId ? 'Loading preview...' : `Preview ${r.label} Sync`}
                </button>
              ))}
            </div>
          )}
          {(!syncableRenewals || syncableRenewals.length === 0) && !onSyncProfile && (
            <p className="text-[10px] text-emerald-500">No renewal data available to sync</p>
          )}
        </div>

        {/* Sync Preview Modal */}
        {previewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-5 max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  Sync Preview — {previewData.lob}
                </h3>
                <button onClick={() => setPreviewData(null)} className="text-gray-400 hover:text-gray-600 p-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {previewData.beforeAfter.length === 0 ? (
                <div className="py-8 text-center">
                  <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">EZLynx is already up to date</p>
                  <p className="text-xs text-gray-400 mt-1">No changes needed</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto mb-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">Field</th>
                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">Current (EZLynx)</th>
                        <th className="text-center py-1.5 px-2 w-6"></th>
                        <th className="text-left py-1.5 px-2 text-gray-500 font-medium">New (Renewal)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.beforeAfter.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="py-1.5 px-2 font-medium text-gray-700">{row.field}</td>
                          <td className="py-1.5 px-2 text-red-600 line-through">{row.before}</td>
                          <td className="py-1.5 px-2 text-center"><ArrowRight className="w-3 h-3 text-gray-400 inline" /></td>
                          <td className="py-1.5 px-2 text-emerald-700 font-medium">{row.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setPreviewData(null)}
                  className="flex-1 px-3 py-2 border border-gray-300 text-sm font-medium rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                {previewData.beforeAfter.length > 0 && (
                  <button
                    onClick={handleConfirmSync}
                    disabled={!!syncing}
                    className="flex-1 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {syncing ? 'Syncing...' : 'Apply Changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // === NOT LINKED STATE ===
  return (
    <>
      <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1 mb-2">
          <Zap className="w-3 h-3" />
          EZLynx
        </h4>

        <div className="flex gap-2">
          <button
            onClick={openSearch}
            className="flex-1 px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-md hover:bg-gray-100 flex items-center justify-center gap-1"
          >
            <Search className="w-3 h-3" />
            Find
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex-1 px-2 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"
          >
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Create
          </button>
        </div>
      </div>

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <Search className="w-4 h-4 text-gray-500" />
                Search EZLynx
              </h3>
              <button onClick={() => setShowSearch(false)} className="text-gray-400 hover:text-gray-600 p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">First Name</label>
                <input
                  type="text"
                  placeholder="e.g. Daryl"
                  value={searchFirstName}
                  onChange={(e) => setSearchFirstName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Last Name</label>
                <input
                  type="text"
                  placeholder="e.g. Caddell"
                  value={searchLastName}
                  onChange={(e) => setSearchLastName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-3">
              <div className="flex-1 border-t border-gray-200" />
              <span>or link by ID</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            <div className="mb-4">
              <label className="block text-[10px] font-medium text-gray-500 uppercase mb-1">Account ID</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g. 153151412"
                  value={searchAccountId}
                  onChange={(e) => setSearchAccountId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                />
              </div>
            </div>

            <button
              onClick={handleSearch}
              disabled={searching}
              className="w-full px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searchAccountId.trim() ? 'Link Account' : 'Search'}
            </button>

            {searchError && (
              <div className="flex items-center gap-1.5 mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {searched && !searchError && searchResults.length > 0 && (
              <div className="mt-3 space-y-1.5 max-h-60 overflow-y-auto">
                <p className="text-[10px] text-gray-400 uppercase font-medium">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} — click to link
                </p>
                {searchResults.map((r) => (
                  <button
                    key={r.accountId}
                    onClick={() => handleLink(r.accountId)}
                    className="w-full text-left p-2.5 bg-gray-50 rounded-md border border-gray-200 hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800">{r.firstName} {r.lastName}</span>
                      <span className="text-gray-400 font-mono text-[11px]">#{r.accountId}</span>
                    </div>
                    {(r.address || r.dateOfBirth) && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {r.dateOfBirth && <span>DOB: {r.dateOfBirth}</span>}
                        {r.dateOfBirth && r.address && <span className="mx-1">|</span>}
                        {r.address && <span>{r.address}{r.city ? `, ${r.city}` : ''}{r.state ? ` ${r.state}` : ''} {r.zip}</span>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            {searched && !searchError && searchResults.length === 0 && !searching && !searchAccountId.trim() && (
              <p className="text-xs text-gray-400 mt-3 text-center">No results found</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
