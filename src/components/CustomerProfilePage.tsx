"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Building2,
  Car,
  Home,
  Umbrella,
  Heart,
  Shield,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  FileText,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Lightbulb,
  Users,
  Clock,
  Send,
  X,
  MoreVertical,
  Loader2,
  ArrowLeft,
  CreditCard,
  Sailboat,
  Truck,
  Droplets,
  User,
  Wind
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  MergedProfile,
  Policy,
  PolicyType,
  Note,
  HouseholdMember,
  Coverage,
  Vehicle,
  Driver,
  PropertyDetails,
  BusinessInfo,
  Location,
  CoverageGap,
  ClientLevel,
  CLIENT_LEVEL_CONFIG,
  formatPhoneNumber,
  formatAddress,
  getInitials
} from "@/types/customer-profile";
import { LifeInsuranceTab } from "@/components/features/life-insurance";
import { mapMergedProfileToLifeInsurance, hasLifeInsurance, calculateOpportunityScore } from "@/lib/utils/lifeInsuranceMapper";
import { DonnaInsightsCard } from "@/components/features/DonnaInsightsCard";
import { MortgageePaymentStatus } from "@/components/features/MortgageePaymentStatus";

// =============================================================================
// ICON MAPPING
// =============================================================================

const POLICY_ICONS: Record<PolicyType, any> = {
  auto: Car,
  home: Home,
  umbrella: Umbrella,
  life: Heart,
  commercial: Building2,
  boat: Sailboat,
  motorcycle: Truck,
  rv: Truck,
  mobile_home: Home,
  flood: Droplets,
  wind: Wind,
  other: Shield
};

const POLICY_COLORS: Record<PolicyType, string> = {
  auto: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  home: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  umbrella: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  life: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  commercial: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  boat: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  motorcycle: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  rv: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  mobile_home: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  flood: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  wind: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  expired: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  non_renewed: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
};

// =============================================================================
// TABS DEFINITION
// =============================================================================

