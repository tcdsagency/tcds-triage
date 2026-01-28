'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { IntentData } from './MultiIntentTabs';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string;
  agencyzoomId?: string;
}

interface BatchCreateTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (assigneeId: string) => void;
  selectedIntents: IntentData[];
  categories: Array<{ id: number; name: string }>;
  priorities: Array<{ id: number; name: string }>;
  customerName: string;
  isLoading?: boolean;
}

/**
 * BatchCreateTicketsModal
 * =======================
 * Confirmation modal for creating multiple service tickets from detected intents.
 * Allows selecting a single assignee for all tickets.
 */
export default function BatchCreateTicketsModal({
  isOpen,
  onClose,
  onConfirm,
  selectedIntents,
  categories,
  priorities,
  customerName,
  isLoading = false,
}: BatchCreateTicketsModalProps) {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedUser(null);
      setSearchTerm('');
    }
  }, [isOpen]);

  // Fetch users when modal opens
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  const handleConfirm = () => {
    if (!selectedUser) return;
    onConfirm(selectedUser.id);
  };

  const filteredUsers = users.filter((user) => {
    const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase());
  });

  const getCategoryName = (id: number | null) => {
    if (!id) return 'Not set';
    return categories.find((c) => c.id === id)?.name || 'Unknown';
  };

  const getPriorityName = (id: number | null) => {
    if (!id) return 'Not set';
    return priorities.find((p) => p.id === id)?.name || 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-indigo-600">
          <h2 className="text-lg font-bold text-white">Create Service Tickets</h2>
          <p className="text-sm text-blue-100">
            Creating {selectedIntents.length} ticket{selectedIntents.length !== 1 ? 's' : ''} for{' '}
            {customerName}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Ticket preview */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Tickets to Create
            </h3>
            <div className="space-y-2">
              {selectedIntents.map((intent, index) => (
                <div
                  key={intent.id}
                  className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </span>
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        {intent.requestType || 'Service Request'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {intent.summary}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>Category: {getCategoryName(intent.categoryId)}</span>
                    <span>|</span>
                    <span>Priority: {getPriorityName(intent.priorityId)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Assignee selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Assign All Tickets To
            </h3>

            {/* Search input */}
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search team members..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 pl-9 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>

            {/* User list */}
            {loadingUsers ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : (
              <div className="grid gap-2 max-h-48 overflow-y-auto">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUser?.id === user.id;
                  const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase();

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border transition-all text-left',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                    >
                      <div
                        className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium',
                          isSelected
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        )}
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user.email}
                        </p>
                      </div>
                      {isSelected && (
                        <svg
                          className="w-5 h-5 text-blue-500"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No team members found
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedUser || isLoading}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              selectedUser
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Creating...
              </span>
            ) : (
              `Create ${selectedIntents.length} Ticket${selectedIntents.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
