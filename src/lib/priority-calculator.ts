/**
 * Priority Calculator
 * Automatically calculates priority (high/medium/low) for triage items
 * based on customer status, content analysis, age, and item type.
 */

export type Priority = 'high' | 'medium' | 'low';

export interface PriorityScore {
  priority: Priority;
  score: number; // 0-100
  reasons: string[];
}

export interface PriorityInput {
  matchStatus: string;
  customerData?: {
    policies?: Array<{ type?: string; premium?: number }>;
    isVIP?: boolean;
  } | null;
  aiSummary: string;
  createdAt: Date;
  itemType: 'call' | 'message';
  direction?: 'inbound' | 'outbound' | null;
  callDuration?: number; // in seconds
}

/**
 * Calculate priority score and level for a triage item
 */
export function calculatePriority(item: PriorityInput): PriorityScore {
  let score = 50; // Start at medium
  const reasons: string[] = [];

  // Factor 1: Customer Status (30 points max)
  if (item.matchStatus === 'matched' && item.customerData) {
    const policyCount = item.customerData.policies?.length || 0;
    const totalPremium = item.customerData.policies?.reduce(
      (sum, p) => sum + (p.premium || 0),
      0
    ) || 0;

    if (item.customerData.isVIP) {
      score += 30;
      reasons.push('VIP customer');
    } else if (policyCount >= 3 || totalPremium >= 5000) {
      score += 25;
      reasons.push(`High-value customer (${policyCount} policies)`);
    } else if (policyCount >= 1) {
      score += 15;
      reasons.push('Existing customer');
    }
  } else if (item.matchStatus === 'unmatched') {
    score -= 10;
    reasons.push('No customer match');
  }

  // Factor 2: Content Analysis (25 points max)
  const summary = (item.aiSummary || '').toLowerCase();

  // High priority keywords (urgent actions)
  if (/cancel|cancellation|drop coverage|non-?renew/i.test(summary)) {
    score += 25;
    reasons.push('Cancellation risk');
  } else if (/claim|accident|damage|loss|theft|injury/i.test(summary)) {
    score += 22;
    reasons.push('Claim-related');
  } else if (/urgent|emergency|asap|immediately|today/i.test(summary)) {
    score += 20;
    reasons.push('Urgent request');
  } else if (/policy change|add vehicle|remove|update policy|endorsement/i.test(summary)) {
    score += 15;
    reasons.push('Policy change request');
  } else if (/quote|price|how much|cost|rate|premium/i.test(summary)) {
    score += 10;
    reasons.push('Quote request');
  } else if (/payment|bill|pay|due|balance/i.test(summary)) {
    score += 12;
    reasons.push('Payment-related');
  } else if (/certificate|proof|verification|id card/i.test(summary)) {
    score += 8;
    reasons.push('Document request');
  }

  // Low priority indicators
  if (/wrong number|spam|telemarketer|solicitor|robot|automated/i.test(summary)) {
    score -= 25;
    reasons.push('Likely spam/wrong number');
  } else if (/general question|just wondering|curious|checking in/i.test(summary)) {
    score -= 10;
    reasons.push('General inquiry');
  } else if (/voicemail|left message|no answer|didn't reach/i.test(summary)) {
    score -= 5;
    reasons.push('Voicemail/no contact');
  }

  // Factor 3: Age (20 points max)
  const hoursOld = (Date.now() - item.createdAt.getTime()) / (1000 * 60 * 60);

  if (hoursOld > 24) {
    score += 20;
    reasons.push('Overdue (>24 hours)');
  } else if (hoursOld > 8) {
    score += 15;
    reasons.push('Waiting >8 hours');
  } else if (hoursOld > 4) {
    score += 10;
    reasons.push('Waiting >4 hours');
  } else if (hoursOld > 2) {
    score += 5;
    reasons.push('Waiting >2 hours');
  }

  // Factor 4: Item Type & Direction (10 points max)
  if (item.itemType === 'call') {
    if (item.direction === 'inbound') {
      score += 10;
      reasons.push('Inbound call (higher intent)');
    } else {
      score += 5;
      reasons.push('Outbound call');
    }
  } else {
    // Messages
    score += 3;
  }

  // Factor 5: Call Duration (5 points max)
  if (item.callDuration) {
    if (item.callDuration > 300) {
      // > 5 minutes
      score += 5;
      reasons.push('Long call (>5 min)');
    } else if (item.callDuration > 120) {
      // > 2 minutes
      score += 3;
    } else if (item.callDuration < 30) {
      // < 30 seconds (likely hangup)
      score -= 10;
      reasons.push('Very short call');
    }
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Determine priority level
  let priority: Priority;
  if (score >= 70) {
    priority = 'high';
  } else if (score >= 40) {
    priority = 'medium';
  } else {
    priority = 'low';
  }

  return { priority, score, reasons };
}

/**
 * Get priority badge styling
 */
export function getPriorityStyle(priority: Priority) {
  const styles = {
    high: {
      label: 'HIGH',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      textColor: 'text-red-800 dark:text-red-200',
      borderColor: 'border-red-300 dark:border-red-700',
      dotColor: 'bg-red-500',
    },
    medium: {
      label: 'MED',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      textColor: 'text-amber-800 dark:text-amber-200',
      borderColor: 'border-amber-300 dark:border-amber-700',
      dotColor: 'bg-amber-500',
    },
    low: {
      label: 'LOW',
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      textColor: 'text-gray-600 dark:text-gray-400',
      borderColor: 'border-gray-300 dark:border-gray-600',
      dotColor: 'bg-gray-400',
    },
  };

  return styles[priority];
}
