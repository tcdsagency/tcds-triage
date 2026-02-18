'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Zap, ExternalLink, Search, Loader2, Link2, RefreshCw, AlertTriangle } from 'lucide-react';

interface EzlynxCardProps {
  /** EZLynx account ID if already linked */
  ezlynxAccountId?: string | null;
  /** Customer name for search */
  insuredName?: string;
  /** Customer ID in TCDS for linking */
  customerId?: string;
  /** Last sync timestamp */
  ezlynxSyncedAt?: string | null;
  /** Renewal snapshot data for reshop push */
  renewalSnapshot?: any;
  /** Line of business */
  lineOfBusiness?: string;
  /** Customer profile data for creating/updating applicant */
  customerProfile?: any;
  /** Comparison ID for application API reshop */
  comparisonId?: string;
}

export default function EzlynxCard({
  ezlynxAccountId,
  insuredName,
  customerId,
  ezlynxSyncedAt,
  renewalSnapshot,
  lineOfBusiness,
  customerProfile,
  comparisonId,
}: EzlynxCardProps) {
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [linkedId, setLinkedId] = useState(ezlynxAccountId);
  const autoSearchedRef = useRef(false);

  const ezlynxUrl = (id: string) => `https://app.ezlynx.com/web/account/${id}/details`;

  const handleSearch = useCallback(async () => {
    if (!insuredName) return;
    setSearching(true);
    setSearched(true);
    setSearchError(null);
    try {
      const parts = insuredName.trim().split(/\s+/);
      const firstName = parts[0] || '';
      const lastName = parts.slice(1).join(' ') || '';
      const params = new URLSearchParams();
      if (firstName) params.set('firstName', firstName);
      if (lastName) params.set('lastName', lastName);
      // Pass address for fallback search (spouse under different name, etc.)
      const snap = renewalSnapshot as any;
      if (snap?.insuredAddress) params.set('address', snap.insuredAddress);
      if (snap?.insuredCity) params.set('city', snap.insuredCity);
      if (snap?.insuredState) params.set('state', snap.insuredState);
      if (snap?.insuredZip) params.set('zip', snap.insuredZip);

      const res = await fetch(`/api/ezlynx/search?${params}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        const errMsg = data.error || `Search failed (${res.status})`;
        // Detect bot connection / auth errors
        if (
          errMsg.toLowerCase().includes('auth') ||
          errMsg.toLowerCase().includes('connect') ||
          errMsg.toLowerCase().includes('econnrefused') ||
          errMsg.toLowerCase().includes('timeout') ||
          errMsg.toLowerCase().includes('bot') ||
          res.status === 502 ||
          res.status === 503
        ) {
          setSearchError('bot_disconnected');
        } else {
          setSearchError(errMsg);
        }
        setSearchResults([]);
        return;
      }

      setSearchResults(data.results || []);
    } catch (err: any) {
      setSearchError('bot_disconnected');
      setSearchResults([]);
      toast.error('EZLynx search failed', { description: err.message });
    } finally {
      setSearching(false);
    }
  }, [insuredName, renewalSnapshot]);

  // Auto-search on mount when insuredName is present and not already linked
  useEffect(() => {
    if (insuredName && !linkedId && !autoSearchedRef.current) {
      autoSearchedRef.current = true;
      handleSearch();
    }
  }, [insuredName, linkedId, handleSearch]);

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
        setSearchResults([]);
        setSearched(false);
        toast.success('Linked to EZLynx', { description: `Account: ${accountId}` });
      }
    } catch {
      toast.error('Failed to link');
    }
  }, [customerId]);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    const toastId = toast.loading('Creating applicant in EZLynx...', {
      description: insuredName,
    });
    try {
      // Build profile from customerProfile or fall back to renewalSnapshot fields
      const profile = customerProfile || (() => {
        if (!insuredName) return undefined;
        const parts = insuredName.trim().split(/\s+/);
        return {
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || '',
          address: {
            street: renewalSnapshot?.insuredAddress,
            city: renewalSnapshot?.insuredCity,
            state: renewalSnapshot?.insuredState,
            zip: renewalSnapshot?.insuredZip,
          },
          contact: {
            email: renewalSnapshot?.insuredEmail,
            phone: renewalSnapshot?.insuredPhone,
          },
        };
      })();

      const res = await fetch('/api/ezlynx/applicant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          customerId,
        }),
      });
      const data = await res.json();
      if (data.success && data.ezlynxId) {
        setLinkedId(data.ezlynxId);
        toast.success('Created in EZLynx', {
          id: toastId,
          description: `Account: ${data.ezlynxId}`,
          action: {
            label: 'Open',
            onClick: () => window.open(ezlynxUrl(data.ezlynxId), '_blank'),
          },
          duration: 10000,
        });
      } else {
        toast.error('Creation failed', { id: toastId, description: data.error });
      }
    } catch (err: any) {
      toast.error('EZLynx error', { id: toastId, description: err.message });
    } finally {
      setCreating(false);
    }
  }, [insuredName, customerProfile, customerId, renewalSnapshot]);

  const handleUpdateForReshop = useCallback(async () => {
    const accountId = linkedId;
    if (!accountId) return;
    setUpdating(true);
    const type = lineOfBusiness?.toLowerCase().includes('auto') ? 'auto' : 'home';
    const toastId = toast.loading(`Pushing ${type} data to EZLynx for reshop...`, {
      description: insuredName,
    });
    try {
      const res = await fetch('/api/ezlynx/reshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparisonId }),
      });
      const data = await res.json();
      if (data.success) {
        // Build sync summary from report
        const report = data.syncReport;
        const parts: string[] = [];
        if (report?.drivers?.matched?.length) parts.push(`${report.drivers.matched.length} drivers matched`);
        if (report?.drivers?.added?.length) parts.push(`${report.drivers.added.length} drivers added`);
        if (report?.vehicles?.matched?.length) parts.push(`${report.vehicles.matched.length} vehicles matched`);
        if (report?.vehicles?.added?.length) parts.push(`${report.vehicles.added.length} vehicles added`);
        if (report?.coverages?.updated?.length) parts.push(`${report.coverages.updated.length} coverages updated`);
        // Home-specific
        if (report?.dwelling?.updated?.length) parts.push(`${report.dwelling.updated.length} dwelling fields`);
        const summary = parts.length > 0 ? parts.join(', ') : `${type} application updated`;

        toast.success(`Reshop data pushed to EZLynx`, {
          id: toastId,
          description: summary,
          action: {
            label: 'Open in EZLynx',
            onClick: () => window.open(ezlynxUrl(accountId), '_blank'),
          },
          duration: 10000,
        });
      } else {
        toast.error('Push failed', { id: toastId, description: data.error });
      }
    } catch (err: any) {
      toast.error('EZLynx error', { id: toastId, description: err.message });
    } finally {
      setUpdating(false);
    }
  }, [linkedId, comparisonId, lineOfBusiness, insuredName]);

  // === LINKED STATE ===
  if (linkedId) {
    return (
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
        <p className="text-xs text-emerald-600 font-mono mb-1">{linkedId}</p>
        {ezlynxSyncedAt && (
          <p className="text-[10px] text-emerald-500 mb-2">
            Synced: {new Date(ezlynxSyncedAt).toLocaleString()}
          </p>
        )}
        <button
          onClick={handleUpdateForReshop}
          disabled={updating}
          className="w-full mt-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {updating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          {updating ? 'Pushing...' : 'Update for Reshop'}
        </button>
      </div>
    );
  }

  // === NOT LINKED STATE ===
  return (
    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <h4 className="text-xs font-medium text-gray-500 uppercase flex items-center gap-1 mb-2">
        <Zap className="w-3 h-3" />
        EZLynx
      </h4>

      {/* Bot disconnected warning */}
      {searchError === 'bot_disconnected' && (
        <div className="flex items-center gap-1.5 p-2 mb-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Bot not connected — start EZLynx bot and retry</span>
        </div>
      )}

      {/* Generic error */}
      {searchError && searchError !== 'bot_disconnected' && (
        <p className="text-xs text-red-500 mb-2">{searchError}</p>
      )}

      {/* Search results with richer details */}
      {searched && !searchError && searchResults.length > 0 && (
        <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
          {searchResults.map((r: any) => (
            <button
              key={r.accountId}
              onClick={() => handleLink(r.accountId)}
              className="w-full text-left p-2 text-xs bg-white rounded border hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.applicantFirstName} {r.applicantLastName}</span>
                <span className="text-gray-400 font-mono text-[10px]">#{r.accountId}</span>
              </div>
              {(r.address || r.dateOfBirth) && (
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {r.dateOfBirth && <span>DOB: {r.dateOfBirth}</span>}
                  {r.dateOfBirth && r.address && <span className="mx-1">|</span>}
                  {r.address && <span>{r.address}{r.city ? `, ${r.city}` : ''}{r.state ? ` ${r.state}` : ''}</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      {searched && !searchError && searchResults.length === 0 && !searching && (
        <p className="text-xs text-gray-400 mb-2">No matches found in EZLynx</p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleSearch}
          disabled={searching || !insuredName}
          className="flex-1 px-2 py-1.5 border border-gray-300 text-xs font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 flex items-center justify-center gap-1"
        >
          {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
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
  );
}
