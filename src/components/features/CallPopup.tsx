"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCallWebSocket } from "@/hooks/useCallWebSocket";
import TranscriptView from "./TranscriptView";
import CoachingTip, { CoachingTipCompact } from "./CoachingTip";
import LiveAssistCard, { LiveAssistCompact } from "./LiveAssistCard";
import { MergedProfile } from "@/types/customer-profile";
import { Playbook, AgentSuggestion, TelemetryFeedback } from "@/lib/agent-assist/types";
import { AgentAvatar } from "@/components/ui/agent-avatar";

// =============================================================================
// TYPES
// =============================================================================

interface CallPopupProps {
  sessionId: string;
  phoneNumber: string;
  direction: "inbound" | "outbound";
  isVisible: boolean;
  onClose: () => void;
  onMinimize: () => void;
}

interface CustomerLookup {
  id: string;
  hawksoftId?: string;
  agencyzoomId?: string;
  name: string;
  phone: string;
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
  onMinimize
}: CallPopupProps) {
  // UI State
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "notes" | "assist">("overview");
  const [callDuration, setCallDuration] = useState(0);

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

  // Wrap-Up State
  const [showWrapUp, setShowWrapUp] = useState(false);
  const [wrapupLoading, setWrapupLoading] = useState(false);
  const [wrapupStatus, setWrapupStatus] = useState<string | null>(null);

  // End Call State
  const [endingCall, setEndingCall] = useState(false);
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
  // Call duration timer
  // =========================================================================
  useEffect(() => {
    if (!isVisible || callStatus === "ended") return;

    const interval = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible, callStatus]);

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
    try {
      const res = await fetch(`/api/calls/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });

      if (res.ok) {
        // Close the popup after ending the call
        onClose();
      } else {
        console.error("Failed to end call:", await res.text());
      }
    } catch (err) {
      console.error("Error ending call:", err);
    } finally {
      setEndingCall(false);
    }
  }, [sessionId, onClose]);

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
  return (
    <div className="fixed inset-4 md:inset-auto md:top-4 md:right-4 md:w-[900px] md:h-[700px] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      
      {/* ===== HEADER ===== */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={cn(
            "text-lg",
            direction === "inbound" ? "text-green-400" : "text-blue-400"
          )}>
            {direction === "inbound" ? "📞" : "📱"}
          </span>
          <div>
            <div className="font-semibold">
              {direction === "inbound" ? "INCOMING" : "OUTGOING"}: {phoneNumber}
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <span>{formatDuration(callDuration)}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-xs",
                callStatus === "connected" && "bg-green-600",
                callStatus === "ringing" && "bg-yellow-600",
                callStatus === "ended" && "bg-gray-600"
              )}>
                {callStatus}
              </span>
              {isConnected && <span className="text-green-400">● Live</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {callStatus !== "ended" && (
            <button
              onClick={handleEndCall}
              disabled={endingCall}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded text-sm font-medium flex items-center gap-1"
              title="End Call"
            >
              {endingCall ? "⏳" : "📞"} End Call
            </button>
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
        <div className="w-80 border-r border-gray-200 overflow-y-auto bg-gray-50">
          
          {lookupLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin text-2xl">⏳</div>
            </div>
          ) : error ? (
            <div className="p-4 text-red-600 text-sm">{error}</div>
          ) : !customerLookup ? (
            // NO MATCH - Unknown caller
            <div className="p-6 text-center">
              <div className="text-5xl mb-3">❓</div>
              <h3 className="font-semibold text-lg mb-1">Unknown Caller</h3>
              <p className="text-gray-500 mb-4">{phoneNumber}</p>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                Create Lead
              </button>
            </div>
          ) : (
            // CUSTOMER FOUND - Show MergedProfile data
            <div className="p-4">
              
              {/* Customer Header with Badges (same as CustomerProfilePage) */}
              <div className="mb-4">
                {/* Badges Row */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {profile?.clientLevel && (
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      CLIENT_LEVEL_CONFIG[profile.clientLevel]?.color || "bg-gray-100 text-gray-700"
                    )}>
                      {CLIENT_LEVEL_CONFIG[profile.clientLevel]?.emoji} {profile.clientLevel} - {CLIENT_LEVEL_CONFIG[profile.clientLevel]?.label}
                    </span>
                  )}
                  {profile?.isOG && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                      🌟 OG
                    </span>
                  )}
                </div>
                
                {/* Name - Bold and prominent */}
                <h2 className="font-bold text-xl text-gray-900">
                  {profile?.preferredName || profile?.name || customerLookup.name}
                </h2>
                {profile?.preferredName && profile.preferredName !== profile.name && (
                  <div className="text-sm text-gray-500">
                    Legal: {profile.name}
                  </div>
                )}
                
                {/* Customer Since */}
                {profile?.customerSince && (
                  <div className="text-sm text-gray-500 mt-1">
                    Customer since {new Date(profile.customerSince).getFullYear()}
                  </div>
                )}
                
                {/* Policy Types with Emojis (same as CustomerProfilePage) */}
                {profile?.activePolicyTypes && profile.activePolicyTypes.length > 0 && (
                  <div className="flex items-center gap-1 mt-2">
                    {profile.activePolicyTypes.map((pt, i) => (
                      <span key={i} className="text-lg" title={`${pt.type} (${pt.count})`}>
                        {pt.emoji}
                      </span>
                    ))}
                    <span className="ml-2 text-sm font-medium text-gray-700">
                      ${profile.totalPremium?.toLocaleString()}/yr
                    </span>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="space-y-1.5 text-sm mb-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <span>📞</span>
                  <span>{profile?.contact?.phone || customerLookup.phone}</span>
                </div>
                {profile?.contact?.email && (
                  <div className="flex items-center gap-2">
                    <span>✉️</span>
                    <span className="truncate">{profile.contact.email}</span>
                  </div>
                )}
              </div>

              {/* AI Insights Panel (same data as CustomerProfilePage Overview) */}
              {profileLoading ? (
                <div className="bg-gray-100 rounded-lg p-3 mb-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ) : aiLoading ? (
                <div className="bg-blue-50 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2 text-blue-700">
                    <span className="animate-spin">🤖</span>
                    <span className="text-sm">Loading AI insights...</span>
                  </div>
                </div>
              ) : aiOverview ? (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-3 mb-4 border border-blue-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span>🤖</span>
                    <span className="text-xs font-semibold text-blue-800 uppercase">AI Insights</span>
                  </div>
                  
                  {/* Summary */}
                  <p className="text-sm text-gray-700 mb-3">{aiOverview.summary}</p>
                  
                  {/* Agent Tips */}
                  {aiOverview.agentTips && aiOverview.agentTips.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-blue-700 mb-1">💡 Tips</div>
                      <ul className="space-y-1">
                        {aiOverview.agentTips.slice(0, 3).map((tip, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                            <span className="text-blue-400">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Coverage Gaps */}
                  {aiOverview.coverageGaps && aiOverview.coverageGaps.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-medium text-amber-700 mb-1">⚠️ Coverage Gaps</div>
                      <ul className="space-y-1">
                        {aiOverview.coverageGaps.slice(0, 2).map((gap, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                            <span className="text-amber-400">•</span>
                            {gap.recommendation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Cross-sell Opportunities */}
                  {aiOverview.crossSellOpportunities && aiOverview.crossSellOpportunities.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-green-700 mb-1">💰 Opportunities</div>
                      <ul className="space-y-1">
                        {aiOverview.crossSellOpportunities.slice(0, 2).map((opp, i) => (
                          <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                            <span className="text-green-400">•</span>
                            {opp.product}: {opp.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Recent Notes from AgencyZoom */}
              {profile?.notes && profile.notes.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    📝 Recent Notes
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {profile.notes.slice(0, 5).map((note, i) => (
                      <div key={i} className="bg-white rounded border p-2 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-500">
                            {note.createdAt
                              ? new Date(note.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })
                              : ""}
                          </span>
                          <div className="flex items-center gap-1">
                            <AgentAvatar name={note.createdBy?.name} size="xs" />
                            <span className="text-gray-400">{note.createdBy?.name || "Agent"}</span>
                          </div>
                        </div>
                        <p className="text-gray-700 line-clamp-2">
                          {note.content?.substring(0, 150)}
                          {(note.content?.length || 0) > 150 ? "..." : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Policies Summary */}
              {profile?.policies && profile.policies.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Active Policies ({profile.activePolicyCount})
                  </h3>
                  <div className="space-y-2">
                    {profile.policies.filter(p => p.status === "active").slice(0, 4).map((policy, i) => (
                      <div key={i} className="bg-white rounded border p-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium flex items-center gap-1">
                            <span>{profile.activePolicyTypes?.find(pt => pt.type === policy.type)?.emoji || "📋"}</span>
                            {policy.type.charAt(0).toUpperCase() + policy.type.slice(1)}
                          </span>
                          <span className="text-xs text-gray-500">
                            ${policy.premium?.toLocaleString()}/yr
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {typeof policy.carrier === 'string' ? policy.carrier : policy.carrier?.name} • #{policy.policyNumber}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open Full Profile Button */}
              <button
                onClick={openCustomerProfile}
                className="w-full px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-2"
              >
                <span>👤</span>
                Open Full Profile
              </button>
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
                "flex-1 px-4 py-2 text-sm font-medium",
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
                "flex-1 px-4 py-2 text-sm font-medium relative",
                activeTab === "assist"
                  ? "border-b-2 border-purple-500 text-purple-600"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              🎯 Assist
              {(matchedPlaybook || aiSuggestions.length > 0) && activeTab !== "assist" && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("notes")}
              className={cn(
                "flex-1 px-4 py-2 text-sm font-medium",
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
              <div className="h-full flex flex-col p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Call Notes
                </div>
                <textarea
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Type notes during the call... These will be posted to HawkSoft and AgencyZoom."
                  className="flex-1 w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />

                {/* Post destinations and button */}
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-500 flex items-center gap-3">
                    {profile?.hawksoftId && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                        HawkSoft
                      </span>
                    )}
                    {profile?.agencyzoomId && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        AgencyZoom
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handlePostNotes}
                    disabled={!draftNotes.trim() || postingNotes}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      notePosted
                        ? "bg-green-500 text-white"
                        : "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    )}
                  >
                    {postingNotes ? "Posting..." : notePosted ? "✓ Posted!" : "Post Notes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div className="border-t bg-gray-50 px-4 py-3 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("notes")}
            className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-1"
          >
            📝 Add Note
          </button>
          <button className="px-4 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-1">
            🎫 Create Task
          </button>
        </div>
        <div className="flex gap-2">
          {customerLookup && (
            <button
              onClick={openCustomerProfile}
              className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              👤 Full Profile
            </button>
          )}
          <button
            onClick={() => setShowWrapUp(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
