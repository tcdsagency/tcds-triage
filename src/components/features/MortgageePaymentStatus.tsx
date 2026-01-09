'use client';

import { useState, useEffect } from 'react';
import {
  CreditCard,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
} from 'lucide-react';

interface Mortgagee {
  id: string;
  name: string;
  loanNumber?: string;
  type?: string;
  position?: number;
  currentPaymentStatus: string;
  lastPaymentCheckAt?: string;
  paidThroughDate?: string;
  nextDueDate?: string;
  amountDue?: number;
  mciPolicyNumber?: string;
}

interface MortgageePaymentStatusProps {
  policyId: string;
  mortgagees?: Mortgagee[];
  compact?: boolean;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bgColor: string; label: string }> = {
  current: {
    icon: CheckCircle,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    label: 'Current',
  },
  late: {
    icon: AlertCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    label: 'Late',
  },
  grace_period: {
    icon: Clock,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    label: 'Grace Period',
  },
  lapsed: {
    icon: AlertCircle,
    color: 'text-red-700',
    bgColor: 'bg-red-100',
    label: 'LAPSED',
  },
  pending_check: {
    icon: Clock,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    label: 'Checking...',
  },
  unknown: {
    icon: Clock,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50',
    label: 'Unknown',
  },
  error: {
    icon: AlertCircle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    label: 'Error',
  },
};

export function MortgageePaymentStatus({ policyId, mortgagees: initialMortgagees, compact = false }: MortgageePaymentStatusProps) {
  const [mortgagees, setMortgagees] = useState<Mortgagee[]>(initialMortgagees || []);
  const [checking, setChecking] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialMortgagees);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialMortgagees) {
      fetchMortgagees();
    }
  }, [policyId, initialMortgagees]);

  const fetchMortgagees = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/mortgagee-payments/history/${policyId}`);
      const data = await res.json();
      if (data.success) {
        setMortgagees(data.mortgagees || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load mortgagees');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPayment = async (mortgageeId: string) => {
    setChecking(mortgageeId);
    try {
      const res = await fetch('/api/mortgagee-payments/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mortgageeId }),
      });
      const data = await res.json();
      if (data.success) {
        // Update local state with new status
        setMortgagees(prev =>
          prev.map(m =>
            m.id === mortgageeId
              ? {
                  ...m,
                  currentPaymentStatus: data.result.payment_status || 'unknown',
                  lastPaymentCheckAt: new Date().toISOString(),
                  paidThroughDate: data.result.paid_through_date,
                  nextDueDate: data.result.next_due_date,
                  amountDue: data.result.amount_due,
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Error checking payment:', err);
    } finally {
      setChecking(null);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        <div className="h-20 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 py-2">{error}</div>
    );
  }

  if (!mortgagees || mortgagees.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4 text-center flex items-center justify-center gap-2">
        <Building2 className="h-4 w-4" />
        No mortgagees on this policy
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {mortgagees.map((mortgagee) => {
          const status = STATUS_CONFIG[mortgagee.currentPaymentStatus] || STATUS_CONFIG.unknown;
          const StatusIcon = status.icon;

          return (
            <div key={mortgagee.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-3 w-3 text-gray-400" />
                <span className="font-medium truncate max-w-[200px]">{mortgagee.name}</span>
              </div>
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs ${status.bgColor} ${status.color}`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mortgagees.map((mortgagee) => {
        const status = STATUS_CONFIG[mortgagee.currentPaymentStatus] || STATUS_CONFIG.unknown;
        const StatusIcon = status.icon;
        const isChecking = checking === mortgagee.id;

        return (
          <div
            key={mortgagee.id}
            className="border border-gray-200 rounded-lg p-4 space-y-3 bg-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="font-medium">{mortgagee.name}</span>
                  {mortgagee.position && mortgagee.position > 1 && (
                    <span className="text-xs text-gray-500">
                      ({mortgagee.position === 2 ? '2nd' : `${mortgagee.position}th`})
                    </span>
                  )}
                </div>
                {mortgagee.loanNumber && (
                  <div className="text-sm text-gray-500 mt-0.5">
                    Loan #: {mortgagee.loanNumber}
                  </div>
                )}
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
                <StatusIcon className="h-4 w-4" />
                {status.label}
              </div>
            </div>

            {/* Payment Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {mortgagee.paidThroughDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-500 text-xs">Paid Through</div>
                    <div>{new Date(mortgagee.paidThroughDate).toLocaleDateString()}</div>
                  </div>
                </div>
              )}
              {mortgagee.nextDueDate && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-500 text-xs">Next Due</div>
                    <div>{new Date(mortgagee.nextDueDate).toLocaleDateString()}</div>
                  </div>
                </div>
              )}
              {mortgagee.amountDue !== undefined && mortgagee.amountDue > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-500 text-xs">Amount Due</div>
                    <div>${mortgagee.amountDue.toLocaleString()}</div>
                  </div>
                </div>
              )}
              {mortgagee.lastPaymentCheckAt && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <div>
                    <div className="text-gray-500 text-xs">Last Checked</div>
                    <div>{new Date(mortgagee.lastPaymentCheckAt).toLocaleDateString()}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => handleCheckPayment(mortgagee.id)}
                disabled={isChecking}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isChecking ? 'animate-spin' : ''}`} />
                {isChecking ? 'Checking...' : 'Check Now'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
