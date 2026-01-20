'use client';

/**
 * Live Call View Component
 *
 * Main container for the three-column live call UI featuring:
 * - Left: Caller context panel (customer info, policies, entities)
 * - Center: Live transcript with real-time updates
 * - Right: AI Agent Assist panel
 *
 * Integrates real-time transcript via Supabase and Claude AI assistance.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Call, Customer, Policy, User } from '@/types';

// Components
import { CallHeader } from './call-header';
import { CallerContextPanel, type DetectedEntity } from './caller-context-panel';
import { LiveTranscriptPanel, type TranscriptSegment } from './live-transcript-panel';
import { AgentAssistPanel } from './agent-assist-panel';
import { CallFooter } from './call-footer';

// Hooks
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime';
import { useClaudeAssist, type AssistState } from '@/hooks/use-claude-assist';

// =============================================================================
// TYPES
// =============================================================================

interface LiveCallViewProps {
  callId: string;
  call: Call;
  agent: User;
  initialCustomer?: Customer | null;
  initialPolicies?: Policy[];
}

// =============================================================================
// COMPONENT
// =============================================================================

export function LiveCallView({
  callId,
  call,
  agent,
  initialCustomer = null,
  initialPolicies = [],
}: LiveCallViewProps) {
  const router = useRouter();

  // Customer and policy state
  const [customer, setCustomer] = useState<Customer | null>(initialCustomer);
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [isLoadingCustomer, setIsLoadingCustomer] = useState(!initialCustomer);
  const [customerNotes, setCustomerNotes] = useState<string[]>([]);

  // Detected entities from transcript
  const [detectedEntities, setDetectedEntities] = useState<DetectedEntity[]>([]);

  // Real-time transcript via Supabase
  const {
    segments,
    isConnected,
    connectionState,
  } = useSupabaseRealtime({
    callId,
    enabled: true,
  });

  // Build full transcript string for AI analysis
  const transcriptText = useMemo(() => {
    return segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
  }, [segments]);

  // Claude AI assistance
  const {
    analyze,
    isLoading: isAssistLoading,
    assistState,
    triggerQuickPrompt,
  } = useClaudeAssist({
    callId,
    agentId: agent.id,
    customer,
    customerNotes,
    debounceMs: 2000,
  });

  // Trigger analysis when transcript updates
  useEffect(() => {
    if (transcriptText.length > 50) {
      analyze(transcriptText);
    }
  }, [transcriptText, analyze]);

  // Fetch customer data on mount if not provided
  useEffect(() => {
    const fetchCustomer = async () => {
      if (initialCustomer) return;

      // Try to find customer by phone number from call
      const phoneNumber = call.direction === 'inbound' ? call.fromNumber : call.toNumber;
      if (!phoneNumber) {
        setIsLoadingCustomer(false);
        return;
      }

      try {
        setIsLoadingCustomer(true);

        // Fetch customer lookup
        const lookupRes = await fetch(`/api/customers/lookup?phone=${encodeURIComponent(phoneNumber)}`);
        if (lookupRes.ok) {
          const data = await lookupRes.json();
          if (data.customer) {
            setCustomer(data.customer);

            // Fetch merged profile for more details and notes
            if (data.customer.agencyzoomId || data.customer.hawksoftClientCode) {
              const profileId = data.customer.agencyzoomId || data.customer.hawksoftClientCode;
              const profileRes = await fetch(`/api/customers/${profileId}/merged-profile`);
              if (profileRes.ok) {
                const profileData = await profileRes.json();
                if (profileData.success && profileData.profile) {
                  // Update with richer data
                  setPolicies(profileData.profile.policies || []);

                  // Extract notes for AI context
                  const notes = (profileData.profile.notes || [])
                    .slice(0, 10) // Last 10 notes
                    .map((n: { content: string }) => n.content);
                  setCustomerNotes(notes);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('[LiveCallView] Error fetching customer:', error);
      } finally {
        setIsLoadingCustomer(false);
      }
    };

    fetchCustomer();
  }, [call, initialCustomer]);

  // Handle entity detection from transcript
  const handleEntityDetected = useCallback((entity: DetectedEntity) => {
    setDetectedEntities((prev) => {
      // Deduplicate by type + value
      const key = `${entity.type}:${entity.value}`;
      if (prev.some((e) => `${e.type}:${e.value}` === key)) {
        return prev;
      }
      return [...prev, entity];
    });
  }, []);

  // Call control handlers
  const handleHold = useCallback(async () => {
    try {
      await fetch('/api/3cx/call-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hold', callId }),
      });
    } catch (error) {
      console.error('Failed to hold call:', error);
    }
  }, [callId]);

  const handleTransfer = useCallback(async () => {
    // This would open a transfer dialog
    // For now, just log
    console.log('Transfer requested for call:', callId);
  }, [callId]);

  const handleEndCall = useCallback(async () => {
    try {
      await fetch('/api/3cx/call-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hangup', callId }),
      });
    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }, [callId]);

  // Quick action handlers
  const handleQuickAction = useCallback((action: string) => {
    console.log('Quick action:', action);
    // These would open appropriate modals/forms
    switch (action) {
      case 'add_vehicle':
        // Open add vehicle form
        break;
      case 'add_driver':
        // Open add driver form
        break;
      case 'new_quote':
        router.push(`/quote/new?callId=${callId}`);
        break;
      case 'schedule_call':
        // Open schedule dialog
        break;
    }
  }, [callId, router]);

  // Footer action handlers
  const handleAddNote = useCallback(() => {
    console.log('Add note');
  }, []);

  const handleCreateTask = useCallback(() => {
    console.log('Create task');
  }, []);

  const handleCreateLead = useCallback(() => {
    console.log('Create lead');
  }, []);

  const handleScheduleFollowUp = useCallback(() => {
    console.log('Schedule follow-up');
  }, []);

  const handleSaveDraft = useCallback(async () => {
    console.log('Saving draft...');
  }, []);

  const handleCompleteWrapup = useCallback(() => {
    router.push(`/reviews?callId=${callId}`);
  }, [callId, router]);

  // Convert segments to the format expected by LiveTranscriptPanel
  const transcriptSegments: TranscriptSegment[] = useMemo(() => {
    return segments.map((s) => ({
      id: s.id,
      text: s.text,
      speaker: s.speaker,
      timestamp: s.timestamp,
      confidence: s.confidence,
      isFinal: s.isFinal,
      sequenceNumber: s.sequenceNumber,
    }));
  }, [segments]);

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-950">
      {/* Header */}
      <CallHeader
        call={call}
        customer={customer}
        isLoading={isLoadingCustomer}
        onHold={handleHold}
        onTransfer={handleTransfer}
        onEnd={handleEndCall}
      />

      {/* Main content - Three column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Caller Context */}
        <CallerContextPanel
          customer={customer}
          policies={policies}
          detectedEntities={detectedEntities}
          callId={callId}
          isLoading={isLoadingCustomer}
          onQuickAction={handleQuickAction}
        />

        {/* Center: Live Transcript */}
        <LiveTranscriptPanel
          segments={transcriptSegments}
          isConnected={isConnected}
          connectionState={connectionState}
          onEntityDetected={handleEntityDetected}
        />

        {/* Right: AI Agent Assist */}
        <AgentAssistPanel
          callId={callId}
          agentId={agent.id}
          customer={customer}
          transcript={transcriptText}
          assistState={assistState}
          isLoading={isAssistLoading}
          onQuickPrompt={triggerQuickPrompt}
        />
      </div>

      {/* Footer */}
      <CallFooter
        callId={callId}
        customer={customer}
        detectedEntities={detectedEntities}
        onAddNote={handleAddNote}
        onCreateTask={handleCreateTask}
        onCreateLead={handleCreateLead}
        onScheduleFollowUp={handleScheduleFollowUp}
        onSaveDraft={handleSaveDraft}
        onCompleteWrapup={handleCompleteWrapup}
      />
    </div>
  );
}

export default LiveCallView;