type TabType = "overview" | "policies" | "household" | "life" | "notes" | "activity";

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "policies", label: "Policies", icon: Shield },
  { id: "household", label: "Household", icon: Users },
  { id: "life", label: "Life Insurance", icon: Heart },
  { id: "notes", label: "Notes", icon: MessageSquare },
  { id: "activity", label: "Activity", icon: Clock }
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function CustomerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const customerId = params.id as string;
  const hsId = searchParams.get("hsId");
  const azId = searchParams.get("azId");
  
  // State
  const [profile, setProfile] = useState<MergedProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  // Note creation
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  
  // AI Overview
  const [aiOverview, setAiOverview] = useState<any>(null);
  const [loadingAiOverview, setLoadingAiOverview] = useState(false);
  
  // =============================================================================
  // DATA FETCHING
  // =============================================================================
  
  const fetchAIOverview = useCallback(async (profileData: MergedProfile) => {
    try {
      setLoadingAiOverview(true);
      const response = await fetch("/api/ai/customer-overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: profileData })
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.overview) {
          setAiOverview(data.overview);
        }
      }
    } catch (err) {
      console.error("AI overview fetch error:", err);
    } finally {
      setLoadingAiOverview(false);
    }
  }, []);
  
  const fetchProfile = useCallback(async (forceSync = false) => {
    try {
      if (forceSync) {
        setSyncing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      
      const params = new URLSearchParams();
      if (hsId) params.set("hsId", hsId);
      if (azId) params.set("azId", azId);
      if (forceSync) params.set("refresh", "true");
      
      const response = await fetch(
        `/api/customers/${customerId}/merged-profile?${params.toString()}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch customer profile");
      }
      
      const data = await response.json();
      
      if (data.success && data.profile) {
        setProfile(data.profile);
        // Fetch AI overview in background
        fetchAIOverview(data.profile);
      } else {
        setError(data.error || "Customer not found");
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
      setError("Failed to load customer profile");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [customerId, hsId, azId]);

  // Donna AI data refresh
  const refreshDonnaData = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const response = await fetch(`/api/donna/customer/${profile.id}?refresh=true`);
      const data = await response.json();

      if (data.success && data.data) {
        // Update profile with new Donna data
        setProfile(prev => prev ? {
          ...prev,
          donnaData: data.data,
          lastSyncedFromDonna: data.lastSyncedAt
        } : null);
      }
    } catch (err) {
      console.error("Donna data refresh error:", err);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
  
  // =============================================================================
  // ACTIONS
  // =============================================================================
  
  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };
  
  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone.replace(/\D/g, "")}`;
  };
  
  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };
  
  const handleSMS = (phone: string) => {
    // Navigate to in-app messaging with this customer's phone pre-selected
    const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
    const customerId = profile?.id || '';
    const params = new URLSearchParams({
      phone: phone.replace(/\D/g, ''),
      ...(name && { name }),
      ...(customerId && { customerId }),
    });
    router.push(`/messages?${params.toString()}`);
  };
  
  const togglePolicy = (policyId: string) => {
    setExpandedPolicies(prev => {
      const next = new Set(prev);
      if (next.has(policyId)) {
        next.delete(policyId);
      } else {
        next.add(policyId);
      }
      return next;
    });
  };
  
  const handleAddNote = async () => {
    if (!newNote.trim() || !profile?.agencyzoomId) return;
    
    try {
      setSavingNote(true);
      
      const response = await fetch(
        `/api/agencyzoom/contacts/${profile.agencyzoomId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: newNote.trim(),
            subject: "Note from TCDS"
          })
        }
      );
      
      if (!response.ok) {
        throw new Error("Failed to save note");
      }
      
      const data = await response.json();
      
      if (data.success && data.note) {
        setProfile(prev => prev ? {
          ...prev,
          notes: [data.note, ...prev.notes]
        } : null);
        setNewNote("");
        setShowNoteModal(false);
      }
    } catch (err) {
      console.error("Note save error:", err);
      alert("Failed to save note. Please try again.");
    } finally {
      setSavingNote(false);
    }
  };
  
  // =============================================================================
  // LOADING STATE
  // =============================================================================
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading customer profile...</p>
        </div>
      </div>
    );
  }
  
  // =============================================================================
  // ERROR STATE
  // =============================================================================
  
  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {error || "Customer Not Found"}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We couldn't load this customer's profile. Please try again.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
            <Button onClick={() => fetchProfile(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back button and breadcrumb */}
          <div className="py-3 flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-900 dark:hover:text-white -ml-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-gray-500">Customers</span>
            <span className="text-gray-300 dark:text-gray-600">/</span>
            <span className="text-gray-900 dark:text-white font-medium">
              {profile.preferredName || profile.name}
            </span>
          </div>
          
          {/* Main header */}
          <div className="py-6 flex items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <Avatar className="w-16 h-16 text-lg">
                <AvatarFallback className="bg-blue-600 text-white">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              
              {/* Name and badges */}
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                    {profile.preferredName || profile.name}
                  </h1>
                  {profile.preferredName && profile.preferredName !== profile.name && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      ({profile.name})
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Contact type badge */}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "capitalize",
                      profile.contactType === "customer" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                      profile.contactType === "lead" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                      profile.contactType === "prospect" && "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                    )}
                  >
                    {profile.contactType}
                  </Badge>
                  
                  {/* Client level badge (A/AA/AAA) */}
                  {profile.clientLevel && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "font-semibold",
                        profile.clientLevel === "A" && "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
                        profile.clientLevel === "AA" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                        profile.clientLevel === "AAA" && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      )}
                      title={CLIENT_LEVEL_CONFIG[profile.clientLevel]?.description}
                    >
                      {profile.clientLevel === "A" && "⭐"}
                      {profile.clientLevel === "AA" && "🏆"}
                      {profile.clientLevel === "AAA" && "👑"}
                      {" "}{profile.clientLevel} - {CLIENT_LEVEL_CONFIG[profile.clientLevel]?.label}
                    </Badge>
                  )}
                  
                  {/* OG Badge - Customer since before 2021 */}
                  {profile.isOG && (
                    <Badge
                      variant="secondary"
                      className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-semibold"
                      title="Original customer - with us since before 2021"
                    >
                      💎 OG
                    </Badge>
                  )}
                  
                  {/* Customer since */}
                  {profile.customerSince && (
                    <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                      <Calendar className="w-4 h-4" />
                      Customer since {new Date(profile.customerSince).getFullYear()}
                    </span>
                  )}
                  
                  {/* AgencyZoom link */}
                  {profile.agencyzoomUrl && (
                    <a
                      href={profile.agencyzoomUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      AgencyZoom
                    </a>
                  )}
                </div>
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchProfile(true)}
                disabled={syncing}
              >
                <RefreshCw className={cn("w-4 h-4 mr-1", syncing && "animate-spin")} />
                {syncing ? "Syncing..." : "Refresh"}
              </Button>
              
              {profile.contact.phone && (
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => handleCall(profile.contact.phone!)}
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Call
                </Button>
              )}
              
              {profile.contact.phone && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSMS(profile.contact.phone!)}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Text
                </Button>
              )}
              
              {profile.contact.email && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEmail(profile.contact.email!)}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Email
                </Button>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowNoteModal(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Note
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => {
                    const name = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
                    const params = new URLSearchParams({ customerId: profile?.id || '' });
                    if (name) params.set('name', name);
                    router.push(`/id-cards?${params.toString()}`);
                  }}>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Send ID Cards
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const params = new URLSearchParams();
                    if (profile?.id) params.set('customerId', profile.id);
                    if (profile?.name) params.set('name', profile.name);
                    if (profile?.contact?.email) params.set('email', profile.contact.email);
                    if (profile?.contact?.phone) params.set('phone', profile.contact.phone);
                    if (profile?.hawksoftId) params.set('hawksoftId', String(profile.hawksoftId));
                    router.push(`/invoice?${params.toString()}`);
                  }}>
                    <FileText className="w-4 h-4 mr-2" />
                    Send Invoice
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => {
                    const params = new URLSearchParams();
                    if (profile?.id) params.set('customerId', profile.id);
                    if (profile?.name) params.set('name', profile.name);
                    if (profile?.contact?.email) params.set('email', profile.contact.email);
                    if (profile?.contact?.phone) params.set('phone', profile.contact.phone);
                    if (profile?.hawksoftId) params.set('hawksoftId', String(profile.hawksoftId));
                    // Pass policy info if they only have one active policy
                    const activePolicies = profile?.policies?.filter(p => p.status === 'active') || [];
                    if (activePolicies.length === 1) {
                      params.set('policyNumber', activePolicies[0].policyNumber);
                      params.set('carrier', activePolicies[0].carrier?.name || '');
                    }
                    router.push(`/policy-change?${params.toString()}`);
                  }}>
                    <FileText className="w-4 h-4 mr-2" />
                    Policy Change
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/quote/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Quote
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Clock className="w-4 h-4 mr-2" />
                    Schedule Callback
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                    isActive
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Contact Info (always visible) */}
          <div className="lg:col-span-1 space-y-6">
            {/* Contact Information Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                Contact Information
              </h3>
              
              <div className="space-y-4">
                {/* Preferred Name */}
                {profile.preferredName && profile.preferredName !== profile.name && (
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Goes by
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        "{profile.preferredName}"
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Date of Birth */}
                {profile.dateOfBirth && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Date of Birth
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(profile.dateOfBirth).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Primary Phone */}
                {profile.contact.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Phone (Primary)
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatPhoneNumber(profile.contact.phone)}
                        </span>
                        <button
                          onClick={() => handleCopy(profile.contact.phone!, "phone")}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === "phone" ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleCall(profile.contact.phone!)}
                    >
                      Call
                    </Button>
                  </div>
                )}
                
                {/* Alt Phone */}
                {profile.contact.altPhone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Phone (Alt)
                      </div>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {formatPhoneNumber(profile.contact.altPhone)}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Email */}
                {profile.contact.email && (
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Email
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {profile.contact.email}
                        </span>
                        <button
                          onClick={() => handleCopy(profile.contact.email!, "email")}
                          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                        >
                          {copiedField === "email" ? (
                            <Check className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs flex-shrink-0"
                      onClick={() => handleEmail(profile.contact.email!)}
                    >
                      Email
                    </Button>
                  </div>
                )}
                
                {/* Address */}
                {profile.address && (
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Address
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {profile.address.street && <div>{profile.address.street}</div>}
                        {profile.address.street2 && <div>{profile.address.street2}</div>}
                        <div>
                          {profile.address.city}, {profile.address.state} {profile.address.zip}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Customer Since */}
                {profile.customerSince && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">
                        Customer Since
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(profile.customerSince).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Account Summary Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
                Account Summary
              </h3>
              
              {/* Client Level Display */}
              <div className={cn(
                "p-3 rounded-lg mb-4 flex items-center gap-3",
                profile.clientLevel === "A" && "bg-slate-50 dark:bg-slate-900/30",
                profile.clientLevel === "AA" && "bg-blue-50 dark:bg-blue-900/30",
                profile.clientLevel === "AAA" && "bg-amber-50 dark:bg-amber-900/30"
              )}>
                <span className="text-2xl">
                  {profile.clientLevel === "A" && "⭐"}
                  {profile.clientLevel === "AA" && "🏆"}
                  {profile.clientLevel === "AAA" && "👑"}
                </span>
                <div>
                  <div className={cn(
                    "font-bold",
                    profile.clientLevel === "A" && "text-slate-700 dark:text-slate-300",
                    profile.clientLevel === "AA" && "text-blue-700 dark:text-blue-300",
                    profile.clientLevel === "AAA" && "text-amber-700 dark:text-amber-300"
                  )}>
                    {profile.clientLevel} - {CLIENT_LEVEL_CONFIG[profile.clientLevel]?.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {CLIENT_LEVEL_CONFIG[profile.clientLevel]?.description}
                  </div>
                </div>
                {profile.isOG && (
                  <Badge className="ml-auto bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    💎 OG
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Total Premium
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    ${profile.totalPremium.toLocaleString()}/yr
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Active Policies
                  </div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    {profile.activePolicyCount}
                    {/* Policy Type Emojis */}
                    {profile.activePolicyTypes && profile.activePolicyTypes.length > 0 && (
                      <span className="flex items-center gap-1 ml-1">
                        {profile.activePolicyTypes.map((pt, idx) => (
                          <span 
                            key={idx} 
                            className="text-base" 
                            title={`${pt.type.charAt(0).toUpperCase() + pt.type.slice(1)}${pt.count > 1 ? ` (${pt.count})` : ''}`}
                          >
                            {pt.emoji}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                {profile.producer && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Producer
                    </div>
                    <div className="flex items-center gap-2">
                      <AgentAvatar
                        name={profile.producer.name}
                        avatarUrl={profile.producer.avatarUrl}
                        size="sm"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {profile.producer.name}
                      </span>
                    </div>
                  </div>
                )}
                {profile.csr && (
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      CSR
                    </div>
                    <div className="flex items-center gap-2">
                      <AgentAvatar
                        name={profile.csr.name}
                        avatarUrl={profile.csr.avatarUrl}
                        size="sm"
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {profile.csr.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Coverage Gaps Card (sample) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                  Coverage Opportunities
                </h3>
              </div>
              
              <div className="space-y-3">
                {!profile.policies.some(p => p.type === "umbrella") && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        No Umbrella Policy
                      </div>
                      <div className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                        Consider recommending umbrella coverage for additional liability protection
                      </div>
                    </div>
                  </div>
                )}
                
                {profile.policies.length > 0 && profile.policies.every(p => p.type !== "life") && (
                  <button
                    onClick={() => setActiveTab("life")}
                    className="w-full flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
                  >
                    <Heart className="w-4 h-4 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Life Insurance Opportunity
                      </div>
                      <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                        Customer may benefit from life insurance coverage
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                        Click to get instant quotes →
                      </div>
                    </div>
                  </button>
                )}
                
                {profile.policies.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No active policies to analyze
                  </p>
                )}
              </div>
            </div>

            {/* Donna AI Insights Card */}
            {profile.hawksoftClientNumber && (
              <DonnaInsightsCard
                customerId={profile.id}
                donnaData={profile.donnaData || null}
                lastSyncedAt={profile.lastSyncedFromDonna}
                onRefresh={refreshDonnaData}
              />
            )}
          </div>

          {/* Right Column - Tab Content */}
          <div className="lg:col-span-2">
            {activeTab === "overview" && (
              <OverviewTab 
                profile={profile} 
                aiOverview={aiOverview}
                loadingAiOverview={loadingAiOverview}
              />
            )}
            
            {activeTab === "policies" && (
              <PoliciesTab
                policies={profile.policies}
                expandedPolicies={expandedPolicies}
                onTogglePolicy={togglePolicy}
              />
            )}
            
            {activeTab === "household" && (
              <HouseholdTab household={profile.household} />
            )}

            {activeTab === "life" && (
              <LifeInsuranceTab
                customerId={profile.id}
                customerData={mapMergedProfileToLifeInsurance(profile)}
                onQuoteGenerated={(quote) => {
                  console.log("Life insurance quote generated:", quote);
                }}
                onApplicationStarted={(quoteId) => {
                  console.log("Life insurance application started:", quoteId);
                }}
              />
            )}

            {activeTab === "notes" && (
              <NotesTab
                notes={profile.notes}
                onAddNote={() => setShowNoteModal(true)}
              />
            )}
            
            {activeTab === "activity" && (
              <ActivityTab
                activities={profile.recentActivity}
                notes={profile.notes}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Add Note Modal */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Add Note
              </h3>
              <button
                onClick={() => setShowNoteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Enter your note..."
                className="w-full h-32 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-900 dark:text-white resize-none"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="outline"
                onClick={() => setShowNoteModal(false)}
                disabled={savingNote}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddNote}
                disabled={!newNote.trim() || savingNote}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingNote ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Save Note
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// TAB COMPONENTS
// =============================================================================

function OverviewTab({ 
  profile,
  aiOverview,
  loadingAiOverview
}: { 
  profile: MergedProfile;
  aiOverview: any;
  loadingAiOverview: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* AI Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            AI Overview
          </h3>
          {loadingAiOverview && (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-2" />
          )}
        </div>
        
        {/* Summary */}
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
          {aiOverview?.summary || (
            `${profile.name} is a ${profile.contactType === "customer" ? "valued customer" : "potential lead"}
            ${profile.customerSince ? ` since ${new Date(profile.customerSince).getFullYear()}` : ""}
            ${profile.activePolicyCount > 0 ? ` with ${profile.activePolicyCount} active ${profile.activePolicyCount === 1 ? "policy" : "policies"}` : ""}
            ${profile.totalPremium > 0 ? ` totaling $${profile.totalPremium.toLocaleString()} in annual premium` : ""}.`
          )}
        </p>
        
        {/* Key Facts */}
        {aiOverview?.keyFacts && aiOverview.keyFacts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {aiOverview.keyFacts.map((fact: string, idx: number) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {fact}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Agent Tips */}
        {aiOverview?.agentTips && aiOverview.agentTips.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase">
                Agent Tips
              </span>
            </div>
            <ul className="space-y-1">
              {aiOverview.agentTips.map((tip: string, idx: number) => (
                <li key={idx} className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      {/* Coverage Gaps */}
      {aiOverview?.coverageGaps && aiOverview.coverageGaps.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Coverage Gaps ({aiOverview.coverageGaps.length})
            </h3>
          </div>
          <div className="space-y-3">
            {aiOverview.coverageGaps.map((gap: any, idx: number) => (
              <div 
                key={idx}
                className={cn(
                  "p-3 rounded-lg",
                  gap.severity === "high" && "bg-red-50 dark:bg-red-900/20",
                  gap.severity === "medium" && "bg-yellow-50 dark:bg-yellow-900/20",
                  gap.severity === "low" && "bg-gray-50 dark:bg-gray-900/50"
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className={cn(
                      "text-sm font-medium",
                      gap.severity === "high" && "text-red-800 dark:text-red-200",
                      gap.severity === "medium" && "text-yellow-800 dark:text-yellow-200",
                      gap.severity === "low" && "text-gray-800 dark:text-gray-200"
                    )}>
                      {gap.type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {gap.recommendation}
                    </p>
                    {gap.suggestedAction && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">
                        → {gap.suggestedAction}
                      </p>
                    )}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs capitalize",
                      gap.severity === "high" && "border-red-300 text-red-700",
                      gap.severity === "medium" && "border-yellow-300 text-yellow-700",
                      gap.severity === "low" && "border-gray-300 text-gray-700"
                    )}
                  >
                    {gap.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Cross-Sell Opportunities */}
      {aiOverview?.crossSellOpportunities && aiOverview.crossSellOpportunities.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="w-5 h-5 text-green-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Cross-Sell Opportunities
            </h3>
          </div>
          <div className="space-y-3">
            {aiOverview.crossSellOpportunities.map((opp: any, idx: number) => (
              <div key={idx} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-sm font-medium text-green-800 dark:text-green-200">
                    {opp.product}
                  </div>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs capitalize",
                      opp.priority === "high" && "border-green-500 text-green-700",
                      opp.priority === "medium" && "border-green-400 text-green-600",
                      opp.priority === "low" && "border-green-300 text-green-500"
                    )}
                  >
                    {opp.priority}
                  </Badge>
                </div>
                <p className="text-xs text-green-700 dark:text-green-300 mb-2">
                  {opp.reason}
                </p>
                {opp.talkingPoints && opp.talkingPoints.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                    <div className="text-xs font-medium text-green-800 dark:text-green-200 mb-1">
                      Talking Points:
                    </div>
                    <ul className="space-y-1">
                      {opp.talkingPoints.map((point: string, i: number) => (
                        <li key={i} className="text-xs text-green-600 dark:text-green-400 flex items-start gap-1">
                          <span>•</span> {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Risk Flags */}
      {aiOverview?.riskFlags && aiOverview.riskFlags.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Risk Flags ({aiOverview.riskFlags.length})
            </h3>
          </div>
          <div className="space-y-2">
            {aiOverview.riskFlags.map((flag: any, idx: number) => (
              <div key={idx} className="flex items-start gap-3 p-2 rounded">
                <div className={cn(
                  "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                  flag.severity === "high" && "bg-red-500",
                  flag.severity === "medium" && "bg-yellow-500",
                  flag.severity === "low" && "bg-gray-400"
                )} />
                <div>
                  <div className="text-sm text-gray-900 dark:text-white">
                    {flag.description}
                  </div>
                  {flag.action && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      Action: {flag.action}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Policy Summary Cards */}
      {profile.policies.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
            Policy Summary
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.policies.filter(p => p.status === "active").slice(0, 4).map((policy) => {
              const Icon = POLICY_ICONS[policy.type] || Shield;
              return (
                <div
                  key={policy.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
                >
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", POLICY_COLORS[policy.type])}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-white capitalize">
                      {policy.type.replace(/_/g, " ")} - {policy.carrier.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {policy.policyNumber} • ${policy.premium.toLocaleString()}/yr
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Recent Notes */}
      {profile.notes.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
            Recent Notes
          </h3>
          <div className="space-y-3">
            {profile.notes.slice(0, 3).map((note) => (
              <div key={note.id} className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                  {note.content}
                </p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {note.createdBy && (
                    <>
                      <AgentAvatar name={note.createdBy.name} size="xs" />
                      <span>{note.createdBy.name}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PoliciesTab({
  policies,
  expandedPolicies,
  onTogglePolicy
}: {
  policies: Policy[];
  expandedPolicies: Set<string>;
  onTogglePolicy: (id: string) => void;
}) {
  if (policies.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          No Policies
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          This customer doesn't have any policies yet.
        </p>
        <Button className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Create Quote
        </Button>
      </div>
    );
  }
  
  // Group policies by status
  const activePolicies = policies.filter(p => p.status === "active");
  const otherPolicies = policies.filter(p => p.status !== "active");
  
  return (
    <div className="space-y-6">
      {/* Active Policies */}
      {activePolicies.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 uppercase tracking-wide flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Active Policies ({activePolicies.length})
          </h3>
          <div className="space-y-3">
            {activePolicies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                isExpanded={expandedPolicies.has(policy.id)}
                onToggle={() => onTogglePolicy(policy.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Other Policies */}
      {otherPolicies.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            Expired / Cancelled ({otherPolicies.length})
          </h3>
          <div className="space-y-3">
            {otherPolicies.map((policy) => (
              <PolicyCard
                key={policy.id}
                policy={policy}
                isExpanded={expandedPolicies.has(policy.id)}
                onToggle={() => onTogglePolicy(policy.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PolicyCard({
  policy,
  isExpanded,
  onToggle
}: {
  policy: Policy;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const Icon = POLICY_ICONS[policy.type] || Shield;
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", POLICY_COLORS[policy.type])}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="font-medium text-gray-900 dark:text-white capitalize">
              {policy.type.replace(/_/g, " ")} Insurance
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {policy.carrier.name} • {policy.policyNumber}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right mr-2">
            <div className="font-medium text-gray-900 dark:text-white">
              ${policy.premium.toLocaleString()}/yr
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Exp: {new Date(policy.expirationDate).toLocaleDateString()}
            </div>
          </div>
          <Badge variant="secondary" className={cn("text-xs", STATUS_COLORS[policy.status])}>
            {policy.status}
          </Badge>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Policy Number</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                {policy.policyNumber}
                <button className="text-gray-400 hover:text-gray-600">
                  <Copy className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Carrier</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {policy.carrier.name}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Effective Date</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {new Date(policy.effectiveDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Expiration Date</div>
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {new Date(policy.expirationDate).toLocaleDateString()}
              </div>
            </div>
          </div>
          
          {/* Coverages */}
          {policy.coverages && policy.coverages.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Coverages
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {policy.coverages.map((cov, idx) => (
                  <div key={idx} className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400">{cov.type}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {cov.limit || cov.deductible || "Included"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Vehicles */}
          {policy.vehicles && policy.vehicles.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Vehicles ({policy.vehicles.length})
              </div>
              <div className="space-y-2">
                {policy.vehicles.map((vehicle) => (
                  <div key={vehicle.id} className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </div>
                        {vehicle.vin && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            VIN: {vehicle.vin}
                          </div>
                        )}
                      </div>
                      {vehicle.use && (
                        <Badge variant="outline" className="text-xs">
                          {vehicle.use}
                        </Badge>
                      )}
                    </div>
                    {vehicle.annualMiles && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {vehicle.annualMiles.toLocaleString()} miles/year
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Drivers */}
          {policy.drivers && policy.drivers.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Drivers ({policy.drivers.length})
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {policy.drivers.map((driver) => (
                  <div key={driver.id} className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {driver.name}
                      </div>
                      {driver.relationship && (
                        <Badge variant="outline" className="text-xs">
                          {driver.relationship}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {driver.dateOfBirth && `DOB: ${new Date(driver.dateOfBirth).toLocaleDateString()}`}
                      {driver.licenseNumber && ` • License: ${driver.licenseNumber}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Property Details */}
          {policy.property && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Property Details
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <div className="text-sm text-gray-900 dark:text-white mb-2">
                  {policy.property.address?.street && <div>{policy.property.address.street}</div>}
                  <div>
                    {policy.property.address?.city}, {policy.property.address?.state} {policy.property.address?.zip}
                  </div>
                  {policy.property.address?.county && (
                    <div className="text-xs text-gray-500">{policy.property.address.county} County</div>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {policy.property.yearBuilt && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Year Built:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.property.yearBuilt}</span>
                    </div>
                  )}
                  {policy.property.squareFeet && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Sq Ft:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.property.squareFeet.toLocaleString()}</span>
                    </div>
                  )}
                  {policy.property.stories && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Stories:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.property.stories}</span>
                    </div>
                  )}
                  {policy.property.constructionType && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Construction:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.property.constructionType}</span>
                    </div>
                  )}
                  {policy.property.roofType && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Roof:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.property.roofType}</span>
                    </div>
                  )}
                  {policy.property.roofAge && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Roof Age:</span>{" "}
                      <span className={cn(
                        "font-medium",
                        policy.property.roofAge > 15 ? "text-orange-600" : "text-gray-900 dark:text-white"
                      )}>
                        {policy.property.roofAge} years
                      </span>
                    </div>
                  )}
                  {policy.property.heatingType && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Heat:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.property.heatingType}</span>
                    </div>
                  )}
                  {policy.property.protectionClass && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Protection Class:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.property.protectionClass}</span>
                    </div>
                  )}
                </div>
                {/* Property Features */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  {policy.property.poolPresent && (
                    <Badge variant="outline" className="text-xs">🏊 Pool</Badge>
                  )}
                  {policy.property.trampolinePresent && (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">⚠️ Trampoline</Badge>
                  )}
                  {policy.property.nearmapData?.solarPanels && (
                    <Badge variant="outline" className="text-xs">☀️ Solar</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Business Info (Commercial) */}
          {policy.businessInfo && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Business Information
              </div>
              <div className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <div className="font-medium text-gray-900 dark:text-white mb-2">
                  {policy.businessInfo.businessName}
                  {policy.businessInfo.dba && (
                    <span className="text-sm text-gray-500 ml-2">DBA: {policy.businessInfo.dba}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  {policy.businessInfo.entityType && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Entity Type:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.businessInfo.entityType}</span>
                    </div>
                  )}
                  {policy.businessInfo.yearsInBusiness && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Years in Business:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.businessInfo.yearsInBusiness}</span>
                    </div>
                  )}
                  {policy.businessInfo.numberOfEmployees && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Employees:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.businessInfo.numberOfEmployees}</span>
                    </div>
                  )}
                  {policy.businessInfo.annualRevenue && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Annual Revenue:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">${policy.businessInfo.annualRevenue.toLocaleString()}</span>
                    </div>
                  )}
                  {policy.businessInfo.naicsCode && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">NAICS:</span>{" "}
                      <span className="font-medium text-gray-900 dark:text-white">{policy.businessInfo.naicsCode}</span>
                    </div>
                  )}
                </div>
                {policy.businessInfo.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                    {policy.businessInfo.description}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* Locations (Commercial) */}
          {policy.locations && policy.locations.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Locations ({policy.locations.length})
              </div>
              <div className="space-y-2">
                {policy.locations.map((location) => (
                  <div key={location.id} className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm text-gray-900 dark:text-white">
                          {location.address?.street}
                        </div>
                        <div className="text-xs text-gray-500">
                          {location.address?.city}, {location.address?.state} {location.address?.zip}
                        </div>
                      </div>
                      {location.isPrimary && (
                        <Badge variant="outline" className="text-xs">Primary</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      {location.squareFeet && (
                        <div>
                          <span className="text-gray-500">Sq Ft:</span> {location.squareFeet.toLocaleString()}
                        </div>
                      )}
                      {location.yearBuilt && (
                        <div>
                          <span className="text-gray-500">Built:</span> {location.yearBuilt}
                        </div>
                      )}
                      {location.occupancy && (
                        <div>
                          <span className="text-gray-500">Occupancy:</span> {location.occupancy}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {location.sprinklered && (
                        <Badge variant="outline" className="text-xs text-green-600">Sprinklered</Badge>
                      )}
                      {location.alarmSystem && (
                        <Badge variant="outline" className="text-xs text-green-600">Alarm</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Lienholders / Additional Interests */}
          {policy.lienholders && policy.lienholders.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Lienholders / Mortgagees ({policy.lienholders.length})
              </div>
              <div className="space-y-2">
                {policy.lienholders.map((lh) => (
                  <div key={lh.id} className="p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-sm text-gray-900 dark:text-white">
                          {lh.name}
                        </div>
                        {lh.loanNumber && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Loan #: {lh.loanNumber}
                          </div>
                        )}
                        {lh.address && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {lh.address.street}, {lh.address.city}, {lh.address.state} {lh.address.zip}
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {lh.type.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mortgagee Payment Status - for home policies */}
          {policy.type === "home" && policy.lienholders && policy.lienholders.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Mortgagee Payment Status
              </div>
              <MortgageePaymentStatus policyId={policy.id} compact />
            </div>
          )}

          {/* Carrier Quick Link */}
          {policy.carrier.portalUrl && (
            <a
              href={policy.carrier.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              <ExternalLink className="w-4 h-4" />
              Open {policy.carrier.name} Portal
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function HouseholdTab({ household }: { household: HouseholdMember[] }) {
  if (household.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          No Household Members
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No household members found in HawkSoft
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          Household Members ({household.length})
        </h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {household.map((member) => (
          <div key={member.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {member.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {member.relationship}
                  {member.dateOfBirth && ` • DOB: ${new Date(member.dateOfBirth).toLocaleDateString()}`}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.isDriver && (
                <Badge variant="outline" className="text-xs">
                  <Car className="w-3 h-3 mr-1" />
                  Driver
                </Badge>
              )}
              {member.phone && (
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Phone className="w-4 h-4" />
                </Button>
              )}
              {member.email && (
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <Mail className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesTab({
  notes,
  onAddNote
}: {
  notes: Note[];
  onAddNote: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
          Notes ({notes.length})
        </h3>
        <Button size="sm" onClick={onAddNote} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" />
          Add Note
        </Button>
      </div>
      
      {notes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No Notes Yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Add notes to keep track of customer interactions
          </p>
          <Button onClick={onAddNote} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add First Note
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              {note.subject && (
                <div className="font-medium text-gray-900 dark:text-white mb-1">
                  {note.subject}
                </div>
              )}
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {note.content}
              </p>
              <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
                {note.createdBy && (
                  <>
                    <AgentAvatar name={note.createdBy.name} size="xs" />
                    <span>{note.createdBy.name}</span>
                    <span>•</span>
                  </>
                )}
                <span>{new Date(note.createdAt).toLocaleString()}</span>
                <span>•</span>
                <Badge variant="outline" className="text-xs">
                  {note.source}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab({
  activities,
  notes
}: {
  activities: any[];
  notes: Note[];
}) {
  // Combine activities and notes into a timeline
  const timeline = [
    ...notes.map(note => ({
      id: note.id,
      type: "note" as const,
      content: note.content,
      subject: note.subject,
      createdAt: note.createdAt,
      createdBy: note.createdBy
    })),
    ...activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      content: activity.content,
      subject: activity.subject,
      createdAt: activity.createdAt,
      createdBy: activity.createdBy
    }))
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  if (timeline.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          No Activity Yet
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Customer activity will appear here
        </p>
      </div>
    );
  }
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
        
        <div className="space-y-4">
          {timeline.map((item, idx) => (
            <div key={item.id} className="relative pl-10">
              {/* Timeline dot */}
              <div className="absolute left-2.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800" />
              
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs capitalize">
                    {item.type}
                  </Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                {item.subject && (
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {item.subject}
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                  {item.content}
                </p>
                {item.createdBy && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    by {item.createdBy.name}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
