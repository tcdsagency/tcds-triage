"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCallWebSocket } from "@/hooks/useCallWebSocket";
import TranscriptView from "./TranscriptView";
import CoachingTip, { CoachingTipCompact } from "./CoachingTip";
import LiveAssistCard, { LiveAssistCompact } from "./LiveAssistCard";
import CustomerAssistCards from "./CustomerAssistCards";
import LeadAssistCards from "./LeadAssistCards";
import { MergedProfile } from "@/types/customer-profile";
import { Playbook, AgentSuggestion, TelemetryFeedback } from "@/lib/agent-assist/types";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { AgencyZoomButton, getAgencyZoomUrl } from "@/components/ui/agencyzoom-link";
import { CanopyConnectSMS } from "@/components/CanopyConnectSMS";

// =============================================================================
// TYPES
// =============================================================================

interface UserInfo {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  extension: string;
}

interface CallPopupProps {
  sessionId: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  isVisible: boolean;
  onClose: () => void;
  onMinimize: () => void;
  startTime?: number;
  callStatus?: "ringing" | "connected" | "on_hold" | "wrap_up" | "ended";
  callerUser?: UserInfo;
  calleeUser?: UserInfo;
}

interface CustomerLookup {
  id: string;
  hawksoftId?: string;
  agencyzoomId?: string;
  name: string;
  phone: string;
}

interface LastInteraction {
  type: "phone_call" | "email" | "sms" | "mailed_card" | "note" | "policy_change" | "claim" | "quote";
  date: string;
  summary: string;
  agentName?: string;
}

interface LifeEvent {
  event: string;
  date?: string;
  followUpQuestion: string;
  icon: string;
}

