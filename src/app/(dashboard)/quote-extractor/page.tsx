"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface QuoteDocument {
  id: string;
  originalFileName: string;
  fileSize: number;
  source: "upload" | "email";
  carrierName: string | null;
  quoteType: string | null;
  quotedPremium: number | null;
  termMonths: number | null;
  effectiveDate: string | null;
  quoteNumber: string | null;
  customerName: string | null;
  customerCity: string | null;
  customerState: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress?: string | null;
  customerZip?: string | null;
  coverageDetails?: Record<string, any> | null;
  vehicleInfo?: Array<{
    year?: string;
    make?: string;
    model?: string;
    vin?: string;
  }> | null;
  propertyInfo?: {
    address?: string;
    yearBuilt?: string;
    squareFeet?: string;
    roofType?: string;
  } | null;
  driverInfo?: Array<{
    name?: string;
    dob?: string;
    licenseNumber?: string;
  }> | null;
  status: "uploaded" | "extracting" | "extracted" | "posted" | "error";
  extractionError: string | null;
  extractedAt: string | null;
  azLeadId: string | null;
  azPostedAt: string | null;
  createdAt: string;
}

interface EmailMessage {
  id: string;
  from: string;
  subject: string;
  date: string;
  snippet?: string;
  read?: boolean;
  attachments: {
    id: string;
    filename: string;
    size: number;
  }[];
}

interface Pipeline {
  id: number;
  name: string;
  stages: { id: number; name: string; order: number }[];
}

