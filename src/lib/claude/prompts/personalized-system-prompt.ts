/**
 * Personalized System Prompt Generator
 * =====================================
 * Generates dynamic system prompts with customer context for agent assist.
 * This makes Claude aware of all relevant customer details to provide
 * highly personalized assistance.
 */

import type { AgentAssistContext } from '../context/context-builder';
import type { PersonalContext } from '../context/note-extractor';

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Generate a personalized system prompt for agent assist
 */
export function generatePersonalizedSystemPrompt(context: AgentAssistContext): string {
  const sections: string[] = [];

  // 1. Role and Identity
  sections.push(generateRoleSection(context));

  // 2. Critical Customer Context
  sections.push(generateCustomerSection(context));

  // 3. Communication Preferences (CRITICAL)
  if (context.personal.communicationPrefs.length > 0) {
    sections.push(generateCommunicationSection(context.personal));
  }

  // 4. Insurance Portfolio
  if (context.policies.length > 0) {
    sections.push(generatePoliciesSection(context));
  }

  // 5. Pending Items & Follow-ups
  if (context.personal.pendingItems.length > 0) {
    sections.push(generatePendingItemsSection(context.personal));
  }

  // 6. Life Events & Rapport Building
  if (context.personal.lifeEvents.length > 0 || context.personal.familyMembers.length > 0) {
    sections.push(generatePersonalizationSection(context.personal));
  }

  // 7. Authorized Contacts
  if (context.personal.authorizedContacts.length > 0) {
    sections.push(generateAuthorizedContactsSection(context.personal));
  }

  // 8. History & Relationship
  sections.push(generateHistorySection(context));

  // 9. Critical Rules
  sections.push(generateRulesSection(context));

  // 10. Response Format
  sections.push(generateResponseFormatSection());

  return sections.join('\n\n');
}

// =============================================================================
// SECTION GENERATORS
// =============================================================================

function generateRoleSection(context: AgentAssistContext): string {
  return `You are ${context.agent.name}, a highly experienced Property & Casualty Customer Service Representative (CSR) at TCDS Insurance in Alabama.

Your role is to provide real-time assistance to agents during customer calls. You have deep expertise in:
- Alabama Insurance Regulations (minimum liability 25/50/25, MVR requirements, DOI rules)
- Personal Lines: Auto, Homeowners, Renters, Umbrella, Life
- Commercial Lines: Business owners, General liability, Commercial auto
- Consultative sales and objection handling
- Compliance and E&O risk mitigation`;
}

function generateCustomerSection(context: AgentAssistContext): string {
  const { customer, personal } = context;
  const displayName = personal.preferredName || customer.name;
  const tenure = customer.yearsAsCustomer
    ? `${customer.yearsAsCustomer} year${customer.yearsAsCustomer !== 1 ? 's' : ''}`
    : 'Unknown';

  let section = `═══════════════════════════════════════════════════════════════
CUSTOMER CONTEXT - ${customer.name.toUpperCase()}
═══════════════════════════════════════════════════════════════`;

  if (personal.preferredName) {
    section += `\n★ PREFERRED NAME: "${personal.preferredName}" (USE THIS!)`;
  }

  section += `
Phone: ${customer.phone}
Email: ${customer.email || 'Not on file'}
Address: ${customer.address || 'Not on file'}
State: ${customer.state}

Customer Since: ${customer.customerSince || 'Unknown'} (${tenure} as customer!)`;

  if (customer.clientLevel) {
    section += `\nClient Level: ${customer.clientLevel}`;
  }

  // Add sentiment indicator
  if (personal.sentiment === 'at-risk') {
    section += `\n\n⚠️ ATTENTION: Customer sentiment is AT-RISK. Handle with extra care!`;
  } else if (personal.sentiment === 'positive') {
    section += `\n\n✓ Customer has positive sentiment - great relationship!`;
  }

  return section;
}

function generateCommunicationSection(personal: PersonalContext): string {
  let section = `🔔 CRITICAL - COMMUNICATION PREFERENCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  for (const pref of personal.communicationPrefs) {
    section += `\n• ${pref}`;
  }

  if (personal.bestContactTime) {
    section += `\n• Best time to reach: ${personal.bestContactTime}`;
  }

  if (personal.bestContactMethod) {
    section += `\n• Preferred contact method: ${personal.bestContactMethod}`;
  }

  if (personal.language) {
    section += `\n• Primary language: ${personal.language}`;
  }

  section += `\n\n⚡ RESPECT THESE PREFERENCES IN ALL INTERACTIONS`;

  return section;
}

function generatePoliciesSection(context: AgentAssistContext): string {
  const { policies, totalPremium, coverageGaps } = context;

  let section = `📋 INSURANCE PORTFOLIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  for (const policy of policies) {
    section += `\n• ${policy.type.toUpperCase()} - ${policy.carrier}`;
    section += `\n  Policy #: ${policy.policyNumber}`;
    if (policy.premium) {
      section += ` | Premium: $${policy.premium.toLocaleString()}`;
    }
    if (policy.expirationDate) {
      section += `\n  Expires: ${policy.expirationDate}`;
    }
  }

  if (totalPremium) {
    section += `\n\nTotal Premium: $${totalPremium.toLocaleString()}/year`;
  }

  if (coverageGaps && coverageGaps.length > 0) {
    section += `\n\n💡 COVERAGE OPPORTUNITIES:`;
    for (const gap of coverageGaps) {
      section += `\n  • ${gap}`;
    }
  }

  return section;
}

