'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Send } from 'lucide-react';
import type { RenewalNote } from './types';

interface NotesPanelProps {
  notes: RenewalNote[];
  onAddNote: (content: string) => Promise<void>;
  loading?: boolean;
}

export default function NotesPanel({ notes, onAddNote, loading }: NotesPanelProps) {
  const [newNote, setNewNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!newNote.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onAddNote(newNote.trim());
      setNewNote('');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes</h4>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3 max-h-64">
        {notes.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500 italic">No notes yet</p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className={cn(
              'p-2 rounded-md text-sm',
              note.type === 'system'
                ? 'bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 italic'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium">
                {note.author || 'System'}
                {note.type === 'system' && (
                  <span className="ml-1.5 px-1 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px]">
                    SYSTEM
                  </span>
                )}
                {note.type === 'agent' && (
                  <span className="ml-1.5 px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px]">
                    AGENT
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {formatTime(note.createdAt)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{note.content}</p>
          </div>
        ))}
      </div>

      {/* Add note form */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="Add a note..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
          disabled={submitting || loading}
        />
        <button
          onClick={handleSubmit}
          disabled={!newNote.trim() || submitting || loading}
          className="px-3 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
