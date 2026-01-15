'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { WrapupTicketType } from '@/types';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  agencyzoomId?: string;
}

interface CreateTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (ticketType: WrapupTicketType, assignedToId: string, summary?: string) => void;
  isLoading?: boolean;
  initialSummary?: string;
  callerName?: string;
}

const TICKET_TYPES: { value: WrapupTicketType; label: string; description: string }[] = [
  { value: 'service_request', label: 'Service Request', description: 'General service or support needed' },
  { value: 'policy_change', label: 'Policy Change', description: 'Endorsement or policy modification' },
  { value: 'billing', label: 'Billing', description: 'Payment, billing question, or issue' },
  { value: 'claims', label: 'Claims', description: 'Claim-related follow-up' },
  { value: 'general', label: 'General', description: 'Other inquiry or follow-up' },
];

export default function CreateTicketModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  initialSummary = '',
  callerName = 'Unknown',
}: CreateTicketModalProps) {
  const [step, setStep] = useState<'type' | 'assign'>('type');
  const [selectedType, setSelectedType] = useState<WrapupTicketType | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [summary, setSummary] = useState(initialSummary);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('type');
      setSelectedType(null);
      setSelectedUser(null);
      setSummary(initialSummary);
    }
  }, [isOpen, initialSummary]);

  // Fetch users when moving to assign step
  useEffect(() => {
    if (step !== 'assign') return;

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch('/api/users?includeAgencyzoom=true');
        const data = await res.json();
        if (data.success && data.users) {
          setUsers(data.users.filter((u: User) => u.agencyzoomId));
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [step]);

  const handleNext = () => {
    if (selectedType) {
      setStep('assign');
    }
  };

  const handleBack = () => {
    setStep('type');
    setSelectedUser(null);
    setSearchTerm('');
  };

  const handleConfirm = () => {
    if (!selectedType || !selectedUser) return;
    onConfirm(selectedType, selectedUser.id, summary.trim() || undefined);
  };

  const handleClose = () => {
    setStep('type');
    setSelectedType(null);
    setSelectedUser(null);
    setSummary('');
    setSearchTerm('');
    onClose();
  };

  const filteredUsers = users.filter(user => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-indigo-600">
          <h2 className="text-lg font-bold text-white">Create Service Ticket</h2>
          <p className="text-sm text-blue-100">
            {step === 'type' ? 'Select ticket type' : 'Assign to team member'}
          </p>
        </div>

        {step === 'type' ? (
          <>
            {/* Type Selection */}
            <div className="p-4 max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                What type of ticket should this be for {callerName}?
              </p>
              <div className="space-y-2">
                {TICKET_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setSelectedType(type.value)}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left transition-all',
                      selectedType === type.value
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {type.label}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {type.description}
                    </div>
                  </button>
                ))}
              </div>

              {/* Summary Edit */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ticket Description
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Describe the ticket..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Footer for Type Step */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleNext}
                disabled={!selectedType}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors',
                  selectedType
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                )}
              >
                Next: Assign
              </button>
            </div>
          </>
        ) : (
          <>
            {/* User Selection */}
            <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loadingUsers ? (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Loading team members...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                  No team members found
                </div>
              ) : (
                <div className="py-2">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUser(user)}
                      className={cn(
                        'w-full px-6 py-3 flex items-center gap-3 transition-colors text-left',
                        selectedUser?.id === user.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </div>

                      {/* Name & Email */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 dark:text-white">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </div>
                      </div>

                      {/* Check */}
                      {selectedUser?.id === user.id && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer for Assign Step */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
              <button
                onClick={handleBack}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading || !selectedUser}
                className={cn(
                  'flex-1 px-4 py-2 rounded-lg font-medium text-white transition-colors',
                  selectedUser
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-400 cursor-not-allowed'
                )}
              >
                {isLoading ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