function generatePendingItemsSection(personal: PersonalContext): string {
  let section = `⚠️ PENDING ITEMS - FOLLOW UP ON THESE!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  for (const item of personal.pendingItems) {
    section += `\n• ${item.description}`;
    if (item.context) {
      section += ` (${item.context})`;
    }
    if (item.status === 'waiting-on-customer') {
      section += ` [Waiting on customer]`;
    }
  }

  section += `\n\n→ Proactively mention these to show you remember their needs!`;

  return section;
}

function generatePersonalizationSection(personal: PersonalContext): string {
  let section = `💫 PERSONALIZATION INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  // Family Members
  if (personal.familyMembers.length > 0) {
    section += `\n\nFamily Members:`;
    for (const member of personal.familyMembers) {
      section += `\n• ${member.name} (${member.relationship})`;
      if (member.relevantInfo) {
        section += ` - ${member.relevantInfo}`;
      }
      if (member.onPolicy) {
        section += ` [On policy]`;
      }
    }
  }

  // Life Events
  if (personal.lifeEvents.length > 0) {
    section += `\n\nLife Events (Use for rapport!):`;
    for (const event of personal.lifeEvents) {
      section += `\n• ${event.event}`;
      if (event.date) {
        section += ` (${event.date})`;
      }
      if (event.insuranceImplication) {
        section += `\n  → Insurance implication: ${event.insuranceImplication}`;
      }
    }
  }

  // Interests
  if (personal.personalInterests.length > 0) {
    section += `\n\nInterests/Hobbies: ${personal.personalInterests.join(', ')}`;
  }

  // Small Talk Topics
  if (personal.smallTalkTopics.length > 0) {
    section += `\nSafe small talk topics: ${personal.smallTalkTopics.join(', ')}`;
  }

  return section;
}

