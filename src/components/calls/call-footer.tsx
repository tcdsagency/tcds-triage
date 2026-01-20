'use client';

/**
 * Call Footer Component
 *
 * Bottom action bar with quick actions like Add Note, Create Task,
 * Create Lead, Schedule Follow-up, and Complete Wrapup.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Customer } from '@/types';
import type { DetectedEntity } from './caller-context-panel';

// =============================================================================
// ICONS
// =============================================================================

const PencilIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const CheckSquareIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const UserPlusIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const TagIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

// =============================================================================
// TYPES
// =============================================================================

interface CallFooterProps {
  callId: string;
  customer: Customer | null;
  detectedEntities: DetectedEntity[];
  onAddNote?: () => void;
  onCreateTask?: () => void;
  onCreateLead?: () => void;
  onScheduleFollowUp?: () => void;
  onSaveDraft?: () => void;
  onCompleteWrapup?: () => void;
  isSaving?: boolean;
}

// =============================================================================
// SIMPLE MODAL COMPONENT
// =============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <XIcon />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

// =============================================================================
// ADD NOTE FORM
// =============================================================================

interface AddNoteFormProps {
  onSubmit: (note: string) => void;
  onCancel: () => void;
}

function AddNoteForm({ onSubmit, onCancel }: AddNoteFormProps) {
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (note.trim()) {
      onSubmit(note.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Enter your note..."
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!note.trim()}>
          Add Note
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// CREATE TASK FORM
// =============================================================================

interface CreateTaskFormProps {
  onSubmit: (task: { title: string; description: string; dueDate?: string }) => void;
  onCancel: () => void;
}

function CreateTaskForm({ onSubmit, onCancel }: CreateTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSubmit({
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || undefined,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Task Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Follow up on quote"
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Additional details..."
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Due Date
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim()}>
          Create Task
        </Button>
      </div>
    </form>
  );
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CallFooter({
  callId,
  customer,
  detectedEntities,
  onAddNote,
  onCreateTask,
  onCreateLead,
  onScheduleFollowUp,
  onSaveDraft,
  onCompleteWrapup,
  isSaving,
}: CallFooterProps) {
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const isNewProspect = !customer || (!customer.hawksoftClientCode && !customer.agencyzoomId);

  // Handle note submission
  const handleNoteSubmit = async (note: string) => {
    // In a real implementation, this would call the API
    console.log('Adding note:', note);
    setShowNoteModal(false);
    onAddNote?.();
  };

  // Handle task submission
  const handleTaskSubmit = async (task: { title: string; description: string; dueDate?: string }) => {
    // In a real implementation, this would call the API
    console.log('Creating task:', task);
    setShowTaskModal(false);
    onCreateTask?.();
  };

  return (
    <>
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Quick actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNoteModal(true)}
            >
              <PencilIcon />
              <span className="ml-1 hidden sm:inline">Add Note</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTaskModal(true)}
            >
              <CheckSquareIcon />
              <span className="ml-1 hidden sm:inline">Create Task</span>
            </Button>

            {isNewProspect && (
              <Button
                variant="outline"
                size="sm"
                onClick={onCreateLead}
              >
                <UserPlusIcon />
                <span className="ml-1 hidden sm:inline">Create Lead</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onScheduleFollowUp}
            >
              <CalendarIcon />
              <span className="ml-1 hidden sm:inline">Schedule</span>
            </Button>
          </div>

          {/* Center: Entity count */}
          <div className="hidden md:flex items-center gap-2">
            {detectedEntities.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                <TagIcon />
                <span className="ml-1">{detectedEntities.length} entities detected</span>
              </Badge>
            )}
          </div>

          {/* Right: Save/Complete */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveDraft}
              disabled={isSaving}
            >
              <SaveIcon />
              <span className="ml-1 hidden sm:inline">Save Draft</span>
            </Button>

            <Button
              size="sm"
              onClick={onCompleteWrapup}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircleIcon />
              <span className="ml-1">Complete Wrapup</span>
            </Button>
          </div>
        </div>
      </footer>

      {/* Note Modal */}
      <Modal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title="Add Note"
      >
        <AddNoteForm
          onSubmit={handleNoteSubmit}
          onCancel={() => setShowNoteModal(false)}
        />
      </Modal>

      {/* Task Modal */}
      <Modal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        title="Create Task"
      >
        <CreateTaskForm
          onSubmit={handleTaskSubmit}
          onCancel={() => setShowTaskModal(false)}
        />
      </Modal>
    </>
  );
}

export default CallFooter;
