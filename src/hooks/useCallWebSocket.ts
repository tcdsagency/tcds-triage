import { useEffect, useState, useRef } from "react";

// Types
export interface TranscriptSegment {
  speaker: "agent" | "customer" | "system";
  text: string;
  timestamp: number;
  confidence?: number;
  isFinal?: boolean;
  segmentId?: string;
}

export interface CoachingSuggestion {
  type: "tip" | "warning" | "opportunity" | "compliance";
  label: string;
  message: string;
}

export type CallStatus = "ringing" | "connected" | "on_hold" | "wrap_up" | "ended";

interface WebSocketMessage {
  type: string;
  sessionId: string;
  [key: string]: any;
}

// Mock mode for development
const MOCK_MODE = process.env.NODE_ENV === "development";

// Mock data
const MOCK_TRANSCRIPT: TranscriptSegment[] = [
  {
    speaker: "agent",
    text: "Hi Sarah, thanks for calling TCDS Insurance, how can I help you today?",
    timestamp: Date.now() - 60000,
    isFinal: true
  },
  {
    speaker: "customer",
    text: "Hi, I need to add my daughter to my auto policy",
    timestamp: Date.now() - 50000,
    isFinal: true
  },
  {
    speaker: "agent",
    text: "Of course! I can help with that. Let me pull up your policy...",
    timestamp: Date.now() - 40000,
    isFinal: true
  },
  {
    speaker: "customer",
    text: "She just got her license last week",
    timestamp: Date.now() - 30000,
    isFinal: true
  }
];

const MOCK_COACHING: CoachingSuggestion = {
  type: "tip",
  label: "Good Student Discount",
  message: "Ask about good student discount - new drivers under 25 with B average get 10-15% off"
};

/**
 * Custom hook for managing WebSocket connection to call transcription service
 * 
 * @param sessionId - Unique call session ID for filtering events
 * @param enabled - Whether to establish WebSocket connection
 * @returns Transcript segments, coaching suggestions, and call status
 */
export function useCallWebSocket(sessionId: string, enabled: boolean = true) {
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [coaching, setCoaching] = useState<CoachingSuggestion | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>("ringing");
  const [isConnected, setIsConnected] = useState(false);
  
  const wsRef = useRef<WebSocket | null>(null);
  const coachingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    // Mock mode for development/testing
    if (MOCK_MODE) {
      console.log("[useCallWebSocket] Running in MOCK_MODE");
      
      setTranscript(MOCK_TRANSCRIPT);
      setCallStatus("connected");
      setIsConnected(true);

      // Simulate coaching tip after 2 seconds
      const timeout = setTimeout(() => {
        setCoaching(MOCK_COACHING);
        
        // Auto-dismiss after 30 seconds
        coachingTimeoutRef.current = setTimeout(() => {
          setCoaching(null);
        }, 30000);
      }, 2000);

      return () => {
        clearTimeout(timeout);
        if (coachingTimeoutRef.current) {
          clearTimeout(coachingTimeoutRef.current);
        }
      };
    }

    // Real WebSocket connection to Google VM
    const connectWebSocket = () => {
      try {
        // Connect to the real-time server on Google VM (SSL via nginx)
        const wsUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL || 'wss://realtime.tcdsagency.com/ws/calls';
        
        console.log(`[useCallWebSocket] Connecting to ${wsUrl}`);
        
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[useCallWebSocket] WebSocket connected");
          setIsConnected(true);
          setCallStatus("connected");
          reconnectAttemptsRef.current = 0;
          
          // Subscribe to this session
          ws.send(JSON.stringify({
            type: 'subscribe',
            sessionId: sessionId,
          }));
          console.log(`[useCallWebSocket] Subscribed to session ${sessionId}`);
        };

        ws.onmessage = (event) => {
          try {
            const data: WebSocketMessage = JSON.parse(event.data);
            
            // Filter to only this session
            if (data.sessionId !== sessionId) {
              return;
            }

            console.log(`[useCallWebSocket] Received event:`, data.type);

            switch (data.type) {
              case "transcript_segment":
                handleTranscriptSegment(data);
                break;

              case "coaching_suggestion":
                handleCoachingSuggestion(data);
                break;

              case "call_started":
                setCallStatus("connected");
                break;

              case "call_updated":
                if (data.status) {
                  setCallStatus(data.status);
                }
                break;

              case "call_ended":
                setCallStatus("ended");
                break;

              default:
                console.log(`[useCallWebSocket] Unknown event type: ${data.type}`);
            }
          } catch (error) {
            console.error("[useCallWebSocket] Error parsing message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("[useCallWebSocket] WebSocket error:", error);
          setIsConnected(false);
        };

        ws.onclose = (event) => {
          console.log(`[useCallWebSocket] WebSocket closed (code: ${event.code})`);
          setIsConnected(false);
          
          // Attempt to reconnect (max 5 attempts)
          if (reconnectAttemptsRef.current < 5) {
            reconnectAttemptsRef.current++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
            
            console.log(`[useCallWebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, delay);
          } else {
            console.error("[useCallWebSocket] Max reconnection attempts reached");
          }
        };
      } catch (error) {
        console.error("[useCallWebSocket] Error creating WebSocket:", error);
      }
    };

    const handleTranscriptSegment = (data: any) => {
      setTranscript(prev => {
        // Deduplicate by segmentId if provided
        if (data.segmentId) {
          const exists = prev.some(seg => seg.segmentId === data.segmentId);
          if (exists) {
            console.log(`[useCallWebSocket] Duplicate segment ignored: ${data.segmentId}`);
            return prev;
          }
        }

        const newSegment: TranscriptSegment = {
          speaker: data.speaker,
          text: data.text,
          timestamp: data.timestamp || Date.now(),
          confidence: data.confidence,
          isFinal: data.isFinal !== false, // Default to true
          segmentId: data.segmentId
        };

        return [...prev, newSegment];
      });
    };

    const handleCoachingSuggestion = (data: any) => {
      const suggestion: CoachingSuggestion = {
        type: data.suggestion?.type || data.type || "tip",
        label: data.suggestion?.label || data.label || "Suggestion",
        message: data.suggestion?.message || data.message || ""
      };

      setCoaching(suggestion);

      // Clear existing timeout
      if (coachingTimeoutRef.current) {
        clearTimeout(coachingTimeoutRef.current);
      }

      // Auto-dismiss after 30 seconds
      coachingTimeoutRef.current = setTimeout(() => {
        setCoaching(null);
      }, 30000);
    };

    // Connect WebSocket
    connectWebSocket();

    // Cleanup
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (coachingTimeoutRef.current) {
        clearTimeout(coachingTimeoutRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [sessionId, enabled]);

  return {
    transcript,
    coaching,
    callStatus,
    isConnected
  };
}
