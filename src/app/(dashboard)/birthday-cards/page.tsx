"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Cake,
  MapPin,
  Calendar,
  Users,
  Check,
  Mail,
  Loader2,
  X,
  Send,
  MailCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// =============================================================================
// TYPES
// =============================================================================

interface BirthdayCustomer {
  id: string;
  agencyzoomId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  preferredName: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  birthDay?: number;
  birthMonth?: number;
  age?: number;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    formatted: string;
  };
  // Local tracking (not persisted)
  cardPrepared?: boolean;
  cardMailed?: boolean;
}

// =============================================================================
// MONTH NAMES
// =============================================================================

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BirthdayCardsPage() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [customers, setCustomers] = useState<BirthdayCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Card writing mode
  const [isCardMode, setIsCardMode] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Track prepared and mailed status locally
  const [preparedIds, setPreparedIds] = useState<Set<string>>(new Set());
  const [mailedIds, setMailedIds] = useState<Set<string>>(new Set());

  // ==========================================================================
  // FETCH CUSTOMERS
  // ==========================================================================

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/customers/birthdays?month=${selectedMonth}&year=${selectedYear}`
      );
      const data = await res.json();

      if (data.success) {
        setCustomers(data.customers);
      } else {
        setError(data.error || "Failed to fetch customers");
      }
    } catch (err) {
      setError("Failed to fetch birthday customers");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // ==========================================================================
  // POST NOTE TO AGENCYZOOM
  // ==========================================================================

  const postNote = async (customerId: string, noteContent: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/agencyzoom/contacts/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteContent }),
      });

      const data = await res.json();
      return data.success;
    } catch (err) {
      console.error("Failed to post note:", err);
      return false;
    }
  };

  // ==========================================================================
  // CARD FLOW HANDLERS
  // ==========================================================================

  const startCardFlow = () => {
    if (customers.length === 0) {
      toast.error("No customers with birthdays this month");
      return;
    }
    setCurrentIndex(0);
    setIsCardMode(true);
  };

  const exitCardFlow = () => {
    setIsCardMode(false);
    setCurrentIndex(0);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = async () => {
    const customer = customers[currentIndex];
    const customerId = customer.agencyzoomId || customer.id;

    // Only post "prepared" note if not already prepared
    if (!preparedIds.has(customer.id)) {
      setActionLoading(true);

      const today = new Date().toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });

      const noteContent = `Annual birthday card prepared for mailing on ${today}`;
      const success = await postNote(customerId, noteContent);

      setActionLoading(false);

      if (success) {
        setPreparedIds((prev) => new Set([...prev, customer.id]));
        toast.success("Note posted - card marked as prepared");
      } else {
        toast.error("Failed to post note to AgencyZoom");
        // Still advance even if note fails
      }
    }

    // Advance to next or exit
    if (currentIndex < customers.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      toast.success("All cards prepared!");
      setIsCardMode(false);
    }
  };

  const handleMarkAsMailed = async (customer: BirthdayCustomer) => {
    const customerId = customer.agencyzoomId || customer.id;
    setActionLoading(true);

    const today = new Date().toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    const noteContent = `Birthday card marked as mailed on ${today}`;
    const success = await postNote(customerId, noteContent);

    setActionLoading(false);

    if (success) {
      setMailedIds((prev) => new Set([...prev, customer.id]));
      toast.success("Marked as mailed!");
    } else {
      toast.error("Failed to post mailed note");
    }
  };

  const handleBulkMarkMailed = async () => {
    const preparedNotMailed = customers.filter(
      (c) => preparedIds.has(c.id) && !mailedIds.has(c.id)
    );

    if (preparedNotMailed.length === 0) {
      toast.error("No prepared cards to mark as mailed");
      return;
    }

    const confirmed = confirm(
      `Mark ${preparedNotMailed.length} cards as mailed?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    let successCount = 0;

    for (const customer of preparedNotMailed) {
      const customerId = customer.agencyzoomId || customer.id;
      const today = new Date().toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });

      const success = await postNote(
        customerId,
        `Birthday card marked as mailed on ${today}`
      );

      if (success) {
        setMailedIds((prev) => new Set([...prev, customer.id]));
        successCount++;
      }
    }

    setActionLoading(false);
    toast.success(`${successCount} cards marked as mailed`);
  };

  // ==========================================================================
  // KEYBOARD NAVIGATION (Enter key to advance)
  // ==========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Enter key in card mode when not loading
      if (isCardMode && e.key === "Enter" && !actionLoading) {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCardMode, actionLoading, currentIndex, customers, preparedIds]);

  // ==========================================================================
  // RENDER - CARD WRITING MODE
  // ==========================================================================

  if (isCardMode && customers.length > 0) {
    const customer = customers[currentIndex];
    const isPrepared = preparedIds.has(customer.id);
    const isMailed = mailedIds.has(customer.id);

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={exitCardFlow}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
              <span>Exit Card Mode</span>
            </button>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg px-3 py-1">
                {currentIndex + 1} / {customers.length}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {isPrepared && !isMailed && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleMarkAsMailed(customer)}
                  disabled={actionLoading}
                  className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                >
                  <MailCheck className="w-4 h-4 mr-2" />
                  Mark Mailed
                </Button>
              )}
              {isMailed && (
                <Badge className="bg-emerald-500 text-white">
                  <Check className="w-3 h-3 mr-1" />
                  Mailed
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Main Content - Centered Card */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-2xl">
            {/* Address Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border-2 border-gray-200 dark:border-gray-700 p-12 text-center">
              {/* Birthday Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-pink-100 dark:bg-pink-900/30 mb-6">
                <Cake className="w-8 h-8 text-pink-500" />
              </div>

              {/* Customer Name */}
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                {customer.preferredName}
              </h1>

              {/* Full Name (if different) */}
              {customer.preferredName !== customer.fullName && (
                <p className="text-lg text-gray-500 dark:text-gray-400 mb-6">
                  ({customer.fullName})
                </p>
              )}

              {/* Birthday */}
              <p className="text-lg text-pink-600 dark:text-pink-400 mb-8">
                <Calendar className="w-5 h-5 inline mr-2" />
                {MONTHS[selectedMonth - 1]} {customer.birthDay}
                {customer.age && ` — Turning ${customer.age}`}
              </p>

              {/* Divider */}
              <div className="border-t border-gray-200 dark:border-gray-700 my-8" />

              {/* Mailing Address */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Mailing Address
                </p>
                <div className="text-2xl font-medium text-gray-900 dark:text-white leading-relaxed">
                  <p>{customer.address.street}</p>
                  <p>
                    {customer.address.city}, {customer.address.state}{" "}
                    {customer.address.zip}
                  </p>
                </div>
              </div>

              {/* Status Badges */}
              <div className="mt-8 flex items-center justify-center gap-3">
                {isPrepared && (
                  <Badge className="bg-blue-500 text-white">
                    <Send className="w-3 h-3 mr-1" />
                    Prepared
                  </Badge>
                )}
                {isMailed && (
                  <Badge className="bg-emerald-500 text-white">
                    <MailCheck className="w-3 h-3 mr-1" />
                    Mailed
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePrevious}
              disabled={currentIndex === 0 || actionLoading}
              className="w-32"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Back
            </Button>

            <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
              {isPrepared ? (
                <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Card prepared
                </span>
              ) : (
                <span>Press <kbd className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs font-mono">Enter</kbd> or click Next</span>
              )}
            </div>

            <Button
              size="lg"
              onClick={handleNext}
              disabled={actionLoading}
              className="w-32 bg-blue-600 hover:bg-blue-700"
            >
              {actionLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : currentIndex === customers.length - 1 ? (
                "Finish"
              ) : (
                <>
                  Next
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER - LIST VIEW
  // ==========================================================================

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Cake className="w-7 h-7 text-pink-500" />
              Birthday Cards
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Prepare and track handwritten birthday cards
            </p>
          </div>
        </div>

        {/* Month/Year Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2 block">
                Select Month
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-24 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {[currentDate.getFullYear(), currentDate.getFullYear() + 1].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={startCardFlow}
                disabled={loading || customers.length === 0}
                className="bg-pink-600 hover:bg-pink-700"
              >
                <Mail className="w-4 h-4 mr-2" />
                Start Card Flow
              </Button>

              {preparedIds.size > 0 && preparedIds.size > mailedIds.size && (
                <Button
                  variant="outline"
                  onClick={handleBulkMarkMailed}
                  disabled={actionLoading}
                  className="border-emerald-300 text-emerald-600 hover:bg-emerald-50"
                >
                  <MailCheck className="w-4 h-4 mr-2" />
                  Mark All Mailed ({preparedIds.size - mailedIds.size})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {loading ? "-" : customers.length}
                </p>
                <p className="text-xs text-gray-500">Total Birthdays</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Send className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {preparedIds.size}
                </p>
                <p className="text-xs text-gray-500">Cards Prepared</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <MailCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mailedIds.size}
                </p>
                <p className="text-xs text-gray-500">Cards Mailed</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.max(0, customers.length - preparedIds.size)}
                </p>
                <p className="text-xs text-gray-500">Remaining</p>
              </div>
            </div>
          </div>
        </div>

        {/* Customer List */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Loading birthdays...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-3" />
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Cake className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
              No birthdays in {MONTHS[selectedMonth - 1]}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Try selecting a different month
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {customers.map((customer, index) => {
                const isPrepared = preparedIds.has(customer.id);
                const isMailed = mailedIds.has(customer.id);

                return (
                  <div
                    key={customer.id}
                    className={cn(
                      "p-4 flex items-center gap-4 transition-colors",
                      isMailed && "bg-emerald-50 dark:bg-emerald-900/10",
                      isPrepared && !isMailed && "bg-blue-50 dark:bg-blue-900/10"
                    )}
                  >
                    {/* Day Badge */}
                    <div className="w-14 h-14 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs text-pink-600 dark:text-pink-400 font-medium">
                        {MONTHS[selectedMonth - 1].slice(0, 3)}
                      </span>
                      <span className="text-xl font-bold text-pink-700 dark:text-pink-300">
                        {customer.birthDay}
                      </span>
                    </div>

                    {/* Customer Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {customer.fullName}
                        </h3>
                        {customer.age && (
                          <Badge variant="outline" className="text-xs">
                            Turning {customer.age}
                          </Badge>
                        )}
                        {isPrepared && (
                          <Badge className="bg-blue-500 text-white text-xs">
                            <Send className="w-3 h-3 mr-1" />
                            Prepared
                          </Badge>
                        )}
                        {isMailed && (
                          <Badge className="bg-emerald-500 text-white text-xs">
                            <MailCheck className="w-3 h-3 mr-1" />
                            Mailed
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          {customer.address.street}, {customer.address.city},{" "}
                          {customer.address.state} {customer.address.zip}
                        </span>
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isPrepared && !isMailed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkAsMailed(customer)}
                          disabled={actionLoading}
                          className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                        >
                          <MailCheck className="w-4 h-4 mr-1" />
                          Mark Mailed
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
