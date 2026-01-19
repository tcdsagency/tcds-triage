'use client';

import { useState } from 'react';
import {
  Phone,
  Search,
  User,
  MapPin,
  Mail,
  Building2,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  Signal,
  MessageSquare,
  Clock,
  Star,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface LookupResult {
  success: boolean;
  phone: string;
  phoneRaw: string;
  timestamp: string;
  overview: {
    isValid: boolean;
    lineType: string;
    carrier: string;
    activityScore: number;
    leadGrade: string;
    isCommercial: boolean;
    isPrepaid: boolean;
    confidence?: number;
  };
  owner: {
    name?: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    gender?: string;
    isBusiness?: boolean;
    industry?: string;
  } | null;
  contact: {
    currentAddress: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      type?: string;
    } | null;
    emails: string[];
    alternatePhones: string[];
  };
  verification: {
    phoneValid: boolean;
    activityScore: number;
    leadGrade: string;
    canReceiveSms: boolean;
    isDisconnected: boolean;
    riskScore?: number;
    spamScore?: number;
    isSpam: boolean;
  };
  callerId: {
    callerName?: string;
    callerType?: string;
    spamScore?: number;
    isSpam?: boolean;
  } | null;
  errors: {
    reversePhone: string | null;
    callerId: string | null;
    phoneValidation: string | null;
    leadQuality: string | null;
  };
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function GradeBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    A: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    B: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    C: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    D: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    F: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${colors[grade] || colors.C}`}>
      Grade {grade}
    </span>
  );
}

function StatusBadge({ isValid, label }: { isValid: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
      isValid
        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      {isValid ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <CheckCircle className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function PhoneLookupPage() {
  const [phoneInput, setPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!phoneInput.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/trestle/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Lookup failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Phone className="w-7 h-7 text-blue-600" />
          Phone Number Lookup
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Search for detailed information about any phone number using Trestle IQ APIs
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter phone number (e.g., 205-617-3229)"
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !phoneInput.trim()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
                     flex items-center gap-2 transition-colors"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            Search
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Overview Section */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-white">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-2xl font-bold">{result.phone}</h2>
                  <CopyButton text={result.phoneRaw} />
                </div>
                {result.owner?.name && (
                  <p className="text-xl text-blue-100">{result.owner.name}</p>
                )}
                {result.owner?.isBusiness && result.owner?.industry && (
                  <p className="text-blue-200 mt-1">{result.owner.industry}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <GradeBadge grade={result.overview.leadGrade} />
                <div className="text-center">
                  <div className="text-3xl font-bold">{result.overview.activityScore}</div>
                  <div className="text-xs text-blue-200">Activity Score</div>
                </div>
              </div>
            </div>

            {/* Quick Status Badges */}
            <div className="flex flex-wrap gap-2 mt-4">
              <StatusBadge isValid={result.overview.isValid} label="Valid" />
              <StatusBadge isValid={result.verification.canReceiveSms} label="SMS Capable" />
              <StatusBadge isValid={!result.verification.isSpam} label={result.verification.isSpam ? 'Spam Risk' : 'Not Spam'} />
              <StatusBadge isValid={!result.verification.isDisconnected} label={result.verification.isDisconnected ? 'Disconnected' : 'Active'} />
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Owner Information */}
            <InfoCard title="Owner Information" icon={User}>
              {result.owner ? (
                <div className="space-y-2 text-sm">
                  {result.owner.name && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Name</span>
                      <span className="font-medium text-gray-900 dark:text-white">{result.owner.name}</span>
                    </div>
                  )}
                  {result.owner.age && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Age</span>
                      <span className="font-medium text-gray-900 dark:text-white">{result.owner.age}</span>
                    </div>
                  )}
                  {result.owner.gender && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Gender</span>
                      <span className="font-medium text-gray-900 dark:text-white capitalize">{result.owner.gender}</span>
                    </div>
                  )}
                  {result.owner.isBusiness && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Type</span>
                      <span className="font-medium text-gray-900 dark:text-white">Business</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No owner information available</p>
              )}
            </InfoCard>

            {/* Phone Details */}
            <InfoCard title="Phone Details" icon={Signal}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Line Type</span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{result.overview.lineType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Carrier</span>
                  <span className="font-medium text-gray-900 dark:text-white">{result.overview.carrier}</span>
                </div>
                {result.overview.isCommercial && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Commercial</span>
                    <span className="font-medium text-gray-900 dark:text-white">Yes</span>
                  </div>
                )}
                {result.overview.isPrepaid && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Prepaid</span>
                    <span className="font-medium text-gray-900 dark:text-white">Yes</span>
                  </div>
                )}
              </div>
            </InfoCard>

            {/* Address */}
            <InfoCard title="Current Address" icon={MapPin}>
              {result.contact.currentAddress ? (
                <div className="text-sm">
                  {result.contact.currentAddress.street && (
                    <p className="font-medium text-gray-900 dark:text-white">
                      {result.contact.currentAddress.street}
                    </p>
                  )}
                  <p className="text-gray-600 dark:text-gray-400">
                    {[
                      result.contact.currentAddress.city,
                      result.contact.currentAddress.state,
                      result.contact.currentAddress.zip,
                    ].filter(Boolean).join(', ')}
                  </p>
                  {result.contact.currentAddress.type && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 capitalize">
                      {result.contact.currentAddress.type}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No address information available</p>
              )}
            </InfoCard>

            {/* Emails */}
            <InfoCard title="Email Addresses" icon={Mail}>
              {result.contact.emails.length > 0 ? (
                <ul className="space-y-1">
                  {result.contact.emails.map((email, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 dark:text-white truncate">{email}</span>
                      <CopyButton text={email} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No email addresses found</p>
              )}
            </InfoCard>

            {/* Alternate Phones */}
            <InfoCard title="Alternate Numbers" icon={Phone}>
              {result.contact.alternatePhones.length > 0 ? (
                <ul className="space-y-1">
                  {result.contact.alternatePhones.map((phone, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-900 dark:text-white">{formatPhone(phone)}</span>
                      <CopyButton text={phone} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">No alternate numbers found</p>
              )}
            </InfoCard>

            {/* Verification */}
            <InfoCard title="Verification & Risk" icon={Shield}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Lead Grade</span>
                  <GradeBadge grade={result.verification.leadGrade} />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Activity Score</span>
                  <span className="font-medium text-gray-900 dark:text-white">{result.verification.activityScore}/100</span>
                </div>
                {result.verification.spamScore !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Spam Score</span>
                    <span className={`font-medium ${result.verification.spamScore > 50 ? 'text-red-600' : 'text-green-600'}`}>
                      {result.verification.spamScore}/100
                    </span>
                  </div>
                )}
                {result.verification.riskScore !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Risk Score</span>
                    <span className={`font-medium ${result.verification.riskScore > 50 ? 'text-red-600' : 'text-green-600'}`}>
                      {result.verification.riskScore}/100
                    </span>
                  </div>
                )}
              </div>
            </InfoCard>
          </div>

          {/* Caller ID Section */}
          {result.callerId && (
            <InfoCard title="Caller ID Information" icon={MessageSquare}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {result.callerId.callerName && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Caller Name</span>
                    <span className="font-medium text-gray-900 dark:text-white">{result.callerId.callerName}</span>
                  </div>
                )}
                {result.callerId.callerType && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Type</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">{result.callerId.callerType}</span>
                  </div>
                )}
                {result.callerId.spamScore !== undefined && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 block">Spam Score</span>
                    <span className={`font-medium ${result.callerId.spamScore! > 50 ? 'text-red-600' : 'text-green-600'}`}>
                      {result.callerId.spamScore}/100
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-gray-500 dark:text-gray-400 block">Spam Flag</span>
                  <span className={`font-medium ${result.callerId.isSpam ? 'text-red-600' : 'text-green-600'}`}>
                    {result.callerId.isSpam ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </InfoCard>
          )}

          {/* Timestamp */}
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" />
            Lookup performed at {new Date(result.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !result && !error && (
        <div className="text-center py-12">
          <Phone className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Search for a phone number
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Enter a phone number above to retrieve detailed information including owner details,
            carrier information, lead quality scores, and verification status.
          </p>
        </div>
      )}
    </div>
  );
}
