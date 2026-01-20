"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Search, Phone, Mail, Building2, Car, Home, Umbrella, Heart, Shield, ChevronRight, ChevronDown, MoreVertical, Plus, ExternalLink, Calendar, DollarSign, User, FileText, MapPin, AlertTriangle, Ship, Truck, Droplets, Wind, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { PolicyType } from "@/types/customer-profile";

interface Coverage {
  type: string;
  limit: string;
  deductible?: string;
  premium?: number;
}

interface Vehicle {
  year: number | null;
  make: string | null;
  model: string | null;
  vin: string | null;
  use: string | null;
  annualMiles: number | null;
}

interface Driver {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  licenseNumber: string | null;
  licenseState: string | null;
  relationship: string | null;
}

interface PropertyAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
}

interface NearmapData {
  lastImageDate?: string;
  roofCondition?: string;
  roofConditionConfidence?: number;
  treesOverhanging?: boolean;
  poolDetected?: boolean;
  trampolineDetected?: boolean;
  solarPanels?: boolean;
}

interface HazardExposure {
  wind?: number;
  hail?: number;
  flood?: number;
  fire?: number;
  earthquake?: number;
}

interface Property {
  address: PropertyAddress;
  yearBuilt: number | null;
  squareFeet: number | null;
  stories: number | null;
  constructionType: string | null;
  roofType: string | null;
  roofAge: number | null;
  nearmapData: NearmapData | null;
  riskScore: string | null;
  hazardExposure: HazardExposure | null;
}

interface Policy {
  id: string;
  policyNumber: string;
  lineOfBusiness: string;
  type: PolicyType;  // Computed from lineOfBusiness by API
  carrier: string | null;
  status: string;
  effectiveDate: string | null;
  expirationDate: string | null;
  premium: number | null;
  coverages: Coverage[] | null;
  vehicles: Vehicle[];
  drivers: Driver[];
  properties: Property[];
}

interface CustomerAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  county?: string;
}

interface UserInfo {
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  phoneAlt: string | null;
  address: CustomerAddress | null;
  isLead: boolean;
  agencyzoomId: string | null;
  hawksoftClientCode: string | null;
  createdAt: string;
  policies: Policy[];
  producer: UserInfo | null;
  csr: UserInfo | null;
}

const POLICY_ICONS: Record<PolicyType | 'default', any> = {
  auto: Car,
  home: Home,
  umbrella: Umbrella,
  life: Heart,
  commercial: Building2,
  boat: Ship,
  motorcycle: Car,
  rv: Truck,
  mobile_home: Home,
  flood: Droplets,
  wind: Wind,
  other: Shield,
  default: Shield,
};

const POLICY_COLORS: Record<PolicyType | 'default', string> = {
  auto: "bg-blue-100 text-blue-700",
  home: "bg-green-100 text-green-700",
  umbrella: "bg-purple-100 text-purple-700",
  life: "bg-pink-100 text-pink-700",
  commercial: "bg-orange-100 text-orange-700",
  boat: "bg-cyan-100 text-cyan-700",
  motorcycle: "bg-red-100 text-red-700",
  rv: "bg-amber-100 text-amber-700",
  mobile_home: "bg-teal-100 text-teal-700",
  flood: "bg-indigo-100 text-indigo-700",
  wind: "bg-sky-100 text-sky-700",
  other: "bg-gray-100 text-gray-700",
  default: "bg-gray-100 text-gray-700",
};

// Policy type display names
const POLICY_TYPE_NAMES: Record<PolicyType, string> = {
  auto: "Auto",
  home: "Homeowners",
  umbrella: "Umbrella",
  life: "Life",
  commercial: "Commercial",
  boat: "Boat",
  motorcycle: "Motorcycle",
  rv: "RV",
  mobile_home: "Mobile Home",
  flood: "Flood",
  wind: "Wind",
  other: "Policy",
};