interface AIOverview {
  summary: string;
  keyFacts: string[];
  coverageGaps: Array<{
    type: string;
    severity: "high" | "medium" | "low";
    recommendation: string;
    suggestedAction: string;
  }>;
  crossSellOpportunities: Array<{
    product: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  riskFlags: Array<{
    type: string;
    description: string;
    severity: "high" | "medium" | "low";
  }>;
  agentTips: string[];
  lastInteraction?: LastInteraction;
  lifeEvents?: LifeEvent[];
  personalizationPrompts?: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CLIENT_LEVEL_CONFIG = {
  A: { label: "Standard", emoji: "⭐", color: "bg-slate-100 text-slate-700" },
  AA: { label: "Premier", emoji: "🏆", color: "bg-blue-100 text-blue-700" },
  AAA: { label: "Premier", emoji: "👑", color: "bg-amber-100 text-amber-700" },
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function CallPopup({
  sessionId,
  phoneNumber,
  direction,
  isVisible,
  onClose,
  onMinimize,
  startTime,
  callStatus: externalCallStatus,
  callerUser,
  calleeUser
}: CallPopupProps) {
  // UI State
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "assist">("overview");

  // Calculate initial duration from startTime to maintain persistence across navigation
  const calculateDuration = useCallback(() => {
    if (!startTime) return 0;
    return Math.floor((Date.now() - startTime) / 1000);
  }, [startTime]);

  const [callDuration, setCallDuration] = useState(calculateDuration);

  // Live Assist State
  const [matchedPlaybook, setMatchedPlaybook] = useState<Playbook | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AgentSuggestion[]>([]);
  const [assistLoading, setAssistLoading] = useState(false);
  const lastTranscriptLength = useRef(0);
  
  // Data State - Uses same MergedProfile type as CustomerProfilePage
  const [customerLookup, setCustomerLookup] = useState<CustomerLookup | null>(null);
  const [profile, setProfile] = useState<MergedProfile | null>(null);
  const [aiOverview, setAiOverview] = useState<AIOverview | null>(null);
  
  // Loading State
  const [lookupLoading, setLookupLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Notes State
  const [draftNotes, setDraftNotes] = useState("");
  const [postingNotes, setPostingNotes] = useState(false);
  const [notePosted, setNotePosted] = useState(false);

  // Deep Think State (triggers after 2+ minutes)
  const [deepThinkData, setDeepThinkData] = useState<{
    foundData: boolean;
    message?: string;
    insights?: {
      transcriptsAnalyzed: number;
      dateRange: { oldest: string; newest: string };
      keyTopics: string[];
      lifeEvents: Array<{ event: string; date?: string; source: string }>;
      conversationHistory: Array<{ date: string; summary: string; agentName?: string }>;
      suggestedTalkingPoints: string[];
    };
  } | null>(null);
  const [deepThinkLoading, setDeepThinkLoading] = useState(false);
  const deepThinkTriggered = useRef(false);

  // Customer Intelligence State (accumulated knowledge about customer)
  const [customerIntel, setCustomerIntel] = useState<{
    facts: Record<string, Array<{ fact: string; keywords: string[]; sourceDate?: string }>>;
    personality: {
      primaryType: string;
      secondaryType: string;
      scores: { dominance: number; influence: number; steadiness: number; conscientiousness: number };
      description: string;
      communicationTips: string[];
    } | null;
    factCount: number;
  } | null>(null);
  const [customerIntelLoading, setCustomerIntelLoading] = useState(false);

  // Wrap-Up State
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [wrapupLoading, setWrapupLoading] = useState(false);
  const [wrapupStatus, setWrapupStatus] = useState<string | null>(null);

  // End Call State
  const [endingCall, setEndingCall] = useState(false);

  // Call Control State
  const [isOnHold, setIsOnHold] = useState(false);
  const [holdLoading, setHoldLoading] = useState(false);
  const [showTransferDropdown, setShowTransferDropdown] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [callControlError, setCallControlError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string;
    name: string;
    extension: string;
    status: string;
  }>>([]);

  const [wrapupData, setWrapupData] = useState<{
    summary?: string;
    aiCleanedSummary?: string;
    requestType?: string;
    insuranceType?: string;
    policyNumbers?: string[];
    customerName?: string;
    aiExtraction?: any;
    aiConfidence?: number;
  } | null>(null);

  // WebSocket for transcript and coaching
  const { transcript, coaching, callStatus, isConnected } = useCallWebSocket(sessionId, isVisible);

  // =========================================================================
  // STEP 1: Lookup customer by phone number
  // Returns hawksoftId and agencyzoomId for loading full profile
  // =========================================================================
  useEffect(() => {
    if (!phoneNumber || !isVisible) return;

    const lookupCustomer = async () => {
      setLookupLoading(true);
      setError(null);
      
      try {
        const res = await fetch(`/api/calls/popup?phone=${encodeURIComponent(phoneNumber)}`);
        const data = await res.json();
        
        if (data.success && data.customer) {
          setCustomerLookup({
            id: data.customer.id,
            hawksoftId: data.customer.hawksoftClientId,
            agencyzoomId: data.customer.agencyzoomId,
            name: data.customer.displayName || `${data.customer.firstName} ${data.customer.lastName}`,
            phone: data.customer.phone,
          });
        } else {
          setCustomerLookup(null);
        }
      } catch (err) {
        setError("Failed to lookup customer");
        setCustomerLookup(null);
      } finally {
        setLookupLoading(false);
      }
    };

    lookupCustomer();
  }, [phoneNumber, isVisible]);

  // =========================================================================
  // STEP 2: Load MergedProfile (SAME endpoint as CustomerProfilePage)
  // This gives us the full customer data: policies, household, notes, etc.
  // =========================================================================
  useEffect(() => {
    if (!customerLookup?.hawksoftId && !customerLookup?.agencyzoomId) return;

    const loadProfile = async () => {
      setProfileLoading(true);
      
      try {
        const params = new URLSearchParams();
        if (customerLookup.hawksoftId) params.set("hsId", customerLookup.hawksoftId);
        if (customerLookup.agencyzoomId) params.set("azId", customerLookup.agencyzoomId);
        
        // Same API endpoint used by CustomerProfilePage
        const res = await fetch(`/api/customers/${customerLookup.id}/merged-profile?${params}`);
        const data = await res.json();
        
        if (data.success && data.profile) {
          setProfile(data.profile);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, [customerLookup]);

  // =========================================================================
  // STEP 3: Load AI Overview (SAME endpoint as CustomerProfilePage)
  // This gives us: summary, coverage gaps, cross-sell, risk flags, agent tips
  // =========================================================================
  useEffect(() => {
    if (!profile) return;

    const loadAIOverview = async () => {
      setAiLoading(true);

      try {
        // Format recent notes for AI context (last 5)
        const recentNotes = profile.notes?.slice(0, 5).map((n) => ({
          content: n.content || "",
          createdAt: n.createdAt || "",
          createdBy: n.createdBy?.name || "Agent",
        }));

        // Same API endpoint used by CustomerProfilePage - now with notes
        const res = await fetch("/api/ai/customer-overview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profile, recentNotes }),
        });
        const data = await res.json();

        if (data.success && data.overview) {
          setAiOverview(data.overview);
        }
      } catch (err) {
        console.error("Failed to load AI overview:", err);
      } finally {
        setAiLoading(false);
      }
    };

    loadAIOverview();
  }, [profile]);

  // =========================================================================
  // Call duration timer - persists across navigation using startTime
  // =========================================================================
  // Recalculate duration when startTime changes (e.g., after navigation)
  useEffect(() => {
    if (startTime) {
      setCallDuration(calculateDuration());
    }
  }, [startTime, calculateDuration]);

  // Use external call status if provided, otherwise use websocket status
  const effectiveCallStatus = externalCallStatus || callStatus;

  useEffect(() => {
    if (!isVisible || effectiveCallStatus === "ended") return;

    const interval = setInterval(() => {
      if (startTime) {
        // Calculate from startTime for accuracy
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      } else {
        // Fallback to increment
        setCallDuration(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, effectiveCallStatus, startTime]);

  // =========================================================================
  // DEEP THINK: Trigger after 2+ minutes to analyze past transcripts
  // =========================================================================
  useEffect(() => {
    // Only trigger once per call, after 2 minutes (120 seconds)
    if (
      !isVisible ||
      effectiveCallStatus === "ended" ||
      !customerLookup?.id ||
      deepThinkTriggered.current ||
      callDuration < 120
    ) {
      return;
    }

    deepThinkTriggered.current = true;
    setDeepThinkLoading(true);

    console.log("[CallPopup] Deep Think triggered at 2+ minutes");

    const runDeepThink = async () => {
      try {
        const res = await fetch("/api/ai/deep-think", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: customerLookup.id,
            customerPhone: phoneNumber,
            currentCallId: sessionId
          })
        });

        const data = await res.json();

        if (data.success) {
          setDeepThinkData({
            foundData: data.foundData,
            message: data.message,
            insights: data.insights
          });
          console.log(`[CallPopup] Deep Think complete: ${data.message}`);
        }
      } catch (err) {
        console.error("[CallPopup] Deep Think error:", err);
      } finally {
        setDeepThinkLoading(false);
      }
    };

    runDeepThink();
  }, [isVisible, effectiveCallStatus, customerLookup, callDuration, phoneNumber, sessionId]);

  // =========================================================================
  // CUSTOMER INTELLIGENCE: Load accumulated customer facts and personality
  // =========================================================================
  useEffect(() => {
    if (!customerLookup?.id || !isVisible) return;

    const loadCustomerIntel = async () => {
      setCustomerIntelLoading(true);
      try {
        const res = await fetch(`/api/ai/customer-intel?customerId=${customerLookup.id}`);
        const data = await res.json();

        if (data.success && data.factCount > 0) {
          setCustomerIntel({
            facts: data.facts,
            personality: data.personality,
            factCount: data.factCount
          });
        }
      } catch (err) {
        console.error("[CallPopup] Customer intel error:", err);
      } finally {
        setCustomerIntelLoading(false);
      }
    };

    loadCustomerIntel();
  }, [customerLookup?.id, isVisible]);

  // =========================================================================
  // LIVE ASSIST: Fetch playbook and suggestions based on transcript
  // Debounced to avoid excessive API calls
  // =========================================================================
  useEffect(() => {
    if (!isVisible || callStatus === "ended") return;

    // Convert transcript segments to text
    const transcriptText = transcript.map(s => s.text).join(" ");

    // Only process if we have new content (at least 100 chars more)
    if (transcriptText.length - lastTranscriptLength.current < 100) return;
    lastTranscriptLength.current = transcriptText.length;

    // Debounce API calls
    const timeoutId = setTimeout(async () => {
      setAssistLoading(true);

      try {
        // Fetch playbook match
        const playbookRes = await fetch("/api/agent-assist/playbook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: transcriptText,
            callType: direction,
          }),
        });

        const playbookData = await playbookRes.json();
        if (playbookData.success && playbookData.playbook) {
          setMatchedPlaybook(playbookData.playbook);

          // Track playbook shown
          fetch("/api/agent-assist/telemetry", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              suggestionType: "playbook",
              playbookId: playbookData.playbook.id,
              action: "shown",
              callTranscriptSnippet: transcriptText.slice(-500),
            }),
          }).catch(console.error);
        }

        // Fetch AI suggestions
        const suggestionsRes = await fetch("/api/agent-assist/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: transcriptText,
            customerProfile: profile ? {
              name: profile.name,
              policyTypes: profile.activePolicyTypes?.map(p => p.type),
              tenure: profile.customerSince,
            } : undefined,
            currentPlaybook: playbookData.playbook?.id,
          }),
        });

        const suggestionsData = await suggestionsRes.json();
        if (suggestionsData.success && suggestionsData.suggestions) {
          setAiSuggestions(suggestionsData.suggestions);

          // Track suggestions shown
          for (const suggestion of suggestionsData.suggestions) {
            fetch("/api/agent-assist/telemetry", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                suggestionType: suggestion.type,
                suggestionId: suggestion.id,
                action: "shown",
                content: suggestion.title,
                callTranscriptSnippet: transcriptText.slice(-500),
              }),
            }).catch(console.error);
          }
        }
      } catch (err) {
        console.error("Live Assist fetch error:", err);
      } finally {
        setAssistLoading(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [transcript, isVisible, callStatus, direction, profile]);

  // =========================================================================
  // LIVE ASSIST: Handle suggestion usage and feedback
  // =========================================================================
  const handleUseSuggestion = useCallback((suggestion: AgentSuggestion) => {
    // Track usage
    fetch("/api/agent-assist/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionType: suggestion.type,
        suggestionId: suggestion.id,
        action: "used",
        content: suggestion.title,
      }),
    }).catch(console.error);

