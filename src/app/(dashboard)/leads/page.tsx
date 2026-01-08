'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  phoneAlt: string | null;
  leadSource: string | null;
  leadStatus: string | null;
  pipelineStage: string | null;
  agencyzoomId: string | null;
  createdAt: string;
  updatedAt: string;
  producer: { id: string; firstName: string; lastName: string } | null;
  csr: { id: string; firstName: string; lastName: string } | null;
}

interface Counts {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
  quoted: number;
  won: number;
  lost: number;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (filter && filter !== 'all') params.set('status', filter);
      params.set('limit', '100');

      const res = await fetch(`/api/leads/synced?${params}`);
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads);
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
      case 'new':
      case null:
        return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">New</span>;
      case 'contacted':
        return <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">Contacted</span>;
      case 'qualified':
        return <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full">Qualified</span>;
      case 'quoted':
        return <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">Quoted</span>;
      case 'won':
        return <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">Won</span>;
      case 'lost':
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Lost</span>;
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

  const openInAgencyZoom = (agencyzoomId: string) => {
    window.open(`https://app.agencyzoom.com/leads/${agencyzoomId}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Queue</h1>
          <p className="text-gray-600 mt-1">AgencyZoom leads • {counts?.total || 0} total</p>
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
        <div className="grid grid-cols-6 gap-4">
          <div 
            onClick={() => setFilter('all')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'all' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-gray-600">{counts.total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div 
            onClick={() => setFilter('new')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'new' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-blue-600">{counts.new}</div>
            <div className="text-sm text-gray-500">New</div>
          </div>
          <div 
            onClick={() => setFilter('contacted')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'contacted' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-yellow-600">{counts.contacted}</div>
            <div className="text-sm text-gray-500">Contacted</div>
          </div>
          <div 
            onClick={() => setFilter('qualified')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'qualified' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-purple-600">{counts.qualified}</div>
            <div className="text-sm text-gray-500">Qualified</div>
          </div>
          <div 
            onClick={() => setFilter('quoted')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'quoted' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-orange-600">{counts.quoted}</div>
            <div className="text-sm text-gray-500">Quoted</div>
          </div>
          <div 
            onClick={() => setFilter('won')}
            className={`bg-white rounded-lg shadow-sm p-4 cursor-pointer hover:ring-2 hover:ring-blue-300 ${filter === 'won' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-2xl font-bold text-green-600">{counts.won}</div>
            <div className="text-sm text-gray-500">Won</div>
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
                  {search ? `No results for "${search}"` : 'Try adjusting your filters or sync leads from AgencyZoom'}
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
                        {lead.displayName || lead.phone || 'Unknown'}
                      </div>
                      <div className="text-sm text-gray-500">{formatTime(lead.createdAt)}</div>
                      {lead.leadSource && (
                        <div className="text-xs text-gray-400 mt-1">Source: {lead.leadSource}</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(lead.leadStatus)}
                      {lead.pipelineStage && (
                        <span className="text-xs text-gray-400">{lead.pipelineStage}</span>
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
                    {selectedLead.displayName || 'Unknown Lead'}
                  </h2>
                  {getStatusBadge(selectedLead.leadStatus)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Created {formatTime(selectedLead.createdAt)}
                </div>
              </div>

              {/* Contact Info */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-3">Contact Information</h3>
                <div className="space-y-3">
                  {selectedLead.phone && (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">📞</span>
                      <a href={`tel:${selectedLead.phone}`} className="text-blue-600 hover:underline">
                        {selectedLead.phone}
                      </a>
                    </div>
                  )}
                  {selectedLead.phoneAlt && (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">📱</span>
                      <a href={`tel:${selectedLead.phoneAlt}`} className="text-blue-600 hover:underline">
                        {selectedLead.phoneAlt}
                      </a>
                    </div>
                  )}
                  {selectedLead.email && (
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">✉️</span>
                      <a href={`mailto:${selectedLead.email}`} className="text-blue-600 hover:underline">
                        {selectedLead.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Lead Details */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-3">Lead Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Source:</span>
                    <span className="ml-2 font-medium">{selectedLead.leadSource || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pipeline:</span>
                    <span className="ml-2 font-medium">{selectedLead.pipelineStage || '-'}</span>
                  </div>
                  {selectedLead.producer && (
                    <div>
                      <span className="text-gray-500">Producer:</span>
                      <span className="ml-2 font-medium">
                        {selectedLead.producer.firstName} {selectedLead.producer.lastName}
                      </span>
                    </div>
                  )}
                  {selectedLead.csr && (
                    <div>
                      <span className="text-gray-500">CSR:</span>
                      <span className="ml-2 font-medium">
                        {selectedLead.csr.firstName} {selectedLead.csr.lastName}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-8">
                {selectedLead.phone && (
                  <a
                    href={`tel:${selectedLead.phone}`}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    📞 Call
                  </a>
                )}
                {selectedLead.agencyzoomId && (
                  <button
                    onClick={() => openInAgencyZoom(selectedLead.agencyzoomId!)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    🔗 Open in AgencyZoom
                  </button>
                )}
                {selectedLead.email && (
                  <a
                    href={`mailto:${selectedLead.email}`}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    ✉️ Email
                  </a>
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
