"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Receipt,
  Download,
  Send,
  Loader2,
  Check,
  AlertCircle,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// =============================================================================
// TYPES
// =============================================================================

interface PolicyFromSearch {
  id: string;
  policyNumber: string;
  carrier: string | null;
  lineOfBusiness: string | null;
  type: string | null;
  status: string;
  isActive: boolean;
  expirationDate: string | null;
}

interface SearchResult {
  id: string;
  type: "customer" | "lead";
  firstName: string;
  lastName: string;
  displayName?: string;
  email?: string;
  phone?: string;
  hawksoftClientNumber?: string;
  agencyzoomId?: string;
  policyCount?: number;
  policyTypes?: string[];
  policies?: PolicyFromSearch[];
}

interface CustomerPolicy {
  policyNumber: string;
  carrier: string;
  type: string;
  status?: string;
  expirationDate?: string;
}

interface ReceiptData {
  customerName: string;
  customerAddress: string;
  policyNumber: string;
  carrier: string;
  policyType: string;
  amount: string;
  paymentMethod: "cash" | "check";
  checkNumber: string;
  paymentDate: string;
  receiptNumber: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function generateReceiptNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `REC-${datePart}-${randomPart}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr + "T00:00:00");
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ReceiptGeneratorPage() {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchResult | null>(null);

  // Policy state
  const [policies, setPolicies] = useState<CustomerPolicy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("");
  const [manualPolicyEntry, setManualPolicyEntry] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ReceiptData>({
    customerName: "",
    customerAddress: "",
    policyNumber: "",
    carrier: "",
    policyType: "",
    amount: "",
    paymentMethod: "cash",
    checkNumber: "",
    paymentDate: new Date().toISOString().split("T")[0],
    receiptNumber: generateReceiptNumber(),
  });

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [generatedPdf, setGeneratedPdf] = useState<Uint8Array | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
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

    // Update form with customer info
    const displayName = customer.displayName || `${customer.firstName} ${customer.lastName}`;
    setFormData((prev) => ({
      ...prev,
      customerName: displayName,
    }));

    // Use policies from search result (already includes all active policies)
    if (customer.policies && customer.policies.length > 0) {
      // Filter to only active policies and map to our format
      const activePolicies = customer.policies
        .filter((p) => p.isActive)
        .map((p) => ({
          policyNumber: p.policyNumber,
          carrier: p.carrier || "Unknown Carrier",
          type: p.type || p.lineOfBusiness || "Unknown",
          status: p.status,
          expirationDate: p.expirationDate || undefined,
        }));
      setPolicies(activePolicies);
    } else {
      setPolicies([]);
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setPolicies([]);
    setSelectedPolicy("");
    setManualPolicyEntry(false);
    setGeneratedPdf(null);
    setFormData((prev) => ({
      ...prev,
      customerName: "",
      customerAddress: "",
      policyNumber: "",
      carrier: "",
      policyType: "",
      receiptNumber: generateReceiptNumber(),
    }));
  };

  // ==========================================================================
  // POLICY SELECTION
  // ==========================================================================

  const handlePolicyChange = (value: string) => {
    if (value === "other") {
      setManualPolicyEntry(true);
      setSelectedPolicy("");
      setFormData((prev) => ({
        ...prev,
        policyNumber: "",
        carrier: "",
        policyType: "",
      }));
    } else {
      setManualPolicyEntry(false);
      setSelectedPolicy(value);

      // Find the selected policy and populate carrier/type
      const policy = policies.find((p) => p.policyNumber === value);
      setFormData((prev) => ({
        ...prev,
        policyNumber: value,
        carrier: policy?.carrier || "",
        policyType: policy?.type || "",
      }));
    }
    setGeneratedPdf(null);
  };

  // ==========================================================================
  // FORM HANDLING
  // ==========================================================================

  const updateField = (field: keyof ReceiptData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setGeneratedPdf(null);
  };

  // ==========================================================================
  // PDF GENERATION
  // ==========================================================================

  const generatePdf = async () => {
    setIsGenerating(true);

    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const { width, height } = page.getSize();

      // Load fonts
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Colors
      const primaryColor = rgb(0.02, 0.59, 0.41); // Emerald
      const darkColor = rgb(0.12, 0.16, 0.21);
      const grayColor = rgb(0.42, 0.45, 0.49);
      const lightGray = rgb(0.94, 0.95, 0.96);

      let y = height - 50;

      // Header background
      page.drawRectangle({
        x: 0,
        y: height - 100,
        width: width,
        height: 100,
        color: primaryColor,
      });

      // Company name
      page.drawText("TCDS Insurance Agency", {
        x: 50,
        y: height - 50,
        size: 22,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      // Receipt title
      page.drawText("PAYMENT RECEIPT", {
        x: 50,
        y: height - 80,
        size: 14,
        font: helvetica,
        color: rgb(1, 1, 1),
      });

      y = height - 140;

      // Receipt info box
      page.drawRectangle({
        x: width - 220,
        y: height - 170,
        width: 170,
        height: 60,
        color: lightGray,
      });

      page.drawText("Receipt #:", {
        x: width - 210,
        y: height - 135,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
      page.drawText(formData.receiptNumber, {
        x: width - 210,
        y: height - 150,
        size: 11,
        font: helveticaBold,
        color: darkColor,
      });

      page.drawText("Date:", {
        x: width - 100,
        y: height - 135,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
      page.drawText(formatDisplayDate(formData.paymentDate), {
        x: width - 100,
        y: height - 150,
        size: 10,
        font: helveticaBold,
        color: darkColor,
      });

      y = height - 200;

      // Divider line
      page.drawLine({
        start: { x: 50, y },
        end: { x: width - 50, y },
        thickness: 1,
        color: lightGray,
      });

      y -= 30;

      // Received From section
      page.drawText("RECEIVED FROM:", {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
      y -= 18;

      page.drawText(formData.customerName || "Customer Name", {
        x: 50,
        y,
        size: 14,
        font: helveticaBold,
        color: darkColor,
      });
      y -= 18;

      if (formData.customerAddress) {
        const addressLines = formData.customerAddress.split("\n");
        for (const line of addressLines) {
          page.drawText(line, {
            x: 50,
            y,
            size: 11,
            font: helvetica,
            color: darkColor,
          });
          y -= 16;
        }
      }

      y -= 20;

      // Policy section
      page.drawText("POLICY INFORMATION:", {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
      y -= 18;

      const policyInfo = [
        { label: "Policy #:", value: formData.policyNumber || "N/A" },
        { label: "Carrier:", value: formData.carrier || "N/A" },
        { label: "Type:", value: formData.policyType || "N/A" },
      ];

      for (const info of policyInfo) {
        page.drawText(info.label, {
          x: 50,
          y,
          size: 11,
          font: helvetica,
          color: grayColor,
        });
        page.drawText(info.value, {
          x: 130,
          y,
          size: 11,
          font: helveticaBold,
          color: darkColor,
        });
        y -= 18;
      }

      y -= 20;

      // Payment Details section
      page.drawText("PAYMENT DETAILS:", {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
      y -= 20;

      // Amount box
      page.drawRectangle({
        x: 50,
        y: y - 40,
        width: 200,
        height: 55,
        color: lightGray,
      });

      page.drawText("Amount Received", {
        x: 60,
        y: y - 5,
        size: 10,
        font: helvetica,
        color: grayColor,
      });

      const amountText = formData.amount
        ? `$${parseFloat(formData.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
        : "$0.00";
      page.drawText(amountText, {
        x: 60,
        y: y - 30,
        size: 24,
        font: helveticaBold,
        color: primaryColor,
      });

      // Payment method
      let methodText = formData.paymentMethod === "cash" ? "Cash" : "Check";
      if (formData.paymentMethod === "check" && formData.checkNumber) {
        methodText += ` #${formData.checkNumber}`;
      }

      page.drawText("Payment Method:", {
        x: 280,
        y: y - 5,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
      page.drawText(methodText, {
        x: 280,
        y: y - 22,
        size: 12,
        font: helveticaBold,
        color: darkColor,
      });

      y -= 80;

      // Divider
      page.drawLine({
        start: { x: 50, y },
        end: { x: width - 50, y },
        thickness: 1,
        color: lightGray,
      });

      y -= 40;

      // Thank you message
      page.drawText("Thank you for your payment!", {
        x: (width - 180) / 2,
        y,
        size: 14,
        font: helveticaBold,
        color: darkColor,
      });

      y -= 30;

      page.drawText("This receipt confirms your payment has been received.", {
        x: (width - 280) / 2,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });

      // Footer
      page.drawRectangle({
        x: 0,
        y: 0,
        width: width,
        height: 80,
        color: rgb(0.12, 0.16, 0.21),
      });

      page.drawText("TCDS Insurance Agency", {
        x: 50,
        y: 55,
        size: 12,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      page.drawText("PO BOX 1283, Pinson, AL 35126", {
        x: 50,
        y: 38,
        size: 10,
        font: helvetica,
        color: rgb(0.7, 0.7, 0.7),
      });

      page.drawText("Phone: (205) 847-5616 | Email: agency@tcdsagency.com", {
        x: 50,
        y: 22,
        size: 10,
        font: helvetica,
        color: rgb(0.7, 0.7, 0.7),
      });

      const pdfBytes = await pdfDoc.save();
      setGeneratedPdf(pdfBytes);

      setNotification({
        type: "success",
        message: "Receipt generated successfully!",
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      setNotification({
        type: "error",
        message: "Failed to generate PDF",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // ==========================================================================
  // PDF DOWNLOAD
  // ==========================================================================

  const downloadPdf = () => {
    if (!generatedPdf) return;

    const pdfBytes = new Uint8Array(generatedPdf);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Receipt-${formData.receiptNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ==========================================================================
  // EMAIL
  // ==========================================================================

  const sendEmail = async () => {
    if (!generatedPdf) return;

    setIsSendingEmail(true);

    try {
      // Convert Uint8Array to base64
      const base64 = btoa(
        String.fromCharCode.apply(null, Array.from(generatedPdf))
      );

      const res = await fetch("/api/receipt/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfBase64: base64,
          receiptNumber: formData.receiptNumber,
          customerName: formData.customerName,
          amount: formData.amount,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setNotification({
          type: "success",
          message: "Receipt emailed to agency@tcdsagency.com",
        });
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to send email",
        });
      }
    } catch (error) {
      console.error("Email error:", error);
      setNotification({
        type: "error",
        message: "Failed to send email",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // ==========================================================================
  // VALIDATION
  // ==========================================================================

  const canGenerate =
    formData.customerName &&
    formData.policyNumber &&
    formData.amount &&
    parseFloat(formData.amount) > 0;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Receipt className="w-7 h-7 text-emerald-600" />
          Payment Receipt
        </h1>
        <p className="text-gray-500 mt-1">
          Generate receipts for in-office cash and check payments
        </p>
      </div>

      {/* Notification */}
      {notification && (
        <div
          className={cn(
            "mb-6 p-4 rounded-lg flex items-center gap-3",
            notification.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          )}
        >
          {notification.type === "success" ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          <span>{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-auto hover:bg-black/5 rounded p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Search */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-gray-400" />
              Customer Search
            </h3>

            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-green-600 text-xl">
                    <Check className="w-5 h-5" />
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {selectedCustomer.displayName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`}
                      </span>
                      {selectedCustomer.policyCount !== undefined && selectedCustomer.policyCount > 0 && (
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded">
                          {selectedCustomer.policyCount} {selectedCustomer.policyCount === 1 ? "policy" : "policies"}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedCustomer.type === "customer" ? "Customer" : "Lead"}
                      {selectedCustomer.phone && ` - ${selectedCustomer.phone}`}
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
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by customer name..."
                    className="pl-10"
                  />
                  {searchLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>

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
                            {result.displayName || `${result.firstName} ${result.lastName}`}
                          </div>
                          {result.policyCount !== undefined && result.policyCount > 0 && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                              {result.policyCount} {result.policyCount === 1 ? "policy" : "policies"}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap mt-1">
                          <span
                            className={cn(
                              "px-1.5 py-0.5 rounded text-xs",
                              result.type === "customer"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-amber-100 text-amber-700"
                            )}
                          >
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

          {/* Policy Selection */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Policy Selection</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Policy *
              </label>
              {policies.length > 0 && !manualPolicyEntry ? (
                <select
                  value={selectedPolicy}
                  onChange={(e) => handlePolicyChange(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
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
                <div className="space-y-3">
                  <Input
                    value={formData.policyNumber}
                    onChange={(e) => updateField("policyNumber", e.target.value)}
                    placeholder="Enter policy number"
                  />
                  {policies.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setManualPolicyEntry(false)}
                      className="text-sm text-emerald-600 hover:text-emerald-700"
                    >
                      Select from list instead
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier
                </label>
                <Input
                  value={formData.carrier}
                  onChange={(e) => updateField("carrier", e.target.value)}
                  placeholder="Insurance carrier"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Type
                </label>
                <Input
                  value={formData.policyType}
                  onChange={(e) => updateField("policyType", e.target.value)}
                  placeholder="e.g., Homeowners, Auto"
                />
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => updateField("amount", e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date *
                </label>
                <Input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => updateField("paymentDate", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cash"
                      checked={formData.paymentMethod === "cash"}
                      onChange={() => updateField("paymentMethod", "cash")}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span>Cash</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="check"
                      checked={formData.paymentMethod === "check"}
                      onChange={() => updateField("paymentMethod", "check")}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span>Check</span>
                  </label>
                </div>
              </div>

              {formData.paymentMethod === "check" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check Number
                  </label>
                  <Input
                    value={formData.checkNumber}
                    onChange={(e) => updateField("checkNumber", e.target.value)}
                    placeholder="Check number"
                  />
                </div>
              )}
            </div>

            {/* Customer Address (optional) */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Address (optional)
              </label>
              <textarea
                value={formData.customerAddress}
                onChange={(e) => updateField("customerAddress", e.target.value)}
                placeholder="123 Main Street&#10;Birmingham, AL 35203"
                rows={2}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Preview & Actions */}
        <div className="space-y-4">
          {/* Receipt Preview Card */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-emerald-600 text-white px-4 py-3">
              <h3 className="font-semibold">Receipt Preview</h3>
            </div>

            <div className="p-4 text-sm">
              <div className="space-y-2 text-gray-600">
                <div className="flex justify-between">
                  <span>Receipt #:</span>
                  <span className="font-medium text-gray-900 font-mono text-xs">
                    {formData.receiptNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span className="font-medium text-gray-900">
                    {formatDisplayDate(formData.paymentDate)}
                  </span>
                </div>
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between">
                    <span>Customer:</span>
                    <span className="font-medium text-gray-900">
                      {formData.customerName || "-"}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span>Policy #:</span>
                  <span className="font-medium text-gray-900">
                    {formData.policyNumber || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Carrier:</span>
                  <span className="font-medium text-gray-900">
                    {formData.carrier || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Method:</span>
                  <span className="font-medium text-gray-900">
                    {formData.paymentMethod === "cash"
                      ? "Cash"
                      : formData.checkNumber
                      ? `Check #${formData.checkNumber}`
                      : "Check"}
                  </span>
                </div>

                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Amount:</span>
                    <span className="font-bold text-emerald-600">
                      {formData.amount
                        ? `$${parseFloat(formData.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        : "$0.00"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <Button
            onClick={generatePdf}
            disabled={!canGenerate || isGenerating}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Receipt className="w-4 h-4 mr-2" />
                Generate Receipt
              </>
            )}
          </Button>

          {generatedPdf && (
            <>
              <Button
                onClick={downloadPdf}
                variant="outline"
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>

              <Button
                onClick={sendEmail}
                disabled={isSendingEmail}
                variant="outline"
                className="w-full"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Email to Agency
                  </>
                )}
              </Button>
            </>
          )}

          {/* Required Fields Note */}
          <p className="text-xs text-gray-500 text-center">* Required fields</p>
        </div>
      </div>
    </div>
  );
}