export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "customer" | "lead" | "mine">("all");
  const [recentSearches, setRecentSearches] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch current user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.id) {
          setCurrentUserId(data.user.id);
        }
      })
      .catch(console.error);
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("tcds_recent_customers");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save recent customer selection
  const addToRecent = (customer: Customer) => {
    const newRecent = [
      { id: customer.id, name: customer.displayName, type: customer.isLead ? "lead" : "customer" },
      ...recentSearches.filter(r => r.id !== customer.id)
    ].slice(0, 10);
    setRecentSearches(newRecent);
    localStorage.setItem("tcds_recent_customers", JSON.stringify(newRecent));
  };

  const removeFromRecent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRecent = recentSearches.filter(r => r.id !== id);
    setRecentSearches(newRecent);
    localStorage.setItem("tcds_recent_customers", JSON.stringify(newRecent));
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem("tcds_recent_customers");
  };

  const searchCustomers = async (query: string, assignedUserId?: string | null) => {
    // For "mine" filter, we can search with empty query
    if (query.length < 2 && !assignedUserId) {
      setCustomers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let url = `/api/customers/search?q=${encodeURIComponent(query)}&limit=50`;
      if (assignedUserId) {
        url += `&assignedTo=${encodeURIComponent(assignedUserId)}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCustomers(data.results);
        if (data.results.length > 0 && !selectedCustomer) {
          setSelectedCustomer(data.results[0]);
        }
      }
    } catch (err) {
      console.error("Search failed:", err);
      toast.error("Search failed", {
        description: "Unable to search customers. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (filterType === "mine" && currentUserId) {
        searchCustomers(searchQuery || "a", currentUserId);
      } else {
        searchCustomers(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filterType, currentUserId]);

  // Initial search or when filter changes to "mine"
  useEffect(() => {
    if (filterType === "mine" && currentUserId) {
      searchCustomers("a", currentUserId);
    } else if (filterType !== "mine") {
      searchCustomers("a");
    }
  }, [filterType, currentUserId]);

  const filteredCustomers = customers.filter(c => {
    if (filterType === "customer") return !c.isLead;
    if (filterType === "lead") return c.isLead;
    return true;
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Use type directly from API (already computed from lineOfBusiness)
  const getPolicyIcon = (type: PolicyType) => {
    return POLICY_ICONS[type] || POLICY_ICONS.default;
  };

  const getPolicyColor = (type: PolicyType) => {
    return POLICY_COLORS[type] || POLICY_COLORS.default;
  };

  const getPolicyName = (type: PolicyType) => {
    return POLICY_TYPE_NAMES[type] || "Policy";
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const togglePolicyExpand = (policyId: string) => {
    const newExpanded = new Set(expandedPolicies);
    if (newExpanded.has(policyId)) {
      newExpanded.delete(policyId);
    } else {
      newExpanded.add(policyId);
    }
    setExpandedPolicies(newExpanded);
  };

  const openInAgencyZoom = (id: string) => {
    window.open(`https://app.agencyzoom.com/customer/index?id=${id}`, '_blank');
  };

  return (
    <div className="flex h-[calc(100vh-120px)] bg-gray-50">
      {/* Customer List */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Customers</h1>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              ref={searchInputRef}
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setShowRecent(true)}
              onBlur={() => setTimeout(() => setShowRecent(false), 200)}
              className="pl-9"
            />
            
            {/* Recent Searches Dropdown */}
            {showRecent && !searchQuery && recentSearches.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Recent Searches
                  </span>
                  <button 
                    onClick={clearRecent}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear all
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {recentSearches.map((recent) => (
                    <div
                      key={recent.id}
                      onClick={() => {
                        // Load customer by searching for them
                        setSearchQuery(recent.name);
                        setShowRecent(false);
                      }}
                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                          recent.type === "lead" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {recent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <span className="text-sm text-gray-700">{recent.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {recent.type}
                        </Badge>
                      </div>
                      <button
                        onClick={(e) => removeFromRecent(recent.id, e)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            {(["mine", "all", "customer", "lead"] as const).map((type) => (
              <Button
                key={type}
                variant={filterType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType(type)}
                disabled={type === "mine" && !currentUserId}
                className={cn(
                  "text-xs",
                  filterType === type && "bg-emerald-600 hover:bg-emerald-700",
                  type === "mine" && "font-medium"
                )}
              >
                {type === "mine" ? "My Customers" : type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-2 space-y-1">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="flex -space-x-1">
                      <Skeleton className="w-6 h-6 rounded-full" />
                      <Skeleton className="w-6 h-6 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCustomers.length === 0 ? (
            <EmptyState
              icon="search"
              title={searchQuery.length < 2 ? "Search for customers" : "No customers found"}
              description={
                searchQuery.length < 2
                  ? "Type at least 2 characters to search"
                  : `No results for "${searchQuery}"`
              }
              size="sm"
              className="py-12"
            />
          ) : (
            filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                onClick={() => {
                  setSelectedCustomer(customer);
                  setExpandedPolicies(new Set());
                  addToRecent(customer);
                  setShowRecent(false);
                }}
                className={cn(
                  "p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors",
                  selectedCustomer?.id === customer.id && "bg-emerald-50 border-l-4 border-l-emerald-600"
                )}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-sm">
                      {getInitials(customer.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{customer.displayName}</span>
                      {customer.isLead && (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs">Lead</Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 truncate">{customer.phone || customer.email || 'No contact'}</div>
                  </div>
                  {customer.policies.length > 0 && (
                    <div className="flex -space-x-1">
                      {customer.policies.slice(0, 3).map((p, i) => {
                        const Icon = getPolicyIcon(p.type);
                        return (
                          <div key={i} className={cn("w-6 h-6 rounded-full flex items-center justify-center", getPolicyColor(p.type))}>
                            <Icon className="w-3 h-3" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Customer Detail */}
      {selectedCustomer ? (
        <div className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xl">
                    {getInitials(selectedCustomer.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedCustomer.displayName}</h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <Badge variant="secondary" className={cn(
                      selectedCustomer.isLead ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                    )}>
                      {selectedCustomer.isLead ? 'Lead' : 'Customer'}
                    </Badge>
                    {selectedCustomer.hawksoftClientCode && (
                      <span>HawkSoft: {selectedCustomer.hawksoftClientCode}</span>
                    )}
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Customer actions menu">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>Edit Customer</DropdownMenuItem>
                  <DropdownMenuItem>Create Task</DropdownMenuItem>
                  <DropdownMenuItem>Send ID Card</DropdownMenuItem>
                  <DropdownMenuItem>Send Invoice</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex gap-2 mt-4">
              {/* View Full Profile Button */}
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link href={`/customer/${selectedCustomer.id}?hsId=${selectedCustomer.hawksoftClientCode || ''}&azId=${selectedCustomer.agencyzoomId || ''}`}>
                  <User className="w-4 h-4 mr-1" />
                  View Profile
                </Link>
              </Button>
              {selectedCustomer.phone && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" asChild>
                  <a href={`tel:${selectedCustomer.phone}`}>
                    <Phone className="w-4 h-4 mr-1" />
                    Call
                  </a>
                </Button>
              )}
              {selectedCustomer.email && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`mailto:${selectedCustomer.email}`}>
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </a>
                </Button>
              )}
              {selectedCustomer.agencyzoomId && (
                <Button size="sm" variant="outline" onClick={() => openInAgencyZoom(selectedCustomer.agencyzoomId!)}>
                  <ExternalLink className="w-4 h-4 mr-1" />
                  AgencyZoom
                </Button>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Contact Information */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                Contact Information
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                {selectedCustomer.phone && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900 font-medium">{selectedCustomer.phone}</span>
                  </div>
                )}
                {selectedCustomer.phoneAlt && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">{selectedCustomer.phoneAlt} (Alt)</span>
                  </div>
                )}
                {selectedCustomer.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-900 font-medium">{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <div className="text-gray-900 font-medium">{selectedCustomer.address.street}</div>
                      <div className="text-gray-500">
                        {selectedCustomer.address.city}, {selectedCustomer.address.state} {selectedCustomer.address.zip}
                        {selectedCustomer.address.county && ` (${selectedCustomer.address.county} County)`}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Account Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                Account Details
              </h3>
              <div className="bg-white rounded-lg border border-gray-200 p-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Producer</div>
                  {selectedCustomer.producer ? (
                    <div className="flex items-center gap-2">
                      {selectedCustomer.producer.avatarUrl ? (
                        <img
                          src={selectedCustomer.producer.avatarUrl}
                          alt={`${selectedCustomer.producer.firstName} ${selectedCustomer.producer.lastName}`}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-medium">
                          {selectedCustomer.producer.firstName[0]}{selectedCustomer.producer.lastName[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCustomer.producer.firstName} {selectedCustomer.producer.lastName}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">Unassigned</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">CSR</div>
                  {selectedCustomer.csr ? (
                    <div className="flex items-center gap-2">
                      {selectedCustomer.csr.avatarUrl ? (
                        <img
                          src={selectedCustomer.csr.avatarUrl}
                          alt={`${selectedCustomer.csr.firstName} ${selectedCustomer.csr.lastName}`}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-medium">
                          {selectedCustomer.csr.firstName[0]}{selectedCustomer.csr.lastName[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium text-gray-900">
                        {selectedCustomer.csr.firstName} {selectedCustomer.csr.lastName}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">Unassigned</div>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Policy Count</div>
                  <div className="text-sm font-medium text-gray-900">
                    {selectedCustomer.policies.length} {selectedCustomer.policies.length === 1 ? 'policy' : 'policies'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Total Premium</div>
                  <div className="text-sm font-medium text-gray-900">
                    ${selectedCustomer.policies.reduce((sum, p) => sum + (p.premium || 0), 0).toLocaleString()}/year
                  </div>
                </div>
              </div>
            </div>

            {/* Policies */}
            {selectedCustomer.policies.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">
                  Policies ({selectedCustomer.policies.length})
                </h3>
                <div className="space-y-3">
                  {selectedCustomer.policies.map((policy) => {
                    const Icon = getPolicyIcon(policy.type);
                    const isExpanded = expandedPolicies.has(policy.id);

                    return (
                      <div key={policy.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        {/* Policy Header */}
                        <div
                          onClick={() => togglePolicyExpand(policy.id)}
                          className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", getPolicyColor(policy.type))}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">
                                  {getPolicyName(policy.type) === "Policy"
                                    ? "Insurance Policy"
                                    : `${getPolicyName(policy.type)} Insurance`}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {policy.carrier} • {policy.policyNumber}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className={cn(
                                "text-xs",
                                policy.status === "active" && "bg-green-100 text-green-700",
                                policy.status === "cancelled" && "bg-gray-100 text-gray-600",
                                policy.status === "replaced" && "bg-orange-100 text-orange-700",
                                policy.status === "expired" && "bg-red-100 text-red-700",
                                policy.status === "non_renewed" && "bg-yellow-100 text-yellow-700",
                                !["active", "cancelled", "replaced", "expired", "non_renewed"].includes(policy.status) && "bg-gray-100 text-gray-600"
                              )}>
                                {policy.status}
                              </Badge>
                              {policy.premium && (
                                <span className="text-sm font-medium text-gray-700">${policy.premium.toLocaleString()}</span>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Policy Details */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                            {/* Dates & Premium */}
                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <Calendar className="w-3 h-3" />
                                  Effective
                                </div>
                                <div className="text-sm font-medium">{formatDate(policy.effectiveDate)}</div>
                              </div>
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <Calendar className="w-3 h-3" />
                                  Expiration
                                </div>
                                <div className="text-sm font-medium">{formatDate(policy.expirationDate)}</div>
                              </div>
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                                  <DollarSign className="w-3 h-3" />
                                  Annual Premium
                                </div>
                                <div className="text-sm font-medium">
                                  {policy.premium ? `$${policy.premium.toLocaleString()}` : '-'}
                                </div>
                              </div>
                            </div>

                            {/* Coverages */}
                            {policy.coverages && policy.coverages.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                  <FileText className="w-3 h-3" />
                                  Coverages
                                </div>
                                <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100">
                                  {policy.coverages.map((cov, i) => (
                                    <div key={i} className="px-3 py-2 flex justify-between text-sm">
                                      <span className="text-gray-700">{cov.type}</span>
                                      <div className="text-right">
                                        <span className="font-medium">{cov.limit}</span>
                                        {cov.deductible && (
                                          <span className="text-gray-500 ml-2">/ {cov.deductible} ded</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Vehicles */}
                            {policy.vehicles && policy.vehicles.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                  <Car className="w-3 h-3" />
                                  Vehicles ({policy.vehicles.length})
                                </div>
                                <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100">
                                  {policy.vehicles.map((veh, i) => (
                                    <div key={i} className="px-3 py-2">
                                      <div className="font-medium text-sm text-gray-900">
                                        {veh.year} {veh.make} {veh.model}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 space-x-3">
                                        {veh.vin && <span>VIN: {veh.vin}</span>}
                                        {veh.use && <span>Use: {veh.use}</span>}
                                        {veh.annualMiles && <span>{veh.annualMiles.toLocaleString()} mi/yr</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Drivers */}
                            {policy.drivers && policy.drivers.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                  <User className="w-3 h-3" />
                                  Drivers ({policy.drivers.length})
                                </div>
                                <div className="bg-white rounded border border-gray-200 divide-y divide-gray-100">
                                  {policy.drivers.map((drv, i) => (
                                    <div key={i} className="px-3 py-2">
                                      <div className="font-medium text-sm text-gray-900">
                                        {drv.firstName} {drv.lastName}
                                        {drv.relationship && (
                                          <span className="text-gray-500 font-normal ml-2">({drv.relationship})</span>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1 space-x-3">
                                        {drv.dateOfBirth && <span>DOB: {formatDate(drv.dateOfBirth)}</span>}
                                        {drv.licenseNumber && (
                                          <span>License: {drv.licenseNumber} ({drv.licenseState})</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Properties (for home/property policies) */}
                            {policy.properties && policy.properties.length > 0 && (
                              <div>
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                  <Home className="w-3 h-3" />
                                  Properties ({policy.properties.length})
                                </div>
                                <div className="space-y-3">
                                  {policy.properties.map((prop, i) => (
                                    <div key={i} className="bg-white rounded border border-gray-200 p-3">
                                      {/* Address */}
                                      <div className="flex items-start gap-2 mb-3">
                                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                        <div>
                                          <div className="font-medium text-sm text-gray-900">
                                            {prop.address.street}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {prop.address.city}, {prop.address.state} {prop.address.zip}
                                            {prop.address.county && ` (${prop.address.county} County)`}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Construction Details */}
                                      <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                                        {prop.yearBuilt && (
                                          <div>
                                            <span className="text-gray-500">Year Built:</span>
                                            <span className="ml-1 font-medium">{prop.yearBuilt}</span>
                                          </div>
                                        )}
                                        {prop.squareFeet && (
                                          <div>
                                            <span className="text-gray-500">Sq Ft:</span>
                                            <span className="ml-1 font-medium">{prop.squareFeet.toLocaleString()}</span>
                                          </div>
                                        )}
                                        {prop.stories && (
                                          <div>
                                            <span className="text-gray-500">Stories:</span>
                                            <span className="ml-1 font-medium">{prop.stories}</span>
                                          </div>
                                        )}
                                        {prop.constructionType && (
                                          <div>
                                            <span className="text-gray-500">Construction:</span>
                                            <span className="ml-1 font-medium">{prop.constructionType}</span>
                                          </div>
                                        )}
                                        {prop.roofType && (
                                          <div>
                                            <span className="text-gray-500">Roof:</span>
                                            <span className="ml-1 font-medium">{prop.roofType}</span>
                                          </div>
                                        )}
                                        {prop.roofAge && (
                                          <div>
                                            <span className="text-gray-500">Roof Age:</span>
                                            <span className="ml-1 font-medium">{prop.roofAge} yrs</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Risk Score */}
                                      {prop.riskScore && (
                                        <div className="flex items-center gap-2 mb-3">
                                          <AlertTriangle className="w-3 h-3 text-amber-500" />
                                          <span className="text-xs text-gray-500">Risk Score:</span>
                                          <span className={cn(
                                            "text-xs font-medium px-2 py-0.5 rounded",
                                            parseFloat(prop.riskScore) > 0.7 ? "bg-red-100 text-red-700" :
                                            parseFloat(prop.riskScore) > 0.4 ? "bg-amber-100 text-amber-700" :
                                            "bg-green-100 text-green-700"
                                          )}>
                                            {(parseFloat(prop.riskScore) * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                      )}

                                      {/* Hazard Exposure */}
                                      {prop.hazardExposure && (
                                        <div className="mb-3">
                                          <div className="text-xs text-gray-500 mb-1">Hazard Exposure:</div>
                                          <div className="flex flex-wrap gap-2">
                                            {prop.hazardExposure.wind !== undefined && (
                                              <Badge variant="outline" className="text-xs">Wind: {prop.hazardExposure.wind}</Badge>
                                            )}
                                            {prop.hazardExposure.hail !== undefined && (
                                              <Badge variant="outline" className="text-xs">Hail: {prop.hazardExposure.hail}</Badge>
                                            )}
                                            {prop.hazardExposure.flood !== undefined && (
                                              <Badge variant="outline" className="text-xs">Flood: {prop.hazardExposure.flood}</Badge>
                                            )}
                                            {prop.hazardExposure.fire !== undefined && (
                                              <Badge variant="outline" className="text-xs">Fire: {prop.hazardExposure.fire}</Badge>
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* Nearmap AI Data */}
                                      {prop.nearmapData && (
                                        <div className="bg-blue-50 rounded p-2 text-xs">
                                          <div className="font-medium text-blue-700 mb-1">AI Property Analysis (Nearmap)</div>
                                          <div className="grid grid-cols-2 gap-2 text-blue-600">
                                            {prop.nearmapData.roofCondition && (
                                              <div>Roof Condition: <span className="font-medium">{prop.nearmapData.roofCondition}</span></div>
                                            )}
                                            {prop.nearmapData.lastImageDate && (
                                              <div>Last Image: {formatDate(prop.nearmapData.lastImageDate)}</div>
                                            )}
                                            {prop.nearmapData.poolDetected && (
                                              <div>🏊 Pool Detected</div>
                                            )}
                                            {prop.nearmapData.trampolineDetected && (
                                              <div>⚠️ Trampoline Detected</div>
                                            )}
                                            {prop.nearmapData.solarPanels && (
                                              <div>☀️ Solar Panels</div>
                                            )}
                                            {prop.nearmapData.treesOverhanging && (
                                              <div>🌳 Trees Overhanging</div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State for Leads */}
            {selectedCustomer.policies.length === 0 && (
              <EmptyState
                icon="policies"
                title="No Policies Yet"
                description={
                  selectedCustomer.isLead
                    ? "This lead doesn't have any policies. Create a quote to get started."
                    : "No policies found for this customer."
                }
                className="bg-white rounded-lg border border-gray-200"
              >
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-1" />
                  Create Quote
                </Button>
              </EmptyState>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState
            icon="customers"
            title="Select a customer"
            description="Choose a customer from the list to view their details and policies"
            size="md"
          />
        </div>
      )}
    </div>
  );
}
