/**
 * Donna AI Context Generator
 * ==========================
 * Generates AI-powered call context for policy notices
 * including talking points, objection handlers, and recommendations.
 */

export interface ObjectionHandler {
  objection: string;
  response: string;
}

export interface DonnaCallContext {
  talkingPoints: string[];
  objectionHandlers: ObjectionHandler[];
  customerSentiment?: string;
  churnRisk?: 'low' | 'medium' | 'high';
  recommendedAction: string;
  generatedAt: string;
}

/**
 * Generate Donna AI call context for a policy notice
 */
export function generateDonnaContext(
  noticeType: string,
  amountDue?: string | null,
  dueDate?: string | null,
  claimStatus?: string | null,
  customerName?: string | null
): DonnaCallContext {
  const context: DonnaCallContext = {
    talkingPoints: [],
    objectionHandlers: [],
    recommendedAction: '',
    generatedAt: new Date().toISOString(),
  };

  const formattedAmount = amountDue ? `$${parseFloat(amountDue).toFixed(2)}` : 'the amount due';
  const formattedDate = dueDate ? formatDate(dueDate) : 'soon';
  const greeting = customerName ? `Hi ${customerName.split(' ')[0]}, ` : '';

  if (noticeType === 'billing') {
    context.talkingPoints = [
      `${greeting}I'm calling about your policy payment of ${formattedAmount} due ${formattedDate}`,
      'Can we help you get this payment taken care of today?',
      'We have several payment options available including credit card, bank draft, or payment plan',
      'Confirm the payment method on file is still current',
    ];

    context.objectionHandlers = [
      {
        objection: "I can't afford to pay right now",
        response: "I completely understand that budgets can be tight. Let me see what payment options we have available. We may be able to set up a payment plan that works better for your situation.",
      },
      {
        objection: "I didn't receive a bill",
        response: "I apologize for that - let me verify we have your correct contact information so we can make sure you receive future notices. In the meantime, I can help you take care of this payment today.",
      },
      {
        objection: "I want to cancel my policy",
        response: "Before we do that, let me make sure we've explored all your options. Sometimes there are ways to adjust coverage that can help with the premium while still keeping you protected.",
      },
    ];

    context.recommendedAction = 'Call to collect payment or set up payment plan';
    context.churnRisk = amountDue && parseFloat(amountDue) > 500 ? 'high' : 'medium';

  } else if (noticeType === 'claim') {
    context.talkingPoints = [
      `${greeting}I'm reaching out about your recent claim`,
      `Current claim status: ${claimStatus || 'in progress'}`,
      'I wanted to check in and see if you have any questions',
      'Let me explain what the next steps will be',
    ];

    context.objectionHandlers = [
      {
        objection: "Why is this taking so long?",
        response: "I understand your frustration. Let me check on the specific status and see if there's anything we can do to expedite the process. Sometimes we need additional documentation which I can help you with.",
      },
      {
        objection: "I'm not happy with the settlement amount",
        response: "I hear your concern. Let me review the claim details with you and explain how the amount was determined. If you have additional documentation or estimates that weren't considered, we can look at those.",
      },
    ];

    context.recommendedAction = 'Proactive claim status update and customer check-in';

    if (claimStatus === 'denied') {
      context.churnRisk = 'high';
      context.talkingPoints.push('I want to explain why the claim was denied and discuss your options');
    }

  } else {
    // Policy notices (renewal, endorsement, cancellation, etc.)
    context.talkingPoints = [
      `${greeting}I'm calling about an important update to your policy`,
      'I wanted to walk you through the changes and answer any questions',
      'Let me explain how this might affect your coverage or premium',
      'Is there anything about your coverage needs that has changed recently?',
    ];

    context.objectionHandlers = [
      {
        objection: "My premium went up too much",
        response: "I understand rate increases are frustrating. Let me review your policy to see if there are any discounts you might qualify for, or if we can adjust coverage to help with the cost while still meeting your needs.",
      },
      {
        objection: "I want to shop around",
        response: "That's completely understandable. Before you do, let me make sure you're getting all the discounts available and that your coverage is right-sized for your current needs. We want to make sure you're comparing apples to apples.",
      },
    ];

    context.recommendedAction = 'Policy review and retention call';
    context.churnRisk = 'medium';
  }

  return context;
}

/**
 * Format date for display in talking points
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) {
      return 'today';
    }
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'tomorrow';
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
