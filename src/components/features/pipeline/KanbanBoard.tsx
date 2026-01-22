'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import KanbanColumn, { StageData } from './KanbanColumn';
import { LeadCardOverlay, PipelineLead } from './LeadCard';
import { Agent } from './AgentBadge';
import { toast } from 'sonner';

interface KanbanBoardProps {
  stages: StageData[];
  employees: Agent[];
  onStageChange: (leadId: string, newStageId: number, newStageName: string) => Promise<boolean>;
  onLeadClick?: (lead: PipelineLead) => void;
}

export default function KanbanBoard({
  stages,
  employees,
  onStageChange,
  onLeadClick,
}: KanbanBoardProps) {
  const [localStages, setLocalStages] = useState<StageData[]>(stages);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<PipelineLead | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Build agent map for quick lookup
  const agentMap = new Map<string, Agent>();
  employees.forEach((emp) => {
    agentMap.set(emp.id, emp);
  });

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag
      },
    })
  );

  // Sync local stages when props change
  if (JSON.stringify(stages) !== JSON.stringify(localStages) && !activeId) {
    setLocalStages(stages);
  }

  // Find lead across all stages
  const findLead = useCallback(
    (leadId: string): { lead: PipelineLead; stageId: number } | null => {
      for (const stage of localStages) {
        const lead = stage.leads.find((l) => l.id === leadId);
        if (lead) {
          return { lead, stageId: stage.id };
        }
      }
      return null;
    },
    [localStages]
  );

  // Find stage from droppable ID
  const findStageFromDroppableId = (droppableId: string): StageData | null => {
    const stageId = parseInt(droppableId.replace('stage-', ''));
    return localStages.find((s) => s.id === stageId) || null;
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);

    const found = findLead(active.id as string);
    if (found) {
      setActiveLead(found.lead);
    }
  };

  // Handle drag over (for visual feedback)
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over) {
      setOverId(over.id as string);
    } else {
      setOverId(null);
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    setActiveLead(null);
    setOverId(null);

    if (!over) return;

    const leadId = active.id as string;
    const found = findLead(leadId);
    if (!found) return;

    // Determine target stage
    let targetStage: StageData | null = null;

    // Check if dropped on a stage
    if (typeof over.id === 'string' && over.id.startsWith('stage-')) {
      targetStage = findStageFromDroppableId(over.id);
    }
    // Check if dropped on another lead
    else if (over.data?.current?.type === 'lead') {
      const targetLead = over.data.current.lead as PipelineLead;
      const targetFound = findLead(targetLead.id);
      if (targetFound) {
        targetStage = localStages.find((s) => s.id === targetFound.stageId) || null;
      }
    }

    if (!targetStage) return;

    // No change if same stage
    if (targetStage.id === found.stageId) return;

    // Optimistic update
    const previousStages = [...localStages];
    setLocalStages((prev) => {
      return prev.map((stage) => {
        if (stage.id === found.stageId) {
          // Remove from old stage
          return {
            ...stage,
            leads: stage.leads.filter((l) => l.id !== leadId),
            count: stage.count - 1,
            totalPremium: stage.totalPremium - (found.lead.quotedPremium || 0),
          };
        }
        if (stage.id === targetStage!.id) {
          // Add to new stage
          const updatedLead = {
            ...found.lead,
            pipelineStageId: targetStage!.id,
            pipelineStage: targetStage!.name,
            stageEnteredAt: new Date().toISOString(),
          };
          return {
            ...stage,
            leads: [...stage.leads, updatedLead],
            count: stage.count + 1,
            totalPremium: stage.totalPremium + (found.lead.quotedPremium || 0),
          };
        }
        return stage;
      });
    });

    // Call API to update
    try {
      const success = await onStageChange(leadId, targetStage.id, targetStage.name);
      if (!success) {
        // Revert on failure
        setLocalStages(previousStages);
        toast.error('Failed to update stage');
      } else {
        toast.success(`Moved to ${targetStage.name}`);
      }
    } catch (error) {
      // Revert on error
      setLocalStages(previousStages);
      toast.error('Failed to update stage');
      console.error('[KanbanBoard] Stage update error:', error);
    }
  };

  // Get active lead's agent for overlay
  const activeAgent = activeLead?.producerId ? agentMap.get(activeLead.producerId) || null : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {localStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            agents={agentMap}
            onLeadClick={onLeadClick}
            isOver={overId === `stage-${stage.id}`}
          />
        ))}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeLead && <LeadCardOverlay lead={activeLead} agent={activeAgent} />}
      </DragOverlay>
    </DndContext>
  );
}
