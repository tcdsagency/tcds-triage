'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Loader2, Check, X } from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface CanopyConnectSMSProps {
  customerPhone?: string;
  customerName?: string;
  customerId?: string;
  quoteType?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showLabel?: boolean;
  onSuccess?: (result: { pullId: string; linkUrl: string }) => void;
  onError?: (error: string) => void;
}

type SendStatus = 'idle' | 'sending' | 'success' | 'error';

// =============================================================================
// COMPONENT
// =============================================================================

export function CanopyConnectSMS({
  customerPhone,
  customerName,
  customerId,
  quoteType,
  variant = 'outline',
  size = 'sm',
  className = '',
  showLabel = true,
  onSuccess,
  onError,
}: CanopyConnectSMSProps) {
  const [status, setStatus] = useState<SendStatus>('idle');
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState(customerPhone || '');
  const [firstName, setFirstName] = useState(
    customerName?.split(' ')[0] || ''
  );
  const [errorMessage, setErrorMessage] = useState('');

  // Format phone number for display
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  // Handle phone input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  // Send the Canopy link
  const handleSend = async () => {
    if (!phone || phone.length < 10) {
      setErrorMessage('Please enter a valid phone number');
      return;
    }

    setStatus('sending');
    setErrorMessage('');

    try {
      const response = await fetch('/api/canopy-connect/send-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `+1${phone}`,
          firstName: firstName || undefined,
          customerId: customerId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send link');
      }

      setStatus('success');
      onSuccess?.({ pullId: data.pullId, linkUrl: data.linkUrl });

      // Reset after 2 seconds
      setTimeout(() => {
        setStatus('idle');
        setShowModal(false);
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send';
      setStatus('error');
      setErrorMessage(message);
      onError?.(message);

      // Reset after 3 seconds
      setTimeout(() => {
        setStatus('idle');
      }, 3000);
    }
  };

  // Quick send if phone is already provided
  const handleQuickSend = () => {
    if (customerPhone && customerPhone.replace(/\D/g, '').length >= 10) {
      setPhone(customerPhone.replace(/\D/g, '').slice(-10));
      handleSend();
    } else {
      setShowModal(true);
    }
  };

  // Button content based on status
  const getButtonContent = () => {
    switch (status) {
      case 'sending':
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {showLabel && <span className="ml-1.5">Sending...</span>}
          </>
        );
      case 'success':
        return (
          <>
            <Check className="h-4 w-4 text-green-600" />
            {showLabel && <span className="ml-1.5 text-green-600">Sent!</span>}
          </>
        );
      case 'error':
        return (
          <>
            <X className="h-4 w-4 text-red-600" />
            {showLabel && <span className="ml-1.5 text-red-600">Failed</span>}
          </>
        );
      default:
        return (
          <>
            <Link2 className="h-4 w-4" />
            {showLabel && <span className="ml-1.5">Send Canopy Connect</span>}
          </>
        );
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleQuickSend}
        disabled={status === 'sending'}
        title="Send Canopy Connect link via SMS"
      >
        {getButtonContent()}
      </Button>

      {/* Modal for entering phone */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Send Canopy Connect Link</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-gray-600">
              Send a secure link to the customer to import their current insurance
              coverage information.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formatPhone(phone)}
                  onChange={handlePhoneChange}
                  placeholder="(555) 555-5555"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  First Name (for personalized message)
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {errorMessage && (
                <p className="text-sm text-red-600">{errorMessage}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={status === 'sending'}
                >
                  {status === 'sending' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Link2 className="mr-2 h-4 w-4" />
                      Send Link
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default CanopyConnectSMS;
