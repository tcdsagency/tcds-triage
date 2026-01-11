/**
 * Priority Scoring for Policy Notices
 * ====================================
 * Calculates a 0-100 priority score for policy notices
 * to help prioritize agent call queues.
 *
 * Score breakdown:
 * - Notice type: 30 pts max
 * - Time sensitivity: 20 pts max
 * - Customer value: 15 pts max
 * - Base: 50 pts
 */

export type NoticeType = 'billing' | 'policy' | 'claim';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'urgent';

export interface PriorityInput {
  noticeType: NoticeType;
  urgency: UrgencyLevel;
  daysUntilDue: number | null;
  amountDue: number | null;
  customerValue: number | null;
  claimStatus?: string;
}

/**
 * Calculate priority score (0-100) for a policy notice
 */
export function calculatePriorityScore(input: PriorityInput): number {
  let score = 50; // baseline

  // Notice type weights (30 points max)
  if (input.noticeType === 'billing') {
    if (input.urgency === 'urgent') {
      score += 30; // cancellation pending
    } else if (input.urgency === 'high') {
      score += 20; // past due
    } else if (input.urgency === 'medium') {
      score += 15;
    } else {
      score += 10;
    }
  } else if (input.noticeType === 'claim') {
    // Claims are always important
    if (input.claimStatus === 'new' || input.claimStatus === 'denied') {
      score += 30;
    } else {
      score += 25;
    }
  } else {
    // Policy notices
    if (input.urgency === 'urgent') {
      score += 25; // cancellation
    } else if (input.urgency === 'high') {
      score += 20; // non-renewal
    } else {
      score += 15;
    }
  }

  // Time sensitivity (20 points max)
  if (input.daysUntilDue !== null) {
    if (input.daysUntilDue < 0) {
      score += 20; // past due
    } else if (input.daysUntilDue <= 1) {
      score += 15; // due today or tomorrow
    } else if (input.daysUntilDue <= 3) {
      score += 10; // due within 3 days
    } else if (input.daysUntilDue <= 7) {
      score += 5; // due within a week
    }
  }

  // Customer value (15 points max)
  if (input.customerValue !== null) {
    if (input.customerValue >= 5000) {
      score += 15; // high-value customer
    } else if (input.customerValue >= 2000) {
      score += 10;
    } else if (input.customerValue >= 1000) {
      score += 5;
    }
  }

  // Clamp to 0-100
  return Math.min(100, Math.max(0, score));
}

/**
 * Get priority label from score
 */
export function getPriorityLabel(score: number): string {
  if (score >= 80) return 'Critical';
  if (score >= 65) return 'High';
  if (score >= 50) return 'Medium';
  return 'Low';
}

/**
 * Get priority color class for UI
 */
export function getPriorityColor(score: number): string {
  if (score >= 80) return 'red';
  if (score >= 65) return 'orange';
  if (score >= 50) return 'yellow';
  return 'gray';
}
