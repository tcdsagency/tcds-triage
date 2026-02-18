'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CoverTreeFormData } from '@/lib/pdf/covertree-extraction';

interface LoanPdfUploadProps {
  onExtracted: (formData: Partial<CoverTreeFormData>, confidence: number) => void;
}

interface UploadedFile {
  name: string;
  confidence: number;
  fieldsExtracted: string[];
}

export default function LoanPdfUpload({ onExtracted }: LoanPdfUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [mergedConfidence, setMergedConfidence] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(
    async (file: File) => {
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

        const res = await fetch('/api/covertree/extract-pdf', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();
        if (!data.success) {
          toast.error(data.error || 'Extraction failed');
          return;
        }

        const extracted: Partial<CoverTreeFormData> = data.formData;
        const confidence: number = data.confidence;

        // Track what fields were extracted for display
        const fieldsExtracted = Object.keys(extracted).filter(
          (k) => extracted[k as keyof CoverTreeFormData] != null && extracted[k as keyof CoverTreeFormData] !== ''
        );

        setUploadedFiles((prev) => [
          ...prev,
          { name: file.name, confidence, fieldsExtracted },
        ]);
        setMergedConfidence((prev) =>
          prev != null ? Math.max(prev, confidence) : confidence
        );

        onExtracted(extracted, confidence);
        toast.success(`Extracted ${fieldsExtracted.length} fields from ${file.name}`);
      } catch (err) {
        console.error('PDF extraction error:', err);
        toast.error('Failed to extract data from PDF');
      } finally {
        setUploading(false);
      }
    },
    [onExtracted]
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      handleUpload(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      handleUpload(file);
    }
    e.target.value = '';
  };

  const handleClear = () => {
    setUploadedFiles([]);
    setMergedConfidence(null);
  };

  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-blue-900 dark:text-blue-200">
            Auto-Fill from PDF
          </h3>
        </div>
        {uploadedFiles.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      <p className="text-sm text-blue-700 dark:text-blue-300">
        Upload a 1003 loan application or property appraisal to auto-fill borrower and property details.
        You can upload multiple documents — data will be merged.
      </p>

      {/* Upload Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        className={cn(
          'border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer',
          dragActive
            ? 'border-blue-500 bg-blue-100 dark:bg-blue-800/30'
            : 'border-blue-300 dark:border-blue-700 hover:border-blue-400'
        )}
        onClick={() => !uploading && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-1.5">
            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Extracting data...
            </p>
            <p className="text-xs text-blue-500">This may take 10-15 seconds</p>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3">
            <Upload className="h-5 w-5 text-blue-400" />
            <div className="text-left">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Drop PDF here or click to upload
              </p>
              <p className="text-xs text-blue-500">
                1003 loan app, appraisal, or both (PDF, max 25MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Uploaded Files Summary */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          {uploadedFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm bg-white dark:bg-gray-800 rounded px-3 py-2 border border-blue-200 dark:border-blue-700"
            >
              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                {f.name}
              </span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">
                {f.fieldsExtracted.length} fields
              </span>
              <span
                className={cn(
                  'ml-auto text-xs px-2 py-0.5 rounded-full flex-shrink-0',
                  f.confidence >= 0.8
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : f.confidence >= 0.6
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}
              >
                {Math.round(f.confidence * 100)}%
              </span>
            </div>
          ))}

          {mergedConfidence != null && mergedConfidence < 0.6 && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Low confidence extraction. Please verify the auto-filled fields.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
