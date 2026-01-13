"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Send, Phone, User, MoreVertical, Plus, Check, CheckCheck,
  Clock, AlertCircle, MessageSquare, Settings, ChevronDown, Paperclip,
  Smile, Image as ImageIcon, X, RefreshCw, ArrowDownLeft, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CanopyConnectSMS } from "@/components/CanopyConnectSMS";

// Types from API
interface SMSMessage {
  id: string;
  type: "sms" | "mms";
  direction: "inbound" | "outbound";
  fromNumber: string;
  toNumber: string;
  body: string;
  mediaUrls: string[];
  contactId: string | null;
  contactName: string | null;
  contactType: string | null;
  isAcknowledged: boolean;
  acknowledgedAt: string | null;
  acknowledgedById: string | null;
  acknowledgedByName: string | null;
  isAfterHours: boolean;
  sentAt: string | null;
  createdAt: string;
}

// Grouped conversation
interface Conversation {
  id: string;
  contact: {
    id: string;
    name: string;
    phone: string;
    email?: string;
    type: "customer" | "lead";
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: SMSMessage[];
}

const QUICK_REPLIES = [
  "Thanks for reaching out! How can I help you today?",
  "I'll look into that and get back to you shortly.",
  "Would you like to schedule a call to discuss further?",
  "Your policy has been updated. Is there anything else I can help with?",
  "I've sent the quote to your email. Let me know if you have questions!",
];

// Format phone number for display
const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone;
};

