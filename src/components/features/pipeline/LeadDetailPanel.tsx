'use client';

import { useState, useEffect } from 'react';
import { cn, formatPhoneNumber } from '@/lib/utils';
import { PipelineLead } from './LeadCard';
import AgentBadge, { Agent } from './AgentBadge';
import { getAgencyZoomUrl } from '@/components/ui/agencyzoom-link';

interface LeadDetailPanelProps {
  lead: PipelineLead | null;
  agents: Agent[];
  stages: { id: number; name: string }[];
  onClose: () => void;
  onUpdate: (leadId: string, updates: Partial<PipelineLead>) => Promise<boolean>;
  onStageChange: (leadId: string, stageId: number, stageName: string) => Promise<boolean>;
}

export default function LeadDetailPanel({
  lead,
  agents,
  stages,
  onClose,
  onUpdate,
  onStageChange,
}: LeadDetailPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editData, setEditData] = useState<Partial<PipelineLead>>({});

  // Reset edit state when lead changes
  useEffect(() => {
    if (lead) {
      setEditData({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        quotedPremium: lead.quotedPremium,
        producerId: lead.producerId,
      });
    }
    setIsEditing(false);
  }, [lead?.id]);

  if (!lead) return null;

  const agent = lead.producerId ? agents.find((a) => a.id === lead.producerId) || null : null;
  const currentStage = stages.find((s) => s.id === lead.pipelineStageId);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await onUpdate(lead.id, editData);
      if (success) {
        setIsEditing(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleStageChange = async (newStageId: number) => {
    const stage = stages.find((s) => s.id === newStageId);
    if (stage) {
      await onStageChange(lead.id, newStageId, stage.name);
    }
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-800 shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <AgentBadge agent={agent} size="lg" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {lead.firstName} {lead.lastName}
                </h2>
                {lead.email && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{lead.email}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 mt-3">
            {lead.agencyzoomId && (
              <a
                href={getAgencyZoomUrl(lead.agencyzoomId, 'lead')}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50"
              >
                Open in AgencyZoom
              </a>
            )}
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50"
              >
                Call
              </a>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Stage Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pipeline Stage
            </label>
            <select
              value={lead.pipelineStageId || ''}
              onChange={(e) => handleStageChange(parseInt(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
            {lead.stageEnteredAt && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Entered stage: {formatDate(lead.stageEnteredAt)}
              </p>
            )}
          </div>

          {/* Contact Information */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Contact Information
              </h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={editData.firstName || ''}
                      onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={editData.lastName || ''}
                      onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editData.phone || ''}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {lead.firstName} {lead.lastName}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Email</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {lead.email || 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white font-mono">
                    {lead.phone ? formatPhoneNumber(lead.phone) : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Lead Details */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
              Lead Details
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">Source</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {lead.leadSource || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">Quoted Premium</span>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {lead.quotedPremium
                    ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(lead.quotedPremium)
                    : 'Not quoted'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">Assigned To</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {lead.producerName || 'Unassigned'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700/50">
                <span className="text-sm text-gray-500 dark:text-gray-400">Created</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {formatDate(lead.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* AgencyZoom ID */}
          {lead.agencyzoomId && (
            <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              AZ ID: {lead.agencyzoomId}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