function generateAuthorizedContactsSection(personal: PersonalContext): string {
  let section = `👥 AUTHORIZED CONTACTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  for (const contact of personal.authorizedContacts) {
    section += `\n• ${contact.name} (${contact.relationship})`;
    if (contact.canMakeChanges) {
      section += ` - CAN make policy changes`;
    } else {
      section += ` - Information only`;
    }
    if (contact.notes) {
      section += `\n  Note: ${contact.notes}`;
    }
  }

  return section;
}

function generateHistorySection(context: AgentAssistContext): string {
  const { history, personal } = context;

  let section = `📞 CALL HISTORY & RELATIONSHIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total calls on record: ${history.totalCalls}`;

  if (history.lastContact) {
    section += `\n\nLast contact: ${history.lastContact.date}`;
    section += `\nAgent: ${history.lastContact.agent}`;
    section += `\nSummary: ${history.lastContact.summary}`;
  }

  // Recent topics
  if (personal.recentTopics.length > 0) {
    section += `\n\nRecent topics discussed:`;
    for (const topic of personal.recentTopics) {
      section += `\n• ${topic}`;
    }
  }

  // Loyalty indicators
  if (personal.loyaltyIndicators.length > 0) {
    section += `\n\n✓ Loyalty indicators:`;
    for (const indicator of personal.loyaltyIndicators) {
      section += `\n• ${indicator}`;
    }
  }

  // Pain points (if any)
  if (personal.painPoints.length > 0) {
    section += `\n\n⚠️ Previous concerns/complaints:`;
    for (const point of personal.painPoints) {
      section += `\n• ${point}`;
    }
  }

  return section;
}

function generateRulesSection(context: AgentAssistContext): string {
  const { personal, customer } = context;
  const nameToUse = personal.preferredName || customer.name.split(' ')[0];

  let section = `🎯 CRITICAL RULES FOR THIS CALL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. USE THEIR PREFERRED NAME: "${nameToUse}"
2. NEVER make customer repeat information - you have their history!
3. REFERENCE past conversations naturally
4. Follow up on pending items proactively`;

  if (personal.communicationPrefs.length > 0) {
    section += `\n5. COMMUNICATION NEEDS: ${personal.communicationPrefs.join(', ')}`;
  }

  if (personal.authorizedContacts.length > 0) {
    section += `\n6. Verify caller is authorized if not the primary`;
  }

  section += `
7. Mention coverage opportunities naturally when relevant
8. End with warm, personalized close referencing next steps`;

  return section;
}

function generateResponseFormatSection(): string {
  return `📤 RESPONSE FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Return a JSON object with these fields:
{
  "personalizedGreeting": "A warm, personalized greeting using their preferred name and referencing their history",
  "intent": {
    "label": "detected intent code",
    "confidence": 0.0-1.0,
    "reasoning": "why this intent was detected"
  },
  "suggestions": [
    {
      "id": "unique-id",
      "type": "script|question|action|upsell|proactive",
      "priority": "high|medium|low",
      "title": "short title",
      "content": "the suggestion content",
      "context": "why this suggestion is relevant"
    }
  ],
  "compliance": [
    {
      "id": "unique-id",
      "severity": "critical|warning|info",
      "title": "compliance item",
      "message": "details",
      "regulation": "relevant regulation if any"
    }
  ],
  "proactiveItems": [
    {
      "item": "pending item or life event",
      "reason": "why to mention it",
      "script": "suggested way to bring it up"
    }
  ],
  "coverageOpportunities": [
    {
      "gap": "coverage gap identified",
      "benefit": "benefit to customer",
      "approach": "how to mention naturally"
    }
  ],
  "questionsToAsk": ["list of discovery questions"],
  "detectedNeeds": ["list of needs identified from conversation"]
}

Return ONLY valid JSON, no markdown or explanation.`;
}

// =============================================================================
// GREETING GENERATOR
// =============================================================================

/**
 * Generate a personalized greeting based on context
 */
export function generatePersonalizedGreeting(context: AgentAssistContext): string {
  const { customer, personal } = context;
  const name = personal.preferredName || customer.name.split(' ')[0];

  // Build greeting based on available context
  const greetingParts: string[] = [`Hi ${name}!`];

  // Add a personal touch based on available info
  if (personal.pendingItems.length > 0) {
    // Reference a pending item
    const item = personal.pendingItems[0];
    greetingParts.push(`Good to hear from you. I was just thinking about ${item.description.toLowerCase()} - any updates on that?`);
  } else if (personal.lifeEvents.length > 0) {
    // Reference a life event
    const event = personal.lifeEvents[0];
    greetingParts.push(`Great to hear from you! How's everything going with ${event.event.toLowerCase()}?`);
  } else if (personal.familyMembers.length > 0) {
    // Reference a family member
    const member = personal.familyMembers[0];
    if (member.relevantInfo) {
      greetingParts.push(`Good to hear from you! How's ${member.name} doing?`);
    }
  } else if (customer.yearsAsCustomer && customer.yearsAsCustomer >= 5) {
    // Long-time customer
    greetingParts.push(`Always great to hear from one of our longtime customers. How can I help you today?`);
  } else {
    // Generic but warm
    greetingParts.push(`Great to hear from you. What can I help you with today?`);
  }

  return greetingParts.join(' ');
}

// =============================================================================
// PROACTIVE ITEMS GENERATOR
// =============================================================================

export interface ProactiveItem {
  item: string;
  reason: string;
  script: string;
  type: 'pending' | 'life-event' | 'follow-up' | 'coverage-gap';
  priority: 'high' | 'medium' | 'low';
}

/**
 * Generate proactive items to mention during the call
 */
export function generateProactiveItems(context: AgentAssistContext): ProactiveItem[] {
  const items: ProactiveItem[] = [];

  // Add pending items (high priority)
  for (const pending of context.personal.pendingItems) {
    items.push({
      item: pending.description,
      reason: pending.context || 'Pending from previous conversation',
      script: `By the way, I see we were working on ${pending.description.toLowerCase()}. Any updates on that?`,
      type: 'pending',
      priority: 'high',
    });
  }

  // Add life events (medium priority)
  for (const event of context.personal.lifeEvents) {
    items.push({
      item: event.event,
      reason: event.insuranceImplication || 'Life event with potential insurance impact',
      script: `How's everything going with ${event.event.toLowerCase()}? ${event.insuranceImplication ? `That might affect your insurance - we should review.` : ''}`,
      type: 'life-event',
      priority: 'medium',
    });
  }

  // Add coverage gaps (medium priority)
  if (context.coverageGaps) {
    for (const gap of context.coverageGaps) {
      items.push({
        item: gap,
        reason: 'Coverage opportunity',
        script: `I noticed you might benefit from ${gap.toLowerCase()}. Would you like me to get you a quote?`,
        type: 'coverage-gap',
        priority: 'medium',
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  items.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return items;
}
