'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { UploadZone, DocumentList, PolicyEditor } from '@/components/policy-creator';
import type { PolicyCreatorDocument } from '@/types/policy-creator.types';

interface Stats {
  total: number;
  extracted: number;
  reviewed: number;
  generated: number;
  error: number;
}

export default function PolicyCreatorPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'documents' | 'upload'>('documents');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Documents state
  const [documents, setDocuments] = useState<PolicyCreatorDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    extracted: 0,
    reviewed: 0,
    generated: 0,
    error: 0,
  });

  // Selected document for editing
  const [selectedDoc, setSelectedDoc] = useState<PolicyCreatorDocument | null>(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Edit/Save state
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  // ==========================================================================
  // DATA LOADING
  // ==========================================================================

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/policy-creator/documents?${params}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.documents);
        // Compute stats from documents
        const s: Stats = {
          total: data.documents.length,
          extracted: 0,
          reviewed: 0,
          generated: 0,
          error: 0,
        };
        for (const doc of data.documents) {
          if (doc.status === 'extracted') s.extracted++;
          else if (doc.status === 'reviewed') s.reviewed++;
          else if (doc.status === 'generated') s.generated++;
          else if (doc.status === 'error') s.error++;
        }
        setStats(s);
      }
    } catch (error) {
      console.error('Load documents error:', error);
    } finally {
      setDocumentsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // ==========================================================================
  // FILE UPLOAD
  // ==========================================================================

  const handleFileUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Only PDF files are supported');
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/policy-creator/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (data.success) {
        setActiveTab('documents');
        loadDocuments();
        // Auto-select the new document
        if (data.document) {
          handleSelectDocument(data.document);
        }
      } else {
        setUploadError(data.error || 'Upload failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // ==========================================================================
  // DOCUMENT SELECTION & EDITING
  // ==========================================================================

  const handleSelectDocument = async (doc: PolicyCreatorDocument) => {
    setSelectedLoading(true);
    try {
      const res = await fetch(`/api/policy-creator/documents/${doc.id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedDoc(data.document);
      }
    } catch (error) {
      console.error('Load document error:', error);
    } finally {
      setSelectedLoading(false);
    }
  };

  const handleSave = async (updates: Partial<PolicyCreatorDocument>) => {
    if (!selectedDoc) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/policy-creator/documents/${selectedDoc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await res.json();

      if (data.success) {
        setSelectedDoc(data.document);
        loadDocuments();
      } else {
        alert(data.error || 'Save failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Save failed';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedDoc) return;

    setGenerating(true);
    try {
      const res = await fetch(`/api/policy-creator/documents/${selectedDoc.id}/generate`, {
        method: 'POST',
      });

      const data = await res.json();

      if (data.success) {
        // Ask user which format to download
        const format = window.confirm(
          'Generation successful!\n\n' +
          'Click OK to download Raw AL3 (recommended for HawkSoft)\n' +
          'Click Cancel to download AL3-XML format'
        ) ? 'raw' : 'xml';

        // Download the selected format
        const downloadRes = await fetch(
          `/api/policy-creator/documents/${selectedDoc.id}/generate?format=${format}`
        );
        const blob = await downloadRes.blob();
        const contentDisposition = downloadRes.headers.get('Content-Disposition');
        const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
        const filename = filenameMatch?.[1] || (format === 'raw' ? 'policy.al3' : 'policy.al3.xml');

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Show warnings if any
        if (data.warnings && data.warnings.length > 0) {
          alert(`Generated with warnings:\n${data.warnings.join('\n')}`);
        }

        // Reload documents to update status
        loadDocuments();

        // Reload selected document
        const updated = await fetch(`/api/policy-creator/documents/${selectedDoc.id}`);
        const updatedData = await updated.json();
        if (updatedData.success) {
          setSelectedDoc(updatedData.document);
        }
      } else {
        const errors = data.errors?.join('\n') || data.error || 'Generation failed';
        alert(`Generation failed:\n${errors}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      alert(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      const res = await fetch(`/api/policy-creator/documents/${selectedDoc.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (data.success) {
        setSelectedDoc(null);
        loadDocuments();
      } else {
        alert(data.error || 'Delete failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Delete failed';
      alert(errorMessage);
    }
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Policy Creator</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Extract policy data from dec pages and generate AL3-XML for HawkSoft
            </p>
          </div>

          {/* Stats Pills */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-full text-sm">
              <span className="text-gray-500 dark:text-gray-400">Total:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{stats.total}</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 rounded-full text-sm">
              <span className="text-green-600 dark:text-green-400">Ready:</span>
              <span className="font-medium text-green-700 dark:text-green-300">
                {stats.extracted + stats.reviewed}
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-full text-sm">
              <span className="text-purple-600 dark:text-purple-400">Generated:</span>
              <span className="font-medium text-purple-700 dark:text-purple-300">{stats.generated}</span>
            </div>
            {stats.error > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 rounded-full text-sm">
                <span className="text-red-600 dark:text-red-400">Errors:</span>
                <span className="font-medium text-red-700 dark:text-red-300">{stats.error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setActiveTab('documents')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'documents'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'upload'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            Upload PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Content */}
        <div className={cn('flex-1 overflow-y-auto p-6', selectedDoc && 'pr-0')}>
          {activeTab === 'documents' && (
            <div>
              {/* Status Filter */}
              <div className="flex gap-2 mb-4">
                {['all', 'extracted', 'reviewed', 'generated', 'error'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-colors',
                      statusFilter === status
                        ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    )}
                  >
                    {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>

              <DocumentList
                documents={documents}
                loading={documentsLoading}
                selectedId={selectedDoc?.id || null}
                onSelect={handleSelectDocument}
              />
            </div>
          )}

          {activeTab === 'upload' && (
            <UploadZone
              onUpload={handleFileUpload}
              uploading={uploading}
              error={uploadError}
            />
          )}
        </div>

        {/* Editor Panel */}
        {selectedDoc && (
          <div className="w-[500px] flex-shrink-0">
            {selectedLoading ? (
              <div className="h-full flex items-center justify-center bg-white dark:bg-gray-800 border-l dark:border-gray-700">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : (
              <PolicyEditor
                document={selectedDoc}
                onSave={handleSave}
                onGenerate={handleGenerate}
                onClose={() => setSelectedDoc(null)}
                saving={saving}
                generating={generating}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
