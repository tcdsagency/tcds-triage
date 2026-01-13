'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface AgencyZoomUser {
  agencyzoomId: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface AssigneeSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (assigneeId: number, assigneeName: string) => void;
  title?: string;
  isLoading?: boolean;
}

export default function AssigneeSelectModal({
  isOpen,
  onClose,
  onSelect,
  title = 'Assign Service Request',
  isLoading = false,
}: AssigneeSelectModalProps) {
  const [users, setUsers] = useState<AgencyZoomUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch AgencyZoom users
  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/agencyzoom/users');
        const data = await res.json();
        if (data.success && data.agencyzoomUsers) {
          setUsers(data.agencyzoomUsers);
        }
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [isOpen]);

  // Filter users by search
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
          <h2 className="text-lg font-bold text-white">{title}</h2>
          <p className="text-sm text-blue-100">Select who should handle this request</p>
        </div>

        {/* Search */}
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

        {/* User List */}
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
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
                  key={user.agencyzoomId}
                  onClick={() => onSelect(user.agencyzoomId, `${user.firstName} ${user.lastName}`)}
                  disabled={isLoading}
                  className={cn(
                    'w-full px-6 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {user.firstName[0]}{user.lastName[0]}
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

                  {/* Arrow */}
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full px-4 py-2 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