    // Remove from list after use
    setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, []);

  const handleDismissSuggestion = useCallback((suggestion: AgentSuggestion) => {
    // Track dismissal
    fetch("/api/agent-assist/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionType: suggestion.type,
        suggestionId: suggestion.id,
        action: "dismissed",
        content: suggestion.title,
      }),
    }).catch(console.error);

    // Remove from list
    setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, []);

  const handlePlaybookFeedback = useCallback((playbookId: string, feedback: TelemetryFeedback) => {
    fetch("/api/agent-assist/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suggestionType: "playbook",
        playbookId,
        action: "used",
        feedback,
      }),
    }).catch(console.error);
  }, []);

  // =========================================================================
  // Post notes to HawkSoft and AgencyZoom
  // Uses existing API endpoints for note logging
  // =========================================================================
  const handlePostNotes = useCallback(async () => {
    if (!draftNotes.trim() || !profile) return;
    
    setPostingNotes(true);
    
    try {
      const promises = [];
      
      // Post to HawkSoft if we have the ID
      if (profile.hawksoftId) {
        promises.push(
          fetch("/api/hawksoft/clients/note", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: profile.hawksoftId,
              note: draftNotes,
              channel: direction === "inbound" ? "phone_from_insured" : "phone_to_insured",
            }),
          })
        );
      }
      
      // Post to AgencyZoom if we have the ID
      if (profile.agencyzoomId) {
        promises.push(
          fetch(`/api/agencyzoom/contacts/${profile.agencyzoomId}/notes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: draftNotes,
              type: "Note",
            }),
          })
        );
      }
      
      await Promise.all(promises);
      setNotePosted(true);
      setTimeout(() => setNotePosted(false), 3000);
    } catch (err) {
      console.error("Failed to post notes:", err);
    } finally {
      setPostingNotes(false);
    }
  }, [draftNotes, profile, direction]);

  // =========================================================================
  // End Call Manually
  // =========================================================================
  const handleEndCall = useCallback(async () => {
    setEndingCall(true);
    setCallControlError(null);
    try {
      const res = await fetch(`/api/calls/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });

      const data = await res.json();
      if (data.success) {
        // Close the popup after ending the call
        onClose();
      } else {
        console.error("Failed to end call:", data.error);
        setCallControlError(data.error || "Failed to end call");
        setTimeout(() => setCallControlError(null), 5000);
      }
    } catch (err) {
      console.error("Error ending call:", err);
      setCallControlError("Network error - could not reach server");
      setTimeout(() => setCallControlError(null), 5000);
    } finally {
      setEndingCall(false);
    }
  }, [sessionId, onClose]);

  // =========================================================================
  // Hold/Resume Call
  // =========================================================================
  const handleHoldToggle = useCallback(async () => {
    setHoldLoading(true);
    setCallControlError(null);
    try {
      const action = isOnHold ? "resume" : "hold";
      const res = await fetch(`/api/calls/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (data.success) {
        setIsOnHold(!isOnHold);
        console.log(`[CallPopup] Call ${action === "hold" ? "put on hold" : "resumed"}`);
      } else {
        console.error(`[CallPopup] Failed to ${action} call:`, data.error);
        setCallControlError(data.error || `Failed to ${action} call`);
        // Auto-clear error after 5 seconds
        setTimeout(() => setCallControlError(null), 5000);
      }
    } catch (err) {
      console.error("[CallPopup] Hold toggle error:", err);
      setCallControlError("Network error - could not reach server");
      setTimeout(() => setCallControlError(null), 5000);
    } finally {
      setHoldLoading(false);
    }
  }, [sessionId, isOnHold]);

  // =========================================================================
  // Transfer Call
  // =========================================================================
  const handleTransfer = useCallback(async (targetExtension: string, blind: boolean = true) => {
    setTransferring(true);
    try {
      const res = await fetch(`/api/calls/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "transfer", targetExtension, blind }),
      });

      const data = await res.json();
      if (data.success) {
        console.log(`[CallPopup] Call transferred to ${targetExtension}`);
        setShowTransferDropdown(false);
        // Close popup after successful transfer
        onClose();
      } else {
        console.error("[CallPopup] Transfer failed:", data.error);
      }
    } catch (err) {
      console.error("[CallPopup] Transfer error:", err);
    } finally {
      setTransferring(false);
    }
  }, [sessionId, onClose]);

  // =========================================================================
  // Load Team Members for Transfer Dropdown
  // =========================================================================
  useEffect(() => {
    if (!showTransferDropdown) return;

    const loadTeam = async () => {
      try {
        const res = await fetch("/api/3cx/presence");
        const data = await res.json();
        if (data.success && data.team) {
          // Filter out current user's extension
          const currentExt = callerUser?.extension || calleeUser?.extension;
          setTeamMembers(
            data.team.filter((member: any) => member.extension !== currentExt)
          );
        }
      } catch (err) {
        console.error("[CallPopup] Failed to load team for transfer:", err);
      }
    };

    loadTeam();
  }, [showTransferDropdown, callerUser, calleeUser]);

  // Update hold state when callStatus changes
  useEffect(() => {
    if (externalCallStatus === "on_hold" || callStatus === "on_hold") {
      setIsOnHold(true);
    } else if (effectiveCallStatus === "connected") {
      setIsOnHold(false);
    }
  }, [externalCallStatus, callStatus, effectiveCallStatus]);

  // =========================================================================
  // Fetch Wrap-Up Data (from wrapupDrafts table - already has AI summary)
  // =========================================================================
  const fetchWrapupData = useCallback(async () => {
    setWrapupLoading(true);
    try {
      const res = await fetch(`/api/wrapups/${sessionId}`);
      const data = await res.json();

      if (data.success) {
        setWrapupStatus(data.status);

        if (data.hasWrapup && data.wrapup) {
          setWrapupData(data.wrapup);
          // Pre-fill notes with AI summary if available
          if (data.wrapup.aiCleanedSummary && !draftNotes) {
            setDraftNotes(data.wrapup.aiCleanedSummary);
          } else if (data.wrapup.summary && !draftNotes) {
            setDraftNotes(data.wrapup.summary);
          }
        } else if (data.hasTranscript && data.call?.aiSummary) {
          // Fallback to call's aiSummary if no wrapup draft yet
          setWrapupData({
            summary: data.call.aiSummary,
          });
          if (!draftNotes) {
            setDraftNotes(data.call.aiSummary);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch wrapup data:", err);
      setWrapupStatus("error");
    } finally {
      setWrapupLoading(false);
    }
  }, [sessionId, draftNotes]);

  // Fetch wrapup data when wrap-up modal is opened
  useEffect(() => {
    if (showWrapUp && !wrapupData && !wrapupLoading) {
      fetchWrapupData();
    }
  }, [showWrapUp, wrapupData, wrapupLoading, fetchWrapupData]);

  // Auto-poll for transcript/processing when in pending state
  useEffect(() => {
    // Only poll if modal is open and we're in a pending state
    if (!showWrapUp) return;
    if (wrapupStatus !== "pending_transcript" && wrapupStatus !== "pending_processing") return;

    const pollInterval = setInterval(() => {
      console.log(`[Wrapup] Polling for transcript (status: ${wrapupStatus})...`);
      fetchWrapupData();
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [showWrapUp, wrapupStatus, fetchWrapupData]);

  // =========================================================================
  // Helpers
  // =========================================================================
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const openCustomerProfile = () => {
    if (customerLookup?.id) {
      const params = new URLSearchParams();
      if (customerLookup.hawksoftId) params.set("hsId", customerLookup.hawksoftId);
      if (customerLookup.agencyzoomId) params.set("azId", customerLookup.agencyzoomId);
      window.open(`/customer/${customerLookup.id}?${params}`, "_blank");
    }
  };

  if (!isVisible) return null;

  // =========================================================================
  // MINIMIZED VIEW
  // =========================================================================
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white rounded-lg shadow-xl p-3 w-80 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green-400">📞</span>
            <span className="font-medium truncate">
              {profile?.preferredName || profile?.name || customerLookup?.name || phoneNumber}
            </span>
            <span className="text-gray-400 text-sm">{formatDuration(callDuration)}</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setIsMinimized(false)}
              className="p-1 hover:bg-gray-700 rounded"
            >
              ⬆️
            </button>
            <button onClick={onClose} className="p-1 hover:bg-gray-700 rounded">
              ✕
            </button>
          </div>
        </div>
        {coaching && <CoachingTipCompact suggestion={coaching} />}
        {(matchedPlaybook || aiSuggestions.length > 0) && (
          <LiveAssistCompact playbook={matchedPlaybook} suggestionCount={aiSuggestions.length} />
        )}
      </div>
    );
  }

  // =========================================================================
  // FULL VIEW
  // =========================================================================

  // Determine which user to show (the internal user on the call)
  const internalUser = direction === "inbound" ? calleeUser : callerUser;
  const externalParty = direction === "inbound" ? callerUser : calleeUser;

  return (
    <div className="fixed inset-2 md:inset-auto md:top-2 md:right-2 md:w-[820px] md:h-[580px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">

      {/* ===== HEADER ===== */}
      <div className="bg-gray-900 text-white px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Show agent avatar if we have user info */}
          {internalUser ? (
            <div className="relative">
              <AgentAvatar
                name={internalUser.name}
                avatarUrl={internalUser.avatarUrl}
                size="md"
              />
              <span className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-900",
                effectiveCallStatus === "connected" && "bg-green-500",
                effectiveCallStatus === "ringing" && "bg-yellow-500 animate-pulse",
                effectiveCallStatus === "ended" && "bg-gray-500"
              )} />
            </div>
          ) : (
            <span className={cn(
              "text-lg",
              direction === "inbound" ? "text-green-400" : "text-blue-400"
            )}>
              {direction === "inbound" ? "📞" : "📱"}
            </span>
          )}
          <div>
            <div className="font-semibold flex items-center gap-2">
              <span className="text-xs uppercase text-gray-400">
                {direction === "inbound" ? "INCOMING" : "OUTGOING"}
              </span>
              {internalUser && (
                <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded">
                  {internalUser.name} (ext {internalUser.extension})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span>{phoneNumber}</span>
              {externalParty && (
                <span className="text-xs text-gray-400">
                  ({externalParty.name})
                </span>
              )}
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <span>{formatDuration(callDuration)}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-xs",
                isOnHold && "bg-amber-500 text-white animate-pulse",
                !isOnHold && effectiveCallStatus === "connected" && "bg-green-600",
                !isOnHold && effectiveCallStatus === "ringing" && "bg-yellow-600",
                effectiveCallStatus === "ended" && "bg-gray-600"
              )}>
                {isOnHold ? "ON HOLD" : effectiveCallStatus}
              </span>
              {isConnected && <span className="text-green-400">● Live</span>}
            </div>
            {/* Call Control Error Display */}
            {callControlError && (
              <div className="text-xs text-red-400 bg-red-900/50 px-2 py-1 rounded mt-1">
                ⚠️ {callControlError}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {effectiveCallStatus !== "ended" && (
            <>
              {/* Hold/Resume Button */}
              <button
                onClick={handleHoldToggle}
                disabled={holdLoading}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors",
                  isOnHold
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-gray-600 hover:bg-gray-500 text-white"
                )}
                title={isOnHold ? "Resume Call" : "Put on Hold"}
              >
                {holdLoading ? "⏳" : isOnHold ? "▶️" : "⏸️"} {isOnHold ? "Resume" : "Hold"}
              </button>

              {/* Transfer Button & Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowTransferDropdown(!showTransferDropdown)}
                  disabled={transferring}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-medium flex items-center gap-1"
                  title="Transfer Call"
                >
                  {transferring ? "⏳" : "↗️"} Transfer
                </button>

                {/* Transfer Dropdown */}
                {showTransferDropdown && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="px-3 py-2 bg-gray-50 border-b text-xs font-semibold text-gray-600 uppercase">
                      Transfer to:
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {teamMembers.length === 0 ? (
                        <div className="px-3 py-4 text-sm text-gray-500 text-center">
                          Loading team...
                        </div>
                      ) : (
                        teamMembers.map((member) => (
                          <button
                            key={member.id}
                            onClick={() => handleTransfer(member.extension)}
                            disabled={member.status === "offline"}
                            className={cn(
                              "w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-gray-50 transition-colors",
                              member.status === "offline" && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span className={cn(
                              "w-2 h-2 rounded-full flex-shrink-0",
                              member.status === "available" && "bg-green-500",
                              member.status === "on_call" && "bg-red-500",
                              member.status === "away" && "bg-yellow-500",
                              member.status === "dnd" && "bg-red-600",
                              member.status === "offline" && "bg-gray-400"
                            )} />
                            <span className="flex-1 text-sm text-gray-900 truncate">
                              {member.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              ext {member.extension}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="px-3 py-2 bg-gray-50 border-t">
                      <button
                        onClick={() => setShowTransferDropdown(false)}
                        className="w-full px-3 py-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* End Call Button */}
              <button
                onClick={handleEndCall}
                disabled={endingCall}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm font-medium flex items-center gap-1"
                title="End Call"
              >
                {endingCall ? "⏳" : "📞"} End
              </button>
            </>
          )}
          <button
            onClick={() => { setIsMinimized(true); onMinimize(); }}
            className="p-2 hover:bg-gray-700 rounded"
            title="Minimize"
          >
            ➖
          </button>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded" title="Close">
            ✕
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ===== LEFT PANEL - Customer Info with MergedProfile ===== */}
        <div className="w-64 border-r border-gray-200 overflow-y-auto bg-gray-50 text-sm">
          
          {lookupLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin text-2xl">⏳</div>
            </div>
          ) : error ? (
            <div className="p-4 text-red-600 text-sm">{error}</div>
          ) : !customerLookup ? (
            // NO MATCH - Unknown caller with Lead Assist
            <div className="p-4">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">❓</div>
                <h3 className="font-semibold text-lg">Unknown Caller</h3>
                <p className="text-gray-500 text-sm">{phoneNumber}</p>
              </div>

              {/* Lead Assist Cards */}
              <LeadAssistCards
                phoneNumber={phoneNumber}
                onCreateLead={() => {
                  // TODO: Open create lead modal or navigate
                  window.open("/leads/new", "_blank");
                }}
                onStartQuote={(quoteType) => {
                  window.open(`/quote/new?type=${quoteType}`, "_blank");
                }}
              />
            </div>
          ) : (
            // CUSTOMER FOUND - Show MergedProfile data
            <div className="p-3">
              
              {/* Customer Header with Badges - Compact */}
              <div className="mb-3">
                {/* Name with inline badges */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <h2 className="font-bold text-base text-gray-900">
                    {profile?.preferredName || profile?.name || customerLookup.name}
                  </h2>
                  {profile?.clientLevel && (
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium",
                      CLIENT_LEVEL_CONFIG[profile.clientLevel]?.color || "bg-gray-100 text-gray-700"
                    )}>
                      {CLIENT_LEVEL_CONFIG[profile.clientLevel]?.emoji} {profile.clientLevel}
                    </span>
                  )}
                  {profile?.isOG && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                      🌟 OG
                    </span>
                  )}
                </div>

                {/* Policy Types with Premium - Compact */}
                {profile?.activePolicyTypes && profile.activePolicyTypes.length > 0 && (
                  <div className="flex items-center gap-0.5">
                    {profile.activePolicyTypes.map((pt, i) => (
                      <span key={i} className="text-sm" title={`${pt.type} (${pt.count})`}>
                        {pt.emoji}
                      </span>
                    ))}
                    <span className="ml-1.5 text-xs font-medium text-gray-600">
                      ${profile.totalPremium?.toLocaleString()}/yr
                    </span>
                    {profile?.customerSince && (
                      <span className="text-xs text-gray-400 ml-1">
                        • since {new Date(profile.customerSince).getFullYear()}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Contact Info - Compact */}
              <div className="text-xs text-gray-600 mb-3 pb-2 border-b flex items-center gap-3">
                <span>📞 {profile?.contact?.phone || customerLookup.phone}</span>
                {profile?.contact?.email && (
                  <span className="truncate">✉️ {profile.contact.email}</span>
                )}
              </div>

              {/* ===== PERSONALIZATION SECTION - Compact ===== */}
              {aiOverview && (aiOverview.lastInteraction || (aiOverview.lifeEvents && aiOverview.lifeEvents.length > 0) || (aiOverview.personalizationPrompts && aiOverview.personalizationPrompts.length > 0)) && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-2 mb-3 border border-amber-200">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-sm">💡</span>
                    <span className="text-[10px] font-semibold text-amber-800 uppercase">Personal Touch</span>
                  </div>

                  {/* Last Interaction - Compact */}
                  {aiOverview.lastInteraction && (
                    <div className="text-xs mb-2 pb-2 border-b border-amber-200">
                      <span className="text-amber-700 font-medium">Last: </span>
                      <span className="text-gray-700">
                        {new Date(aiOverview.lastInteraction.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {aiOverview.lastInteraction.agentName && ` by ${aiOverview.lastInteraction.agentName}`}
                        {" - "}{aiOverview.lastInteraction.summary.substring(0, 60)}...
                      </span>
                    </div>
                  )}

                  {/* Life Events - Compact */}
                  {aiOverview.lifeEvents && aiOverview.lifeEvents.length > 0 && (
                    <div className="space-y-1">
                      {aiOverview.lifeEvents.slice(0, 2).map((event, i) => (
                        <div key={i} className="text-xs">
                          <span>{event.icon} {event.event}</span>
                          <span className="text-amber-600 italic ml-1">"{event.followUpQuestion}"</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Personalization Prompts (if no life events) */}
                  {(!aiOverview.lifeEvents || aiOverview.lifeEvents.length === 0) && aiOverview.personalizationPrompts && aiOverview.personalizationPrompts.length > 0 && (
                    <ul className="space-y-0.5 text-xs">
                      {aiOverview.personalizationPrompts.slice(0, 2).map((prompt, i) => (
                        <li key={i} className="text-gray-700">• {prompt}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* ===== DEEP THINK SECTION - Collapsible ===== */}
              {deepThinkLoading && (
                <div className="bg-purple-50 rounded p-2 mb-2 border border-purple-200 text-xs">
                  <span className="animate-pulse">🧠</span> AI analyzing past calls...
                </div>
              )}

              {deepThinkData?.foundData && deepThinkData.insights && (
                <details className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg mb-3 border border-purple-200">
                  <summary className="p-2 cursor-pointer text-xs font-medium text-purple-800 flex items-center gap-1.5">
                    <span>🧠</span> Deep Think
                    <span className="bg-purple-100 text-purple-700 px-1 py-0.5 rounded text-[10px]">
                      {deepThinkData.insights.transcriptsAnalyzed} calls
                    </span>
                  </summary>
                  <div className="px-2 pb-2 text-xs space-y-1.5">
                    {/* Key Topics */}
                    {deepThinkData.insights.keyTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {deepThinkData.insights.keyTopics.slice(0, 4).map((topic, i) => (
                          <span key={i} className="bg-purple-100 text-purple-700 px-1 py-0.5 rounded text-[10px]">
                            {topic}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Talking Points */}
                    {deepThinkData.insights.suggestedTalkingPoints.slice(0, 2).map((point, i) => (
                      <div key={i} className="text-gray-600 italic">"{point}"</div>
                    ))}
                  </div>
                </details>
              )}

              {/* ===== CUSTOMER INTEL - Collapsible ===== */}
              {customerIntelLoading && (
                <div className="bg-emerald-50 rounded p-2 mb-2 border border-emerald-200 text-xs">
                  <span className="animate-pulse">📚</span> Loading knowledge...
                </div>
              )}

              {customerIntel && customerIntel.factCount > 0 && (
                <details className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg mb-3 border border-emerald-200">
                  <summary className="p-2 cursor-pointer text-xs font-medium text-emerald-800 flex items-center gap-1.5">
                    <span>📚</span> Knowledge
                    <span className="bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded text-[10px]">
                      {customerIntel.factCount} facts
                    </span>
                    {customerIntel.personality && (
                      <span className="text-gray-600 font-normal ml-1">
                        {customerIntel.personality.primaryType}
                      </span>
                    )}
                  </summary>
                  <div className="px-2 pb-2 text-xs">
                    {customerIntel.personality?.communicationTips?.[0] && (
                      <div className="text-emerald-700 mb-1">💬 {customerIntel.personality.communicationTips[0]}</div>
                    )}
                    <div className="space-y-0.5 text-gray-600">
                      {Object.entries(customerIntel.facts).slice(0, 2).flatMap(([_, facts]) =>
                        facts.slice(0, 2).map((f, i) => (
                          <div key={i}>• {f.fact}</div>
                        ))
                      ).slice(0, 3)}
                    </div>
                  </div>
                </details>
              )}

              {/* AI Insights Panel - Compact */}
              {profileLoading ? (
                <div className="bg-gray-100 rounded p-2 mb-3 animate-pulse">
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                </div>
              ) : aiLoading ? (
                <div className="bg-blue-50 rounded p-2 mb-3 text-xs text-blue-700">
                  <span className="animate-spin">🤖</span> Loading insights...
                </div>
              ) : aiOverview ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-2 mb-3 border border-blue-100">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-sm">🤖</span>
                    <span className="text-[10px] font-semibold text-blue-800 uppercase">AI Insights</span>
                  </div>

                  {/* Summary - Compact */}
                  <p className="text-xs text-gray-700 mb-2 line-clamp-2">{aiOverview.summary}</p>

                  {/* Combined Tips/Gaps/Opportunities - Very Compact */}
                  <div className="space-y-1 text-xs">
                    {aiOverview.agentTips?.[0] && (
                      <div className="text-blue-700">💡 {aiOverview.agentTips[0]}</div>
                    )}
                    {aiOverview.coverageGaps?.[0] && (
                      <div className="text-amber-700">⚠️ {aiOverview.coverageGaps[0].recommendation}</div>
                    )}
                    {aiOverview.crossSellOpportunities?.[0] && (
                      <div className="text-green-700">💰 {aiOverview.crossSellOpportunities[0].product}</div>
                    )}
                  </div>
                </div>
              ) : null}

              {/* Recent Notes - Collapsible */}
              {profile?.notes && profile.notes.length > 0 && (
                <details className="mb-3">
                  <summary className="text-[10px] font-semibold text-gray-500 uppercase cursor-pointer mb-1">
                    📝 Recent Notes ({profile.notes.length})
                  </summary>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {profile.notes.slice(0, 3).map((note, i) => (
                      <div key={i} className="bg-white rounded border p-1.5 text-[11px]">
                        <div className="text-gray-400 mb-0.5">
                          {note.createdAt ? new Date(note.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                          {note.createdBy?.name && ` • ${note.createdBy.name}`}
                        </div>
                        <p className="text-gray-700 line-clamp-2">{note.content?.substring(0, 100)}</p>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Quick Policies Summary - Collapsible */}
              {profile?.policies && profile.policies.length > 0 && (
                <details className="mb-3" open>
                  <summary className="text-[10px] font-semibold text-gray-500 uppercase cursor-pointer mb-1.5">
                    📋 Policies ({profile.activePolicyCount})
                  </summary>
                  <div className="space-y-1">
                    {profile.policies.filter(p => p.status === "active").slice(0, 3).map((policy, i) => (
                      <div key={i} className="bg-white rounded border p-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-medium flex items-center gap-1">
                            <span>{profile.activePolicyTypes?.find(pt => pt.type === policy.type)?.emoji || "📋"}</span>
                            {policy.type.charAt(0).toUpperCase() + policy.type.slice(1)}
                          </span>
                          <span className="text-gray-500">
                            ${policy.premium?.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 truncate">
                          {typeof policy.carrier === 'string' ? policy.carrier : policy.carrier?.name} • #{policy.policyNumber}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Action Buttons - Compact */}
              <div className="flex flex-wrap gap-1.5">
                {customerLookup?.agencyzoomId && (
                  <AgencyZoomButton
                    href={getAgencyZoomUrl(customerLookup.agencyzoomId, "customer")}
                    variant="outline"
                    size="sm"
                  />
                )}
                <button
                  onClick={openCustomerProfile}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center gap-1"
                >
                  👤 Profile
                </button>
                <CanopyConnectSMS
                  customerPhone={phoneNumber}
                  customerName={customerLookup?.name?.split(' ')[0]}
                  customerId={customerLookup?.id}
                  variant="outline"
                  size="sm"
                />
              </div>

              {/* Customer Assist Cards - Renewals, Open Items, Activity */}
              {profile && (
                <CustomerAssistCards profile={profile} className="mt-4" />
              )}
            </div>
          )}
        </div>

        {/* ===== RIGHT PANEL - Transcript & Notes ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">
          
          {/* Tab Switcher - Compact */}
          <div className="flex border-b bg-gray-50">
            <button
              onClick={() => setActiveTab("overview")}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium",
                activeTab === "overview"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              📝 Transcript
            </button>
            <button
              onClick={() => setActiveTab("assist")}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium relative",
                activeTab === "assist"
                  ? "border-b-2 border-purple-500 text-purple-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              🎯 Assist
              {(matchedPlaybook || aiSuggestions.length > 0) && activeTab !== "assist" && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={cn(
                "flex-1 px-2 py-1.5 text-xs font-medium",
                activeTab === "notes"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              📋 Notes
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "overview" && (
              <div className="h-full flex flex-col">
                <TranscriptView segments={transcript} className="flex-1" />
                {coaching && (
                  <CoachingTip suggestion={coaching} onDismiss={() => {}} />
                )}
              </div>
            )}
            
            {activeTab === "assist" && (
              <div className="h-full overflow-y-auto">
                <LiveAssistCard
                  playbook={matchedPlaybook}
                  suggestions={aiSuggestions}
                  isLoading={assistLoading}
                  onUseSuggestion={handleUseSuggestion}
                  onDismissSuggestion={handleDismissSuggestion}
                  onPlaybookFeedback={handlePlaybookFeedback}
                />
              </div>
            )}

            {activeTab === "notes" && (
              <div className="h-full flex flex-col p-2">
                <div className="text-[10px] font-semibold text-gray-500 uppercase mb-1">
                  Call Notes
                </div>
                <textarea
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Type notes during the call..."
                  className="flex-1 w-full p-2 border rounded resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
                />

                {/* Post destinations and button */}
                <div className="mt-1.5 flex items-center justify-between">
                  <div className="text-[10px] text-gray-500 flex items-center gap-2">
                    {profile?.hawksoftId && (
                      <span className="flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        HS
                      </span>
                    )}
                    {profile?.agencyzoomId && (
                      <span className="flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                        AZ
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handlePostNotes}
                    disabled={!draftNotes.trim() || postingNotes}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                      notePosted
                        ? "bg-green-500 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    )}
                  >
                    {postingNotes ? "..." : notePosted ? "✓" : "Post"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== FOOTER - Compact ===== */}
      <div className="border-t bg-gray-50 px-3 py-1.5 flex items-center justify-between">
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab("notes")}
            className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 flex items-center gap-1"
          >
            📝 Note
          </button>
          <button className="px-2 py-1 text-xs bg-white border rounded hover:bg-gray-50 flex items-center gap-1">
            🎫 Task
          </button>
        </div>
        <div className="flex gap-1.5">
          {customerLookup && (
            <button
              onClick={openCustomerProfile}
              className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200"
            >
              👤 Profile
            </button>
          )}
          <button
            onClick={() => setShowWrapUp(true)}
            className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            📋 Wrap-Up
          </button>
        </div>
      </div>

      {/* ===== WRAP-UP MODAL ===== */}
      {showWrapUp && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90%] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">📋</span>
                <div>
                  <h2 className="font-semibold">Call Wrap-Up</h2>
                  <p className="text-xs text-gray-400">
                    {profile?.name || customerLookup?.name || phoneNumber} • {formatDuration(callDuration)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWrapUp(false)}
                className="p-2 hover:bg-gray-700 rounded"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* AI Summary Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-2">
                    <span>🤖</span> AI Call Summary
                  </h3>
                  {!wrapupLoading && wrapupData && (
                    <button
                      onClick={fetchWrapupData}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Refresh
                    </button>
                  )}
                </div>

                {wrapupLoading ? (
                  <div className="bg-blue-50 rounded-lg p-4 flex items-center gap-3">
                    <span className="animate-spin text-xl">🔄</span>
                    <span className="text-blue-700">Loading wrap-up data...</span>
                  </div>
                ) : wrapupStatus === "pending_transcript" ? (
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="animate-pulse">⏳</span>
                        <span className="font-medium text-amber-800">Waiting for Transcript</span>
                      </div>
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <span className="animate-spin">↻</span> Auto-checking...
                      </span>
                    </div>
                    <p className="text-sm text-amber-700">
                      The call transcript is being fetched from the phone system.
                      This will update automatically when ready.
                    </p>
                  </div>
                ) : wrapupStatus === "pending_processing" ? (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="animate-pulse">🤖</span>
                        <span className="font-medium text-blue-800">AI Processing</span>
                      </div>
                      <span className="text-xs text-blue-600 flex items-center gap-1">
                        <span className="animate-spin">↻</span> Auto-checking...
                      </span>
                    </div>
                    <p className="text-sm text-blue-700">
                      The transcript is being analyzed by AI. The summary will appear automatically.
                    </p>
                  </div>
                ) : wrapupData ? (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                    {/* Summary */}
                    <p className="text-gray-700 mb-3">
                      {wrapupData.aiCleanedSummary || wrapupData.summary || "No summary available"}
                    </p>

                    {/* Request Type & Insurance Type */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {wrapupData.requestType && (
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          wrapupData.requestType.toLowerCase().includes("claim") && "bg-red-100 text-red-700",
                          wrapupData.requestType.toLowerCase().includes("quote") && "bg-green-100 text-green-700",
                          wrapupData.requestType.toLowerCase().includes("billing") && "bg-amber-100 text-amber-700",
                          !["claim", "quote", "billing"].some(t => wrapupData.requestType?.toLowerCase().includes(t)) && "bg-gray-100 text-gray-700"
                        )}>
                          {wrapupData.requestType}
                        </span>
                      )}
                      {wrapupData.insuranceType && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {wrapupData.insuranceType}
                        </span>
                      )}
                      {wrapupData.aiConfidence && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          {Math.round(wrapupData.aiConfidence * 100)}% confidence
                        </span>
                      )}
                    </div>

                    {/* Policy Numbers */}
                    {wrapupData.policyNumbers && wrapupData.policyNumbers.length > 0 && (
                      <div className="text-sm mb-3">
                        <span className="text-gray-500">Policies: </span>
                        <span className="text-gray-700 font-mono">
                          {wrapupData.policyNumbers.join(", ")}
                        </span>
                      </div>
                    )}

                    {/* AI Extraction Data */}
                    {wrapupData.aiExtraction && typeof wrapupData.aiExtraction === 'object' && (
                      <div className="mt-3 pt-3 border-t border-blue-100">
                        <div className="text-xs font-medium text-gray-500 mb-2">Extracted Data:</div>
                        <div className="text-sm text-gray-600 space-y-1">
                          {Object.entries(wrapupData.aiExtraction).slice(0, 5).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-gray-400">{key}:</span>
                              <span>{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-600">
                      No AI summary available yet. You can write notes manually below.
                    </p>
                  </div>
                )}
              </div>

              {/* Editable Notes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 uppercase mb-2">
                  📝 Call Notes
                </label>
                <textarea
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Edit the AI-generated note or write your own..."
                  rows={4}
                  className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="text-xs text-gray-500 mt-1">
                  This note will be posted to {profile?.hawksoftId ? "HawkSoft" : ""}{profile?.hawksoftId && profile?.agencyzoomId ? " and " : ""}{profile?.agencyzoomId ? "AgencyZoom" : ""}
                  {!profile?.hawksoftId && !profile?.agencyzoomId && "customer record"}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 uppercase mb-2">
                  Quick Actions
                </label>
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1">
                    📅 Schedule Follow-up
                  </button>
                  <button className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1">
                    🎫 Create Task
                  </button>
                  <button className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-1">
                    📧 Send Email
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowWrapUp(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    handlePostNotes();
                    setShowWrapUp(false);
                    onClose();
                  }}
                  disabled={!draftNotes.trim() || postingNotes}
                  className={cn(
                    "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
                    "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  )}
                >
                  {postingNotes ? "Posting..." : "Post Notes & Close"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
