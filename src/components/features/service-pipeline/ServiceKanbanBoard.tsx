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
import ServiceKanbanColumn, { StageConfig } from './ServiceKanbanColumn';
import { ServiceTicketCardOverlay } from './ServiceTicketCard';
import { TriageCardOverlay } from './TriageCard';
import type { ServiceTicketItem, TriageItem, Employee } from '@/app/api/service-pipeline/route';
import { toast } from 'sonner';

interface ServiceKanbanBoardProps {
  stages: StageConfig[];
  triageItems: TriageItem[];
  tickets: Record<number, ServiceTicketItem[]>;
  employees: Employee[];
  onStageChange: (ticketId: string, newStageId: number, newStageName: string) => Promise<boolean>;
  onTriageAction: (item: TriageItem, action: 'note' | 'ticket' | 'skip' | 'delete') => void;
  onItemClick: (item: TriageItem | ServiceTicketItem, type: 'triage' | 'ticket') => void;
  onCreateTicketFromTriage?: (item: TriageItem, targetStageId: number) => void;
}

type DragItemType = 'triage' | 'ticket';
type ActiveItem = { type: 'triage'; item: TriageItem } | { type: 'ticket'; item: ServiceTicketItem };

export default function ServiceKanbanBoard({
  stages,
  triageItems,
  tickets,
  employees,
  onStageChange,
  onTriageAction,
  onItemClick,
  onCreateTicketFromTriage,
}: ServiceKanbanBoardProps) {
  const [localTriageItems, setLocalTriageItems] = useState<TriageItem[]>(triageItems);
  const [localTickets, setLocalTickets] = useState<Record<number, ServiceTicketItem[]>>(tickets);
  const [activeItem, setActiveItem] = useState<ActiveItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement to start drag
      },
    })
  );

  // Sync local state when props change (but not during drag)
  if (!activeItem) {
    if (JSON.stringify(triageItems) !== JSON.stringify(localTriageItems)) {
      setLocalTriageItems(triageItems);
    }
    if (JSON.stringify(tickets) !== JSON.stringify(localTickets)) {
      setLocalTickets(tickets);
    }
  }

  // Find ticket across all stages
  const findTicket = useCallback(
    (ticketId: string): { ticket: ServiceTicketItem; stageId: number } | null => {
      for (const [stageIdStr, stageTickets] of Object.entries(localTickets)) {
        const ticket = stageTickets.find((t) => t.id === ticketId);
        if (ticket) {
          return { ticket, stageId: parseInt(stageIdStr) };
        }
      }
      return null;
    },
    [localTickets]
  );

  // Find triage item
  const findTriageItem = useCallback(
    (itemId: string): TriageItem | null => {
      return localTriageItems.find((item) => item.id === itemId) || null;
    },
    [localTriageItems]
  );

  // Parse stage ID from droppable ID
  const parseStageId = (droppableId: string): string | number | null => {
    const match = droppableId.match(/^stage-(.+)$/);
    if (!match) return null;
    const id = match[1];
    return id === 'triage' ? 'triage' : parseInt(id);
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (data?.type === 'ticket') {
      setActiveItem({ type: 'ticket', item: data.ticket as ServiceTicketItem });
    } else if (data?.type === 'triage') {
      setActiveItem({ type: 'triage', item: data.item as TriageItem });
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
    const currentActiveItem = activeItem;

    setActiveItem(null);
    setOverId(null);

    if (!over || !currentActiveItem) return;

    // Determine target stage
    let targetStageId: string | number | null = null;

    // Check if dropped on a stage
    if (typeof over.id === 'string' && over.id.startsWith('stage-')) {
      targetStageId = parseStageId(over.id);
    }
    // Check if dropped on another item (get its stage)
    else if (over.data?.current) {
      const overData = over.data.current;
      if (overData.type === 'ticket') {
        const overTicket = overData.ticket as ServiceTicketItem;
        targetStageId = overTicket.stageId || 111160; // Default to New
      } else if (overData.type === 'triage') {
        targetStageId = 'triage';
      }
    }

    if (targetStageId === null) return;

    // Handle different drag scenarios
    if (currentActiveItem.type === 'ticket') {
      // Ticket being moved between service stages
      if (targetStageId === 'triage') {
        // Can't move a ticket back to triage
        toast.error("Can't move a ticket back to triage");
        return;
      }

      const found = findTicket(currentActiveItem.item.id);
      if (!found) return;

      // No change if same stage
      if (found.stageId === targetStageId) return;

      const targetStage = stages.find((s) => s.id === targetStageId);
      if (!targetStage) return;

      // Optimistic update
      const previousTickets = { ...localTickets };
      setLocalTickets((prev) => {
        const newState = { ...prev };

        // Remove from old stage
        if (newState[found.stageId]) {
          newState[found.stageId] = newState[found.stageId].filter(
            (t) => t.id !== currentActiveItem.item.id
          );
        }

        // Add to new stage
        const updatedTicket = {
          ...found.ticket,
          stageId: targetStageId as number,
          stageName: targetStage.name,
        };
        if (!newState[targetStageId as number]) {
          newState[targetStageId as number] = [];
        }
        newState[targetStageId as number] = [updatedTicket, ...newState[targetStageId as number]];

        return newState;
      });

      // Call API
      try {
        const success = await onStageChange(
          currentActiveItem.item.id,
          targetStageId as number,
          targetStage.name
        );
        if (!success) {
          setLocalTickets(previousTickets);
          toast.error('Failed to update stage');
        } else {
          toast.success(`Moved to ${targetStage.name}`);
        }
      } catch (error) {
        setLocalTickets(previousTickets);
        toast.error('Failed to update stage');
        console.error('[ServiceKanbanBoard] Stage update error:', error);
      }
    } else if (currentActiveItem.type === 'triage') {
      // Triage item being moved
      if (targetStageId === 'triage') {
        // Reordering within triage - no action needed
        return;
      }

      // Moving triage item to a service stage = create ticket
      if (onCreateTicketFromTriage) {
        const targetStage = stages.find((s) => s.id === targetStageId);
        if (targetStage) {
          onCreateTicketFromTriage(currentActiveItem.item, targetStageId as number);
        }
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-full">
        {stages.map((stage) => {
          const isTriage = stage.id === 'triage';
          return (
            <ServiceKanbanColumn
              key={stage.id}
              stage={stage}
              triageItems={isTriage ? localTriageItems : undefined}
              tickets={!isTriage ? localTickets[stage.id as number] || [] : undefined}
              onItemClick={onItemClick}
              onTriageAction={isTriage ? onTriageAction : undefined}
              isOver={overId === `stage-${stage.id}`}
            />
          );
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeItem?.type === 'ticket' && (
          <ServiceTicketCardOverlay ticket={activeItem.item} />
        )}
        {activeItem?.type === 'triage' && (
          <TriageCardOverlay item={activeItem.item} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
