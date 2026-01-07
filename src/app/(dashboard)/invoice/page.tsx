"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Upload,
  Download,
  Send,
  Loader2,
  Check,
  AlertCircle,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// =============================================================================
// CONSTANTS
// =============================================================================

const LINES_OF_BUSINESS = [
  "Homeowners",
  "Flood",
  "Auto",
  "Commercial Auto",
  "Commercial Property",
  "General Liability",
  "Workers Comp",
  "Umbrella",
  "Other",
];

const CARRIERS = [
  "Travelers",
  "Progressive",
  "State Auto",
  "Safeco",
  "Foremost",
  "National General",
  "Dairyland",
  "AICO",
  "American Traditions",
  "Openly",
  "SageSure",
  "Palomar",
  "Universal Property",
  "Citizens",
  "Heritage",
  "Slide",
  "TypTap",
  "Federated National",
  "American Integrity",
  "Security First",
  "ASI",
  "Tower Hill",
  "Florida Peninsula",
  "Other",
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

// =============================================================================
// TYPES
// =============================================================================

interface InvoiceFormData {
  customerName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  policyNumber: string;
  invoiceDate: string;
  carrier: string;
  effectiveDate: string;
  lineOfBusiness: string;
  premium: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function InvoiceGeneratorPage() {
  const searchParams = useSearchParams();

  // Form state
  const [formData, setFormData] = useState<InvoiceFormData>({
    customerName: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    policyNumber: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    carrier: "",
    effectiveDate: "",
    lineOfBusiness: "",
    premium: "",
  });

  // UI state
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [generatedPdf, setGeneratedPdf] = useState<Uint8Array | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Pre-fill from URL params
  useEffect(() => {
    const customerName = searchParams.get("customerName");
    const policyNumber = searchParams.get("policyNumber");
    const carrier = searchParams.get("carrier");
    const premium = searchParams.get("premium");
    const lineOfBusiness = searchParams.get("lineOfBusiness");

    if (customerName || policyNumber || carrier || premium || lineOfBusiness) {
      setFormData((prev) => ({
        ...prev,
        customerName: customerName || prev.customerName,
        policyNumber: policyNumber || prev.policyNumber,
        carrier: carrier || prev.carrier,
        premium: premium || prev.premium,
        lineOfBusiness: lineOfBusiness || prev.lineOfBusiness,
      }));
    }
  }, [searchParams]);

  // Update form field
  const updateField = (field: keyof InvoiceFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setGeneratedPdf(null); // Clear generated PDF when form changes
  };

  // Calculate due date (effective date + 7 days)
  const getDueDate = () => {
    if (!formData.effectiveDate) return "";
    const date = new Date(formData.effectiveDate);
    date.setDate(date.getDate() + 7);
    return date.toLocaleDateString("en-US");
  };

  // Handle dec page upload
  const handleDecPageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setNotification(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const res = await fetch("/api/invoice/extract-dec-page", {
        method: "POST",
        body: formDataUpload,
      });

      const data = await res.json();

      if (data.success && data.data) {
        setFormData((prev) => ({
          ...prev,
          customerName: data.data.customerName || prev.customerName,
          street: data.data.street || prev.street,
          city: data.data.city || prev.city,
          state: data.data.state || prev.state,
          zip: data.data.zip || prev.zip,
          policyNumber: data.data.policyNumber || prev.policyNumber,
          carrier: data.data.carrier || prev.carrier,
          effectiveDate: data.data.effectiveDate
            ? formatDateForInput(data.data.effectiveDate)
            : prev.effectiveDate,
          lineOfBusiness: data.data.lineOfBusiness || prev.lineOfBusiness,
          premium: data.data.premium ? String(data.data.premium) : prev.premium,
        }));

        setNotification({
          type: "success",
          message: "Dec page data extracted successfully!",
        });
      } else {
        setNotification({
          type: "error",
          message: data.error || "Failed to extract data from dec page",
        });
      }
    } catch (error) {
      console.error("Extraction error:", error);
      setNotification({
        type: "error",
        message: "Failed to process dec page",
      });
    } finally {
      setIsExtracting(false);
      // Reset file input
      e.target.value = "";
    }
  };

  // Format date string to YYYY-MM-DD for input
  const formatDateForInput = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  // Generate PDF invoice
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
        y: height - 80,
        width: width,
        height: 80,
        color: primaryColor,
      });

      // Company name
      page.drawText("TCDS Insurance Agency", {
        x: 50,
        y: height - 45,
        size: 20,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      // Invoice title
      page.drawText("INVOICE", {
        x: width - 130,
        y: height - 45,
        size: 24,
        font: helveticaBold,
        color: rgb(1, 1, 1),
      });

      y = height - 120;

      // Customer info (left side)
      page.drawText("Bill To:", {
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
        size: 12,
        font: helveticaBold,
        color: darkColor,
      });
      y -= 16;

      if (formData.street) {
        page.drawText(formData.street, {
          x: 50,
          y,
          size: 11,
          font: helvetica,
          color: darkColor,
        });
        y -= 14;
      }

      if (formData.city || formData.state || formData.zip) {
        const cityStateZip = [
          formData.city,
          formData.state,
          formData.zip,
        ].filter(Boolean).join(", ");
        page.drawText(cityStateZip, {
          x: 50,
          y,
          size: 11,
          font: helvetica,
          color: darkColor,
        });
      }

      // Invoice details (right side)
      const rightX = width - 200;
      y = height - 120;

      const invoiceDetails = [
        { label: "Invoice Date:", value: formatDisplayDate(formData.invoiceDate) },
        { label: "Policy No:", value: formData.policyNumber || "N/A" },
        { label: "Due Date:", value: getDueDate() || "N/A" },
      ];

      for (const detail of invoiceDetails) {
        page.drawText(detail.label, {
          x: rightX,
          y,
          size: 10,
          font: helvetica,
          color: grayColor,
        });
        page.drawText(detail.value, {
          x: rightX + 80,
          y,
          size: 11,
          font: helveticaBold,
          color: darkColor,
        });
        y -= 18;
      }

      // Table section
      y = height - 240;

      // Table header background
      page.drawRectangle({
        x: 50,
        y: y - 5,
        width: width - 100,
        height: 25,
        color: lightGray,
      });

      // Table headers
      const columns = [
        { label: "Carrier", x: 55, width: 120 },
        { label: "Policy #", x: 180, width: 100 },
        { label: "Eff. Date", x: 285, width: 80 },
        { label: "Line of Business", x: 370, width: 120 },
        { label: "Premium", x: 495, width: 70 },
      ];

      for (const col of columns) {
        page.drawText(col.label, {
          x: col.x,
          y: y + 3,
          size: 10,
          font: helveticaBold,
          color: darkColor,
        });
      }

      y -= 30;

      // Table row
      const rowData = [
        formData.carrier || "N/A",
        formData.policyNumber || "N/A",
        formatDisplayDate(formData.effectiveDate) || "N/A",
        formData.lineOfBusiness || "N/A",
        formData.premium ? `$${parseFloat(formData.premium).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "$0.00",
      ];

      columns.forEach((col, i) => {
        page.drawText(rowData[i], {
          x: col.x,
          y,
          size: 10,
          font: helvetica,
          color: darkColor,
        });
      });

      // Divider line
      y -= 20;
      page.drawLine({
        start: { x: 50, y },
        end: { x: width - 50, y },
        thickness: 1,
        color: lightGray,
      });

      // Total
      y -= 30;
      page.drawText("Total Due:", {
        x: width - 180,
        y,
        size: 12,
        font: helveticaBold,
        color: darkColor,
      });
      page.drawText(
        formData.premium
          ? `$${parseFloat(formData.premium).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
          : "$0.00",
        {
          x: width - 100,
          y,
          size: 14,
          font: helveticaBold,
          color: primaryColor,
        }
      );

      // Payment stub section
      y -= 80;

      // Dashed line
      for (let x = 50; x < width - 50; x += 10) {
        page.drawLine({
          start: { x, y },
          end: { x: x + 5, y },
          thickness: 1,
          color: grayColor,
        });
      }

      y -= 20;
      page.drawText("--- Detach and return with payment ---", {
        x: (width - 220) / 2,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });

      y -= 40;

      // Payment stub content
      page.drawText("Make checks payable to:", {
        x: 50,
        y,
        size: 10,
        font: helvetica,
        color: grayColor,
      });
      y -= 16;
      page.drawText("TCDS Insurance Agency", {
        x: 50,
        y,
        size: 12,
        font: helveticaBold,
        color: darkColor,
      });
      y -= 14;
      page.drawText("123 Insurance Way", {
        x: 50,
        y,
        size: 11,
        font: helvetica,
        color: darkColor,
      });
      y -= 14;
      page.drawText("Tampa, FL 33601", {
        x: 50,
        y,
        size: 11,
        font: helvetica,
        color: darkColor,
      });

      // Right side of stub
      const stubRightX = width - 250;
      y += 44;

      page.drawText(`Customer: ${formData.customerName || "N/A"}`, {
        x: stubRightX,
        y,
        size: 10,
        font: helvetica,
        color: darkColor,
      });
      y -= 16;
      page.drawText(`Policy #: ${formData.policyNumber || "N/A"}`, {
        x: stubRightX,
        y,
        size: 10,
        font: helvetica,
        color: darkColor,
      });
      y -= 16;
      page.drawText(
        `Amount Enclosed: $____________`,
        {
          x: stubRightX,
          y,
          size: 10,
          font: helvetica,
          color: darkColor,
        }
      );

      // Footer
      page.drawText("Thank you for your business!", {
        x: (width - 140) / 2,
        y: 50,
        size: 11,
        font: helvetica,
        color: grayColor,
      });

      const pdfBytes = await pdfDoc.save();
      setGeneratedPdf(pdfBytes);

      setNotification({
        type: "success",
        message: "Invoice generated successfully!",
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

  // Format date for display
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("en-US");
    } catch {
      return dateStr;
    }
  };

  // Download PDF
  const downloadPdf = () => {
    if (!generatedPdf) return;

    // Create new Uint8Array to avoid SharedArrayBuffer type issues
    const pdfBytes = new Uint8Array(generatedPdf);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${formData.policyNumber || "TCDS"}-${formData.invoiceDate}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Send email
  const sendEmail = async () => {
    if (!generatedPdf || !emailTo) return;

    setIsSendingEmail(true);

    try {
      // Convert Uint8Array to base64
      const base64 = btoa(
        String.fromCharCode.apply(null, Array.from(generatedPdf))
      );

      const res = await fetch("/api/invoice/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo,
          customerName: formData.customerName,
          policyNumber: formData.policyNumber,
          amount: formData.premium,
          pdfBase64: base64,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setNotification({
          type: "success",
          message: `Invoice sent to ${emailTo}`,
        });
        setShowEmailModal(false);
        setEmailTo("");
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

  // Check if form is valid for generation
  const canGenerate =
    formData.customerName &&
    formData.policyNumber &&
    formData.lineOfBusiness &&
    formData.premium;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-emerald-600" />
          Invoice Generator
        </h1>
        <p className="text-gray-500 mt-1">
          Generate professional PDF invoices for insurance premium billing
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
          {/* Dec Page Upload */}
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-5 border border-purple-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">AI Auto-Fill</h3>
                <p className="text-sm text-gray-600">
                  Upload a declarations page to extract data automatically
                </p>
              </div>
            </div>

            <label className="block">
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={handleDecPageUpload}
                className="hidden"
                disabled={isExtracting}
              />
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                  isExtracting
                    ? "border-purple-300 bg-purple-50"
                    : "border-purple-200 hover:border-purple-400 hover:bg-purple-50/50"
                )}
              >
                {isExtracting ? (
                  <div className="flex items-center justify-center gap-2 text-purple-600">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Extracting data...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-purple-600">
                    <Upload className="w-5 h-5" />
                    <span>Upload Dec Page (PDF or Image)</span>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Customer Information */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Customer Information
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => updateField("customerName", e.target.value)}
                  placeholder="John Smith"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address
                </label>
                <Input
                  value={formData.street}
                  onChange={(e) => updateField("street", e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  City
                </label>
                <Input
                  value={formData.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="Tampa"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State
                  </label>
                  <select
                    value={formData.state}
                    onChange={(e) => updateField("state", e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">--</option>
                    {US_STATES.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ZIP
                  </label>
                  <Input
                    value={formData.zip}
                    onChange={(e) => updateField("zip", e.target.value)}
                    placeholder="33601"
                    maxLength={5}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Policy Information */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-gray-900 mb-4">
              Policy Information
            </h3>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Policy Number *
                </label>
                <Input
                  value={formData.policyNumber}
                  onChange={(e) => updateField("policyNumber", e.target.value)}
                  placeholder="HO-12345678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Date *
                </label>
                <Input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => updateField("invoiceDate", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Carrier *
                </label>
                <select
                  value={formData.carrier}
                  onChange={(e) => updateField("carrier", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select Carrier</option>
                  {CARRIERS.map((carrier) => (
                    <option key={carrier} value={carrier}>
                      {carrier}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Effective Date
                </label>
                <Input
                  type="date"
                  value={formData.effectiveDate}
                  onChange={(e) => updateField("effectiveDate", e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Line of Business *
                </label>
                <select
                  value={formData.lineOfBusiness}
                  onChange={(e) => updateField("lineOfBusiness", e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select Type</option>
                  {LINES_OF_BUSINESS.map((lob) => (
                    <option key={lob} value={lob}>
                      {lob}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Premium *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                    $
                  </span>
                  <Input
                    type="number"
                    value={formData.premium}
                    onChange={(e) => updateField("premium", e.target.value)}
                    placeholder="1,200.00"
                    className="pl-7"
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview & Actions */}
        <div className="space-y-4">
          {/* Invoice Preview Card */}
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="bg-emerald-600 text-white px-4 py-3">
              <h3 className="font-semibold">Invoice Preview</h3>
            </div>

            <div className="p-4 text-sm">
              <div className="space-y-2 text-gray-600">
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span className="font-medium text-gray-900">
                    {formData.customerName || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Policy #:</span>
                  <span className="font-medium text-gray-900">
                    {formData.policyNumber || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Carrier:</span>
                  <span className="font-medium text-gray-900">
                    {formData.carrier || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Line:</span>
                  <span className="font-medium text-gray-900">
                    {formData.lineOfBusiness || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Due Date:</span>
                  <span className="font-medium text-gray-900">
                    {getDueDate() || "—"}
                  </span>
                </div>

                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-base">
                    <span className="font-semibold">Total:</span>
                    <span className="font-bold text-emerald-600">
                      {formData.premium
                        ? `$${parseFloat(formData.premium).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
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
                <FileText className="w-4 h-4 mr-2" />
                Generate Invoice
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
                onClick={() => setShowEmailModal(true)}
                variant="outline"
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Email Invoice
              </Button>
            </>
          )}

          {/* Required Fields Note */}
          <p className="text-xs text-gray-500 text-center">
            * Required fields
          </p>
        </div>
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Send Invoice via Email</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient Email Address
              </label>
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="customer@example.com"
                autoFocus
              />

              <div className="mt-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
                <p>
                  Invoice for <strong>{formData.customerName}</strong> - Policy{" "}
                  <strong>{formData.policyNumber}</strong>
                </p>
                <p className="mt-1">
                  Amount:{" "}
                  <strong className="text-emerald-600">
                    $
                    {parseFloat(formData.premium || "0").toLocaleString(
                      "en-US",
                      { minimumFractionDigits: 2 }
                    )}
                  </strong>
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEmailModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={sendEmail}
                disabled={!emailTo || isSendingEmail}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Email
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
