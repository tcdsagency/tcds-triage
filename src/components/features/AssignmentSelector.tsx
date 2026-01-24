'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Assignee {
  id: string;
  name: string;
  initials?: string;
}

interface AssignmentSelectorProps {
  itemId: string;
  currentAssignee?: Assignee | null;
  currentUserId: string;
  currentUserName: string;
  teamMembers: Assignee[];
  onAssign: (userId: string | null) => Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Assignment selector dropdown for assigning triage items to team members
 */
export function AssignmentSelector({
  itemId,
  currentAssignee,
  currentUserId,
  currentUserName,
  teamMembers,
  onAssign,
  disabled = false,
  compact = false,
}: AssignmentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAssign = async (userId: string | null) => {
    if (loading || disabled) return;

    setLoading(true);
    try {
      await onAssign(userId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to assign:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAssignedToMe = currentAssignee?.id === currentUserId;
  const assigneeDisplay = currentAssignee
    ? isAssignedToMe
      ? 'Me'
      : currentAssignee.name
    : 'Unassigned';

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={cn(
          'flex items-center gap-1.5 rounded-md border transition-colors',
          compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm',
          isOpen
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800',
          disabled && 'opacity-50 cursor-not-allowed',
          loading && 'opacity-70'
        )}
      >
        {/* Avatar/Icon */}
        {currentAssignee ? (
          <span
            className={cn(
              'flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium',
              compact ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs'
            )}
          >
            {currentAssignee.initials || getInitials(currentAssignee.name)}
          </span>
        ) : (
          <svg
            className={cn('text-gray-400', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        )}

        <span className={cn(currentAssignee ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500')}>
          {loading ? '...' : assigneeDisplay}
        </span>

        <svg
          className={cn('text-gray-400', compact ? 'w-3 h-3' : 'w-4 h-4')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
          <div className="p-1.5">
            <div className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1 mb-1">
              Assign to:
            </div>

            {/* Assign to me */}
            {!isAssignedToMe && (
              <button
                onClick={() => handleAssign(currentUserId)}
                disabled={loading}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-left"
              >
                <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium">
                  {getInitials(currentUserName)}
                </span>
                <span>Me ({currentUserName.split(' ')[0]})</span>
              </button>
            )}

            {/* Assign to team members */}
            {teamMembers
              .filter((m) => m.id !== currentUserId && m.id !== currentAssignee?.id)
              .slice(0, 8) // Limit to 8 team members
              .map((member) => (
                <button
                  key={member.id}
                  onClick={() => handleAssign(member.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-left"
                >
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium">
                    {member.initials || getInitials(member.name)}
                  </span>
                  <span className="truncate">{member.name}</span>
                </button>
              ))}

            {/* Unassign */}
            {currentAssignee && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <button
                  onClick={() => handleAssign(null)}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-left text-gray-600 dark:text-gray-400"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span>Unassign</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact assignment badge (shows just initials, no dropdown)
 */
export function AssignmentBadge({
  assignee,
  currentUserId,
  className = '',
}: {
  assignee?: Assignee | null;
  currentUserId?: string;
  className?: string;
}) {
  if (!assignee) {
    return (
      <span
        className={cn(
          'inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400',
          className
        )}
        title="Unassigned"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </span>
    );
  }

  const isMe = currentUserId && assignee.id === currentUserId;
  const initials =
    assignee.initials ||
    assignee.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
        isMe
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
        className
      )}
      title={isMe ? 'Assigned to me' : `Assigned to ${assignee.name}`}
    >
      {initials}
    </span>
  );
}
