"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Plus,
  Send,
  Upload,
  X,
  FileText,
  MessageSquare,
  Loader2,
} from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface Session {
  id: string;
  title: string;
  mode: "general" | "document";
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  citations?: { documentId: string; documentName: string; chunkIndex: number; excerpt: string }[] | null;
  createdAt: string;
}

interface UploadedDocument {
  id: string;
  filename: string;
  chunkCount: number;
  status: "processing" | "ready" | "error";
}

// =============================================================================
// SHORTCUT BUTTONS
// =============================================================================

const SHORTCUTS = [
  "Summarize policy changes",
  "Explain endorsement in plain English",
  "Create insurance-safe customer email",
  "Generate submission narrative",
  "Create endorsement checklist",
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function AssistantPage() {
  // State
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<"general" | "document">("general");
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const res = await fetch("/api/ai/assistant/sessions");
      const data = await res.json();
      if (data.success) {
        setSessions(data.sessions);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const loadMessages = useCallback(async (sessionId: string) => {
    setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/ai/assistant/sessions/${sessionId}`);
      const data = await res.json();
      if (data.success) {
        setMessages(data.messages);
        setMode(data.session.mode);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const selectSession = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      setStreamingText("");
      loadMessages(sessionId);
    },
    [loadMessages]
  );

  const createSession = async () => {
    try {
      const res = await fetch("/api/ai/assistant/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (data.success) {
        setSessions((prev) => [data.session, ...prev]);
        setActiveSessionId(data.session.id);
        setMessages([]);
        setDocuments([]);
        setStreamingText("");
        inputRef.current?.focus();
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || !activeSessionId || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    setStreamingText("");

    // Optimistically add user message
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      sessionId: activeSessionId,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: messageText,
          mode,
          documentIds: documents.filter((d) => d.status === "ready").map((d) => d.id),
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to send message");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      let accumulated = "";
      let citations: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "chunk") {
              accumulated += event.text;
              setStreamingText(accumulated);
            } else if (event.type === "done") {
              citations = event.citations || [];
            } else if (event.type === "error") {
              console.error("Stream error:", event.message);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Add assistant message
      const assistantMsg: Message = {
        id: `temp-${Date.now()}-assistant`,
        sessionId: activeSessionId,
        role: "assistant",
        content: accumulated,
        citations:
          citations.length > 0
            ? citations.map((name) => ({
                documentId: "",
                documentName: name,
                chunkIndex: 0,
                excerpt: "",
              }))
            : null,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingText("");

      // Refresh sessions to get updated title
      loadSessions();
    } catch (error) {
      console.error("Failed to send message:", error);
      setStreamingText("");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    // Add optimistic doc
    const tempDoc: UploadedDocument = {
      id: `temp-${Date.now()}`,
      filename: file.name,
      chunkCount: 0,
      status: "processing",
    };
    setDocuments((prev) => [...prev, tempDoc]);

    try {
      const res = await fetch("/api/ai/assistant/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === tempDoc.id ? data.document : d))
        );
      } else {
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === tempDoc.id ? { ...d, status: "error" as const } : d
          )
        );
      }
    } catch {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === tempDoc.id ? { ...d, status: "error" as const } : d
        )
      );
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0">
      {/* Left sidebar - Sessions */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-800/50">
        <div className="p-3">
          <button
            onClick={createSession}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {isLoadingSessions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">
              No chats yet
            </p>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => selectSession(session.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeSessionId === session.id
                    ? "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
              >
                <div className="truncate font-medium">{session.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {session.messageCount} messages
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              AI Assistant
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden text-sm">
              <button
                onClick={() => setMode("general")}
                className={`px-3 py-1.5 transition-colors ${
                  mode === "general"
                    ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                General
              </button>
              <button
                onClick={() => setMode("document")}
                className={`px-3 py-1.5 transition-colors ${
                  mode === "document"
                    ? "bg-purple-600 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Document Q&A
              </button>
            </div>

            {/* Upload button (document mode only) */}
            {mode === "document" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>
              </>
            )}
          </div>
        </div>

        {/* Document chips */}
        {documents.length > 0 && (
          <div className="flex flex-wrap gap-2 px-6 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            {documents.map((doc) => (
              <span
                key={doc.id}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                  doc.status === "ready"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                    : doc.status === "processing"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                }`}
              >
                <FileText className="w-3 h-3" />
                {doc.filename}
                {doc.status === "processing" && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                <button
                  onClick={() => removeDocument(doc.id)}
                  className="hover:opacity-70"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {!activeSessionId ? (
            // No session selected
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="w-12 h-12 text-purple-300 dark:text-purple-600 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                How can I help?
              </h2>
              <p className="text-sm text-gray-400 mb-6 max-w-md">
                Start a new chat to ask insurance questions, draft customer
                communications, or analyze documents.
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {SHORTCUTS.map((shortcut) => (
                  <button
                    key={shortcut}
                    onClick={async () => {
                      await createSession();
                    }}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                  >
                    {shortcut}
                  </button>
                ))}
              </div>
            </div>
          ) : isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 && !streamingText ? (
            // Empty session
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-400 mb-4">
                {mode === "document"
                  ? "Upload a document and ask questions about it."
                  : "Ask me anything about insurance."}
              </p>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg">
                {SHORTCUTS.map((shortcut) => (
                  <button
                    key={shortcut}
                    onClick={() => sendMessage(shortcut)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
                  >
                    {shortcut}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    }`}
                  >
                    <div className="text-sm whitespace-pre-wrap">
                      {msg.content}
                    </div>
                    {msg.role === "assistant" &&
                      msg.citations &&
                      msg.citations.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                            Sources:
                          </p>
                          {msg.citations.map((c, i) => (
                            <span
                              key={i}
                              className="inline-block text-xs bg-gray-200 dark:bg-gray-600 rounded px-1.5 py-0.5 mr-1 mb-1"
                            >
                              {c.documentName}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
              ))}

              {/* Streaming message */}
              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[75%] rounded-xl px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    <div className="text-sm whitespace-pre-wrap">
                      {streamingText}
                    </div>
                  </div>
                </div>
              )}

              {/* Streaming indicator */}
              {isStreaming && !streamingText && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-4 py-3 bg-gray-100 dark:bg-gray-700">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !activeSessionId
                  ? "Start a new chat first..."
                  : "Type your message..."
              }
              disabled={!activeSessionId || isStreaming}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage()}
              disabled={!activeSessionId || !input.trim() || isStreaming}
              className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
