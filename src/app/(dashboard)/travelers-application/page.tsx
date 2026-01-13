'use client';

/**
 * Travelers Application Page
 * ==========================
 * Simple interface to request Travelers policy applications
 * via Power Automate integration.
 */

import { useState } from 'react';
import {
  FileText,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  FolderOpen,
  HelpCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export default function TravelersApplicationPage() {
  const [policyNumber, setPolicyNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    policyNumber?: string;
  } | null>(null);
  const [recentRequests, setRecentRequests] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!policyNumber.trim()) {
      setResult({ success: false, message: 'Please enter a policy number' });
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    try {
      const res = await fetch('/api/travelers/fetch-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policyNumber: policyNumber.trim() }),
      });

      const data = await res.json();

      if (data.success) {
        setResult({
          success: true,
          message: data.message,
          policyNumber: data.policyNumber,
        });
        // Add to recent requests
        setRecentRequests(prev => [data.policyNumber, ...prev.slice(0, 4)]);
        // Clear input
        setPolicyNumber('');
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to submit request',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Travelers Application
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Retrieve policy applications from Travelers portal
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Policy Number Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Travelers Policy Number
              </label>
              <div className="flex gap-3">
                <Input
                  type="text"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123456"
                  className="flex-1 text-lg font-mono uppercase"
                  disabled={isSubmitting}
                  autoFocus
                />
                <Button
                  type="submit"
                  disabled={isSubmitting || !policyNumber.trim()}
                  className="bg-blue-600 hover:bg-blue-700 px-6"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Fetch
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Result Message */}
            {result && (
              <div
                className={cn(
                  'p-4 rounded-xl flex items-start gap-3',
                  result.success
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                )}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p
                    className={cn(
                      'font-medium',
                      result.success
                        ? 'text-green-800 dark:text-green-300'
                        : 'text-red-800 dark:text-red-300'
                    )}
                  >
                    {result.message}
                  </p>
                  {result.success && result.policyNumber && (
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                      Policy: {result.policyNumber}
                    </p>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5" />
            How It Works
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                1
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Enter the Travelers policy number and click "Fetch"
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                2
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                The system will automatically retrieve the application from Travelers
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                3
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Wait approximately 5 minutes
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 flex-shrink-0">
                4
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Find the PDF in: <span className="font-mono bg-blue-100 dark:bg-blue-800 px-2 py-0.5 rounded">Agency Shared Docs → Travelers AOR</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Requests */}
        {recentRequests.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Recent Requests
            </h3>
            <div className="flex flex-wrap gap-2">
              {recentRequests.map((policy, idx) => (
                <span
                  key={`${policy}-${idx}`}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono text-gray-700 dark:text-gray-300"
                >
                  {policy}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