// Group messages by phone number into conversations
const groupIntoConversations = (messages: SMSMessage[]): Conversation[] => {
  const convMap = new Map<string, Conversation>();

  messages.forEach((msg) => {
    // Use the other party's phone number as the conversation key
    const phone = msg.direction === 'inbound' ? msg.fromNumber : msg.toNumber;
    const normalizedPhone = phone.replace(/\D/g, '');

    if (!convMap.has(normalizedPhone)) {
      // Treat "undefined undefined" as null (legacy data cleanup)
      const validName = msg.contactName && msg.contactName !== "undefined undefined"
        ? msg.contactName
        : null;
      convMap.set(normalizedPhone, {
        id: normalizedPhone,
        contact: {
          id: msg.contactId || normalizedPhone,
          name: validName || formatPhone(phone),
          phone: formatPhone(phone),
          type: (msg.contactType as 'customer' | 'lead') || 'lead',
        },
        lastMessage: msg.body,
        lastMessageTime: msg.createdAt,
        unreadCount: 0,
        messages: [],
      });
    }

    const conv = convMap.get(normalizedPhone)!;
    conv.messages.push(msg);

    // Update unread count
    if (msg.direction === 'inbound' && !msg.isAcknowledged) {
      conv.unreadCount++;
    }

    // Update last message if newer
    if (new Date(msg.createdAt) > new Date(conv.lastMessageTime)) {
      conv.lastMessage = msg.body;
      conv.lastMessageTime = msg.createdAt;
    }
  });

  // Sort messages within each conversation
  convMap.forEach((conv) => {
    conv.messages.sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  });

  // Sort conversations by last message time (newest first)
  return Array.from(convMap.values()).sort(
    (a, b) =>
      new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
  );
};

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const phoneParam = searchParams.get('phone');
  const nameParam = searchParams.get('name');
  const customerIdParam = searchParams.get('customerId');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [phoneFromUrl, setPhoneFromUrl] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch current user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.id) {
          setCurrentUser({
            id: data.user.id,
            name: `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim() || 'Unknown',
          });
        }
      })
      .catch(err => console.error('Failed to fetch current user:', err));
  }, []);

  // Track phone from URL on mount
  useEffect(() => {
    if (phoneParam) {
      setPhoneFromUrl(phoneParam.replace(/\D/g, ''));
    }
  }, [phoneParam]);

  // Fetch messages from API
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/messages?filter=all&limit=500');
      const data = await res.json();
      if (data.success) {
        const grouped = groupIntoConversations(data.messages);
        setConversations(grouped);
        setUnreadTotal(data.unreadCount);

        // If phone from URL, try to find and select that conversation
        if (phoneFromUrl) {
          const matchedConv = grouped.find(c => c.id === phoneFromUrl || c.id.endsWith(phoneFromUrl));
          if (matchedConv) {
            setSelectedConversation(matchedConv);
            setPhoneFromUrl(null); // Clear so we don't keep re-selecting
            return;
          }
          // If no existing conversation, create a new one for this phone
          const newConv: Conversation = {
            id: phoneFromUrl,
            contact: {
              id: customerIdParam || phoneFromUrl,
              name: nameParam || formatPhone(phoneFromUrl),
              phone: formatPhone(phoneFromUrl),
              type: customerIdParam ? 'customer' : 'lead',
            },
            lastMessage: '',
            lastMessageTime: new Date().toISOString(),
            unreadCount: 0,
            messages: [],
          };
          setConversations([newConv, ...grouped]);
          setSelectedConversation(newConv);
          setPhoneFromUrl(null);
          return;
        }

        // Select first conversation if none selected
        if (!selectedConversation && grouped.length > 0) {
          setSelectedConversation(grouped[0]);
        } else if (selectedConversation) {
          // Update selected conversation with fresh data
          const updated = grouped.find((c) => c.id === selectedConversation.id);
          if (updated) setSelectedConversation(updated);
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedConversation, phoneFromUrl, nameParam, customerIdParam]);

  // Resync contacts for messages with unknown names
  const resyncContacts = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/messages/resync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        console.log(`Resynced contacts: ${data.updated} updated, ${data.skipped} skipped`);
        // Refresh messages to show updated names
        await fetchMessages();
      }
    } catch (error) {
      console.error('Error resyncing contacts:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [phoneFromUrl]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages]);

  const filteredConversations = conversations.filter(conv =>
    conv.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.contact.phone.includes(searchQuery)
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatMessageTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setSending(true);

    try {
      // Get the phone number to send to
      const toPhone = selectedConversation.messages[0]?.direction === 'inbound'
        ? selectedConversation.messages[0].fromNumber
        : selectedConversation.messages[0].toNumber;

      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toPhone,
          message: newMessage,
          contactId: selectedConversation.contact.id,
          contactName: selectedConversation.contact.name,
          contactType: selectedConversation.contact.type,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setNewMessage("");
        // Refresh messages to show the new one
        await fetchMessages();
      } else {
        console.error('Send failed:', data.error);
        alert(`Failed to send: ${data.error}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Acknowledge a message
  const acknowledgeMessage = async (messageId: string) => {
    try {
      const now = new Date().toISOString();
      const acknowledgedBy = currentUser?.name || 'Unknown';
      const acknowledgedById = currentUser?.id || null;

      await fetch(`/api/messages/${messageId}/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: acknowledgedById }),
      });

      // Update local state with acknowledgement info
      const updateMessage = (m: SMSMessage) =>
        m.id === messageId
          ? {
              ...m,
              isAcknowledged: true,
              acknowledgedAt: now,
              acknowledgedById,
              acknowledgedByName: acknowledgedBy,
            }
          : m;

      setConversations(prev =>
        prev.map(conv => ({
          ...conv,
          unreadCount: conv.messages.some(m => m.id === messageId && !m.isAcknowledged)
            ? Math.max(0, conv.unreadCount - 1)
            : conv.unreadCount,
          messages: conv.messages.map(updateMessage),
        }))
      );
      if (selectedConversation) {
        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: prev.messages.map(updateMessage),
        } : null);
      }
      setUnreadTotal(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error acknowledging message:', error);
    }
  };

  const getStatusIcon = (msg: SMSMessage) => {
    if (msg.direction === 'inbound') {
      return msg.isAcknowledged
        ? <CheckCheck className="w-3 h-3 text-blue-500" />
        : <Clock className="w-3 h-3 text-amber-500" />;
    }
    // Outbound messages
    return <CheckCheck className="w-3 h-3 text-gray-400" />;
  };

  return (
    <div className="flex h-[calc(100vh-65px)] bg-gray-50">
      {/* Conversations List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
              {unreadTotal > 0 && (
                <p className="text-xs text-amber-600">{unreadTotal} unread</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={resyncContacts}
                disabled={syncing}
                className="text-gray-500"
                title="Sync contacts"
              >
                <User className={cn("w-4 h-4", syncing && "animate-pulse")} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={fetchMessages}
                className="text-gray-500"
                title="Refresh messages"
              >
                <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={cn(
                  "p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors",
                  selectedConversation?.id === conv.id && "bg-emerald-50 border-l-4 border-l-emerald-600"
                )}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className={cn(
                      "text-white text-sm",
                      conv.contact.type === "lead" ? "bg-amber-500" : "bg-emerald-500"
                    )}>
                      {conv.contact.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 truncate">{conv.contact.name}</span>
                      <span className="text-xs text-gray-500">{formatTime(conv.lastMessageTime)}</span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {conv.contact.type}
                      </Badge>
                      {conv.unreadCount > 0 && (
                        <Badge className="bg-emerald-500 text-white text-xs">
                          {conv.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className={cn(
                  "text-white",
                  selectedConversation.contact.type === "lead" ? "bg-amber-500" : "bg-emerald-500"
                )}>
                  {selectedConversation.contact.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-gray-900">{selectedConversation.contact.name}</h2>
                <p className="text-sm text-gray-500">{selectedConversation.contact.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Phone className="w-4 h-4 mr-2" />
                Call
              </Button>
              <CanopyConnectSMS
                customerPhone={selectedConversation.contact.phone}
                customerName={selectedConversation.contact.name?.split(' ')[0]}
                customerId={selectedConversation.contact.id}
                variant="outline"
                size="sm"
              />
              <Button variant="outline" size="sm">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Mark as unread</DropdownMenuItem>
                  <DropdownMenuItem>Archive conversation</DropdownMenuItem>
                  <DropdownMenuItem>Block number</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {selectedConversation.messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.direction === "outbound" ? "justify-end" : "justify-start"
                )}
              >
                <div className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-2 relative group",
                  msg.direction === "outbound"
                    ? "bg-emerald-600 text-white rounded-br-md"
                    : "bg-white text-gray-900 rounded-bl-md shadow-sm",
                  msg.direction === "inbound" && !msg.isAcknowledged && "ring-2 ring-amber-400"
                )}>
                  {/* Unread indicator */}
                  {msg.direction === "inbound" && !msg.isAcknowledged && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        acknowledgeMessage(msg.id);
                      }}
                      className="absolute -top-2 -right-2 bg-amber-500 text-white p-1 rounded-full hover:bg-amber-600 transition-colors"
                      title="Mark as read"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  )}
                  {/* Media attachments */}
                  {msg.mediaUrls && msg.mediaUrls.length > 0 && (
                    <div className="mb-2 space-y-2">
                      {msg.mediaUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={url}
                            alt={`Attachment ${idx + 1}`}
                            className="max-w-full rounded-lg max-h-64 object-cover hover:opacity-90 transition-opacity"
                            onError={(e) => {
                              // If image fails to load, show a link instead
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                              target.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <span className="hidden text-sm underline">📎 View attachment</span>
                        </a>
                      ))}
                    </div>
                  )}
                  {msg.body && <p>{msg.body}</p>}
                  <div className={cn(
                    "flex items-center justify-end gap-1 mt-1",
                    msg.direction === "outbound" ? "text-emerald-200" : "text-gray-400"
                  )}>
                    <span className="text-xs">{formatMessageTime(msg.createdAt)}</span>
                    {getStatusIcon(msg)}
                  </div>
                  {/* Acknowledgement info for inbound messages */}
                  {msg.direction === "inbound" && msg.isAcknowledged && msg.acknowledgedByName && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 text-right">
                      Acknowledged by {msg.acknowledgedByName}
                      {msg.acknowledgedAt && ` on ${new Date(msg.acknowledgedAt).toLocaleDateString()} at ${new Date(msg.acknowledgedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {showQuickReplies && (
            <div className="px-4 py-2 bg-white border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Quick Replies</span>
                <button onClick={() => setShowQuickReplies(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {QUICK_REPLIES.map((reply, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setNewMessage(reply);
                      setShowQuickReplies(false);
                    }}
                    className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full text-gray-700 transition-colors"
                  >
                    {reply.length > 40 ? reply.slice(0, 40) + '...' : reply}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                  <Paperclip className="w-5 h-5" />
                </button>
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full">
                  <ImageIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setShowQuickReplies(!showQuickReplies)}
                  className={cn(
                    "p-2 hover:bg-gray-100 rounded-full",
                    showQuickReplies ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
              </div>
              <Input
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-500">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No conversation selected</h3>
            <p>Select a conversation to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
}
