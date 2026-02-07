'use client';

import { cn } from '@/lib/utils';
import { FileText, AlertCircle, CheckCircle, Clock, FileCheck } from 'lucide-react';
import type { PolicyCreatorDocument } from '@/types/policy-creator.types';

interface DocumentListProps {
  documents: PolicyCreatorDocument[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (doc: PolicyCreatorDocument) => void;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString();
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `$${amount.toLocaleString()}`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
    uploaded: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', icon: Clock },
    extracting: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: Clock },
    extracted: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: CheckCircle },
    reviewed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: CheckCircle },
    generated: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', icon: FileCheck },
    error: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: AlertCircle },
  };

  const { bg, text, icon: Icon } = config[status] || config.uploaded;

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium', bg, text)}>
      <Icon className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function DocumentList({ documents, loading, selectedId, onSelect }: DocumentListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No documents yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Upload a dec page PDF to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              File / Insured
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Carrier / LOB
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Premium
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Date
            </th>
          </tr>
        </thead>
        <tbody className="divide-y dark:divide-gray-700">
          {documents.map((doc) => {
            const displayName = doc.insuredName ||
              (doc.insuredFirstName && doc.insuredLastName
                ? `${doc.insuredFirstName} ${doc.insuredLastName}`
                : null) ||
              doc.originalFileName;

            return (
              <tr
                key={doc.id}
                onClick={() => onSelect(doc)}
                className={cn(
                  'cursor-pointer transition-colors',
                  selectedId === doc.id
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                )}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                    {displayName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    {doc.policyNumber && (
                      <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                        {doc.policyNumber}
                      </span>
                    )}
                    <span>{formatFileSize(doc.fileSize)}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 dark:text-gray-100">{doc.carrier || '—'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{doc.lineOfBusiness || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(doc.totalPremium)}
                  </div>
                  {doc.effectiveDate && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Eff: {formatDate(doc.effectiveDate)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(doc.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
