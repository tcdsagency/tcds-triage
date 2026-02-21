"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// =============================================================================
// TYPES
// =============================================================================

interface SearchResult {
  id: string;
  type: "customer" | "lead";
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hawksoftClientNumber?: string;
  agencyzoomId?: string;
  policyCount?: number;
  policyTypes?: string[];
}

interface CustomerPolicy {
  policyNumber: string;
  carrier: string;
  type: string;
  status?: string;
  expirationDate?: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  policyNumber: string;
  amount: string;
  paymentType: "card" | "checking";
  cardNumber: string;
  cardExp: string;
  cardCvv: string;
  cardZip: string;
  routingNumber: string;
  accountNumber: string;
  draftDate: string;
  submitterEmail: string;
  reason: string;
  reasonDetails: string;
}

interface PaymentAdvance {
  id: string;
  firstName: string;
  lastName: string;
  policyNumber: string;
  amount: number;
  processingFee: number;
  convenienceFee: number;
  totalAmount: number;
  paymentType: string;
  draftDate: string;
  submittedDate: string;
  status: string;
  processedAt: string | null;
  reason: string | null;
  submitterEmail: string | null;
  createdAt: string;
  epayScheduleId: string | null;
  epayError: string | null;
  isRecurring: boolean | null;
  numberOfPayments: number | null;
  paymentInterval: string | null;
}

interface RecurringFormData {
  firstName: string;
  lastName: string;
  policyNumber: string;
  amount: string;
  paymentType: "card" | "checking";
  cardNumber: string;
  cardExp: string;
  cardCvv: string;
  cardZip: string;
  routingNumber: string;
  accountNumber: string;
  numberOfPayments: string;
  interval: "Monthly" | "Weekly" | "Bi-weekly";
  startDate: string;
  submitterEmail: string;
  reason: string;
  reasonDetails: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CONVENIENCE_FEE = 15;

const REASON_OPTIONS = [
  { value: "", label: "Select a reason..." },
  { value: "Hardship", label: "Hardship" },
  { value: "New policy issued/payment date match", label: "New policy issued/payment date match" },
  { value: "Other", label: "Other (please specify)" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function PaymentAdvancePage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"form" | "recurring" | "history">("form");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchResult | null>(null);

  // Policy state
  const [policies, setPolicies] = useState<CustomerPolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");
  const [manualPolicyEntry, setManualPolicyEntry] = useState(false);

  // Form state
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    lastName: "",
    policyNumber: "",
    amount: "",
    paymentType: "card",
    cardNumber: "",
    cardExp: "",
    cardCvv: "",
    cardZip: "",
    routingNumber: "",
    accountNumber: "",
    draftDate: "",
    submitterEmail: "",
    reason: "",
    reasonDetails: "",
  });