interface Stats {
  total: number;
  uploaded: number;
  extracting: number;
  extracted: number;
  posted: number;
  error: number;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return `$${amount.toLocaleString()}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function QuoteExtractorPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<"documents" | "upload" | "email">("documents");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Documents state
  const [documents, setDocuments] = useState<QuoteDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [stats, setStats] = useState<Stats>({
    total: 0, uploaded: 0, extracting: 0, extracted: 0, posted: 0, error: 0,
  });

  // Detail panel state
  const [selectedDoc, setSelectedDoc] = useState<QuoteDocument | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<QuoteDocument>>({});

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email state
  const [emailConfigured, setEmailConfigured] = useState(false);
  const [emailMessages, setEmailMessages] = useState<EmailMessage[]>([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [importingEmail, setImportingEmail] = useState<string | null>(null);

  // Post to AZ state
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string; agencyzoomId: string }[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  // Reference data for carrier/product line matching
  const [carriers, setCarriers] = useState<{ id: number; name: string }[]>([]);
  const [productLines, setProductLines] = useState<{ id: number; name: string }[]>([]);
  const [refDataLoading, setRefDataLoading] = useState(false);
  const [matchedCarrier, setMatchedCarrier] = useState<{ id: number; name: string } | null>(null);
  const [matchedProductLine, setMatchedProductLine] = useState<{ id: number; name: string } | null>(null);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string>("");
  const [selectedProductLineId, setSelectedProductLineId] = useState<string>("");

  // ==========================================================================
  // DATA LOADING
  // ==========================================================================

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/quote-extractor/documents?${params}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Load documents error:", error);
    } finally {
      setDocumentsLoading(false);
    }
  }, [statusFilter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/quote-extractor/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Load stats error:", error);
    }
  }, []);

  const loadPipelines = useCallback(async () => {
    setPipelinesLoading(true);
    try {
      const res = await fetch("/api/quote-extractor/pipelines");
      const data = await res.json();
      if (data.success) {
        setPipelines(data.pipelines);
      }
    } catch (error) {
      console.error("Load pipelines error:", error);
    } finally {
      setPipelinesLoading(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const res = await fetch("/api/users?active=true");
      const data = await res.json();
      if (data.success) {
        // Filter to users with AgencyZoom IDs (can be assigned leads)
        const azUsers = data.users
          .filter((u: any) => u.agencyzoomId)
          .map((u: any) => ({
            id: u.id,
            name: `${u.firstName} ${u.lastName}`,
            agencyzoomId: u.agencyzoomId,
          }));
        setAgents(azUsers);
      }
    } catch (error) {
      console.error("Load agents error:", error);
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  const loadReferenceData = useCallback(async () => {
    setRefDataLoading(true);
    try {
      const res = await fetch("/api/quote-extractor/reference-data");
      const data = await res.json();
      if (data.success) {
        setCarriers(data.carriers || []);
        setProductLines(data.productLines || []);
      }
    } catch (error) {
      console.error("Load reference data error:", error);
    } finally {
      setRefDataLoading(false);
    }
  }, []);

  const matchCarrierProductLine = useCallback(async (carrierName: string | null, quoteType: string | null) => {
    if (!carrierName && !quoteType) return;
    try {
      const res = await fetch("/api/quote-extractor/reference-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrierName, quoteType }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.carrier) {
          setMatchedCarrier(data.carrier);
          setSelectedCarrierId(data.carrier.id.toString());
        }
        if (data.productLine) {
          setMatchedProductLine(data.productLine);
          setSelectedProductLineId(data.productLine.id.toString());
        }
      }
    } catch (error) {
      console.error("Match carrier/product line error:", error);
    }
  }, []);

  const checkEmailStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/quote-extractor/email/status");
      const data = await res.json();
      setEmailConfigured(data.configured);
    } catch (error) {
      console.error("Email status error:", error);
    }
  }, []);

  const loadEmailMessages = useCallback(async () => {
    if (!emailConfigured) return;
    setEmailLoading(true);
    try {
      const res = await fetch("/api/quote-extractor/email/messages");
      const data = await res.json();
      if (data.success) {
        setEmailMessages(data.messages);
      }
    } catch (error) {
      console.error("Load emails error:", error);
    } finally {
      setEmailLoading(false);
    }
  }, [emailConfigured]);

  useEffect(() => {
    loadDocuments();
    loadStats();
    checkEmailStatus();
  }, [loadDocuments, loadStats, checkEmailStatus]);

  useEffect(() => {
    if (activeTab === "email" && emailConfigured) {
      loadEmailMessages();
    }
  }, [activeTab, emailConfigured, loadEmailMessages]);

  // ==========================================================================
  // FILE UPLOAD
  // ==========================================================================

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("Only PDF files are supported");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/quote-extractor/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setActiveTab("documents");
        loadDocuments();
        loadStats();
      } else {
        setUploadError(data.error || "Upload failed");
      }
    } catch (error: any) {
      setUploadError(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  // ==========================================================================
  // EMAIL IMPORT
  // ==========================================================================

  const handleEmailImport = async (messageId: string, attachmentId: string, filename: string) => {
    setImportingEmail(messageId);
    try {
      const res = await fetch("/api/quote-extractor/email/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, attachmentId, filename }),
      });

      const data = await res.json();

      if (data.success) {
        setActiveTab("documents");
        loadDocuments();
        loadStats();
      } else {
        alert(data.error || "Import failed");
      }
    } catch (error: any) {
      alert(error.message || "Import failed");
    } finally {
      setImportingEmail(null);
    }
  };

  // ==========================================================================
  // DOCUMENT ACTIONS
  // ==========================================================================

  const handleSelectDocument = async (doc: QuoteDocument) => {
    try {
      const res = await fetch(`/api/quote-extractor/documents/${doc.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDoc(data.document);
        setEditData(data.document);
        setEditMode(false);
      }
    } catch (error) {
      console.error("Load document error:", error);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedDoc) return;

    try {
      const res = await fetch(`/api/quote-extractor/documents/${selectedDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      const data = await res.json();

      if (data.success) {
        setSelectedDoc(data.document);
        setEditMode(false);
        loadDocuments();
      } else {
        alert(data.error || "Save failed");
      }
    } catch (error: any) {
      alert(error.message || "Save failed");
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    try {
      const res = await fetch(`/api/quote-extractor/documents/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (data.success) {
        setSelectedDoc(null);
        loadDocuments();
        loadStats();
      } else {
        alert(data.error || "Delete failed");
      }
    } catch (error: any) {
      alert(error.message || "Delete failed");
    }
  };

  // ==========================================================================
  // POST TO AGENCYZOOM
  // ==========================================================================

  const handleOpenPostModal = () => {
    if (pipelines.length === 0) {
      loadPipelines();
    }
    if (agents.length === 0) {
      loadAgents();
    }
    // Load reference data and auto-match carrier/product line
    if (carriers.length === 0) {
      loadReferenceData();
    }
    // Reset state
    setMatchedCarrier(null);
    setMatchedProductLine(null);
    setSelectedCarrierId("");
    setSelectedProductLineId("");
    // Auto-match carrier and product line
    if (selectedDoc) {
      matchCarrierProductLine(selectedDoc.carrierName, selectedDoc.quoteType);
    }
    setShowPostModal(true);
    setPostError(null);
    setSelectedAgent("");
  };

  const handlePostToAZ = async () => {
    if (!selectedDoc || !selectedPipeline || !selectedStage) return;

    setPosting(true);
    setPostError(null);

    try {
      const pipeline = pipelines.find((p) => p.id.toString() === selectedPipeline);
      const stage = pipeline?.stages.find((s) => s.id.toString() === selectedStage);
      const agent = agents.find((a) => a.id === selectedAgent);

      const res = await fetch(`/api/quote-extractor/documents/${selectedDoc.id}/post-to-az`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: selectedPipeline,
          stageId: selectedStage,
          stageName: stage?.name,
          agentId: agent?.agencyzoomId || undefined,
          // Pass carrier and product line overrides
          carrierId: selectedCarrierId || undefined,
          productLineId: selectedProductLineId || undefined,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowPostModal(false);
        setSelectedDoc(null);
        loadDocuments();
        loadStats();
      } else {
        setPostError(data.error || "Failed to post to AgencyZoom");
      }
    } catch (error: any) {
      setPostError(error.message || "Failed to post to AgencyZoom");
    } finally {
      setPosting(false);
    }
  };

  // Get stages for selected pipeline
  const selectedPipelineStages = pipelines.find(
    (p) => p.id.toString() === selectedPipeline
  )?.stages || [];

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quote Extractor</h1>
            <p className="text-sm text-gray-500 mt-1">
              Extract quote data from carrier PDFs and post to AgencyZoom
            </p>
          </div>

          {/* Stats Pills */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
              <span className="text-gray-500">Total:</span>
              <span className="font-medium">{stats.total}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full text-sm">
              <span className="text-green-600">Ready:</span>
              <span className="font-medium text-green-700">{stats.extracted}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full text-sm">
              <span className="text-blue-600">Posted:</span>
              <span className="font-medium text-blue-700">{stats.posted}</span>
            </div>
            {stats.error > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 rounded-full text-sm">
                <span className="text-red-600">Errors:</span>
                <span className="font-medium text-red-700">{stats.error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab("documents")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "documents"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab("upload")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "upload"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Upload PDF
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === "email"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            Import from Email
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className={cn(
          "flex-1 overflow-y-auto p-6",
          selectedDoc && "pr-0"
        )}>
          {activeTab === "documents" && (
            <div>
              {/* Status Filter */}
              <div className="flex gap-2 mb-4">
                {["all", "extracted", "posted", "error"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm transition-colors",
                      statusFilter === status
                        ? "bg-gray-800 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>

              {/* Documents Table */}
              <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                {documentsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-3">📄</div>
                    <h3 className="text-lg font-medium text-gray-900">No documents yet</h3>
                    <p className="text-gray-500 mt-1">Upload a PDF or import from email to get started.</p>
                    <button
                      onClick={() => setActiveTab("upload")}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Upload PDF
                    </button>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          File / Customer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Carrier / Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Premium
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {documents.map((doc) => (
                        <tr
                          key={doc.id}
                          onClick={() => handleSelectDocument(doc)}
                          className={cn(
                            "cursor-pointer hover:bg-gray-50 transition-colors",
                            selectedDoc?.id === doc.id && "bg-blue-50"
                          )}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900 truncate max-w-[200px]">
                              {doc.customerName || doc.originalFileName}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <span className={cn(
                                "px-1.5 py-0.5 rounded",
                                doc.source === "upload" ? "bg-gray-100" : "bg-purple-100 text-purple-700"
                              )}>
                                {doc.source}
                              </span>
                              <span>{formatFileSize(doc.fileSize)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-gray-900">{doc.carrierName || "—"}</div>
                            <div className="text-xs text-gray-500">{doc.quoteType || "—"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(doc.quotedPremium)}
                            </div>
                            {doc.termMonths && (
                              <div className="text-xs text-gray-500">{doc.termMonths} months</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "px-2 py-1 rounded text-xs font-medium",
                                doc.status === "extracted" && "bg-green-100 text-green-700",
                                doc.status === "posted" && "bg-blue-100 text-blue-700",
                                doc.status === "extracting" && "bg-amber-100 text-amber-700",
                                doc.status === "uploaded" && "bg-gray-100 text-gray-700",
                                doc.status === "error" && "bg-red-100 text-red-700"
                              )}
                            >
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {formatDate(doc.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {activeTab === "upload" && (
            <div className="max-w-2xl mx-auto">
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 text-center transition-colors",
                  dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300",
                  uploading && "opacity-50 pointer-events-none"
                )}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="text-5xl mb-4">📄</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {uploading ? "Uploading & Extracting..." : "Drop PDF here"}
                </h3>
                <p className="text-gray-500 mb-4">
                  or click to browse for a carrier quote PDF
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? "Processing..." : "Select File"}
                </button>

                {uploadError && (
                  <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {uploadError}
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">How it works</h4>
                <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
                  <li>Upload a carrier quote PDF</li>
                  <li>AI extracts customer info, coverage, and premium details</li>
                  <li>Review and edit extracted data if needed</li>
                  <li>Post to AgencyZoom as a new lead with notes</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === "email" && (
            <div className="max-w-3xl mx-auto">
              {!emailConfigured ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📧</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Email Integration Not Configured
                  </h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Set up email integration to automatically import quote PDFs from your inbox.
                    Configure the QUOTE_EXTRACTOR_EMAIL_ENDPOINT environment variable.
                  </p>
                </div>
              ) : emailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : emailMessages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">📬</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No Emails with PDF Attachments
                  </h3>
                  <p className="text-gray-500">
                    No emails with PDF attachments found in your inbox.
                  </p>
                  <button
                    onClick={loadEmailMessages}
                    className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                  >
                    Refresh
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium text-gray-900">
                      Emails with PDF Attachments ({emailMessages.length})
                    </h3>
                    <button
                      onClick={loadEmailMessages}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Refresh
                    </button>
                  </div>

                  {emailMessages.map((email) => (
                    <div key={email.id} className="bg-white rounded-lg border p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-gray-900">{email.subject}</div>
                          <div className="text-sm text-gray-500">From: {email.from}</div>
                          <div className="text-xs text-gray-400">{formatDate(email.date)}</div>
                        </div>
                      </div>

                      {email.snippet && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{email.snippet}</p>
                      )}

                      <div className="border-t pt-3">
                        <div className="text-xs text-gray-500 mb-2">PDF Attachments:</div>
                        <div className="space-y-2">
                          {email.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center justify-between p-2 bg-gray-50 rounded"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-red-500">📄</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {att.filename}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({formatFileSize(att.size)})
                                </span>
                              </div>
                              <button
                                onClick={() => handleEmailImport(email.id, att.id, att.filename)}
                                disabled={importingEmail === email.id}
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {importingEmail === email.id ? "Importing..." : "Import"}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedDoc && (
          <div className="w-[480px] border-l bg-white overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Document Details</h3>
              <button
                onClick={() => setSelectedDoc(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Status & Actions */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    selectedDoc.status === "extracted" && "bg-green-100 text-green-700",
                    selectedDoc.status === "posted" && "bg-blue-100 text-blue-700",
                    selectedDoc.status === "extracting" && "bg-amber-100 text-amber-700",
                    selectedDoc.status === "error" && "bg-red-100 text-red-700"
                  )}
                >
                  {selectedDoc.status}
                </span>

                <div className="flex gap-2">
                  {selectedDoc.status === "extracted" && (
                    <button
                      onClick={handleOpenPostModal}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Post to AZ
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteDocument(selectedDoc.id)}
                    className="px-3 py-1.5 text-red-600 text-sm rounded border border-red-200 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {selectedDoc.extractionError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {selectedDoc.extractionError}
                </div>
              )}

              {/* Posted Info */}
              {selectedDoc.azLeadId && (
                <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                  Posted to AgencyZoom (Lead #{selectedDoc.azLeadId})
                  <br />
                  <span className="text-xs">{formatDate(selectedDoc.azPostedAt)}</span>
                </div>
              )}

              {/* File Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">File</h4>
                <div className="text-sm text-gray-900">{selectedDoc.originalFileName}</div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(selectedDoc.fileSize)} • {selectedDoc.source}
                </div>
              </div>

              {/* Quote Info */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-500">Quote Details</h4>
                  {!editMode && selectedDoc.status === "extracted" && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500">Carrier</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={editData.carrierName || ""}
                          onChange={(e) => setEditData({ ...editData, carrierName: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      ) : (
                        <div className="text-sm font-medium">{selectedDoc.carrierName || "—"}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Type</label>
                      {editMode ? (
                        <select
                          value={editData.quoteType || ""}
                          onChange={(e) => setEditData({ ...editData, quoteType: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        >
                          <option value="">Select...</option>
                          <option value="auto">Auto</option>
                          <option value="home">Home</option>
                          <option value="renters">Renters</option>
                          <option value="umbrella">Umbrella</option>
                          <option value="commercial_auto">Commercial Auto</option>
                          <option value="general_liability">General Liability</option>
                          <option value="bop">BOP</option>
                          <option value="workers_comp">Workers Comp</option>
                          <option value="other">Other</option>
                        </select>
                      ) : (
                        <div className="text-sm font-medium">{selectedDoc.quoteType || "—"}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Premium</label>
                      {editMode ? (
                        <input
                          type="number"
                          value={editData.quotedPremium || ""}
                          onChange={(e) => setEditData({ ...editData, quotedPremium: parseFloat(e.target.value) || null })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      ) : (
                        <div className="text-sm font-medium">{formatCurrency(selectedDoc.quotedPremium)}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Term</label>
                      {editMode ? (
                        <select
                          value={editData.termMonths || ""}
                          onChange={(e) => setEditData({ ...editData, termMonths: parseInt(e.target.value) || null })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        >
                          <option value="">Select...</option>
                          <option value="6">6 months</option>
                          <option value="12">12 months</option>
                        </select>
                      ) : (
                        <div className="text-sm font-medium">
                          {selectedDoc.termMonths ? `${selectedDoc.termMonths} months` : "—"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Customer</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500">Name</label>
                    {editMode ? (
                      <input
                        type="text"
                        value={editData.customerName || ""}
                        onChange={(e) => setEditData({ ...editData, customerName: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    ) : (
                      <div className="text-sm font-medium">{selectedDoc.customerName || "—"}</div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500">Phone</label>
                      {editMode ? (
                        <input
                          type="text"
                          value={editData.customerPhone || ""}
                          onChange={(e) => setEditData({ ...editData, customerPhone: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      ) : (
                        <div className="text-sm">{selectedDoc.customerPhone || "—"}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Email</label>
                      {editMode ? (
                        <input
                          type="email"
                          value={editData.customerEmail || ""}
                          onChange={(e) => setEditData({ ...editData, customerEmail: e.target.value })}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      ) : (
                        <div className="text-sm truncate">{selectedDoc.customerEmail || "—"}</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500">Address</label>
                    <div className="text-sm">
                      {selectedDoc.customerAddress || "—"}
                      {(selectedDoc.customerCity || selectedDoc.customerState) && (
                        <div className="text-gray-500">
                          {[selectedDoc.customerCity, selectedDoc.customerState, selectedDoc.customerZip]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Vehicles */}
              {selectedDoc.vehicleInfo && selectedDoc.vehicleInfo.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Vehicles</h4>
                  <div className="space-y-2">
                    {selectedDoc.vehicleInfo.map((v, i) => (
                      <div key={i} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium">
                          {[v.year, v.make, v.model].filter(Boolean).join(" ") || "Unknown Vehicle"}
                        </div>
                        {v.vin && <div className="text-xs text-gray-500">VIN: {v.vin}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drivers */}
              {selectedDoc.driverInfo && selectedDoc.driverInfo.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Drivers</h4>
                  <div className="space-y-2">
                    {selectedDoc.driverInfo.map((d, i) => (
                      <div key={i} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium">{d.name || "Unknown Driver"}</div>
                        {d.dob && <div className="text-xs text-gray-500">DOB: {d.dob}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coverage Details */}
              {selectedDoc.coverageDetails && Object.keys(selectedDoc.coverageDetails).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Coverage</h4>
                  <div className="p-3 bg-gray-50 rounded text-sm space-y-1">
                    {Object.entries(selectedDoc.coverageDetails).map(([key, value]) => (
                      value && (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-500 capitalize">
                            {key.replace(/([A-Z])/g, " $1").trim()}:
                          </span>
                          <span className="font-medium">{String(value)}</span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              {/* Edit Actions */}
              {editMode && (
                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => {
                      setEditMode(false);
                      setEditData(selectedDoc);
                    }}
                    className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Post to AZ Modal */}
      {showPostModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg m-4 max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Post to AgencyZoom</h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Quote Summary */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="font-medium">{selectedDoc.customerName || "Unknown Customer"}</div>
                <div className="text-sm text-gray-500">
                  {selectedDoc.carrierName} • {selectedDoc.quoteType} • {formatCurrency(selectedDoc.quotedPremium)}
                </div>
                {selectedDoc.vehicleInfo && (selectedDoc.vehicleInfo as any[]).length > 0 && (
                  <div className="text-xs text-gray-400 mt-1">
                    {(selectedDoc.vehicleInfo as any[]).length} vehicle(s)
                  </div>
                )}
              </div>

              {postError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  {postError}
                </div>
              )}

              {/* Carrier & Product Line Matching */}
              <div className="p-3 bg-blue-50 rounded-lg space-y-3">
                <div className="text-sm font-medium text-blue-900">Quote Mapping</div>

                <div>
                  <label className="block text-xs text-blue-700 mb-1">
                    Carrier {matchedCarrier && <span className="text-green-600">(Auto-matched)</span>}
                  </label>
                  <select
                    value={selectedCarrierId}
                    onChange={(e) => setSelectedCarrierId(e.target.value)}
                    disabled={refDataLoading}
                    className="w-full px-2 py-1.5 border rounded text-sm bg-white"
                  >
                    <option value="">
                      {refDataLoading ? "Loading..." : "Select carrier (or leave blank for auto-match)"}
                    </option>
                    {carriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {matchedCarrier && selectedCarrierId === matchedCarrier.id.toString() && (
                    <div className="text-xs text-green-600 mt-1">
                      Matched: {selectedDoc.carrierName} -&gt; {matchedCarrier.name}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-blue-700 mb-1">
                    Product Line {matchedProductLine && <span className="text-green-600">(Auto-matched)</span>}
                  </label>
                  <select
                    value={selectedProductLineId}
                    onChange={(e) => setSelectedProductLineId(e.target.value)}
                    disabled={refDataLoading}
                    className="w-full px-2 py-1.5 border rounded text-sm bg-white"
                  >
                    <option value="">
                      {refDataLoading ? "Loading..." : "Select product line (or leave blank for auto-match)"}
                    </option>
                    {productLines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {matchedProductLine && selectedProductLineId === matchedProductLine.id.toString() && (
                    <div className="text-xs text-green-600 mt-1">
                      Matched: {selectedDoc.quoteType} -&gt; {matchedProductLine.name}
                    </div>
                  )}
                </div>
              </div>

              {/* Pipeline & Stage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pipeline *
                </label>
                <select
                  value={selectedPipeline}
                  onChange={(e) => {
                    setSelectedPipeline(e.target.value);
                    setSelectedStage("");
                  }}
                  disabled={pipelinesLoading}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select pipeline...</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPipeline && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stage *
                  </label>
                  <select
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="">Select stage...</option>
                    {selectedPipelineStages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign To
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  disabled={agentsLoading}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Optional - leave blank for unassigned</p>
              </div>
            </div>

            {/* Info about what will be created */}
            <div className="px-4 pb-2 text-xs text-gray-500">
              {selectedCarrierId && selectedProductLineId ? (
                <span className="text-green-600">Will create quote record with {selectedDoc.vehicleInfo && (selectedDoc.vehicleInfo as any[]).length > 0 ? (selectedDoc.vehicleInfo as any[]).length : 1} item(s)</span>
              ) : (
                <span>Lead + note will be created. Select carrier & product to also create quote record.</span>
              )}
            </div>

            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setShowPostModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePostToAZ}
                disabled={!selectedPipeline || !selectedStage || posting}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {posting ? "Posting..." : (selectedCarrierId && selectedProductLineId ? "Create Lead & Quote" : "Create Lead")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
