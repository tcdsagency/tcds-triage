'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Sparkles, X, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AIPasteButton() {
  const { setValue } = useFormContext();
  const [isOpen, setIsOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!pastedText.trim()) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/ai/quote-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'extract',
          text: pastedText,
        }),
      });

      if (!response.ok) throw new Error('Extraction failed');

      const data = await response.json();

      if (data.fields && typeof data.fields === 'object') {
        let count = 0;
        Object.entries(data.fields).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            setValue(key, value);
            count++;
          }
        });
        setResult({ count });
        setTimeout(() => {
          setIsOpen(false);
          setResult(null);
          setPastedText('');
        }, 2000);
      } else {
        setError('No fields could be extracted from the text.');
      }
    } catch (err) {
      console.error('AI extraction error:', err);
      setError('Failed to extract fields. Please try again or enter manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
          'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
          'border border-purple-200 dark:border-purple-700',
          'hover:bg-purple-100 dark:hover:bg-purple-900/50'
        )}
      >
        <Sparkles className="w-4 h-4" />
        AI Paste
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  AI Paste
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setPastedText('');
                  setError(null);
                  setResult(null);
                }}
                className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Paste a dec page, email, or any document and AI will extract the relevant fields automatically.
              </p>

              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={8}
                placeholder="Paste document text here..."
                className={cn(
                  'w-full px-3 py-2 rounded-lg border transition-colors',
                  'text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800',
                  'border-gray-300 dark:border-gray-600',
                  'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500',
                  'text-sm font-mono'
                )}
                disabled={isProcessing}
              />

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              {result && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <Check className="w-4 h-4" />
                  Extracted {result.count} field{result.count !== 1 ? 's' : ''} successfully!
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setPastedText('');
                  setError(null);
                  setResult(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExtract}
                disabled={isProcessing || !pastedText.trim()}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  'bg-purple-600 text-white hover:bg-purple-700',
                  (isProcessing || !pastedText.trim()) && 'opacity-50 cursor-not-allowed'
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract Fields
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default AIPasteButton;
