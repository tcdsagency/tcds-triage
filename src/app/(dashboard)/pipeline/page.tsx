'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { KanbanBoard, PipelineFilters, LeadDetailPanel, StageData, Agent, PipelineLead } from '@/components/features/pipeline';

interface PipelineResponse {
  success: boolean;
  pipeline: {
    id: number;
    name: string;
    stages: StageData[];
  };
  employees: Agent[];
  totalLeads: number;
  error?: string;
}

export default function PipelinePage() {
  const [stages, setStages] = useState<StageData[]>([]);
  const [employees, setEmployees] = useState<Agent[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [pipelineName, setPipelineName] = useState('New Leads Pipeline');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProducerId, setSelectedProducerId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);

  // Fetch pipeline data
  const fetchPipeline = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (selectedProducerId) params.set('producerId', selectedProducerId);
      params.set('fetchFromAz', 'true'); // Fetch fresh data from AgencyZoom

      const res = await fetch(`/api/leads/pipeline?${params}`);
      const data: PipelineResponse = await res.json();

      if (data.success) {
        setStages(data.pipeline.stages);
        setEmployees(data.employees);
        setTotalLeads(data.totalLeads);
        setPipelineName(data.pipeline.name);
      } else {
        toast.error('Failed to load pipeline', {
          description: data.error || 'Please try again',
        });
      }
    } catch (err) {
      console.error('Failed to load pipeline:', err);
      toast.error('Failed to load pipeline');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [search, selectedProducerId]);

  // Initial load
  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.length >= 2 || search.length === 0) {
        fetchPipeline();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle stage change (drag-drop)
  const handleStageChange = async (
    leadId: string,
    newStageId: number,
    newStageName: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: newStageId, stageName: newStageName }),
      });

      const data = await res.json();

      if (!data.success) {
        console.error('[Pipeline] Stage update failed:', data);
        return false;
      }

      // Check AgencyZoom sync status
      if (!data.agencyzoomSync?.success) {
        toast.warning('Updated locally, but AgencyZoom sync failed', {
          description: data.agencyzoomSync?.error || 'Will retry on next sync',
        });
      }

      return true;
    } catch (error) {
      console.error('[Pipeline] Stage update error:', error);
      return false;
    }
  };

  // Handle lead click (open detail panel)
  const handleLeadClick = (lead: PipelineLead) => {
    setSelectedLead(lead);
  };

  // Handle lead update from detail panel
  const handleLeadUpdate = async (
    leadId: string,
    updates: Partial<PipelineLead>
  ): Promise<boolean> => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (!data.success) {
        console.error('[Pipeline] Lead update failed:', data);
        toast.error('Failed to update lead', {
          description: data.error || 'Please try again',
        });
        return false;
      }

      // Update local state with the returned data
      setStages((prev) =>
        prev.map((stage) => ({
          ...stage,
          leads: stage.leads.map((lead) =>
            lead.id === leadId ? { ...lead, ...updates } : lead
          ),
        }))
      );

      // Also update the selected lead if it's the one being edited
      if (selectedLead?.id === leadId) {
        setSelectedLead((prev) => (prev ? { ...prev, ...updates } : prev));
      }

      // Check AgencyZoom sync status
      if (!data.agencyzoomSync?.success) {
        toast.warning('Updated locally, but AgencyZoom sync failed', {
          description: data.agencyzoomSync?.error || 'Will retry on next sync',
        });
      } else {
        toast.success('Lead updated');
      }

      return true;
    } catch (error) {
      console.error('[Pipeline] Lead update error:', error);
      toast.error('Failed to update lead');
      return false;
    }
  };

  // Close detail panel
  const handleCloseDetail = () => {
    setSelectedLead(null);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchPipeline(true);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Page Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{pipelineName}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Drag leads between stages to update their status
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <PipelineFilters
          search={search}
          onSearchChange={setSearch}
          selectedProducerId={selectedProducerId}
          onProducerChange={setSelectedProducerId}
          employees={employees}
          totalLeads={totalLeads}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      </div>

      {/* Kanban Board */}
      <div className="flex-1 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">Loading pipeline...</p>
            </div>
          </div>
        ) : stages.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-2">No stages found</p>
              <button
                onClick={handleRefresh}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Refresh
              </button>
            </div>
          </div>
        ) : (
          <KanbanBoard
            stages={stages}
            employees={employees}
            onStageChange={handleStageChange}
            onLeadClick={handleLeadClick}
          />
        )}
      </div>

      {/* Lead Detail Panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          agents={employees}
          stages={stages.map((s) => ({ id: s.id, name: s.name }))}
          onClose={handleCloseDetail}
          onUpdate={handleLeadUpdate}
          onStageChange={handleStageChange}
        />
      )}
    </div>
  );
}
