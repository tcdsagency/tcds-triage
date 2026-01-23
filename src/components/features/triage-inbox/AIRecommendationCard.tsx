'use client';

import { cn } from '@/lib/utils';

interface OpenTicket {
  id: number;
  subject: string;
  stageName: string | null;
  csrName: string | null;
  createdAt: string;
  daysOpen: number;
  priorityName: string | null;
  categoryName: string | null;
}

interface AIRecommendation {
  suggestedAction: 'append' | 'create' | 'dismiss';
  confidence: number;
  reasoning: string;
  relatedTickets?: Array<{
    ticketId: number;
    similarity: number;
    subject: string;
    csrName: string | null;
  }>;
}

interface AIRecommendationCardProps {
  recommendation: AIRecommendation | null | undefined;
  loading: boolean;
  openTickets: OpenTicket[];
  onAppend: (ticketId: number) => void;
  onDismiss: () => void;
  onCreate: () => void;
}

const ACTION_CONFIG = {
  append: {
    icon: '📎',
    title: 'Append to Existing Ticket',
    description: 'This appears to be a follow-up to an existing ticket',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800',
    buttonColor: 'bg-blue-600 hover:bg-blue-700',
    buttonText: 'Append',
  },
  create: {
    icon: '➕',
    title: 'Create New Ticket',
    description: 'This appears to be a new service request',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    buttonColor: 'bg-green-600 hover:bg-green-700',
    buttonText: 'Create Ticket',
  },
  dismiss: {
    icon: '🚫',
    title: 'Dismiss',
    description: 'No action appears to be needed',
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    borderColor: 'border-gray-200 dark:border-gray-700',
    buttonColor: 'bg-gray-500 hover:bg-gray-600',
    buttonText: 'Dismiss',
  },
};

export default function AIRecommendationCard({
  recommendation,
  loading,
  openTickets,
  onAppend,
  onDismiss,
  onCreate,
}: AIRecommendationCardProps) {
  if (loading) {
    return (
      <div className="p-4 rounded-lg border border-border bg-muted/30 animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-muted rounded" />
          <div className="h-5 bg-muted rounded w-48" />
        </div>
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
    );
  }

  if (!recommendation) {
    return (
      <div className="p-4 rounded-lg border border-border bg-muted/30">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="text-lg">🤖</span>
          <span className="text-sm">Analyzing call content...</span>
        </div>
      </div>
    );
  }

  const config = ACTION_CONFIG[recommendation.suggestedAction];
  const topTicket = recommendation.relatedTickets?.[0];
  const confidencePercent = Math.round(recommendation.confidence * 100);

  const handlePrimaryAction = () => {
    switch (recommendation.suggestedAction) {
      case 'append':
        if (topTicket) {
          onAppend(topTicket.ticketId);
        } else if (openTickets.length > 0) {
          onAppend(openTickets[0].id);
        }
        break;
      case 'create':
        onCreate();
        break;
      case 'dismiss':
        onDismiss();
        break;
    }
  };

  return (
    <div className={cn(
      'p-4 rounded-lg border-2',
      config.bgColor,
      config.borderColor
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <span className="font-semibold">AI Recommendation</span>
        </div>
        <span className={cn(
          'text-xs px-2 py-1 rounded-full font-medium',
          confidencePercent >= 80
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : confidencePercent >= 60
            ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        )}>
          {confidencePercent}% confident
        </span>
      </div>

      {/* Suggested Action */}
      <div className="mb-3">
        <h4 className="font-medium">{config.title}</h4>
        <p className="text-sm text-muted-foreground">
          {recommendation.reasoning || config.description}
        </p>
      </div>

      {/* Related Ticket (for append) */}
      {recommendation.suggestedAction === 'append' && topTicket && (
        <div className="mb-4 p-3 bg-white dark:bg-gray-900 rounded border border-border">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-sm text-muted-foreground">
                #{topTicket.ticketId}
              </span>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-sm font-medium">{topTicket.subject}</span>
            </div>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-medium',
              topTicket.similarity >= 0.8
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            )}>
              {Math.round(topTicket.similarity * 100)}% match
            </span>
          </div>
          {topTicket.csrName && (
            <div className="text-xs text-muted-foreground mt-1">
              Assigned to: {topTicket.csrName}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePrimaryAction}
          className={cn(
            'flex-1 px-4 py-2 text-white rounded-lg font-medium transition-colors',
            config.buttonColor
          )}
        >
          {config.buttonText}
          {recommendation.suggestedAction === 'append' && topTicket && (
            <span className="ml-1 opacity-75">→ #{topTicket.ticketId}</span>
          )}
        </button>

        {/* Alternative actions */}
        {recommendation.suggestedAction !== 'dismiss' && (
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Dismiss
          </button>
        )}
        {recommendation.suggestedAction !== 'create' && (
          <button
            onClick={onCreate}
            className="px-4 py-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Create New
          </button>
        )}
      </div>
    </div>
  );
}
