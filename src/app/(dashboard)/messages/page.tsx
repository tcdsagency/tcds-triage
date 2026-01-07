"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Search, Send, Phone, User, MoreVertical, Plus, Check, CheckCheck, 
  Clock, AlertCircle, MessageSquare, Settings, ChevronDown, Paperclip,
  Smile, Image as ImageIcon, X, RefreshCw
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

// Types
interface Message {
  id: string;
  content: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  status: "sent" | "delivered" | "read" | "failed";
  sender?: string;
}

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
  messages: Message[];
}

// Mock data
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    contact: { id: "c1", name: "John Smith", phone: "(205) 555-1234", type: "customer" },
    lastMessage: "Thanks for the quote! I'll review it tonight.",
    lastMessageTime: "2024-01-06T14:30:00",
    unreadCount: 2,
    messages: [
      { id: "m1", content: "Hi John, I wanted to follow up on your auto insurance quote.", timestamp: "2024-01-06T10:00:00", direction: "outbound", status: "read" },
      { id: "m2", content: "Hi! Yes, I've been meaning to look at it. What's the total premium?", timestamp: "2024-01-06T10:15:00", direction: "inbound", status: "read" },
      { id: "m3", content: "Your 6-month premium would be $847 for full coverage on both vehicles.", timestamp: "2024-01-06T10:20:00", direction: "outbound", status: "read" },
      { id: "m4", content: "That's actually better than my current rate! Can I bundle with home insurance?", timestamp: "2024-01-06T14:00:00", direction: "inbound", status: "read" },
      { id: "m5", content: "Absolutely! Bundling would save you an additional 15%. Want me to run a home quote?", timestamp: "2024-01-06T14:15:00", direction: "outbound", status: "delivered" },
      { id: "m6", content: "Thanks for the quote! I'll review it tonight.", timestamp: "2024-01-06T14:30:00", direction: "inbound", status: "read" },
    ]
  },
  {
    id: "2",
    contact: { id: "c2", name: "Sarah Johnson", phone: "(205) 555-5678", type: "lead" },
    lastMessage: "When can we schedule a call to discuss?",
    lastMessageTime: "2024-01-06T11:45:00",
    unreadCount: 1,
    messages: [
      { id: "m7", content: "Hi Sarah, thank you for requesting a quote from TCDS Insurance!", timestamp: "2024-01-06T09:00:00", direction: "outbound", status: "read" },
      { id: "m8", content: "Hi! Yes, I'm looking for home insurance for my new house.", timestamp: "2024-01-06T09:30:00", direction: "inbound", status: "read" },
      { id: "m9", content: "Congratulations on the new home! I'd be happy to help. What's the address?", timestamp: "2024-01-06T09:35:00", direction: "outbound", status: "read" },
      { id: "m10", content: "When can we schedule a call to discuss?", timestamp: "2024-01-06T11:45:00", direction: "inbound", status: "read" },
    ]
  },
  {
    id: "3",
    contact: { id: "c3", name: "Mike Williams", phone: "(205) 555-9012", type: "customer" },
    lastMessage: "Got it, thanks!",
    lastMessageTime: "2024-01-05T16:20:00",
    unreadCount: 0,
    messages: [
      { id: "m11", content: "Hi Mike, just a reminder that your policy renews next month.", timestamp: "2024-01-05T15:00:00", direction: "outbound", status: "read" },
      { id: "m12", content: "Thanks for the reminder! Is the rate staying the same?", timestamp: "2024-01-05T16:00:00", direction: "inbound", status: "read" },
      { id: "m13", content: "Your premium is actually going down $12/month due to your claims-free discount!", timestamp: "2024-01-05T16:10:00", direction: "outbound", status: "read" },
      { id: "m14", content: "Got it, thanks!", timestamp: "2024-01-05T16:20:00", direction: "inbound", status: "read" },
    ]
  },
  {
    id: "4",
    contact: { id: "c4", name: "Emily Davis", phone: "(205) 555-3456", type: "lead" },
    lastMessage: "I'll send over the quote details shortly.",
    lastMessageTime: "2024-01-05T10:30:00",
    unreadCount: 0,
    messages: [
      { id: "m15", content: "I'll send over the quote details shortly.", timestamp: "2024-01-05T10:30:00", direction: "outbound", status: "delivered" },
    ]
  },
];

const QUICK_REPLIES = [
  "Thanks for reaching out! How can I help you today?",
  "I'll look into that and get back to you shortly.",
  "Would you like to schedule a call to discuss further?",
  "Your policy has been updated. Is there anything else I can help with?",
  "I've sent the quote to your email. Let me know if you have questions!",
];

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(MOCK_CONVERSATIONS[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    
    // Simulate sending
    const newMsg: Message = {
      id: `m${Date.now()}`,
      content: newMessage,
      timestamp: new Date().toISOString(),
      direction: "outbound",
      status: "sent"
    };
    
    // Update conversation
    const updatedConv = {
      ...selectedConversation,
      messages: [...selectedConversation.messages, newMsg],
      lastMessage: newMessage,
      lastMessageTime: new Date().toISOString()
    };
    
    setConversations(prev => prev.map(c => c.id === updatedConv.id ? updatedConv : c));
    setSelectedConversation(updatedConv);
    setNewMessage("");
    
    // Simulate delivery after delay
    setTimeout(() => {
      const deliveredMsg = { ...newMsg, status: "delivered" as const };
      const deliveredConv = {
        ...updatedConv,
        messages: updatedConv.messages.map(m => m.id === newMsg.id ? deliveredMsg : m)
      };
      setConversations(prev => prev.map(c => c.id === deliveredConv.id ? deliveredConv : c));
      setSelectedConversation(deliveredConv);
      setSending(false);
    }, 1000);
  };

  const getStatusIcon = (status: Message["status"]) => {
    switch (status) {
      case "sent": return <Check className="w-3 h-3 text-gray-400" />;
      case "delivered": return <CheckCheck className="w-3 h-3 text-gray-400" />;
      case "read": return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case "failed": return <AlertCircle className="w-3 h-3 text-red-500" />;
    }
  };

  return (
    <div className="flex h-[calc(100vh-65px)] bg-gray-50">
      {/* Conversations List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
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
                  "max-w-[70%] rounded-2xl px-4 py-2",
                  msg.direction === "outbound"
                    ? "bg-emerald-600 text-white rounded-br-md"
                    : "bg-white text-gray-900 rounded-bl-md shadow-sm"
                )}>
                  <p>{msg.content}</p>
                  <div className={cn(
                    "flex items-center justify-end gap-1 mt-1",
                    msg.direction === "outbound" ? "text-emerald-200" : "text-gray-400"
                  )}>
                    <span className="text-xs">{formatMessageTime(msg.timestamp)}</span>
                    {msg.direction === "outbound" && getStatusIcon(msg.status)}
                  </div>
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
