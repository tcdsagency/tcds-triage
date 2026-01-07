"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface TranscriptSegment {
  speaker: "agent" | "customer" | "system";
  text: string;
  timestamp: number;
  confidence?: number;
  isFinal?: boolean;
  segmentId?: string;
}

interface TranscriptViewProps {
  segments: TranscriptSegment[];
  className?: string;
}

/**
 * Scrolling transcript view with color-coded speakers
 * Auto-scrolls to bottom when new segments arrive
 */
export default function TranscriptView({ segments, className }: TranscriptViewProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new segments arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [segments]);

  if (segments.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-full", className)}>
        <div className="text-center text-gray-500">
          <p className="text-sm">Waiting for transcript...</p>
          <p className="text-xs mt-1">Transcription will appear here once the call starts</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-y-auto space-y-3 p-4", className)}>
      {segments.map((segment, idx) => (
        <TranscriptBubble key={segment.segmentId || idx} segment={segment} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

interface TranscriptBubbleProps {
  segment: TranscriptSegment;
}

function TranscriptBubble({ segment }: TranscriptBubbleProps) {
  const { speaker, text, timestamp, confidence, isFinal } = segment;

  // System messages (centered, italic, gray)
  if (speaker === "system") {
    return (
      <div className="flex justify-center">
        <div className="text-xs italic text-gray-500">
          {text}
        </div>
      </div>
    );
  }

  // Agent and customer messages (bubbles)
  const isAgent = speaker === "agent";
  
  return (
    <div className={cn(
      "flex",
      isAgent ? "justify-start" : "justify-end"
    )}>
      <div className={cn(
        "max-w-[80%] rounded-lg px-3 py-2 text-sm transition-opacity",
        isAgent && "bg-blue-100 text-blue-900",
        !isAgent && "bg-green-100 text-green-900",
        !isFinal && "opacity-60"
      )}>
        {/* Speaker label */}
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs font-semibold">
            {isAgent ? "🔵 Agent" : "🟢 Customer"}
          </span>
          {confidence !== undefined && (
            <span className="text-xs opacity-60">
              ({Math.round(confidence * 100)}%)
            </span>
          )}
          {!isFinal && (
            <span className="text-xs opacity-60">...</span>
          )}
        </div>

        {/* Message text */}
        <div className="leading-relaxed">
          {text}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <div className="text-xs opacity-50 mt-1">
            {new Date(timestamp).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit',
              second: '2-digit'
            })}
          </div>
        )}
      </div>
    </div>
  );
}
