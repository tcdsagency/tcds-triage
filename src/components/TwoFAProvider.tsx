'use client';

/**
 * Two-Factor Authentication Provider
 * ===================================
 * Global context for managing 2FA prompts across the application.
 * Shows a modal when MMI or other services require 2FA verification.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { KeyRound, X, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface TwoFARequest {
  sessionId: string;
  service: 'mmi' | 'rpr' | 'other';
  resolve: (code: string | null) => void;
}

interface TwoFAContextType {
  request2FA: (sessionId: string, service?: 'mmi' | 'rpr' | 'other') => Promise<string | null>;
  isModalOpen: boolean;
  currentService: string | null;
}

// =============================================================================
// CONTEXT
// =============================================================================

const TwoFAContext = createContext<TwoFAContextType | null>(null);

export function useTwoFA() {
  const context = useContext(TwoFAContext);
  if (!context) {
    throw new Error('useTwoFA must be used within TwoFAProvider');
  }
  return context;
}

// =============================================================================
// PROVIDER
// =============================================================================

interface TwoFAProviderProps {
  children: React.ReactNode;
}

export function TwoFAProvider({ children }: TwoFAProviderProps) {
  const [currentRequest, setCurrentRequest] = useState<TwoFARequest | null>(null);
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request 2FA code from user
  const request2FA = useCallback(
    (sessionId: string, service: 'mmi' | 'rpr' | 'other' = 'mmi'): Promise<string | null> => {
      return new Promise((resolve) => {
        setCurrentRequest({ sessionId, service, resolve });
        setCode('');
        setError(null);
      });
    },
    []
  );

  // Handle code submission
  const handleSubmit = async () => {
    if (!currentRequest || !code.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Submit code to API
      const response = await fetch('/api/mmi/2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentRequest.sessionId,
          code: code.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('2FA verification successful');
        currentRequest.resolve(code.trim());
        setCurrentRequest(null);
      } else {
        setError(result.error || 'Verification failed. Please try again.');
      }
    } catch (err) {
      setError('Failed to submit verification code');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (currentRequest) {
      currentRequest.resolve(null);
      setCurrentRequest(null);
    }
  };

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.trim() && !isSubmitting) {
      handleSubmit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Auto-focus input when modal opens
  useEffect(() => {
    if (currentRequest) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        const input = document.getElementById('twofa-code-input');
        if (input) input.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentRequest]);

  const serviceNames = {
    mmi: 'MMI Property Search',
    rpr: 'RPR Property Data',
    other: 'Service',
  };

  const contextValue: TwoFAContextType = {
    request2FA,
    isModalOpen: !!currentRequest,
    currentService: currentRequest?.service || null,
  };

  return (
    <TwoFAContext.Provider value={contextValue}>
      {children}

      {/* 2FA Modal */}
      {currentRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <KeyRound className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Verification Required
                  </h3>
                  <p className="text-sm text-emerald-100">
                    {serviceNames[currentRequest.service]}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancel}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              <div className="flex items-start gap-3 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  A verification code has been sent to your registered email or phone.
                  Please enter the code below to continue.
                </p>
              </div>

              <label
                htmlFor="twofa-code-input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Verification Code
              </label>
              <input
                id="twofa-code-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                onKeyDown={handleKeyDown}
                placeholder="Enter 6-digit code"
                className="w-full px-4 py-3 text-lg tracking-widest text-center font-mono border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
                disabled={isSubmitting}
                maxLength={8}
              />

              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex gap-3 justify-end">
              <button
                onClick={handleCancel}
                disabled={isSubmitting}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!code.trim() || isSubmitting}
                className="px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </TwoFAContext.Provider>
  );
}

export default TwoFAProvider;
