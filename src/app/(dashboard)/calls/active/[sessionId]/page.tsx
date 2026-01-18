"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useCallWebSocket } from "@/hooks/useCallWebSocket";
import TranscriptView from "@/components/features/TranscriptView";
import CoachingTip, { CoachingTipCompact } from "@/components/features/CoachingTip";
import LiveAssistCard from "@/components/features/LiveAssistCard";
import CustomerAssistCards from "@/components/features/CustomerAssistCards";
import LeadAssistCards from "@/components/features/LeadAssistCards";
import { MergedProfile } from "@/types/customer-profile";
import { Playbook, AgentSuggestion, TelemetryFeedback } from "@/lib/agent-assist/types";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { AgencyZoomButton, getAgencyZoomUrl } from "@/components/ui/agencyzoom-link";
import { HawkSoftButton } from "@/components/ui/hawksoft-link";
import { CanopyConnectSMS } from "@/components/CanopyConnectSMS";
import { useCall } from "@/components/providers/CallProvider";

// =============================================================================
// TYPES
// =============================================================================

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

const CLIENT_LEVEL_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  A: { label: "Standard", emoji: "", color: "bg-slate-100 text-slate-700" },
  AA: { label: "Premier", emoji: "", color: "bg-blue-100 text-blue-700" },
  AAA: { label: "Premier", emoji: "", color: "bg-amber-100 text-amber-700" },
};

// =============================================================================
// COLLAPSIBLE SECTION COMPONENT
// =============================================================================

