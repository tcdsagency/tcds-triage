'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CanopyConnectSMS } from '@/components/CanopyConnectSMS';

interface Lead {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  contactAddress: string | null;
  source: string | null;
  sourceReference: string | null;
  insuranceType: string | null;
  leadNotes: string | null;
  priority: string | null;
  status: string | null; // queued, notified, escalated, claimed, converted, expired
  assignedUserId: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  convertedAt: string | null;
  convertedCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUser: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
  claimedByUser: { id: string; firstName: string | null; lastName: string | null; email: string | null } | null;
}

interface Counts {
  total: number;
  queued: number;
  notified: number;
  escalated: number;
  claimed: number;
  converted: number;
  expired: number;
}

const STATUS_OPTIONS = [
  { value: 'queued', label: 'Queued', color: 'bg-blue-100 text-blue-800' },
  { value: 'notified', label: 'Notified', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'escalated', label: 'Escalated', color: 'bg-red-100 text-red-800' },
  { value: 'claimed', label: 'Claimed', color: 'bg-purple-100 text-purple-800' },
  { value: 'converted', label: 'Converted', color: 'bg-green-100 text-green-800' },
  { value: 'expired', label: 'Expired', color: 'bg-gray-100 text-gray-600' },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter && filter !== 'all') params.set('status', filter);
      params.set('limit', '100');

      // Use /api/leads for web app/webhook leads only (not synced AgencyZoom leads)
      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      if (data.success) {
        // Filter by search locally since the API doesn't support search
        let filteredLeads = data.leads;
        if (search && search.length >= 2) {
          const searchLower = search.toLowerCase();
          filteredLeads = data.leads.filter((lead: Lead) =>
            (lead.contactName?.toLowerCase().includes(searchLower)) ||
            (lead.contactPhone?.includes(search)) ||
            (lead.contactEmail?.toLowerCase().includes(searchLower))
          );
        }
        setLeads(filteredLeads);
        setCounts(data.counts);
      }
    } catch (err) {
      console.error('Failed to load leads:', err);
      toast.error('Failed to load leads', {
        description: 'Please check your connection and try again',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();
  }, [filter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2 || search.length === 0) {
        loadLeads();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'queued':
      case null:
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">Queued</span>;
      case 'notified':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Notified</span>;
      case 'escalated':
        return <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">Escalated</span>;
      case 'claimed':
        return <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">Claimed</span>;
      case 'converted':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Converted</span>;
      case 'expired':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Expired</span>;
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">{status}</span>;
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state
        setLeads(leads.map(l =>
          l.id === leadId ? { ...l, status: newStatus } : l
        ));
        if (selectedLead?.id === leadId) {
          setSelectedLead({ ...selectedLead, status: newStatus });
        }
        toast.success('Status updated', {
          description: `Lead moved to ${newStatus}`,
        });
        // Refresh counts
        loadLeads();
      } else {
        toast.error('Failed to update status', {
          description: data.error || 'Please try again',
        });
      }
    } catch (err) {
      console.error('Status update failed:', err);
      toast.error('Failed to update status', {
        description: 'Please check your connection',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Queue</h1>
          <p className="text-gray-600 mt-1">Web app & webhook leads • {counts?.total || 0} total</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadLeads}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      {counts && (
        <div className="grid grid-cols-7 gap-4">
          <div
            onClick={() => setFilter('all')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-gray-600">{counts.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div
            onClick={() => setFilter('queued')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'queued' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-blue-600">{counts.queued}</div>
            <div className="text-sm text-gray-500">Queued</div>
          </div>
          <div
            onClick={() => setFilter('notified')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'notified' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-yellow-600">{counts.notified}</div>
            <div className="text-sm text-gray-500">Notified</div>
          </div>
          <div
            onClick={() => setFilter('escalated')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'escalated' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-red-600">{counts.escalated}</div>
            <div className="text-sm text-gray-500">Escalated</div>
          </div>
          <div
            onClick={() => setFilter('claimed')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'claimed' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-purple-600">{counts.claimed}</div>
            <div className="text-sm text-gray-500">Claimed</div>
          </div>
          <div
            onClick={() => setFilter('converted')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'converted' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-green-600">{counts.converted}</div>
            <div className="text-sm text-gray-500">Converted</div>
          </div>
          <div
            onClick={() => setFilter('expired')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'expired' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-gray-500">{counts.expired}</div>
            <div className="text-sm text-gray-500">Expired</div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads by name or email..."
          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Split View */}
      <div className="flex h-[calc(100vh-400px)] min-h-[400px]">
        {/* List */}
        <div className="w-1/2 border-r border-gray-200 overflow-hidden flex flex-col bg-white rounded-l-lg shadow-sm">
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-2 space-y-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="p-4 border-b border-gray-100 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200" />
                      <div className="flex-1">
                        <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                        <div className="h-3 w-24 bg-gray-200 rounded" />
                      </div>
                      <div className="h-5 w-16 bg-gray-200 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-1">No leads found</p>
                <p className="text-sm text-gray-500 max-w-xs">
                  {search ? `No results for "${search}"` : 'Try adjusting your filters or add a new lead'}
                </p>
              </div>
            ) : (
              leads.map((lead) => (
                <div
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    selectedLead?.id === lead.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-gray-900">
                        {lead.contactName || lead.contactPhone || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">{formatTime(lead.createdAt)}</div>
                      {lead.source && (
                        <div className="text-xs text-gray-400 mt-1">Source: {lead.source}</div>
                      )}
                      {lead.insuranceType && (
                        <div className="text-xs text-blue-500 mt-1">{lead.insuranceType}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(lead.status)}
                      {lead.priority && lead.priority !== 'normal' && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          lead.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          lead.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{lead.priority}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="w-1/2 overflow-y-auto bg-white rounded-r-lg shadow-sm">
          {selectedLead ? (
            <div className="p-6">
              <div className="mb-6">
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-bold text-gray-900">
                    {selectedLead.contactName || 'Unknown Lead'}
                  </h2>
                  {getStatusBadge(selectedLead.status)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Created {formatTime(selectedLead.createdAt)}
                </div>
              </div>

              {/* Contact Info */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-3">Contact Information</h3>
                <div className="space-y-3">
                  {selectedLead.contactPhone && (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">📞</span>
                      <a href={`tel:${selectedLead.contactPhone}`} className="text-blue-600 hover:underline">
                        {selectedLead.contactPhone}
                      </a>
                    </div>
                  )}
                  {selectedLead.contactEmail && (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">✉️</span>
                      <a href={`mailto:${selectedLead.contactEmail}`} className="text-blue-600 hover:underline">
                        {selectedLead.contactEmail}
                      </a>
                    </div>
                  )}
                  {selectedLead.contactAddress && (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">📍</span>
                      <span className="text-gray-700">{selectedLead.contactAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Update */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="font-semibold text-gray-700 mb-3">Update Status</h3>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => updateLeadStatus(selectedLead.id, opt.value)}
                      disabled={updatingStatus || selectedLead.status === opt.value || (!selectedLead.status && opt.value === 'queued')}
                      className={`px-3 py-1.5 text-sm rounded-full transition-all ${
                        (selectedLead.status === opt.value || (!selectedLead.status && opt.value === 'queued'))
                          ? `${opt.color} ring-2 ring-offset-1 ring-blue-500 cursor-default`
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                      } ${updatingStatus ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lead Details */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-3">Lead Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Source:</span>
                    <span className="ml-2 font-medium">{selectedLead.source || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Insurance Type:</span>
                    <span className="ml-2 font-medium">{selectedLead.insuranceType || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Priority:</span>
                    <span className="ml-2 font-medium capitalize">{selectedLead.priority || 'normal'}</span>
                  </div>
                  {selectedLead.assignedUser && (
                    <div>
                      <span className="text-gray-500">Assigned To:</span>
                      <span className="ml-2 font-medium">
                        {selectedLead.assignedUser.firstName} {selectedLead.assignedUser.lastName}
                      </span>
                    </div>
                  )}
                  {selectedLead.claimedByUser && (
                    <div>
                      <span className="text-gray-500">Claimed By:</span>
                      <span className="ml-2 font-medium">
                        {selectedLead.claimedByUser.firstName} {selectedLead.claimedByUser.lastName}
                      </span>
                    </div>
                  )}
                </div>
                {selectedLead.leadNotes && (
                  <div className="mt-4">
                    <span className="text-gray-500 block mb-1">Notes:</span>
                    <p className="text-gray-700 bg-white p-2 rounded border text-sm">{selectedLead.leadNotes}</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 mt-8">
                {selectedLead.contactPhone && (
                  <a
                    href={`tel:${selectedLead.contactPhone}`}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    📞 Call
                  </a>
                )}
                {selectedLead.contactEmail && (
                  <a
                    href={`mailto:${selectedLead.contactEmail}`}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    ✉️ Email
                  </a>
                )}
                {selectedLead.contactPhone && (
                  <CanopyConnectSMS
                    customerPhone={selectedLead.contactPhone}
                    customerName={selectedLead.contactName?.split(' ')[0] || ''}
                    variant="outline"
                    size="default"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a lead to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
