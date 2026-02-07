'use client';

import { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface UploadZoneProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  error: string | null;
}

export function UploadZone({ onUpload, uploading, error }: UploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.pdf')) {
      onUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-12 text-center transition-all',
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600',
          uploading && 'opacity-50 pointer-events-none'
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="flex justify-center mb-4">
          {uploading ? (
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          ) : (
            <div className="relative">
              <FileText className="w-12 h-12 text-gray-400" />
              <Upload className="w-6 h-6 text-blue-500 absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-0.5" />
            </div>
          )}
        </div>

        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {uploading ? 'Extracting Policy Data...' : 'Drop Dec Page PDF Here'}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          {uploading
            ? 'Using AI to extract policy information from your document'
            : 'or click to browse for a carrier dec page or policy application'}
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={cn(
            'px-6 py-2 rounded-lg font-medium transition-colors',
            'bg-blue-600 text-white hover:bg-blue-700',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {uploading ? 'Processing...' : 'Select PDF File'}
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
          How it works
        </h4>
        <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-decimal list-inside">
          <li>Upload a carrier dec page or policy application PDF</li>
          <li>AI extracts policy details, coverages, vehicles, and drivers</li>
          <li>Review and edit extracted data as needed</li>
          <li>Generate AL3-XML file for HawkSoft import</li>
        </ol>
      </div>
    </div>
  );
}