interface CollapsibleSectionProps {
  title: string;
  icon: string;
  badge?: string;
  defaultExpanded?: boolean;
  headerClassName?: string;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  badge,
  defaultExpanded = false,
  headerClassName,
  children,
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors",
          headerClassName || "bg-gray-50 hover:bg-gray-100"
        )}
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <span className="text-gray-500 text-sm">{isExpanded ? '▲' : '▼'}</span>
      </button>
      {isExpanded && <div className="mt-2">{children}</div>}
    </div>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ActiveCallPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  // Get active call info from CallProvider
  const { activeCall, closePopup } = useCall();

  // UI State
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "assist">("overview");
  const [callDuration, setCallDuration] = useState(0);

  // Call Data State
  const [callData, setCallData] = useState<{
    phoneNumber: string;
    direction: "inbound" | "outbound";
    status: string;
    extension?: string;
    startedAt?: string;
  } | null>(null);
  const [callLoading, setCallLoading] = useState(true);

  // Live Assist State
  const [matchedPlaybook, setMatchedPlaybook] = useState<Playbook | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<AgentSuggestion[]>([]);
  const [assistLoading, setAssistLoading] = useState(false);
  const lastTranscriptLength = useRef(0);

  // Data State
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

  // Deep Think State
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

  // Customer Intelligence State
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
  const [endingCall, setEndingCall] = useState(false);

  // WebSocket for transcript and coaching
  const { transcript, coaching, callStatus, isConnected } = useCallWebSocket(sessionId, true);

  // Derived values
  const phoneNumber = callData?.phoneNumber || activeCall?.phoneNumber || "";
  const direction = callData?.direction || activeCall?.direction || "inbound";
  const effectiveCallStatus = callData?.status || activeCall?.status || callStatus;

  // =========================================================================
  // Load call data from API
  // =========================================================================
  useEffect(() => {
    const loadCallData = async () => {
      setCallLoading(true);
      try {
        const res = await fetch(`/api/calls/${sessionId}`);
        const data = await res.json();

        if (data.success && data.call) {
          setCallData({
            phoneNumber: data.call.direction === "inbound"
              ? data.call.fromNumber
              : data.call.toNumber,
            direction: data.call.direction,
            status: data.call.status,
            extension: data.call.extension,
            startedAt: data.call.startedAt,
          });

          // Calculate duration from startedAt
          if (data.call.startedAt) {
            const start = new Date(data.call.startedAt).getTime();
            setCallDuration(Math.floor((Date.now() - start) / 1000));
          }
        }
      } catch (err) {
        console.error("Failed to load call data:", err);
        setError("Failed to load call data");
      } finally {
        setCallLoading(false);
      }
    };

    if (sessionId) {
      loadCallData();
    }
  }, [sessionId]);

  // =========================================================================
  // Call duration timer
  // =========================================================================
  useEffect(() => {
    if (effectiveCallStatus === "ended" || effectiveCallStatus === "completed") return;

    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [effectiveCallStatus]);

  // =========================================================================
  // Poll call status (fallback for reliable call end detection)
  // =========================================================================
  useEffect(() => {
    if (effectiveCallStatus === "ended" || effectiveCallStatus === "completed") return;

    const pollStatus = async () => {
      try {
        const res = await fetch(`/api/calls/${sessionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.call?.status === "completed" || data.call?.status === "missed" || data.call?.endedAt) {
            console.log(`[ActiveCallPage] DB shows call ended: ${data.call.status}`);
            setCallData(prev => prev ? { ...prev, status: "completed" } : null);
          }
        }
      } catch (e) {
        // Ignore errors
      }
    };

    const interval = setInterval(pollStatus, 3000);
    return () => clearInterval(interval);
  }, [sessionId, effectiveCallStatus]);

  // =========================================================================
  // Customer lookup
  // =========================================================================
  useEffect(() => {
    if (!phoneNumber) return;

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
  }, [phoneNumber]);

  // =========================================================================
  // Load MergedProfile
  // =========================================================================
  useEffect(() => {
    if (!customerLookup?.hawksoftId && !customerLookup?.agencyzoomId) return;

    const loadProfile = async () => {
      setProfileLoading(true);

      try {
        const params = new URLSearchParams();
        if (customerLookup.hawksoftId) params.set("hsId", customerLookup.hawksoftId);
        if (customerLookup.agencyzoomId) params.set("azId", customerLookup.agencyzoomId);

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
  // Load AI Overview
  // =========================================================================
  useEffect(() => {
    if (!profile) return;

    const loadAIOverview = async () => {
      setAiLoading(true);

      try {
        const recentNotes = profile.notes?.slice(0, 5).map((n) => ({
          content: n.content || "",
          createdAt: n.createdAt || "",
          createdBy: n.createdBy?.name || "Agent",
        }));

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
  // Deep Think (after 2+ minutes)
  // =========================================================================
  useEffect(() => {
    if (
      effectiveCallStatus === "ended" ||
      effectiveCallStatus === "completed" ||
      !customerLookup?.id ||
      deepThinkTriggered.current ||
      callDuration < 120
    ) {
      return;
    }

    deepThinkTriggered.current = true;
    setDeepThinkLoading(true);

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
        }
      } catch (err) {
        console.error("[ActiveCall] Deep Think error:", err);
      } finally {
        setDeepThinkLoading(false);
      }
    };

    runDeepThink();
  }, [effectiveCallStatus, customerLookup, callDuration, phoneNumber, sessionId]);

  // =========================================================================
  // Customer Intelligence
  // =========================================================================
  useEffect(() => {
    if (!customerLookup?.id) return;

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
        console.error("[ActiveCall] Customer intel error:", err);
      } finally {
        setCustomerIntelLoading(false);
      }
    };

    loadCustomerIntel();
  }, [customerLookup?.id]);

  // =========================================================================
  // Live Assist
  // =========================================================================
  useEffect(() => {
    if (callStatus === "ended") return;

    const transcriptText = transcript.map(s => s.text).join(" ");

    if (transcriptText.length - lastTranscriptLength.current < 100) return;
    lastTranscriptLength.current = transcriptText.length;

    const timeoutId = setTimeout(async () => {
      setAssistLoading(true);

      try {
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
        }

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
        }
      } catch (err) {
        console.error("Live Assist fetch error:", err);
      } finally {
        setAssistLoading(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [transcript, callStatus, direction, profile]);

  // =========================================================================
  // Handlers
  // =========================================================================
  const handleUseSuggestion = useCallback((suggestion: AgentSuggestion) => {
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

    setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, []);

  const handleDismissSuggestion = useCallback((suggestion: AgentSuggestion) => {
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

  const handlePostNotes = useCallback(async () => {
    if (!draftNotes.trim() || !profile) return;

    setPostingNotes(true);

    try {
      const promises = [];

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
        // Clear the active call state in CallProvider
        closePopup();
        router.push("/");
      } else {
        setCallControlError(data.error || "Failed to end call");
        setTimeout(() => setCallControlError(null), 5000);
      }
    } catch (err) {
      setCallControlError("Network error - could not reach server");
      setTimeout(() => setCallControlError(null), 5000);
    } finally {
      setEndingCall(false);
    }
  }, [sessionId, router, closePopup]);

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
      } else {
        setCallControlError(data.error || `Failed to ${action} call`);
        setTimeout(() => setCallControlError(null), 5000);
      }
    } catch (err) {
      setCallControlError("Network error - could not reach server");
      setTimeout(() => setCallControlError(null), 5000);
    } finally {
      setHoldLoading(false);
    }
  }, [sessionId, isOnHold]);

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
        setShowTransferDropdown(false);
        router.push("/");
      }
    } catch (err) {
      console.error("[ActiveCall] Transfer error:", err);
    } finally {
      setTransferring(false);
    }
  }, [sessionId, router]);

  // Load team members for transfer
  useEffect(() => {
    if (!showTransferDropdown) return;

    const loadTeam = async () => {
      try {
        const res = await fetch("/api/3cx/presence");
        const data = await res.json();
        if (data.success && data.team) {
          setTeamMembers(data.team);
        }
      } catch (err) {
        console.error("[ActiveCall] Failed to load team for transfer:", err);
      }
    };

    loadTeam();
  }, [showTransferDropdown]);

  // Fetch wrapup data
  const fetchWrapupData = useCallback(async () => {
    setWrapupLoading(true);
    try {
      console.log(`[Wrapup] Fetching data for session ${sessionId}`);
      const res = await fetch(`/api/wrapups/${sessionId}`);

      // Handle HTTP errors
      if (!res.ok) {
        console.error(`[Wrapup] API returned ${res.status}`);
        setWrapupStatus("error");
        return;
      }

      const data = await res.json();
      console.log(`[Wrapup] Response:`, { success: data.success, status: data.status, hasWrapup: data.hasWrapup });

      if (data.success) {
        setWrapupStatus(data.status);

        if (data.hasWrapup && data.wrapup) {
          setWrapupData(data.wrapup);
          if (data.wrapup.aiCleanedSummary && !draftNotes) {
            setDraftNotes(data.wrapup.aiCleanedSummary);
          } else if (data.wrapup.summary && !draftNotes) {
            setDraftNotes(data.wrapup.summary);
          }
        }
      } else {
        // API returned success: false - set error state
        console.error(`[Wrapup] API error:`, data.error);
        setWrapupStatus("error");
      }
    } catch (err) {
      console.error("[Wrapup] Failed to fetch wrapup data:", err);
      setWrapupStatus("error");
    } finally {
      setWrapupLoading(false);
    }
  }, [sessionId, draftNotes]);

  useEffect(() => {
    if (showWrapUp && !wrapupData && !wrapupLoading) {
      fetchWrapupData();
    }
  }, [showWrapUp, wrapupData, wrapupLoading, fetchWrapupData]);

  // Auto-poll for transcript/processing when in pending state
  useEffect(() => {
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

  const handleBackToDashboard = () => {
    // Don't close the call, just navigate back - minimized bar will show
    router.push("/");
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  if (callLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin text-4xl">Loading call...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white">
      {/* ===== HEADER ===== */}
      <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Back Button */}
          <button
            onClick={handleBackToDashboard}
            className="p-2 hover:bg-gray-700 rounded-lg flex items-center gap-2 text-sm"
          >
            <span>Back</span>
          </button>

          <div className="h-8 w-px bg-gray-700" />

          <div>
            <div className="font-semibold flex items-center gap-2">
              <span className="text-xs uppercase text-gray-400">
                {direction === "inbound" ? "INCOMING" : "OUTGOING"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">{phoneNumber}</span>
              {customerLookup && (
                <span className="text-gray-400">
                  ({customerLookup.name})
                </span>
              )}
            </div>
            <div className="text-sm text-gray-400 flex items-center gap-3">
              <span className="text-xl font-mono">{formatDuration(callDuration)}</span>
              <span className={cn(
                "px-2 py-0.5 rounded text-xs",
                isOnHold && "bg-amber-500 text-white animate-pulse",
                !isOnHold && effectiveCallStatus === "connected" && "bg-green-600",
                !isOnHold && effectiveCallStatus === "in_progress" && "bg-green-600",
                !isOnHold && effectiveCallStatus === "ringing" && "bg-yellow-600",
                (effectiveCallStatus === "ended" || effectiveCallStatus === "completed") && "bg-gray-600"
              )}>
                {isOnHold ? "ON HOLD" : effectiveCallStatus}
              </span>
              {isConnected && <span className="text-green-400">Live</span>}
            </div>
            {callControlError && (
              <div className="text-xs text-red-400 bg-red-900/50 px-2 py-1 rounded mt-1">
                {callControlError}
              </div>
            )}
          </div>
        </div>

        {/* Call Controls */}
        <div className="flex items-center gap-2">
          {effectiveCallStatus !== "ended" && effectiveCallStatus !== "completed" && (
            <>
              {/* Hold/Resume */}
              <button
                onClick={handleHoldToggle}
                disabled={holdLoading}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                  isOnHold
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : "bg-gray-600 hover:bg-gray-500 text-white"
                )}
              >
                {holdLoading ? "..." : isOnHold ? "Resume" : "Hold"}
              </button>

              {/* Transfer */}
              <div className="relative">
                <button
                  onClick={() => setShowTransferDropdown(!showTransferDropdown)}
                  disabled={transferring}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium"
                >
                  {transferring ? "..." : "Transfer"}
                </button>

                {showTransferDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-700">
                      Transfer to:
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {teamMembers.length === 0 ? (
                        <div className="px-4 py-6 text-sm text-gray-500 text-center">
                          Loading team...
                        </div>
                      ) : (
                        teamMembers.map((member) => (
                          <button
                            key={member.id}
                            onClick={() => handleTransfer(member.extension)}
                            disabled={member.status === "offline"}
                            className={cn(
                              "w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors",
                              member.status === "offline" && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <span className={cn(
                              "w-3 h-3 rounded-full flex-shrink-0",
                              member.status === "available" && "bg-green-500",
                              member.status === "on_call" && "bg-red-500",
                              member.status === "away" && "bg-yellow-500",
                              member.status === "dnd" && "bg-red-600",
                              member.status === "offline" && "bg-gray-400"
                            )} />
                            <span className="flex-1 text-gray-900">
                              {member.name}
                            </span>
                            <span className="text-sm text-gray-500">
                              ext {member.extension}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="px-4 py-2 bg-gray-50 border-t">
                      <button
                        onClick={() => setShowTransferDropdown(false)}
                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* End Call */}
              <button
                onClick={handleEndCall}
                disabled={endingCall}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-sm font-medium"
              >
                {endingCall ? "..." : "End Call"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">

        {/* ===== LEFT PANEL - Customer Info ===== */}
        <div className="w-96 border-r border-gray-200 overflow-y-auto bg-gray-50">

          {lookupLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin text-2xl">Loading customer...</div>
            </div>
          ) : error ? (
            <div className="p-4 text-red-600 text-sm">{error}</div>
          ) : !customerLookup ? (
            // NO MATCH - Unknown caller
            <div className="p-6">
              <div className="text-center mb-6">
                <div className="text-5xl mb-3">?</div>
                <h3 className="font-semibold text-xl">Unknown Caller</h3>
                <p className="text-gray-500">{phoneNumber}</p>
              </div>

              <LeadAssistCards
                phoneNumber={phoneNumber}
                onCreateLead={() => {
                  window.open("/leads/new", "_blank");
                }}
                onStartQuote={(quoteType) => {
                  window.open(`/quote/new?type=${quoteType}`, "_blank");
                }}
              />
            </div>
          ) : (
            // CUSTOMER FOUND
            <div className="p-6">

              {/* Customer Header */}
              <div className="mb-6">
                <div className="flex flex-wrap gap-2 mb-3">
                  {profile?.clientLevel && (
                    <span className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium",
                      CLIENT_LEVEL_CONFIG[profile.clientLevel]?.color || "bg-gray-100 text-gray-700"
                    )}>
                      {CLIENT_LEVEL_CONFIG[profile.clientLevel]?.emoji} {profile.clientLevel} - {CLIENT_LEVEL_CONFIG[profile.clientLevel]?.label}
                    </span>
                  )}
                  {profile?.isOG && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
                      OG
                    </span>
                  )}
                </div>

                <h2 className="font-bold text-2xl text-gray-900">
                  {profile?.preferredName || profile?.name || customerLookup.name}
                </h2>

                {profile?.customerSince && (
                  <div className="text-sm text-gray-500 mt-1">
                    Customer since {new Date(profile.customerSince).getFullYear()}
                  </div>
                )}

                {profile?.activePolicyTypes && profile.activePolicyTypes.length > 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    {profile.activePolicyTypes.map((pt, i) => (
                      <span key={i} className="text-xl" title={`${pt.type} (${pt.count})`}>
                        {pt.emoji}
                      </span>
                    ))}
                    <span className="ml-2 text-lg font-medium text-gray-700">
                      ${profile.totalPremium?.toLocaleString()}/yr
                    </span>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-2 text-sm mb-6 pb-6 border-b">
                <div className="flex items-center gap-2">
                  <span>Phone:</span>
                  <span>{profile?.contact?.phone || customerLookup.phone}</span>
                </div>
                {profile?.contact?.email && (
                  <div className="flex items-center gap-2">
                    <span>Email:</span>
                    <span className="truncate">{profile.contact.email}</span>
                  </div>
                )}
              </div>

              {/* Personalization Section - Collapsible */}
              {aiOverview && (aiOverview.lastInteraction || (aiOverview.lifeEvents && aiOverview.lifeEvents.length > 0)) && (
                <CollapsibleSection
                  title="Personal Touch"
                  icon="💛"
                  badge={aiOverview.lifeEvents?.length ? `${aiOverview.lifeEvents.length} events` : undefined}
                  defaultExpanded={false}
                  headerClassName="bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200"
                >
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-200">
                    {aiOverview.lastInteraction && (
                      <div className="mb-3 pb-3 border-b border-amber-200">
                        <div className="text-xs text-amber-700 font-medium mb-2">Last Contact:</div>
                        <div className="text-sm text-gray-800 font-medium">
                          {new Date(aiOverview.lastInteraction.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {aiOverview.lastInteraction.agentName && (
                            <span className="text-gray-500 font-normal"> by {aiOverview.lastInteraction.agentName}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {aiOverview.lastInteraction.summary}
                        </p>
                      </div>
                    )}

                    {aiOverview.lifeEvents && aiOverview.lifeEvents.length > 0 && (
                      <div>
                        <div className="text-xs text-amber-700 font-medium mb-2">Life Events to Mention:</div>
                        <div className="space-y-2">
                          {aiOverview.lifeEvents.slice(0, 3).map((event, i) => (
                            <div key={i} className="bg-white/60 rounded p-3 border border-amber-100">
                              <div className="flex items-center gap-2 mb-1">
                                <span>{event.icon}</span>
                                <span className="font-medium text-gray-800">{event.event}</span>
                              </div>
                              <p className="text-sm text-amber-700 italic pl-6">
                                "{event.followUpQuestion}"
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Deep Think Section - Collapsible */}
              {deepThinkLoading && (
                <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 mb-4 border border-purple-200">
                  <div className="flex items-center gap-2">
                    <span className="animate-pulse">🧠 AI Deep Think analyzing past calls...</span>
                  </div>
                </div>
              )}

              {deepThinkData?.foundData && deepThinkData.insights && (
                <CollapsibleSection
                  title="AI Deep Think"
                  icon="🧠"
                  badge={`${deepThinkData.insights.transcriptsAnalyzed} calls`}
                  defaultExpanded={false}
                  headerClassName="bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border border-purple-200"
                >
                  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-200">
                    <div className="text-sm text-purple-700 font-medium mb-3">
                      Found data from {deepThinkData.insights.dateRange.oldest} - {deepThinkData.insights.dateRange.newest}
                    </div>

                    {deepThinkData.insights.keyTopics.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs text-purple-700 font-medium mb-2">Topics discussed:</div>
                        <div className="flex flex-wrap gap-2">
                          {deepThinkData.insights.keyTopics.slice(0, 5).map((topic, i) => (
                            <span key={i} className="text-sm bg-purple-100 text-purple-700 px-2 py-1 rounded">
                              {topic}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {deepThinkData.insights.suggestedTalkingPoints.length > 0 && (
                      <div className="border-t border-purple-200 pt-3 mt-3">
                        <div className="text-xs text-purple-700 font-medium mb-2">Suggested talking points:</div>
                        <ul className="space-y-1">
                          {deepThinkData.insights.suggestedTalkingPoints.slice(0, 3).map((point, i) => (
                            <li key={i} className="text-sm text-gray-700 italic">
                              "{point}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* AI Insights - Collapsible */}
              {aiOverview && (
                <CollapsibleSection
                  title="AI Insights"
                  icon="✨"
                  badge={aiOverview.coverageGaps?.length ? `${aiOverview.coverageGaps.length} gaps` : undefined}
                  defaultExpanded={true}
                  headerClassName="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-100"
                >
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                    <p className="text-sm text-gray-700 mb-4">{aiOverview.summary}</p>

                    {aiOverview.agentTips && aiOverview.agentTips.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-blue-700 mb-2">Tips</div>
                        <ul className="space-y-1">
                          {aiOverview.agentTips.slice(0, 3).map((tip, i) => (
                            <li key={i} className="text-sm text-gray-600">
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiOverview.coverageGaps && aiOverview.coverageGaps.length > 0 && (
                      <div className="mb-3">
                        <div className="text-xs font-medium text-amber-700 mb-2">Coverage Gaps</div>
                        <ul className="space-y-1">
                          {aiOverview.coverageGaps.slice(0, 2).map((gap, i) => (
                            <li key={i} className="text-sm text-gray-600">
                              {gap.recommendation}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Policies */}
              {profile?.policies && profile.policies.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                    Active Policies ({profile.activePolicyCount})
                  </h3>
                  <div className="space-y-2">
                    {profile.policies.filter(p => p.status === "active").slice(0, 4).map((policy, i) => (
                      <div key={i} className="bg-white rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium flex items-center gap-2">
                            <span>{profile.activePolicyTypes?.find(pt => pt.type === policy.type)?.emoji}</span>
                            {policy.type.charAt(0).toUpperCase() + policy.type.slice(1)}
                          </span>
                          <span className="text-sm text-gray-500">
                            ${policy.premium?.toLocaleString()}/yr
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {typeof policy.carrier === 'string' ? policy.carrier : policy.carrier?.name} #{policy.policyNumber}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {customerLookup?.agencyzoomId && (
                  <AgencyZoomButton
                    href={getAgencyZoomUrl(customerLookup.agencyzoomId, "customer")}
                    variant="default"
                    size="md"
                    className="w-full justify-center"
                  />
                )}
                {customerLookup?.hawksoftId && (
                  <HawkSoftButton
                    clientCode={customerLookup.hawksoftId}
                    variant="default"
                    size="md"
                    className="w-full justify-center"
                  />
                )}

                <button
                  onClick={openCustomerProfile}
                  className="w-full px-4 py-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-2"
                >
                  Open Full Profile
                </button>

                <CanopyConnectSMS
                  customerPhone={phoneNumber}
                  customerName={customerLookup?.name?.split(' ')[0]}
                  customerId={customerLookup?.id}
                  variant="outline"
                  size="default"
                  className="w-full justify-center"
                />
              </div>

              {profile && (
                <CustomerAssistCards profile={profile} className="mt-6" />
              )}
            </div>
          )}
        </div>

        {/* ===== RIGHT PANEL - Transcript & Notes ===== */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Tab Switcher */}
          <div className="flex border-b bg-gray-50">
            <button
              onClick={() => setActiveTab("overview")}
              className={cn(
                "flex-1 px-6 py-4 text-sm font-medium",
                activeTab === "overview"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Transcript
            </button>
            <button
              onClick={() => setActiveTab("assist")}
              className={cn(
                "flex-1 px-6 py-4 text-sm font-medium relative",
                activeTab === "assist"
                  ? "border-b-2 border-purple-500 text-purple-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Assist
              {(matchedPlaybook || aiSuggestions.length > 0) && activeTab !== "assist" && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={cn(
                "flex-1 px-6 py-4 text-sm font-medium",
                activeTab === "notes"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              Notes
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
              <div className="h-full flex flex-col p-6">
                <div className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  Call Notes
                </div>
                <textarea
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Type notes during the call... These will be posted to HawkSoft and AgencyZoom."
                  className="flex-1 w-full p-4 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />

                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-500 flex items-center gap-4">
                    {profile?.hawksoftId && (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        HawkSoft
                      </span>
                    )}
                    {profile?.agencyzoomId && (
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        AgencyZoom
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handlePostNotes}
                    disabled={!draftNotes.trim() || postingNotes}
                    className={cn(
                      "px-6 py-3 rounded-lg font-medium transition-colors",
                      notePosted
                        ? "bg-green-500 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    )}
                  >
                    {postingNotes ? "Posting..." : notePosted ? "Posted!" : "Post Notes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
        <div className="flex gap-3">
          <button
            onClick={() => setActiveTab("notes")}
            className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50"
          >
            Add Note
          </button>
          <button className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50">
            Create Task
          </button>
        </div>
        <div className="flex gap-3">
          {customerLookup?.agencyzoomId && (
            <AgencyZoomButton
              href={getAgencyZoomUrl(customerLookup.agencyzoomId, "customer")}
              variant="outline"
              size="md"
            />
          )}
          {customerLookup?.hawksoftId && (
            <HawkSoftButton
              clientCode={customerLookup.hawksoftId}
              variant="outline"
              size="md"
            />
          )}
          {customerLookup && (
            <button
              onClick={openCustomerProfile}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Full Profile
            </button>
          )}
          <button
            onClick={() => setShowWrapUp(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Wrap-Up
          </button>
        </div>
      </div>

      {/* ===== WRAP-UP MODAL ===== */}
      {showWrapUp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90%] overflow-hidden flex flex-col">
            <div className="bg-gray-900 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-lg">Call Wrap-Up</h2>
                <p className="text-sm text-gray-400">
                  {profile?.name || customerLookup?.name || phoneNumber} {formatDuration(callDuration)}
                </p>
              </div>
              <button
                onClick={() => setShowWrapUp(false)}
                className="p-2 hover:bg-gray-700 rounded"
              >
                X
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* AI Summary */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">
                  AI Call Summary
                </h3>

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
                ) : wrapupStatus === "error" ? (
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span className="font-medium text-red-800">Failed to Load Summary</span>
                      </div>
                      <button
                        onClick={fetchWrapupData}
                        className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
                      >
                        <span>↻</span> Try Again
                      </button>
                    </div>
                    <p className="text-sm text-red-700">
                      Could not load the AI summary. You can still enter notes manually below.
                    </p>
                  </div>
                ) : wrapupData ? (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
                    <p className="text-gray-700 mb-3">
                      {wrapupData.aiCleanedSummary || wrapupData.summary || "No summary available"}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {wrapupData.requestType && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {wrapupData.requestType}
                        </span>
                      )}
                      {wrapupData.insuranceType && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {wrapupData.insuranceType}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 border">
                    <p className="text-sm text-gray-600">
                      No AI summary available yet. You can write notes manually below.
                    </p>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 uppercase mb-2">
                  Call Notes
                </label>
                <textarea
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Edit the AI-generated note or write your own..."
                  rows={4}
                  className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
              <button
                onClick={() => setShowWrapUp(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handlePostNotes();
                  setShowWrapUp(false);
                  router.push("/");
                }}
                disabled={!draftNotes.trim() || postingNotes}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              >
                {postingNotes ? "Posting..." : "Post Notes & Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
