"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface SearchResult {
  id: string; // Local database UUID
  agencyzoomId?: string; // AgencyZoom ID for API calls
  type: "customer" | "lead";
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  hawksoftClientNumber?: string;
}

interface Vehicle {
  year: string;
  make: string;
  model: string;
  vin: string;
}

interface Policy {
  policyId: string;
  carrier: string;
  naic: string;
  policyNumber: string;
  effectiveDate: string;
  expirationDate: string;
  status: string;
  isActive: boolean;
  lineOfBusiness: string;
  isAutoPolicy: boolean;
  vehicles: Vehicle[];
  drivers: Array<{ name: string; info?: string }>;
}

interface HawkSoftData {
  externalId: string | null;
  insuredName: string;
  email: string;
  phone: string;
  policies: Policy[];
}

interface HistoryRecord {
  id: string;
  contactId: string;
  contactName: string;
  policyNumber: string;
  carrier: string;
  expirationDate: string;
  vehicleCount: number;
  deliveryMethod: string;
  deliveredTo: string | null;
  createdAt: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function IdCardsPage() {
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SearchResult | null>(null);

  // HawkSoft data state
  const [hawkSoftData, setHawkSoftData] = useState<HawkSoftData | null>(null);
  const [hawkSoftLoading, setHawkSoftLoading] = useState(false);
  const [hawkSoftError, setHawkSoftError] = useState<string | null>(null);

  // Policy selection state
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  // Vehicle editing state
  const [editableVehicles, setEditableVehicles] = useState<Vehicle[]>([]);
  const [spouseName, setSpouseName] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  // PDF state
  const [generating, setGenerating] = useState(false);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFilename, setPdfFilename] = useState("");