  // Fee state
  const [waiveConvenienceFee, setWaiveConvenienceFee] = useState(false);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // History state
  const [advances, setAdvances] = useState<PaymentAdvance[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, pending: 0, scheduled: 0, processed: 0, failed: 0, cancelled: 0 });

  // Bank validation state
  const [bankInfo, setBankInfo] = useState<{
    bankName: string;
    brandName: string;
    state: string;
    supportsAch: boolean;
  } | null>(null);
  const [bankValidating, setBankValidating] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankConfirmed, setBankConfirmed] = useState(false);

  // Recurring form state
  const [recurringForm, setRecurringForm] = useState<RecurringFormData>({
    firstName: "",
    lastName: "",
    policyNumber: "",
    amount: "",
    paymentType: "card",
    cardNumber: "",
    cardExp: "",
    cardCvv: "",
    cardZip: "",
    routingNumber: "",
    accountNumber: "",
    numberOfPayments: "3",
    interval: "Monthly",
    startDate: "",
    submitterEmail: "",
    reason: "",
    reasonDetails: "",
  });
  const [recurringWaiveFee, setRecurringWaiveFee] = useState(false);
  const [showRecurringConfirm, setShowRecurringConfirm] = useState(false);

  // Recurring search state (separate from one-time)
  const [recurringSearchQuery, setRecurringSearchQuery] = useState("");
  const [recurringSearchResults, setRecurringSearchResults] = useState<SearchResult[]>([]);
  const [recurringSearchLoading, setRecurringSearchLoading] = useState(false);
  const [recurringSelectedCustomer, setRecurringSelectedCustomer] = useState<SearchResult | null>(null);
  const [recurringPolicies, setRecurringPolicies] = useState<CustomerPolicy[]>([]);
  const [recurringPoliciesLoading, setRecurringPoliciesLoading] = useState(false);
  const [recurringSelectedPolicy, setRecurringSelectedPolicy] = useState<string>("");
  const [recurringManualPolicy, setRecurringManualPolicy] = useState(false);

  // Recurring bank validation
  const [recurringBankInfo, setRecurringBankInfo] = useState<{
    bankName: string;
    brandName: string;
    state: string;
    supportsAch: boolean;
  } | null>(null);
  const [recurringBankValidating, setRecurringBankValidating] = useState(false);
  const [recurringBankError, setRecurringBankError] = useState<string | null>(null);
  const [recurringBankConfirmed, setRecurringBankConfirmed] = useState(false);

  // Fetch current user email on mount to prefill submitterEmail
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.email) {
          setFormData(prev => ({
            ...prev,
            submitterEmail: prev.submitterEmail || data.user.email,
          }));
          setRecurringForm(prev => ({
            ...prev,
            submitterEmail: prev.submitterEmail || data.user.email,
          }));
        }
      })
      .catch(() => {
        // Ignore errors - user can still manually enter email
      });
  }, []);

  // Validate bank routing number when it reaches 9 digits
  useEffect(() => {
    if (formData.routingNumber.length !== 9) {
      setBankInfo(null);
      setBankError(null);
      setBankConfirmed(false);
      return;
    }

    const validateRouting = async () => {
      setBankValidating(true);
      setBankError(null);
      setBankConfirmed(false);

      try {
        const res = await fetch(`/api/bank/validate-routing?routingNumber=${formData.routingNumber}`);
        const data = await res.json();

        if (!res.ok) {
          setBankError(data.error || "Invalid routing number");
          setBankInfo(null);
        } else if (!data.supportsAch) {
          setBankError("This routing number does not support ACH transfers");
          setBankInfo(null);
        } else {
          setBankInfo({
            bankName: data.bankName,
            brandName: data.brandName,
            state: data.state,
            supportsAch: data.supportsAch,
          });
        }
      } catch (error) {
        setBankError("Failed to validate routing number");
        setBankInfo(null);
      } finally {
        setBankValidating(false);
      }
    };

    validateRouting();
  }, [formData.routingNumber]);

  // Validate recurring bank routing number when it reaches 9 digits
  useEffect(() => {
    if (recurringForm.routingNumber.length !== 9) {
      setRecurringBankInfo(null);
      setRecurringBankError(null);
      setRecurringBankConfirmed(false);
      return;
    }

    const validateRouting = async () => {
      setRecurringBankValidating(true);
      setRecurringBankError(null);
      setRecurringBankConfirmed(false);

      try {
        const res = await fetch(`/api/bank/validate-routing?routingNumber=${recurringForm.routingNumber}`);
        const data = await res.json();

        if (!res.ok) {
          setRecurringBankError(data.error || "Invalid routing number");
          setRecurringBankInfo(null);
        } else if (!data.supportsAch) {
          setRecurringBankError("This routing number does not support ACH transfers");
          setRecurringBankInfo(null);
        } else {
          setRecurringBankInfo({
            bankName: data.bankName,
            brandName: data.brandName,
            state: data.state,
            supportsAch: data.supportsAch,
          });
        }
      } catch (error) {
        setRecurringBankError("Failed to validate routing number");
        setRecurringBankInfo(null);
      } finally {
        setRecurringBankValidating(false);
      }
    };

    validateRouting();
  }, [recurringForm.routingNumber]);

  // Debounced recurring search
  const handleRecurringSearch = useCallback(async () => {
    if (recurringSearchQuery.length < 2) {
      setRecurringSearchResults([]);
      return;
    }
    setRecurringSearchLoading(true);
    try {
      const res = await fetch(`/api/payment-advance/search?q=${encodeURIComponent(recurringSearchQuery)}`);
      const data = await res.json();
      if (data.success) setRecurringSearchResults(data.results);
    } catch (error) {
      console.error("Recurring search error:", error);
    } finally {
      setRecurringSearchLoading(false);
    }
  }, [recurringSearchQuery]);

  useEffect(() => {
    const timer = setTimeout(handleRecurringSearch, 300);
    return () => clearTimeout(timer);
  }, [handleRecurringSearch]);

  // ==========================================================================
  // COMPUTED VALUES
  // ==========================================================================

  const todaysDate = new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  const amount = parseFloat(formData.amount) || 0;

  const processingFee = formData.paymentType === "card"
    ? amount * 0.035  // 3.5% for cards
    : Math.min(amount * 0.01, 10); // 1% for ACH, max $10

  const convenienceFee = waiveConvenienceFee ? 0 : CONVENIENCE_FEE;

  const totalAmount = amount + processingFee + convenienceFee;

  // Recurring computed values
  const recurringAmount = parseFloat(recurringForm.amount) || 0;
  const recurringProcessingFee = recurringForm.paymentType === "card"
    ? recurringAmount * 0.035
    : Math.min(recurringAmount * 0.01, 10);
  const recurringConvenienceFee = recurringWaiveFee ? 0 : CONVENIENCE_FEE;
  const recurringTotalAmount = recurringAmount + recurringProcessingFee + recurringConvenienceFee;
  const recurringNumPayments = parseInt(recurringForm.numberOfPayments) || 0;

  // ==========================================================================
  // SEARCH
  // ==========================================================================

  const handleSearch = useCallback(async () => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(`/api/payment-advance/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(handleSearch, 300);
    return () => clearTimeout(timer);
  }, [handleSearch]);

  // ==========================================================================
  // CUSTOMER SELECTION
  // ==========================================================================

  const handleSelectCustomer = async (customer: SearchResult) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setSearchQuery("");

    // Update form with customer info (prefill all available data)
    setFormData((prev) => ({
      ...prev,
      firstName: customer.firstName,
      lastName: customer.lastName,
      submitterEmail: prev.submitterEmail || "", // Don't overwrite if already set
    }));

    // Load policies - use local customer ID or HawkSoft client number
    if (customer.hawksoftClientNumber || customer.type === "customer") {
      setPoliciesLoading(true);
      try {
        const params = new URLSearchParams({
          customerId: customer.id,
          customerType: customer.type,
        });
        if (customer.hawksoftClientNumber) {
          params.set("hawksoftClientNumber", customer.hawksoftClientNumber);
        }
        if (customer.agencyzoomId) {
          params.set("agencyzoomId", customer.agencyzoomId);
        }

        const res = await fetch(`/api/payment-advance/customer/policies?${params}`);
        const data = await res.json();
        if (data.success) {
          setPolicies(data.policies);
        }
      } catch (error) {
        console.error("Policies error:", error);
      } finally {
        setPoliciesLoading(false);
      }
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setPolicies([]);
    setSelectedPolicy("");
    setManualPolicyEntry(false);
    setFormData((prev) => ({
      ...prev,
      firstName: "",
      lastName: "",
      policyNumber: "",
    }));
  };

  // Clear entire form and start fresh
  const handleClearForm = () => {
    setSelectedCustomer(null);
    setSearchQuery("");
    setSearchResults([]);
    setPolicies([]);
    setSelectedPolicy("");
    setManualPolicyEntry(false);
    setFormData({
      firstName: "",
      lastName: "",
      policyNumber: "",
      amount: "",
      paymentType: "card",
      cardNumber: "",
      cardExp: "",
      cardCvv: "",
      cardZip: "",
      routingNumber: "",
      accountNumber: "",
      draftDate: "",
      submitterEmail: "",
      reason: "",
      reasonDetails: "",
    });
    setWaiveConvenienceFee(false);
    setBankInfo(null);
    setBankError(null);
    setBankConfirmed(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  // ==========================================================================
  // POLICY SELECTION
  // ==========================================================================

  const handlePolicyChange = (value: string) => {
    if (value === "other") {
      setManualPolicyEntry(true);
      setSelectedPolicy("");
      setFormData((prev) => ({ ...prev, policyNumber: "" }));
    } else {
      setManualPolicyEntry(false);
      setSelectedPolicy(value);
      setFormData((prev) => ({ ...prev, policyNumber: value }));
    }
  };

  // ==========================================================================
  // FORM HANDLING
  // ==========================================================================

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Show confirmation modal before submitting
  const handleShowConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    setSubmitError(null);

    try {
      // Send raw payment data — API handles masking for storage and tokenization via ePay
      const payload: any = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        policyNumber: formData.policyNumber,
        amount: formData.amount,
        paymentType: formData.paymentType,
        draftDate: formData.draftDate,
        todaysDate,
        processingFee: processingFee.toFixed(2),
        convenienceFee: convenienceFee.toFixed(2),
        convenienceFeeWaived: waiveConvenienceFee,
        totalAmount: totalAmount.toFixed(2),
        customerId: selectedCustomer?.id,
        customerType: selectedCustomer?.type,
        reason: formData.reason,
        reasonDetails: formData.reasonDetails,
        submitterEmail: formData.submitterEmail,
      };

      if (formData.paymentType === "card") {
        payload.cardNumber = formData.cardNumber;
        payload.cardExp = formData.cardExp;
        payload.cardCvv = formData.cardCvv;
        payload.cardZip = formData.cardZip;
      } else {
        payload.routingNumber = formData.routingNumber;
        payload.accountNumber = formData.accountNumber;
      }

      const res = await fetch("/api/payment-advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitSuccess(true);
        // Reset form after 3 seconds
        setTimeout(() => {
          setSubmitSuccess(false);
          handleClearCustomer();
          setFormData({
            firstName: "",
            lastName: "",
            policyNumber: "",
            amount: "",
            paymentType: "card",
            cardNumber: "",
            cardExp: "",
            cardCvv: "",
            cardZip: "",
            routingNumber: "",
            accountNumber: "",
            draftDate: "",
            submitterEmail: "",
            reason: "",
            reasonDetails: "",
          });
          setWaiveConvenienceFee(false);
        }, 3000);
      } else {
        setSubmitError(data.error || "Failed to submit payment advance");
      }
    } catch (error: any) {
      setSubmitError(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // RECURRING HANDLERS
  // ==========================================================================

  const handleRecurringInputChange = (field: keyof RecurringFormData, value: string) => {
    setRecurringForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleRecurringSelectCustomer = async (customer: SearchResult) => {
    setRecurringSelectedCustomer(customer);
    setRecurringSearchResults([]);
    setRecurringSearchQuery("");
    setRecurringForm((prev) => ({
      ...prev,
      firstName: customer.firstName,
      lastName: customer.lastName,
    }));

    if (customer.hawksoftClientNumber || customer.type === "customer") {
      setRecurringPoliciesLoading(true);
      try {
        const params = new URLSearchParams({
          customerId: customer.id,
          customerType: customer.type,
        });
        if (customer.hawksoftClientNumber) params.set("hawksoftClientNumber", customer.hawksoftClientNumber);
        if (customer.agencyzoomId) params.set("agencyzoomId", customer.agencyzoomId);

        const res = await fetch(`/api/payment-advance/customer/policies?${params}`);
        const data = await res.json();
        if (data.success) setRecurringPolicies(data.policies);
      } catch (error) {
        console.error("Recurring policies error:", error);
      } finally {
        setRecurringPoliciesLoading(false);
      }
    }
  };

  const handleRecurringClearCustomer = () => {
    setRecurringSelectedCustomer(null);
    setRecurringPolicies([]);
    setRecurringSelectedPolicy("");
    setRecurringManualPolicy(false);
    setRecurringForm((prev) => ({ ...prev, firstName: "", lastName: "", policyNumber: "" }));
  };

  const handleRecurringPolicyChange = (value: string) => {
    if (value === "other") {
      setRecurringManualPolicy(true);
      setRecurringSelectedPolicy("");
      setRecurringForm((prev) => ({ ...prev, policyNumber: "" }));
    } else {
      setRecurringManualPolicy(false);
      setRecurringSelectedPolicy(value);
      setRecurringForm((prev) => ({ ...prev, policyNumber: value }));
    }
  };

  const handleRecurringClearForm = () => {
    setRecurringSelectedCustomer(null);
    setRecurringSearchQuery("");
    setRecurringSearchResults([]);
    setRecurringPolicies([]);
    setRecurringSelectedPolicy("");
    setRecurringManualPolicy(false);
    setRecurringForm((prev) => ({
      firstName: "",
      lastName: "",
      policyNumber: "",
      amount: "",
      paymentType: "card",
      cardNumber: "",
      cardExp: "",
      cardCvv: "",
      cardZip: "",
      routingNumber: "",
      accountNumber: "",
      numberOfPayments: "3",
      interval: "Monthly",
      startDate: "",
      submitterEmail: prev.submitterEmail,
      reason: "",
      reasonDetails: "",
    }));
    setRecurringWaiveFee(false);
    setRecurringBankInfo(null);
    setRecurringBankError(null);
    setRecurringBankConfirmed(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleRecurringShowConfirmation = (e: React.FormEvent) => {
    e.preventDefault();
    setShowRecurringConfirm(true);
  };

  const handleRecurringSubmit = async () => {
    setShowRecurringConfirm(false);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: any = {
        firstName: recurringForm.firstName,
        lastName: recurringForm.lastName,
        policyNumber: recurringForm.policyNumber,
        amount: recurringForm.amount,
        paymentType: recurringForm.paymentType,
        startDate: recurringForm.startDate,
        numberOfPayments: recurringForm.numberOfPayments,
        interval: recurringForm.interval,
        todaysDate,
        processingFee: recurringProcessingFee.toFixed(2),
        convenienceFee: recurringConvenienceFee.toFixed(2),
        convenienceFeeWaived: recurringWaiveFee,
        totalAmount: recurringTotalAmount.toFixed(2),
        customerId: recurringSelectedCustomer?.id,
        customerType: recurringSelectedCustomer?.type,
        reason: recurringForm.reason,
        reasonDetails: recurringForm.reasonDetails,
        submitterEmail: recurringForm.submitterEmail,
      };

      if (recurringForm.paymentType === "card") {
        payload.cardNumber = recurringForm.cardNumber;
        payload.cardExp = recurringForm.cardExp;
        payload.cardCvv = recurringForm.cardCvv;
        payload.cardZip = recurringForm.cardZip;
      } else {
        payload.routingNumber = recurringForm.routingNumber;
        payload.accountNumber = recurringForm.accountNumber;
      }

      const res = await fetch("/api/payment-advance/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.success) {
        setSubmitSuccess(true);
        setTimeout(() => {
          setSubmitSuccess(false);
          handleRecurringClearForm();
        }, 3000);
      } else {
        setSubmitError(data.error || "Failed to submit recurring payment");
      }
    } catch (error: any) {
      setSubmitError(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // HISTORY
  // ==========================================================================

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/payment-advance");
      const data = await res.json();
      if (data.success) {
        setAdvances(data.advances);
        setStats(data.stats);
      }
    } catch (error) {
      console.error("History error:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, loadHistory]);

  const handleMarkProcessed = async (id: string, processed: boolean) => {
    try {
      const res = await fetch(`/api/payment-advance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processed }),
      });

      if (res.ok) {
        loadHistory();
      }
    } catch (error) {
      console.error("Mark processed error:", error);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this scheduled payment?")) return;
    try {
      const res = await fetch(`/api/payment-advance/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });

      if (res.ok) {
        loadHistory();
      }
    } catch (error) {
      console.error("Cancel error:", error);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Advance</h1>
            <p className="text-sm text-gray-500 mt-1">
              Submit customer payment information for agency advances
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("form")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "form"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              New Request
            </button>
            <button
              onClick={() => setActiveTab("recurring")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "recurring"
                  ? "bg-purple-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              Recurring
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "history"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              History ({stats.pending + stats.scheduled} active)
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "form" && (
          <div className="max-w-3xl mx-auto">
            {/* Success Message */}
            {submitSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <span className="text-xl">✓</span>
                  <span className="font-medium">Payment advance submitted successfully!</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <span className="text-xl">!</span>
                  <span className="font-medium">{submitError}</span>
                </div>
              </div>
            )}

            {/* Customer Search */}
            <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>🔍</span> Customer Search
              </h2>

              {selectedCustomer ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-xl">✓</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {selectedCustomer.firstName} {selectedCustomer.lastName}
                        </span>
                        {selectedCustomer.policyCount !== undefined && selectedCustomer.policyCount > 0 && (
                          <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                            {selectedCustomer.policyCount} {selectedCustomer.policyCount === 1 ? 'policy' : 'policies'}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {selectedCustomer.type === "customer" ? "Customer" : "Lead"}
                        {selectedCustomer.phone && ` • ${selectedCustomer.phone}`}
                        {selectedCustomer.email && ` • ${selectedCustomer.email}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleClearCustomer}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name..."
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {searchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <span className="animate-spin">⏳</span>
                    </div>
                  )}

                  {/* Search Results Dropdown */}
                  {searchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                      {searchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleSelectCustomer(result)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium text-gray-900">
                              {result.firstName} {result.lastName}
                            </div>
                            {result.policyCount !== undefined && result.policyCount > 0 && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                {result.policyCount} {result.policyCount === 1 ? 'policy' : 'policies'}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap mt-1">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-xs",
                              result.type === "customer"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            )}>
                              {result.type}
                            </span>
                            {result.phone && <span>{result.phone}</span>}
                            {result.email && <span className="truncate max-w-[200px]">{result.email}</span>}
                            {result.policyTypes && result.policyTypes.length > 0 && (
                              <span className="text-xs text-gray-400">
                                ({result.policyTypes.slice(0, 3).join(', ')})
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                  <div className="bg-blue-600 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white">Confirm Payment Advance</h3>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium">{formData.firstName} {formData.lastName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Policy:</span>
                      <span className="font-medium">{formData.policyNumber}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Payment Amount:</span>
                      <span className="font-medium">${parseFloat(formData.amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Payment Method:</span>
                      <span className="font-medium">
                        {formData.paymentType === "card"
                          ? `Card ending in ${formData.cardNumber.slice(-4)}`
                          : `ACH ending in ${formData.accountNumber.slice(-4)}`}
                      </span>
                    </div>
                    {formData.paymentType === "checking" && bankInfo && (
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Bank:</span>
                        <span className="font-medium text-green-700">
                          {bankInfo.brandName || bankInfo.bankName} ✓
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Draft Date:</span>
                      <span className="font-medium">{formData.draftDate}</span>
                    </div>
                    {waiveConvenienceFee && (
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Convenience Fee:</span>
                        <span className="font-medium text-green-600">WAIVED</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 text-lg">
                      <span className="font-semibold">Total Amount:</span>
                      <span className="font-bold text-blue-600">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                    >
                      {submitting ? "Processing..." : "Confirm & Submit"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Form */}
            <form onSubmit={handleShowConfirmation} className="bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>💵</span> Payment Advance Form
                </h2>
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
                >
                  Clear Form
                </button>
              </div>

              <div className="text-sm text-gray-500 mb-6">
                Today&apos;s Date: <span className="font-medium text-gray-900">{todaysDate}</span>
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange("firstName", e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange("lastName", e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Policy Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy *
                </label>
                {policiesLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 py-2">
                    <span className="animate-spin">⏳</span>
                    <span>Loading policies...</span>
                  </div>
                ) : policies.length > 0 && !manualPolicyEntry ? (
                  <select
                    value={selectedPolicy}
                    onChange={(e) => handlePolicyChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a policy...</option>
                    {policies.map((p) => (
                      <option key={p.policyNumber} value={p.policyNumber}>
                        {p.policyNumber} - {p.type} - {p.carrier}
                      </option>
                    ))}
                    <option value="other">Other (enter manually)</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formData.policyNumber}
                      onChange={(e) => handleInputChange("policyNumber", e.target.value)}
                      placeholder="Enter policy number"
                      required
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {policies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setManualPolicyEntry(false)}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50"
                      >
                        Select from list
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => handleInputChange("amount", e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Payment Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Type *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value="card"
                      checked={formData.paymentType === "card"}
                      onChange={() => handleInputChange("paymentType", "card")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>Credit/Debit Card</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentType"
                      value="checking"
                      checked={formData.paymentType === "checking"}
                      onChange={() => handleInputChange("paymentType", "checking")}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>ACH/Checking</span>
                  </label>
                </div>
              </div>

              {/* Card Fields */}
              {formData.paymentType === "card" && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Card Number *
                      </label>
                      <input
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) => handleInputChange("cardNumber", e.target.value.replace(/\D/g, ""))}
                        maxLength={16}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expiration *
                      </label>
                      <input
                        type="text"
                        value={formData.cardExp}
                        onChange={(e) => handleInputChange("cardExp", e.target.value)}
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CVV *
                        </label>
                        <input
                          type="text"
                          value={formData.cardCvv}
                          onChange={(e) => handleInputChange("cardCvv", e.target.value.replace(/\D/g, ""))}
                          maxLength={4}
                          required
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="123"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          ZIP *
                        </label>
                        <input
                          type="text"
                          value={formData.cardZip}
                          onChange={(e) => handleInputChange("cardZip", e.target.value.replace(/\D/g, ""))}
                          maxLength={5}
                          required
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="12345"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACH Fields */}
              {formData.paymentType === "checking" && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Routing Number *
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.routingNumber}
                          onChange={(e) => handleInputChange("routingNumber", e.target.value.replace(/\D/g, ""))}
                          maxLength={9}
                          required
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                            bankError && "border-red-300 bg-red-50",
                            bankInfo && bankConfirmed && "border-green-300 bg-green-50"
                          )}
                          placeholder="123456789"
                        />
                        {bankValidating && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <span className="animate-spin text-blue-500">⏳</span>
                          </div>
                        )}
                      </div>
                      {bankError && (
                        <p className="mt-1 text-sm text-red-600">{bankError}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Account Number *
                      </label>
                      <input
                        type="text"
                        value={formData.accountNumber}
                        onChange={(e) => handleInputChange("accountNumber", e.target.value.replace(/\D/g, ""))}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Account number"
                      />
                    </div>
                  </div>

                  {/* Bank Verification */}
                  {bankInfo && !bankConfirmed && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="text-amber-500 text-xl">🏦</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">
                            Please confirm this is the correct bank:
                          </p>
                          <p className="text-lg font-semibold text-blue-700 mt-1">
                            {bankInfo.brandName || bankInfo.bankName}
                          </p>
                          {bankInfo.state && (
                            <p className="text-sm text-gray-500">State: {bankInfo.state}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => setBankConfirmed(true)}
                            className="mt-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            ✓ Yes, this is correct
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bank Confirmed */}
                  {bankInfo && bankConfirmed && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xl">✓</span>
                        <div>
                          <p className="font-medium text-green-700">
                            Bank verified: {bankInfo.brandName || bankInfo.bankName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setBankConfirmed(false)}
                          className="ml-auto text-sm text-gray-500 hover:text-gray-700"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Draft Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Draft Date *
                </label>
                <input
                  type="date"
                  value={formData.draftDate}
                  onChange={(e) => handleInputChange("draftDate", e.target.value)}
                  required
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Reason */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <select
                  value={formData.reason}
                  onChange={(e) => handleInputChange("reason", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {formData.reason === "Other" && (
                  <textarea
                    value={formData.reasonDetails}
                    onChange={(e) => handleInputChange("reasonDetails", e.target.value)}
                    placeholder="Please provide details..."
                    rows={2}
                    className="w-full mt-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>

              {/* Waive Convenience Fee */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waiveConvenienceFee}
                    onChange={(e) => setWaiveConvenienceFee(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Waive ${CONVENIENCE_FEE} convenience fee
                  </span>
                </label>
              </div>

              {/* Fee Summary */}
              {amount > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Amount:</span>
                      <span className="font-medium">${amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Processing Fee ({formData.paymentType === "card" ? "3.5%" : "1% max $10"}):
                      </span>
                      <span className="font-medium">${processingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Convenience Fee:</span>
                      <span className={cn("font-medium", waiveConvenienceFee && "text-green-600")}>
                        {waiveConvenienceFee ? "WAIVED" : `$${convenienceFee.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="border-t border-blue-200 pt-2 flex justify-between text-base">
                      <span className="font-semibold text-gray-900">Total Amount:</span>
                      <span className="font-bold text-blue-700">${totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Submitter Email */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Email (for confirmation)
                </label>
                <input
                  type="email"
                  value={formData.submitterEmail}
                  onChange={(e) => handleInputChange("submitterEmail", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="agent@tcds.com"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || amount <= 0 || (formData.paymentType === "checking" && (!bankInfo || !bankConfirmed))}
                className={cn(
                  "w-full py-3 rounded-lg font-medium text-white transition-colors",
                  submitting || amount <= 0 || (formData.paymentType === "checking" && (!bankInfo || !bankConfirmed))
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {submitting ? "Submitting..." : "Submit Payment Advance"}
              </button>
              {formData.paymentType === "checking" && formData.routingNumber.length === 9 && !bankConfirmed && !bankError && (
                <p className="mt-2 text-sm text-amber-600 text-center">
                  Please confirm the bank name above before submitting
                </p>
              )}
            </form>
          </div>
        )}

        {activeTab === "recurring" && (
          <div className="max-w-3xl mx-auto">
            {/* Success Message */}
            {submitSuccess && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <span className="text-xl">✓</span>
                  <span className="font-medium">Recurring payment schedule created successfully!</span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 text-red-700">
                  <span className="text-xl">!</span>
                  <span className="font-medium">{submitError}</span>
                </div>
              </div>
            )}

            {/* Customer Search (Recurring) */}
            <div className="bg-white rounded-lg border shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>🔍</span> Customer Search
              </h2>

              {recurringSelectedCustomer ? (
                <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 text-xl">✓</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {recurringSelectedCustomer.firstName} {recurringSelectedCustomer.lastName}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {recurringSelectedCustomer.type === "customer" ? "Customer" : "Lead"}
                        {recurringSelectedCustomer.phone && ` • ${recurringSelectedCustomer.phone}`}
                        {recurringSelectedCustomer.email && ` • ${recurringSelectedCustomer.email}`}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleRecurringClearCustomer}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={recurringSearchQuery}
                    onChange={(e) => setRecurringSearchQuery(e.target.value)}
                    placeholder="Search by customer name..."
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  {recurringSearchLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <span className="animate-spin">⏳</span>
                    </div>
                  )}

                  {recurringSearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-72 overflow-y-auto">
                      {recurringSearchResults.map((result) => (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleRecurringSelectCustomer(result)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">
                            {result.firstName} {result.lastName}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded text-xs",
                              result.type === "customer" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {result.type}
                            </span>
                            {result.phone && <span>{result.phone}</span>}
                            {result.email && <span className="truncate max-w-[200px]">{result.email}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recurring Confirmation Modal */}
            {showRecurringConfirm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                  <div className="bg-purple-600 px-6 py-4">
                    <h3 className="text-lg font-semibold text-white">Confirm Recurring Payment</h3>
                  </div>
                  <div className="px-6 py-4 space-y-3">
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Customer:</span>
                      <span className="font-medium">{recurringForm.firstName} {recurringForm.lastName}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Policy:</span>
                      <span className="font-medium">{recurringForm.policyNumber}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Amount per payment:</span>
                      <span className="font-medium">${parseFloat(recurringForm.amount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Schedule:</span>
                      <span className="font-medium">{recurringForm.numberOfPayments} payments, {recurringForm.interval}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Start Date:</span>
                      <span className="font-medium">{recurringForm.startDate}</span>
                    </div>
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Payment Method:</span>
                      <span className="font-medium">
                        {recurringForm.paymentType === "card"
                          ? `Card ending in ${recurringForm.cardNumber.slice(-4)}`
                          : `ACH ending in ${recurringForm.accountNumber.slice(-4)}`}
                      </span>
                    </div>
                    {recurringWaiveFee && (
                      <div className="flex justify-between border-b pb-2">
                        <span className="text-gray-600">Convenience Fee:</span>
                        <span className="font-medium text-green-600">WAIVED</span>
                      </div>
                    )}
                    <div className="flex justify-between border-b pb-2">
                      <span className="text-gray-600">Total per payment:</span>
                      <span className="font-bold text-purple-600">${recurringTotalAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 text-lg">
                      <span className="font-semibold">Grand Total ({recurringForm.numberOfPayments} payments):</span>
                      <span className="font-bold text-purple-600">${(recurringTotalAmount * recurringNumPayments).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="px-6 py-4 bg-gray-50 flex gap-3 justify-end">
                    <button
                      onClick={() => setShowRecurringConfirm(false)}
                      className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRecurringSubmit}
                      disabled={submitting}
                      className="px-6 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400"
                    >
                      {submitting ? "Processing..." : "Confirm & Create Schedule"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recurring Payment Form */}
            <form onSubmit={handleRecurringShowConfirmation} className="bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>🔄</span> Recurring Payment Form
                </h2>
                <button
                  type="button"
                  onClick={handleRecurringClearForm}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors"
                >
                  Clear Form
                </button>
              </div>

              <div className="mb-6 p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-purple-700">
                Creates a recurring payment schedule in ePayPolicy. The customer will be charged automatically on the specified interval.
              </div>

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={recurringForm.firstName}
                    onChange={(e) => handleRecurringInputChange("firstName", e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={recurringForm.lastName}
                    onChange={(e) => handleRecurringInputChange("lastName", e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Policy Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Policy *</label>
                {recurringPoliciesLoading ? (
                  <div className="flex items-center gap-2 text-gray-500 py-2">
                    <span className="animate-spin">⏳</span>
                    <span>Loading policies...</span>
                  </div>
                ) : recurringPolicies.length > 0 && !recurringManualPolicy ? (
                  <select
                    value={recurringSelectedPolicy}
                    onChange={(e) => handleRecurringPolicyChange(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Select a policy...</option>
                    {recurringPolicies.map((p) => (
                      <option key={p.policyNumber} value={p.policyNumber}>
                        {p.policyNumber} - {p.type} - {p.carrier}
                      </option>
                    ))}
                    <option value="other">Other (enter manually)</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={recurringForm.policyNumber}
                      onChange={(e) => handleRecurringInputChange("policyNumber", e.target.value)}
                      placeholder="Enter policy number"
                      required
                      className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                    {recurringPolicies.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRecurringManualPolicy(false)}
                        className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50"
                      >
                        Select from list
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Amount per payment */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount per Payment *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={recurringForm.amount}
                    onChange={(e) => handleRecurringInputChange("amount", e.target.value)}
                    min="0.01"
                    step="0.01"
                    required
                    className="w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Schedule Fields */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Number of Payments *</label>
                  <input
                    type="number"
                    value={recurringForm.numberOfPayments}
                    onChange={(e) => handleRecurringInputChange("numberOfPayments", e.target.value)}
                    min="2"
                    max="52"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interval *</label>
                  <select
                    value={recurringForm.interval}
                    onChange={(e) => handleRecurringInputChange("interval", e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Bi-weekly">Bi-weekly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={recurringForm.startDate}
                    onChange={(e) => handleRecurringInputChange("startDate", e.target.value)}
                    required
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Payment Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recurringPaymentType"
                      value="card"
                      checked={recurringForm.paymentType === "card"}
                      onChange={() => handleRecurringInputChange("paymentType", "card")}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span>Credit/Debit Card</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="recurringPaymentType"
                      value="checking"
                      checked={recurringForm.paymentType === "checking"}
                      onChange={() => handleRecurringInputChange("paymentType", "checking")}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span>ACH/Checking</span>
                  </label>
                </div>
              </div>

              {/* Card Fields */}
              {recurringForm.paymentType === "card" && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Card Number *</label>
                      <input
                        type="text"
                        value={recurringForm.cardNumber}
                        onChange={(e) => handleRecurringInputChange("cardNumber", e.target.value.replace(/\D/g, ""))}
                        maxLength={16}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Expiration *</label>
                      <input
                        type="text"
                        value={recurringForm.cardExp}
                        onChange={(e) => handleRecurringInputChange("cardExp", e.target.value)}
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CVV *</label>
                        <input
                          type="text"
                          value={recurringForm.cardCvv}
                          onChange={(e) => handleRecurringInputChange("cardCvv", e.target.value.replace(/\D/g, ""))}
                          maxLength={4}
                          required
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          placeholder="123"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">ZIP *</label>
                        <input
                          type="text"
                          value={recurringForm.cardZip}
                          onChange={(e) => handleRecurringInputChange("cardZip", e.target.value.replace(/\D/g, ""))}
                          maxLength={5}
                          required
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                          placeholder="12345"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ACH Fields */}
              {recurringForm.paymentType === "checking" && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Routing Number *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={recurringForm.routingNumber}
                          onChange={(e) => handleRecurringInputChange("routingNumber", e.target.value.replace(/\D/g, ""))}
                          maxLength={9}
                          required
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500",
                            recurringBankError && "border-red-300 bg-red-50",
                            recurringBankInfo && recurringBankConfirmed && "border-green-300 bg-green-50"
                          )}
                          placeholder="123456789"
                        />
                        {recurringBankValidating && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <span className="animate-spin text-purple-500">⏳</span>
                          </div>
                        )}
                      </div>
                      {recurringBankError && (
                        <p className="mt-1 text-sm text-red-600">{recurringBankError}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Number *</label>
                      <input
                        type="text"
                        value={recurringForm.accountNumber}
                        onChange={(e) => handleRecurringInputChange("accountNumber", e.target.value.replace(/\D/g, ""))}
                        required
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        placeholder="Account number"
                      />
                    </div>
                  </div>

                  {/* Bank Verification */}
                  {recurringBankInfo && !recurringBankConfirmed && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="text-amber-500 text-xl">🏦</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">Please confirm this is the correct bank:</p>
                          <p className="text-lg font-semibold text-purple-700 mt-1">
                            {recurringBankInfo.brandName || recurringBankInfo.bankName}
                          </p>
                          {recurringBankInfo.state && (
                            <p className="text-sm text-gray-500">State: {recurringBankInfo.state}</p>
                          )}
                          <button
                            type="button"
                            onClick={() => setRecurringBankConfirmed(true)}
                            className="mt-2 px-4 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                          >
                            ✓ Yes, this is correct
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {recurringBankInfo && recurringBankConfirmed && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-xl">✓</span>
                        <p className="font-medium text-green-700">
                          Bank verified: {recurringBankInfo.brandName || recurringBankInfo.bankName}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRecurringBankConfirmed(false)}
                          className="ml-auto text-sm text-gray-500 hover:text-gray-700"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={recurringForm.reason}
                  onChange={(e) => handleRecurringInputChange("reason", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  {REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {recurringForm.reason === "Other" && (
                  <textarea
                    value={recurringForm.reasonDetails}
                    onChange={(e) => handleRecurringInputChange("reasonDetails", e.target.value)}
                    placeholder="Please provide details..."
                    rows={2}
                    className="w-full mt-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                )}
              </div>

              {/* Waive Convenience Fee */}
              <div className="mb-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recurringWaiveFee}
                    onChange={(e) => setRecurringWaiveFee(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    Waive ${CONVENIENCE_FEE} convenience fee
                  </span>
                </label>
              </div>

              {/* Fee Summary */}
              {recurringAmount > 0 && (
                <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount per payment:</span>
                      <span className="font-medium">${recurringAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        Processing Fee ({recurringForm.paymentType === "card" ? "3.5%" : "1% max $10"}):
                      </span>
                      <span className="font-medium">${recurringProcessingFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Convenience Fee:</span>
                      <span className={cn("font-medium", recurringWaiveFee && "text-green-600")}>
                        {recurringWaiveFee ? "WAIVED" : `$${recurringConvenienceFee.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="border-t border-purple-200 pt-2 flex justify-between text-base">
                      <span className="font-semibold text-gray-900">Total per payment:</span>
                      <span className="font-bold text-purple-700">${recurringTotalAmount.toFixed(2)}</span>
                    </div>
                    {recurringNumPayments >= 2 && (
                      <div className="flex justify-between text-base">
                        <span className="font-semibold text-gray-900">Grand total ({recurringNumPayments} payments):</span>
                        <span className="font-bold text-purple-700">${(recurringTotalAmount * recurringNumPayments).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submitter Email */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Your Email (for confirmation)</label>
                <input
                  type="email"
                  value={recurringForm.submitterEmail}
                  onChange={(e) => handleRecurringInputChange("submitterEmail", e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="agent@tcds.com"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || recurringAmount <= 0 || recurringNumPayments < 2 || (recurringForm.paymentType === "checking" && (!recurringBankInfo || !recurringBankConfirmed))}
                className={cn(
                  "w-full py-3 rounded-lg font-medium text-white transition-colors",
                  submitting || recurringAmount <= 0 || recurringNumPayments < 2 || (recurringForm.paymentType === "checking" && (!recurringBankInfo || !recurringBankConfirmed))
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-purple-600 hover:bg-purple-700"
                )}
              >
                {submitting ? "Creating Schedule..." : "Submit Recurring Payment"}
              </button>
              {recurringForm.paymentType === "checking" && recurringForm.routingNumber.length === 9 && !recurringBankConfirmed && !recurringBankError && (
                <p className="mt-2 text-sm text-amber-600 text-center">
                  Please confirm the bank name above before submitting
                </p>
              )}
            </form>
          </div>
        )}

        {activeTab === "history" && (
          /* History Tab */
          <div className="max-w-5xl mx-auto">
            {/* Stats */}
            <div className="grid grid-cols-6 gap-4 mb-6">
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
                <div className="text-sm text-gray-500">Pending</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
                <div className="text-sm text-gray-500">Scheduled</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
                <div className="text-sm text-gray-500">Processed</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                <div className="text-sm text-gray-500">Failed</div>
              </div>
              <div className="bg-white rounded-lg border p-4 text-center">
                <div className="text-2xl font-bold text-gray-400">{stats.cancelled}</div>
                <div className="text-sm text-gray-500">Cancelled</div>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <span className="animate-spin text-3xl">⏳</span>
                </div>
              ) : advances.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-3">📋</div>
                  <h3 className="text-lg font-medium text-gray-900">No payment advances yet</h3>
                  <p className="text-gray-500">Submit your first payment advance to see it here.</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Policy
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Draft Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {advances.map((adv) => (
                      <tr key={adv.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {adv.firstName} {adv.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {adv.submitterEmail || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {adv.policyNumber}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            ${adv.totalAmount.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Base: ${adv.amount.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {adv.draftDate}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              adv.status === "pending" && "bg-amber-100 text-amber-700",
                              adv.status === "scheduled" && "bg-blue-100 text-blue-700",
                              adv.status === "processed" && "bg-green-100 text-green-700",
                              adv.status === "failed" && "bg-red-100 text-red-700",
                              adv.status === "cancelled" && "bg-gray-100 text-gray-500"
                            )}
                          >
                            {adv.status}
                          </span>
                          {adv.isRecurring && (
                            <span className="ml-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                              {adv.numberOfPayments}x {adv.paymentInterval}
                            </span>
                          )}
                          {adv.status === "failed" && adv.epayError && (
                            <div className="text-xs text-red-500 mt-1 max-w-[200px] truncate" title={adv.epayError}>
                              {adv.epayError}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {/* Legacy records (no ePay) — manual mark processed */}
                            {adv.status === "pending" && !adv.epayScheduleId && (
                              <button
                                onClick={() => handleMarkProcessed(adv.id, true)}
                                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                              >
                                Mark Processed
                              </button>
                            )}
                            {/* Scheduled ePay records — cancel button */}
                            {adv.status === "scheduled" && (
                              <button
                                onClick={() => handleCancel(adv.id)}
                                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                Cancel
                              </button>
                            )}
                            {/* Processed legacy records — reopen */}
                            {adv.status === "processed" && !adv.epayScheduleId && (
                              <button
                                onClick={() => handleMarkProcessed(adv.id, false)}
                                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                              >
                                Reopen
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
        </div>
    </div>
  );
}
