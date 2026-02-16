'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RenewalPdfUploadProps {
  renewalId: string;
  hasRenewalSnapshot: boolean;
  onUploadComplete: () => void;
  onComparisonComplete: () => void;
}

interface ExtractedSummary {
  policyNumber: string | null;
  carrier: string | null;
  lineOfBusiness: string | null;
  effectiveDate: string | null;
  expirationDate: string | null;
  totalPremium: number | null;
  insuredName: string | null;
  coverageCount: number;
  vehicleCount: number;
  driverCount: number;
  mortgageeCount: number;
  discountCount: number;
}

export default function RenewalPdfUpload({
  renewalId,
  hasRenewalSnapshot,
  onUploadComplete,
  onComparisonComplete,
}: RenewalPdfUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedSummary | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are accepted');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error('File exceeds 25MB limit');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/renewals/${renewalId}/upload-renewal-pdf`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Upload failed');
        return;
      }

      setExtracted(data.extracted);
      setConfidence(data.confidence?.overall ?? null);
      toast.success('Renewal data extracted from PDF');
      onUploadComplete();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload PDF');
    } finally {
      setUploading(false);
    }
  }, [renewalId, onUploadComplete]);

  const handleRunComparison = useCallback(async () => {
    setComparing(true);
    try {
      const res = await fetch(`/api/renewals/${renewalId}/run-comparison`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Comparison failed');
        return;
      }

      toast.success(`Comparison complete: ${data.recommendation?.replace(/_/g, ' ')}`);
      onComparisonComplete();
    } catch (err) {
      console.error('Comparison error:', err);
      toast.error('Failed to run comparison');
    } finally {
      setComparing(false);
    }
  }, [renewalId, onComparisonComplete]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const showUploadZone = !hasRenewalSnapshot && !extracted;
  const showExtracted = extracted || hasRenewalSnapshot;

  return (
    <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        <h3 className="font-semibold text-purple-900 dark:text-purple-200">
          Upload Renewal Declaration Page
        </h3>
      </div>

      <p className="text-sm text-purple-700 dark:text-purple-300">
        This carrier doesn&apos;t send AL3 data via IVANS. Upload the renewal dec page PDF
        to extract policy data and run a comparison against the current policy.
      </p>

      {/* Upload Zone */}
      {showUploadZone && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer',
            dragActive
              ? 'border-purple-500 bg-purple-100 dark:bg-purple-800/30'
              : 'border-purple-300 dark:border-purple-700 hover:border-purple-400'
          )}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Extracting policy data...
              </p>
              <p className="text-xs text-purple-500">This may take 10-15 seconds</p>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 mx-auto mb-2 text-purple-400" />
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                Drop renewal PDF here
              </p>
              <p className="text-xs text-purple-500 mt-1">or click to select (PDF, max 25MB)</p>
            </>
          )}
        </div>
      )}

      {/* Extracted Data Summary */}
      {showExtracted && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Renewal data extracted
            </span>
            {confidence != null && (
              <span className={cn(
                'text-xs px-2 py-0.5 rounded-full',
                confidence >= 0.8
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : confidence >= 0.6
                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              )}>
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
          </div>

          {extracted && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {extracted.insuredName && (
                <div><span className="text-gray-500">Insured:</span> <span className="font-medium">{extracted.insuredName}</span></div>
              )}
              {extracted.carrier && (
                <div><span className="text-gray-500">Carrier:</span> <span className="font-medium">{extracted.carrier}</span></div>
              )}
              {extracted.totalPremium != null && (
                <div><span className="text-gray-500">Premium:</span> <span className="font-medium">${extracted.totalPremium.toLocaleString()}</span></div>
              )}
              {extracted.effectiveDate && (
                <div><span className="text-gray-500">Effective:</span> <span className="font-medium">{extracted.effectiveDate}</span></div>
              )}
              <div><span className="text-gray-500">Coverages:</span> <span className="font-medium">{extracted.coverageCount}</span></div>
              {extracted.vehicleCount > 0 && (
                <div><span className="text-gray-500">Vehicles:</span> <span className="font-medium">{extracted.vehicleCount}</span></div>
              )}
              {extracted.driverCount > 0 && (
                <div><span className="text-gray-500">Drivers:</span> <span className="font-medium">{extracted.driverCount}</span></div>
              )}
            </div>
          )}

          {/* Re-upload option */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
          >
            Upload different PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
          />
        </div>
      )}

      {/* Run Comparison Button */}
      {(showExtracted) && (
        <button
          onClick={handleRunComparison}
          disabled={comparing}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-colors',
            comparing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          )}
        >
          {comparing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running comparison...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Comparison vs HawkSoft
            </>
          )}
        </button>
      )}

      {/* Info about what comparison does */}
      {showExtracted && !comparing && (
        <p className="text-xs text-purple-500 dark:text-purple-400">
          This will compare the PDF-extracted renewal data against the current policy in HawkSoft
          and generate change analysis.
        </p>
      )}
    </div>
  );
}