  // Delivery state
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

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
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.results) {
        // Map search results to SearchResult interface
        const mapped = data.results.map((r: any) => ({
          id: r.id,
          agencyzoomId: r.agencyzoomId,
          type: r.isLead ? "lead" : "customer",
          firstName: r.firstName,
          lastName: r.lastName,
          email: r.email,
          phone: r.phone,
          hawksoftClientNumber: r.hawksoftClientCode,
        }));
        setSearchResults(mapped);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

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
    setSelectedPolicy(null);
    setPdfBase64(null);
    setDeliverySuccess(null);
    setDeliveryError(null);

    // Pre-fill email and phone
    setEmail(customer.email || "");
    setPhone(customer.phone || "");

    // Fetch HawkSoft data
    setHawkSoftLoading(true);
    setHawkSoftError(null);

    try {
      // Use hawksoft client number directly if available, otherwise use AgencyZoom ID
      let lookupId: string;
      if (customer.hawksoftClientNumber) {
        lookupId = `hawksoft-${customer.hawksoftClientNumber}`;
      } else if (customer.agencyzoomId) {
        lookupId = customer.agencyzoomId;
      } else {
        // Fall back to local ID (will likely fail AgencyZoom lookup)
        lookupId = customer.id;
      }

      const res = await fetch(
        `/api/id-cards/hawksoft-data/${lookupId}?type=${customer.type}`
      );
      const data = await res.json();

      if (data.success) {
        setHawkSoftData(data);
        // Pre-fill email/phone from HawkSoft if not already set
        if (!email && data.email) setEmail(data.email);
        if (!phone && data.phone) setPhone(data.phone);

        // Load history
        loadHistory(customer.id.toString());
      } else {
        setHawkSoftError(data.error || "Failed to fetch policy data");
        setHawkSoftData(null);
      }
    } catch (error: any) {
      setHawkSoftError(error.message || "Failed to fetch policy data");
      setHawkSoftData(null);
    } finally {
      setHawkSoftLoading(false);
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setHawkSoftData(null);
    setSelectedPolicy(null);
    setEditableVehicles([]);
    setSpouseName("");
    setPdfBase64(null);
    setEmail("");
    setPhone("");
    setHistory([]);
    setDeliverySuccess(null);
    setDeliveryError(null);
  };

  // ==========================================================================
  // POLICY SELECTION
  // ==========================================================================

  const handleSelectPolicy = (policy: Policy) => {
    setSelectedPolicy(policy);
    setEditableVehicles([...policy.vehicles]);
    setSpouseName("");
    setPdfBase64(null);
    setDeliverySuccess(null);
    setDeliveryError(null);
  };

  // ==========================================================================
  // VEHICLE EDITING
  // ==========================================================================

  const handleVehicleChange = (index: number, field: keyof Vehicle, value: string) => {
    setEditableVehicles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddVehicle = () => {
    setEditableVehicles((prev) => [
      ...prev,
      { year: "", make: "", model: "", vin: "" },
    ]);
  };

  const handleRemoveVehicle = (index: number) => {
    setEditableVehicles((prev) => prev.filter((_, i) => i !== index));
  };

  // ==========================================================================
  // PDF GENERATION
  // ==========================================================================

  const handleGenerate = async () => {
    if (!selectedPolicy || !hawkSoftData || editableVehicles.length === 0) return;

    setGenerating(true);
    setDeliveryError(null);

    try {
      const res = await fetch("/api/id-cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insuredName: hawkSoftData.insuredName,
          spouseName: spouseName || undefined,
          carrier: selectedPolicy.carrier,
          carrierNaic: selectedPolicy.naic,
          policyNumber: selectedPolicy.policyNumber,
          effectiveDate: selectedPolicy.effectiveDate,
          expirationDate: selectedPolicy.expirationDate,
          vehicles: editableVehicles,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setPdfBase64(data.pdf);
        setPdfFilename(data.filename);
      } else {
        setDeliveryError(data.error || "Failed to generate PDF");
      }
    } catch (error: any) {
      setDeliveryError(error.message || "Failed to generate PDF");
    } finally {
      setGenerating(false);
    }
  };

  // ==========================================================================
  // DOWNLOAD
  // ==========================================================================

  const handleDownload = async () => {
    if (!pdfBase64) return;

    // Download the PDF
    const blob = new Blob([Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = pdfFilename || "ID_Card.pdf";
    a.click();
    URL.revokeObjectURL(url);

    // Save to history
    if (selectedCustomer && selectedPolicy) {
      try {
        await fetch("/api/id-cards/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: selectedCustomer.id.toString(),
            contactType: selectedCustomer.type,
            contactName: hawkSoftData?.insuredName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
            hawksoftClientNumber: hawkSoftData?.externalId || undefined,
            policyNumber: selectedPolicy.policyNumber,
            carrier: selectedPolicy.carrier,
            effectiveDate: selectedPolicy.effectiveDate,
            expirationDate: selectedPolicy.expirationDate,
            vehicleCount: editableVehicles.length,
            vehicles: editableVehicles,
            pdfBase64,
            deliveryMethod: "download",
          }),
        });
        loadHistory(selectedCustomer.id.toString());
      } catch (err) {
        console.error("Failed to save history:", err);
      }
    }

    setDeliverySuccess("ID card downloaded!");
    setTimeout(() => setDeliverySuccess(null), 3000);
  };

  // ==========================================================================
  // EMAIL DELIVERY
  // ==========================================================================

  const handleSendEmail = async () => {
    if (!pdfBase64 || !email || !selectedCustomer || !selectedPolicy) return;

    setSendingEmail(true);
    setDeliveryError(null);

    try {
      const res = await fetch("/api/id-cards/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          pdfBase64,
          filename: pdfFilename,
          insuredName: hawkSoftData?.insuredName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
          contactId: selectedCustomer.id.toString(),
          contactType: selectedCustomer.type,
          policyNumber: selectedPolicy.policyNumber,
          carrier: selectedPolicy.carrier,
          expirationDate: selectedPolicy.expirationDate,
          vehicleCount: editableVehicles.length,
          vehicles: editableVehicles,
          hawksoftClientNumber: hawkSoftData?.externalId || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setDeliverySuccess(`ID card sent to ${email}!`);
        loadHistory(selectedCustomer.id.toString());
        setTimeout(() => setDeliverySuccess(null), 3000);
      } else {
        setDeliveryError(data.error || "Failed to send email");
      }
    } catch (error: any) {
      setDeliveryError(error.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  // ==========================================================================
  // SMS DELIVERY
  // ==========================================================================

  const handleSendSms = async () => {
    if (!pdfBase64 || !phone || !selectedCustomer || !selectedPolicy) return;

    setSendingSms(true);
    setDeliveryError(null);

    try {
      const res = await fetch("/api/id-cards/send-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          pdfBase64,
          insuredName: hawkSoftData?.insuredName || `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
          contactId: selectedCustomer.id.toString(),
          contactType: selectedCustomer.type,
          policyNumber: selectedPolicy.policyNumber,
          carrier: selectedPolicy.carrier,
          expirationDate: selectedPolicy.expirationDate,
          vehicleCount: editableVehicles.length,
          vehicles: editableVehicles,
          hawksoftClientNumber: hawkSoftData?.externalId || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setDeliverySuccess(`ID card sent to ${phone}!`);
        loadHistory(selectedCustomer.id.toString());
        setTimeout(() => setDeliverySuccess(null), 3000);
      } else {
        setDeliveryError(data.error || "Failed to send SMS");
      }
    } catch (error: any) {
      setDeliveryError(error.message || "Failed to send SMS");
    } finally {
      setSendingSms(false);
    }
  };

  // ==========================================================================
  // HISTORY
  // ==========================================================================

  const loadHistory = async (contactId: string) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/id-cards/history/${contactId}?limit=10`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.records);
      }
    } catch (error) {
      console.error("History error:", error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  // Only show active auto policies
  const autoPolicies = hawkSoftData?.policies.filter((p) => p.isAutoPolicy && p.isActive) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ID Card Generator</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate and send insurance ID cards for auto policies
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Customer Search */}
          <div className="bg-white rounded-lg border shadow-sm p-6 overflow-visible">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              1. Search for Customer
            </h2>

            {selectedCustomer ? (
              <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-green-600 text-xl">&#10003;</span>
                  <div>
                    <div className="font-medium text-gray-900">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </div>
                    <div className="text-sm text-gray-500">
                      {selectedCustomer.type === "customer" ? "Customer" : "Lead"}
                      {selectedCustomer.hawksoftClientNumber &&
                        ` | HawkSoft #${selectedCustomer.hawksoftClientNumber}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleClearCustomer}
                  className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                >
                  Change
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
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  </div>
                )}

                {searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((result) => (
                      <button
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelectCustomer(result)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0"
                      >
                        <div className="font-medium text-gray-900">
                          {result.firstName} {result.lastName}
                        </div>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
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
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Policy Selection */}
          {selectedCustomer && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                2. Select Auto Policy
              </h2>

              {hawkSoftLoading ? (
                <div className="flex items-center gap-2 text-gray-500 py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
                  <span>Loading policies from HawkSoft...</span>
                </div>
              ) : hawkSoftError ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                  {hawkSoftError}
                </div>
              ) : !hawkSoftData?.externalId ? (
                <div className="p-4 bg-amber-50 text-amber-700 rounded-lg">
                  No HawkSoft client number linked to this contact. Please link the customer in AgencyZoom first.
                </div>
              ) : autoPolicies.length === 0 ? (
                <div className="p-4 bg-gray-50 text-gray-600 rounded-lg">
                  No active auto policies found for this customer.
                </div>
              ) : (
                <div className="space-y-3">
                  {autoPolicies.map((policy) => (
                    <button
                      key={policy.policyId}
                      onClick={() => handleSelectPolicy(policy)}
                      className={cn(
                        "w-full p-4 rounded-lg border text-left transition-colors",
                        selectedPolicy?.policyId === policy.policyId
                          ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                          : "hover:bg-gray-50 hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900">
                            {policy.carrier}
                          </div>
                          <div className="text-sm text-gray-600">
                            {policy.policyNumber}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {policy.effectiveDate} - {policy.expirationDate}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {policy.vehicles.length} vehicle(s)
                          </div>
                        </div>
                      </div>
                      {policy.vehicles.length > 0 && (
                        <div className="mt-2 pt-2 border-t text-xs text-gray-500">
                          {policy.vehicles.map((v, i) => (
                            <div key={i}>
                              {v.year} {v.make} {v.model}
                            </div>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Generate Button - Show when policy is selected */}
          {selectedPolicy && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                3. Generate ID Card
              </h2>

              {/* Policy Summary */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600">
                  <strong>{hawkSoftData?.insuredName}</strong>
                </div>
                <div className="text-sm text-gray-600">
                  {selectedPolicy.carrier} - {selectedPolicy.policyNumber}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {editableVehicles.length} vehicle(s) | Expires {selectedPolicy.expirationDate}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={generating || editableVehicles.length === 0}
                className={cn(
                  "w-full py-3 rounded-lg font-medium text-white transition-colors",
                  generating || editableVehicles.length === 0
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {generating ? "Generating..." : "Generate ID Card"}
              </button>

              {/* Editor Toggle - Hidden by default */}
              <button
                onClick={() => setShowEditor(!showEditor)}
                className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                {showEditor ? "▲ Hide Editor" : "▼ Edit Vehicle Details (Optional)"}
              </button>

              {/* Collapsible Editor Section */}
              {showEditor && (
                <div className="mt-4 pt-4 border-t">
                  {/* Spouse Name */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Spouse/Co-Insured Name (optional)
                    </label>
                    <input
                      type="text"
                      value={spouseName}
                      onChange={(e) => setSpouseName(e.target.value)}
                      placeholder="Enter spouse name if applicable"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Vehicles */}
                  <div className="space-y-4">
                    {editableVehicles.map((vehicle, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-sm text-gray-700">
                            Vehicle {index + 1}
                          </span>
                          {editableVehicles.length > 1 && (
                            <button
                              onClick={() => handleRemoveVehicle(index)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <input
                            type="text"
                            value={vehicle.year}
                            onChange={(e) =>
                              handleVehicleChange(index, "year", e.target.value)
                            }
                            placeholder="Year"
                            className="px-3 py-2 border rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            value={vehicle.make}
                            onChange={(e) =>
                              handleVehicleChange(index, "make", e.target.value)
                            }
                            placeholder="Make"
                            className="px-3 py-2 border rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            value={vehicle.model}
                            onChange={(e) =>
                              handleVehicleChange(index, "model", e.target.value)
                            }
                            placeholder="Model"
                            className="px-3 py-2 border rounded-lg text-sm"
                          />
                          <input
                            type="text"
                            value={vehicle.vin}
                            onChange={(e) =>
                              handleVehicleChange(index, "vin", e.target.value)
                            }
                            placeholder="VIN"
                            className="px-3 py-2 border rounded-lg text-sm font-mono"
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={handleAddVehicle}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700"
                    >
                      + Add Vehicle
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Delivery Options */}
          {pdfBase64 && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                4. Deliver ID Card
              </h2>

              {deliverySuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg">
                  {deliverySuccess}
                </div>
              )}

              {deliveryError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg">
                  {deliveryError}
                </div>
              )}

              <div className="space-y-4">
                {/* Download */}
                <button
                  onClick={handleDownload}
                  className="w-full py-3 bg-gray-100 text-gray-800 rounded-lg font-medium hover:bg-gray-200 flex items-center justify-center gap-2"
                >
                  <span>&#8595;</span> Download PDF
                </button>

                {/* Email */}
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !email}
                    className={cn(
                      "px-4 py-2 rounded-lg font-medium text-white",
                      sendingEmail || !email
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-green-600 hover:bg-green-700"
                    )}
                  >
                    {sendingEmail ? "Sending..." : "Send Email"}
                  </button>
                </div>

                {/* SMS */}
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    className="flex-1 px-3 py-2 border rounded-lg"
                  />
                  <button
                    onClick={handleSendSms}
                    disabled={sendingSms || !phone}
                    className={cn(
                      "px-4 py-2 rounded-lg font-medium text-white",
                      sendingSms || !phone
                        ? "bg-gray-400 cursor-not-allowed"
                        : "bg-purple-600 hover:bg-purple-700"
                    )}
                  >
                    {sendingSms ? "Sending..." : "Send SMS"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* History */}
          {selectedCustomer && history.length > 0 && (
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Previous ID Cards
              </h2>

              <div className="space-y-2">
                {history.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {record.carrier} - {record.policyNumber}
                      </div>
                      <div className="text-sm text-gray-500">
                        {record.vehicleCount} vehicle(s) | {record.deliveryMethod}
                        {record.deliveredTo && ` to ${record.deliveredTo}`}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(record.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
