/**
 * Call Phases
 * ============
 * Different prompts for different phases of a customer call.
 * This ensures Claude provides contextually appropriate suggestions
 * based on where we are in the conversation.
 */

// =============================================================================
// TYPES
// =============================================================================

export type CallPhase = 'opening' | 'discovery' | 'resolution' | 'closing';

export interface PhaseConfig {
  phase: CallPhase;
  minChars: number;
  maxChars: number;
  focus: string[];
  suggestionTypes: string[];
}

// =============================================================================
// PHASE CONFIGURATIONS
// =============================================================================

const PHASES: PhaseConfig[] = [
  {
    phase: 'opening',
    minChars: 0,
    maxChars: 500,
    focus: [
      'Personalized greeting',
      'Building rapport',
      'Proactive item mentions',
      'Understanding reason for call',
    ],
    suggestionTypes: ['greeting', 'proactive', 'rapport'],
  },
  {
    phase: 'discovery',
    minChars: 500,
    maxChars: 1500,
    focus: [
      'Discovery questions',
      'Policy lookups',
      'Understanding full needs',
      'Identifying cross-sell opportunities',
    ],
    suggestionTypes: ['question', 'lookup', 'upsell'],
  },
  {
    phase: 'resolution',
    minChars: 1500,
    maxChars: 3000,
    focus: [
      'Scripts and procedures',
      'Compliance requirements',
      'Documentation',
      'Explaining options',
    ],
    suggestionTypes: ['script', 'compliance', 'action'],
  },
  {
    phase: 'closing',
    minChars: 3000,
    maxChars: Infinity,
    focus: [
      'Summarizing actions taken',
      'Next steps',
      'Warm personalized close',
      'Follow-up scheduling',
    ],
    suggestionTypes: ['summary', 'next-steps', 'close'],
  },
];

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Determine the current call phase based on transcript length
 */
export function getCallPhase(transcriptLength: number): CallPhase {
  for (const config of PHASES) {
    if (transcriptLength >= config.minChars && transcriptLength < config.maxChars) {
      return config.phase;
    }
  }
  return 'closing';
}

/**
 * Get phase-specific instructions to append to the system prompt
 */
export function getPhaseInstructions(transcriptLength: number): string {
  const phase = getCallPhase(transcriptLength);

  switch (phase) {
    case 'opening':
      return `
═══════════════════════════════════════════════════════════════
📞 CALL PHASE: OPENING (0-500 characters)
═══════════════════════════════════════════════════════════════

This call JUST STARTED. Your primary goals:

1. PERSONALIZED GREETING
   - Use their preferred name
   - Reference something from their history
   - Make them feel recognized and valued

2. PROACTIVE MENTIONS
   - Bring up any pending items naturally
   - Reference recent life events if appropriate
   - Show you remember their previous conversations

3. RAPPORT BUILDING
   - Use small talk topics if appropriate
   - Acknowledge their tenure as a customer
   - Be warm and genuine

4. DISCOVER THE REASON
   - Let them explain why they're calling
   - Don't rush to solutions yet
   - Listen actively

SUGGESTION PRIORITY:
- Personalized greeting script (HIGH)
- Proactive items to mention (HIGH)
- Rapport-building openers (MEDIUM)`;

    case 'discovery':
      return `
═══════════════════════════════════════════════════════════════
📞 CALL PHASE: DISCOVERY (500-1500 characters)
═══════════════════════════════════════════════════════════════

The call is in DISCOVERY phase. Your primary goals:

1. ASK DISCOVERY QUESTIONS
   - Understand their full needs
   - Uncover related needs they haven't mentioned
   - Identify cross-sell opportunities

2. POLICY LOOKUPS
   - Reference their specific policies
   - Check coverage details
   - Note any gaps or opportunities

3. IDENTIFY OPPORTUNITIES
   - Look for natural upsell moments
   - Consider bundling opportunities
   - Note coverage gaps to address

4. GATHER INFORMATION
   - Get all details needed for the request
   - Verify information on file
   - Document important points

SUGGESTION PRIORITY:
- Discovery questions (HIGH)
- Policy lookups and details (HIGH)
- Cross-sell opportunities (MEDIUM)`;

    case 'resolution':
      return `
═══════════════════════════════════════════════════════════════
📞 CALL PHASE: RESOLUTION (1500-3000 characters)
═══════════════════════════════════════════════════════════════

The call is in RESOLUTION phase. Your primary goals:

1. PROVIDE SCRIPTS & PROCEDURES
   - Give specific steps to complete their request
   - Include proper wording and compliance language
   - Reference Alabama regulations as needed

2. COMPLIANCE CHECKS
   - Ensure all required disclosures are made
   - Note any documentation requirements
   - Flag E&O risks

3. EXPLAIN OPTIONS
   - Present options clearly
   - Explain pros and cons
   - Make recommendations based on their needs

4. DOCUMENTATION
   - Note what needs to be documented
   - Suggest follow-up items
   - Prepare for handoff if needed

SUGGESTION PRIORITY:
- Procedural scripts (HIGH)
- Compliance warnings (HIGH)
- Action items (MEDIUM)`;

    case 'closing':
      return `
═══════════════════════════════════════════════════════════════
📞 CALL PHASE: CLOSING (3000+ characters)
═══════════════════════════════════════════════════════════════

The call is in CLOSING phase. Your primary goals:

1. SUMMARIZE ACTIONS
   - Recap what was discussed
   - Confirm what actions will be taken
   - Set clear expectations

2. NEXT STEPS
   - Explain what happens next
   - Set follow-up dates/times
   - Provide contact information for questions

3. WARM PERSONALIZED CLOSE
   - Use their preferred name
   - Reference something personal
   - Thank them for their continued business

4. DOCUMENTATION REMINDER
   - Remind agent to document the call
   - Note any follow-up tasks
   - Flag items for other team members

SUGGESTION PRIORITY:
- Summary script (HIGH)
- Next steps (HIGH)
- Warm close script (MEDIUM)`;

    default:
      return '';
  }
}

/**
 * Get the phase configuration
 */
export function getPhaseConfig(transcriptLength: number): PhaseConfig {
  const phase = getCallPhase(transcriptLength);
  return PHASES.find((p) => p.phase === phase) || PHASES[PHASES.length - 1];
}

/**
 * Check if we should show greeting suggestions
 */
export function shouldShowGreeting(transcriptLength: number): boolean {
  return transcriptLength < 200; // Very early in the call
}

/**
 * Check if we should emphasize proactive items
 */
export function shouldEmphasizeProactive(transcriptLength: number): boolean {
  return transcriptLength < 800; // Still in opening/early discovery
}

/**
 * Check if we should show closing suggestions
 */
export function shouldShowClosing(transcriptLength: number): boolean {
  return transcriptLength > 2500; // Late in the call
}
