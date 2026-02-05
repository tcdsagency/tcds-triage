"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { GayaEntity, GayaField } from "@/types/gaya";

// =============================================================================
// TYPES
// =============================================================================

interface Pipeline {
  id: number;
  name: string;
  stages: { id: number; name: string; order: number }[];
}

type TabId =
  | "customer"
  | "household_member"
  | "car"
  | "property"
  | "auto_policy"
  | "home_policy";

const TABS: { id: TabId; label: string }[] = [
  { id: "customer", label: "Customer" },
  { id: "household_member", label: "Household" },
  { id: "car", label: "Vehicles" },
  { id: "property", label: "Properties" },
  { id: "auto_policy", label: "Auto Policies" },
  { id: "home_policy", label: "Home Policies" },
];

// =============================================================================
// HELPERS
// =============================================================================

function formatFieldName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getEntitiesByType(entities: GayaEntity[], type: string): GayaEntity[] {
  return entities.filter((e) => e.entity === type);
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function GayaExtractorPage() {
  // Upload state
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extracted data state
  const [entities, setEntities] = useState<GayaEntity[]>([]);
  const [hasExtracted, setHasExtracted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("customer");

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Post to AZ state
  const [showPostModal, setShowPostModal] = useState(false);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<{
    leadId?: number;
    agencyzoomUrl?: string;
  } | null>(null);

  // ==========================================================================
  // FILE MANAGEMENT
  // ==========================================================================

  const addFiles = (newFiles: FileList | File[]) => {
    const pdfFiles = Array.from(newFiles).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length === 0) {
      setUploadError("Only PDF files are supported");
      return;
    }

    const combined = [...files, ...pdfFiles].slice(0, 5);
    setFiles(combined);
    setUploadError(null);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  // ==========================================================================
  // EXTRACTION
  // ==========================================================================

  const handleExtract = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadError(null);
    setEntities([]);
    setHasExtracted(false);
    setSaveSuccess(false);
    setPostSuccess(null);

    try {
      const formData = new FormData();
      for (const file of files) {
        formData.append("file", file);
      }

      const res = await fetch("/api/gaya/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.entities) {
        setEntities(data.entities);
        setHasExtracted(true);
        // Auto-select the first tab that has data
        const firstWithData = TABS.find(
          (t) => getEntitiesByType(data.entities, t.id).length > 0
        );
        if (firstWithData) {
          setActiveTab(firstWithData.id);
        }
      } else {
        setUploadError(data.error || "Extraction failed");
      }
    } catch (error: any) {
      setUploadError(error.message || "Extraction failed");
    } finally {
      setUploading(false);
    }
  };

  // ==========================================================================
  // ENTITY EDITING
  // ==========================================================================

  const updateFieldValue = (
    entityType: string,
    entityIndex: number,
    fieldName: string,
    newValue: string
  ) => {
    setEntities((prev) =>
      prev.map((e) => {
        if (e.entity !== entityType || e.index !== entityIndex) return e;
        return {
          ...e,
          fields: e.fields.map((f) =>
            f.name === fieldName ? { ...f, value: newValue } : f
          ),
        };
      })
    );
  };

  // ==========================================================================
  // SAVE TO GAYA
  // ==========================================================================

  const handleSaveToGaya = async () => {
    if (entities.length === 0) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/gaya/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entities }),
      });

      const data = await res.json();

      if (data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(data.error || "Save failed");
      }
    } catch (error: any) {
      alert(error.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // POST TO AGENCYZOOM
  // ==========================================================================

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

  const handleOpenPostModal = () => {
    if (pipelines.length === 0) {
      loadPipelines();
    }
    setShowPostModal(true);
    setPostError(null);
    setPostSuccess(null);
    setSelectedPipeline("");
    setSelectedStage("");
  };

  const handlePostToAZ = async () => {
    if (!selectedPipeline || !selectedStage) return;

    setPosting(true);
    setPostError(null);

    try {
      const res = await fetch("/api/gaya/post-to-az", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entities,
          pipelineId: Number(selectedPipeline),
          stageId: Number(selectedStage),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setPostSuccess({
          leadId: data.leadId,
          agencyzoomUrl: data.agencyzoomUrl,
        });
      } else {
        setPostError(data.error || "Failed to create lead");
      }
    } catch (error: any) {
      setPostError(error.message || "Failed to create lead");
    } finally {
      setPosting(false);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const selectedPipelineObj = pipelines.find(
    (p) => p.id.toString() === selectedPipeline
  );
  const stages = selectedPipelineObj?.stages || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Gaya Extractor
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload PDFs to extract insurance data with Gaya AI
          </p>
        </div>
      </div>

      {/* Upload Area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 uppercase tracking-wide">
          Upload Documents
        </h2>

        {/* Drag & Drop Zone */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            dragActive
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              Click to upload
            </span>{" "}
            or drag and drop
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            PDF files only (up to 5 files, 50MB each)
          </p>
        </div>

        {/* Error */}
        {uploadError && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">{uploadError}</p>
          </div>
        )}

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <svg
                    className="w-5 h-5 text-red-500 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <button
              onClick={handleExtract}
              disabled={uploading}
              className={cn(
                "w-full mt-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                uploading
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              )}
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Extracting...
                </span>
              ) : (
                `Upload & Extract (${files.length} file${files.length > 1 ? "s" : ""})`
              )}
            </button>
          </div>
        )}
      </div>

      {/* Extracted Data */}
      {hasExtracted && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Tabs + Actions */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-4">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map((tab) => {
                const count = getEntitiesByType(entities, tab.id).length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    )}
                  >
                    {tab.label}
                    {count > 0 && (
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full",
                          activeTab === tab.id
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 py-2 ml-4 flex-shrink-0">
              <button
                onClick={handleSaveToGaya}
                disabled={saving || entities.length === 0}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  saveSuccess
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : saving
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
                )}
              >
                {saveSuccess ? "Saved!" : saving ? "Saving..." : "Save to Gaya"}
              </button>
              <button
                onClick={handleOpenPostModal}
                disabled={entities.length === 0}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send to AgencyZoom
              </button>
            </div>
          </div>

          {/* Entity Cards */}
          <div className="p-4">
            {(() => {
              const tabEntities = getEntitiesByType(entities, activeTab);

              if (tabEntities.length === 0) {
                return (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">No {TABS.find((t) => t.id === activeTab)?.label?.toLowerCase()} data found</p>
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {tabEntities.map((entity) => (
                    <div
                      key={`${entity.entity}-${entity.index}`}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatFieldName(entity.entity)} #{entity.index}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {entity.fields.map((field) => (
                          <div key={field.name}>
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {formatFieldName(field.name)}
                            </label>
                            <input
                              type="text"
                              value={field.value}
                              onChange={(e) =>
                                updateFieldValue(
                                  entity.entity,
                                  entity.index,
                                  field.name,
                                  e.target.value
                                )
                              }
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Post to AgencyZoom Modal */}
      {showPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Send to AgencyZoom
            </h3>

            {postSuccess ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    Lead created successfully!
                  </p>
                  {postSuccess.leadId && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      Lead ID: {postSuccess.leadId}
                    </p>
                  )}
                </div>
                {postSuccess.agencyzoomUrl && (
                  <a
                    href={postSuccess.agencyzoomUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Open in AgencyZoom
                  </a>
                )}
                <button
                  onClick={() => setShowPostModal(false)}
                  className="block w-full text-center px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pipeline Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pipeline
                  </label>
                  <select
                    value={selectedPipeline}
                    onChange={(e) => {
                      setSelectedPipeline(e.target.value);
                      setSelectedStage("");
                    }}
                    disabled={pipelinesLoading}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">
                      {pipelinesLoading ? "Loading..." : "Select a pipeline"}
                    </option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id.toString()}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stage Select */}
                {selectedPipeline && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stage
                    </label>
                    <select
                      value={selectedStage}
                      onChange={(e) => setSelectedStage(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select a stage</option>
                      {stages.map((s) => (
                        <option key={s.id} value={s.id.toString()}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Error */}
                {postError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{postError}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowPostModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handlePostToAZ}
                    disabled={!selectedPipeline || !selectedStage || posting}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {posting ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Creating...
                      </span>
                    ) : (
                      "Create Lead"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
