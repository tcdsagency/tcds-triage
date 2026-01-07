// Agent Assist Playbooks
// Static playbook definitions for real-time call guidance

import { Playbook } from './types';

// =============================================================================
// BILLING & PAYMENTS PLAYBOOKS
// =============================================================================

const billingPaymentInquiry: Playbook = {
  id: 'billing-inquiry',
  domain: 'billing_payments',
  title: 'Payment & Billing Inquiry',
  description: 'Customer asking about their bill, balance, or payment status',
  triggers: ['bill', 'payment', 'pay', 'balance', 'due', 'owe', 'amount', 'how much'],
  confirm: "I can help you with your billing question. Let me pull up your account.",
  do: [
    'Verify customer identity before discussing account details',
    'Pull up the account in HawkSoft',
    'Explain each charge clearly',
    'Offer payment options if balance is due',
    'Document the call in notes'
  ],
  dont: [
    'Never share account details without verification',
    'Do not make promises about credits without supervisor approval',
    'Avoid discussing other customers\' accounts'
  ],
  escalateIf: [
    'Customer disputes charges over $500',
    'Billing discrepancy that cannot be explained',
    'Customer threatens to cancel'
  ],
  scripts: {
    opening: [
      "I can help you with that billing question. Let me pull up your account.",
      "I'd be happy to review your billing. Can I verify your information first?"
    ],
    discovery: [
      "What specific charge are you asking about?",
      "When was your last payment made?",
      "Are you looking at a specific invoice or statement?"
    ],
    resolution: [
      "Your current balance is [amount] due on [date].",
      "I see the charge you're asking about - that's for [explanation].",
      "Would you like to make a payment now, or set up a payment plan?"
    ]
  },
  complianceNotes: [
    'PCI: Never write down full card numbers',
    'Always verify identity before discussing account'
  ]
};

const billingNSF: Playbook = {
  id: 'billing-nsf',
  domain: 'billing_payments',
  title: 'NSF / Returned Payment',
  description: 'Payment was returned, declined, or bounced',
  triggers: ['nsf', 'bounced', 'returned', 'declined', 'failed payment', 'rejected', 'insufficient'],
  confirm: "I see there was an issue with a recent payment. Let me look into this for you.",
  do: [
    'Verify customer identity first',
    'Check payment history for failed transaction',
    'Explain any NSF fees charged',
    'Offer alternative payment methods',
    'Set up autopay to prevent future issues'
  ],
  dont: [
    'Never blame customer for failed payment',
    'Do not promise to waive fees without supervisor approval',
    'Do not take new payment info until confirming failed one'
  ],
  escalateIf: [
    'Multiple NSF occurrences (3+ in 12 months)',
    'Customer is combative about fees',
    'Policy is at risk of cancellation'
  ],
  scripts: {
    opening: [
      "I can help you with that payment issue. Let me pull up your account.",
      "I see there was a payment that didn't go through. Let me take a look."
    ],
    discovery: [
      "Can you tell me the date the payment was attempted?",
      "What payment method was used?",
      "Were there any changes to your bank account recently?"
    ],
    resolution: [
      "I've updated your payment method and can process the payment now.",
      "Would you like to set up autopay to avoid this in the future?",
      "Let me check if we can waive that NSF fee for you."
    ]
  },
  complianceNotes: [
    'PCI: Never write down full card numbers',
    'Document all fee waivers with supervisor approval'
  ]
};

const paymentPlanSetup: Playbook = {
  id: 'billing-payment-plan',
  domain: 'billing_payments',
  title: 'Payment Plan Setup',
  description: 'Customer wants to split payments or set up installments',
  triggers: ['payment plan', 'installments', 'split', 'pay over time', 'monthly payments', 'can\'t pay all'],
  confirm: "I can help you set up a payment arrangement. Let me see what options are available.",
  do: [
    'Verify customer identity',
    'Review current balance and due dates',
    'Explain available payment plan options',
    'Document the agreed payment schedule',
    'Set reminders for follow-up'
  ],
  dont: [
    'Do not create plans exceeding carrier guidelines',
    'Never promise to hold cancellation without authority',
    'Avoid extending past policy expiration'
  ],
  escalateIf: [
    'Balance exceeds $1000',
    'Customer has defaulted on previous plans',
    'Request extends beyond carrier limits'
  ],
  scripts: {
    opening: [
      "I understand. Let me see what payment options we can offer.",
      "We do have some flexibility on payment arrangements. Let me review your account."
    ],
    discovery: [
      "What amount can you pay today?",
      "What timeframe works best for you?",
      "Do you prefer payments on specific dates?"
    ],
    resolution: [
      "I've set up your payment plan: [amount] on [dates].",
      "You'll receive email confirmations for each scheduled payment.",
      "Would you like to set up automatic payments for this plan?"
    ]
  }
};

const autopaySetup: Playbook = {
  id: 'billing-autopay',
  domain: 'billing_payments',
  title: 'Autopay Setup',
  description: 'Customer wants to set up automatic recurring payments',
  triggers: ['autopay', 'automatic', 'recurring', 'auto draft', 'automatic payment', 'set up autopay'],
  confirm: "Great choice! Autopay helps ensure you never miss a payment. Let me set that up.",
  do: [
    'Verify customer identity',
    'Explain how autopay works',
    'Collect payment method details securely',
    'Confirm the draft date',
    'Send confirmation email'
  ],
  dont: [
    'Never read back full card numbers',
    'Do not set up without verbal authorization',
    'Avoid promising specific draft times'
  ],
  escalateIf: [
    'Customer wants autopay for multiple policies with different carriers',
    'Technical issues preventing setup'
  ],
  scripts: {
    opening: [
      "I'd be happy to set up autopay for you. It's a great way to ensure on-time payments.",
      "Autopay is convenient and you'll get a discount on some policies. Let me help you set that up."
    ],
    discovery: [
      "Would you like to use a bank account or credit card?",
      "What day of the month works best for the draft?",
      "Should I set this up for all your policies?"
    ],
    resolution: [
      "Your autopay is all set up. You'll be drafted on the [date] of each month.",
      "I'm sending you a confirmation email now.",
      "Remember, you'll still get a statement before each draft so you can review it."
    ]
  },
  complianceNotes: [
    'PCI: Process payments through secure system only',
    'Document verbal authorization in notes'
  ]
};

// =============================================================================
// NEW BUSINESS PLAYBOOKS
// =============================================================================

const newQuoteRequest: Playbook = {
  id: 'new-quote',
  domain: 'new_business',
  title: 'New Quote Request',
  description: 'Customer calling to get a new insurance quote',
  triggers: ['quote', 'rate', 'price', 'coverage', 'new policy', 'how much', 'looking for insurance', 'need insurance'],
  confirm: "I'd be happy to help you with a quote! Let me gather some information.",
  do: [
    'Ask about current coverage and expiration',
    'Gather all required rating information',
    'Quote multiple carriers for comparison',
    'Explain coverage options clearly',
    'Set follow-up if not binding today'
  ],
  dont: [
    'Never guarantee a specific price before quoting',
    'Do not rush through coverage explanations',
    'Avoid badmouthing their current carrier'
  ],
  escalateIf: [
    'Complex commercial risk',
    'Customer has multiple claims or violations',
    'High-value home or vehicles'
  ],
  scripts: {
    opening: [
      "Great! I'd love to help you find the best coverage. Let me ask you a few questions.",
      "Absolutely, let's see what we can do for you. What type of insurance are you looking for?"
    ],
    discovery: [
      "Do you currently have insurance? When does it expire?",
      "How long have you been with your current company?",
      "What's prompting you to shop around today?"
    ],
    resolution: [
      "Based on what you've told me, I can offer you [coverage] for [price].",
      "I'd like to email you a detailed comparison of your options.",
      "Would you like to move forward today, or would you prefer some time to review?"
    ]
  }
};

const quoteFollowUp: Playbook = {
  id: 'quote-followup',
  domain: 'new_business',
  title: 'Quote Follow-Up',
  description: 'Customer calling back about a previous quote',
  triggers: ['follow up', 'checking on', 'quote I requested', 'called earlier', 'got a quote', 'following up'],
  confirm: "Let me pull up your quote information.",
  do: [
    'Find the existing quote in the system',
    'Review what was quoted',
    'Check if rates have changed',
    'Address any questions',
    'Move toward binding if interested'
  ],
  dont: [
    'Do not dismiss their previous interaction',
    'Never pressure them to decide immediately',
    'Avoid creating duplicate quotes'
  ],
  escalateIf: [
    'Quote has expired and rates increased significantly',
    'Customer is upset about wait time'
  ],
  scripts: {
    opening: [
      "Welcome back! Let me pull up your information.",
      "I'm glad you called back. Let me find your quote."
    ],
    discovery: [
      "Did you have any questions about the coverage options?",
      "Has anything changed since we last spoke?",
      "Are you ready to move forward, or do you need more information?"
    ],
    resolution: [
      "Everything still looks good. We can get you started today.",
      "I can hold this rate for you until [date] if you need more time.",
      "Let me email you an updated summary to review."
    ]
  }
};

const bindingCoverage: Playbook = {
  id: 'binding-coverage',
  domain: 'new_business',
  title: 'Binding Coverage',
  description: 'Customer ready to purchase and start coverage',
  triggers: ['ready to buy', 'want to start', 'bind', 'purchase', 'start the policy', 'sign me up', 'let\'s do it'],
  confirm: "Excellent! I'm excited to get you covered. Let me finalize everything.",
  do: [
    'Verify all information is accurate',
    'Confirm coverage selections',
    'Collect payment for first installment',
    'Set effective date',
    'Send welcome documents'
  ],
  dont: [
    'Never backdate coverage without proper documentation',
    'Do not bind without payment',
    'Avoid rushing through disclosures'
  ],
  escalateIf: [
    'Customer wants same-day effective date after hours',
    'Payment method issues',
    'Underwriting concerns arise'
  ],
  scripts: {
    opening: [
      "Wonderful! Let's get everything finalized for you.",
      "Great decision! I'll walk you through the final steps."
    ],
    discovery: [
      "Let me confirm the coverage: [coverage details]. Is that correct?",
      "What effective date would you like?",
      "How would you like to make your payment today?"
    ],
    resolution: [
      "Congratulations! Your policy is now active.",
      "I'm emailing your ID cards and policy documents now.",
      "You'll receive your full policy packet in 7-10 business days."
    ]
  },
  complianceNotes: [
    'Read all required disclosures',
    'Document verbal consent for electronic delivery'
  ]
};

// =============================================================================
// RENEWALS PLAYBOOKS
// =============================================================================

const renewalDiscussion: Playbook = {
  id: 'renewal-discussion',
  domain: 'renewals',
  title: 'Renewal Discussion',
  description: 'Customer calling about upcoming or recent renewal',
  triggers: ['renewal', 'renew', 'expiring', 'renewal notice', 'coming up for renewal'],
  confirm: "I can help you with your renewal. Let me review your policy.",
  do: [
    'Pull up renewal offer and compare to current',
    'Review for any coverage gaps',
    'Look for available discounts',
    'Discuss any changes needed',
    'Confirm renewal or shop if requested'
  ],
  dont: [
    'Never let a policy lapse without discussing options',
    'Do not ignore rate increases - address proactively',
    'Avoid promising to match competitor rates'
  ],
  escalateIf: [
    'Rate increase over 25%',
    'Customer threatening to leave',
    'Major coverage changes needed'
  ],
  scripts: {
    opening: [
      "Let me pull up your renewal information and review it with you.",
      "I'm glad you called about your renewal. Let's make sure everything looks good."
    ],
    discovery: [
      "Have there been any changes we should know about?",
      "Are you happy with your current coverage?",
      "Did you see anything on the renewal notice you had questions about?"
    ],
    resolution: [
      "Your renewal is all set. No action needed on your part.",
      "I've updated your policy with those changes for the renewal.",
      "Would you like me to shop this to see if we can find a better rate?"
    ]
  }
};

const rateIncreaseExplanation: Playbook = {
  id: 'rate-increase',
  domain: 'renewals',
  title: 'Rate Increase Explanation',
  description: 'Customer upset about rate increase at renewal',
  triggers: ['increase', 'went up', 'more expensive', 'rate went up', 'higher', 'why did my rate'],
  confirm: "I understand your concern about the rate increase. Let me explain what happened.",
  do: [
    'Acknowledge their frustration',
    'Review specific reasons for increase',
    'Look for any available discounts',
    'Offer to shop other carriers',
    'Document the conversation'
  ],
  dont: [
    'Never dismiss their concerns',
    'Do not blame the customer for the increase',
    'Avoid making negative comments about the carrier'
  ],
  escalateIf: [
    'Rate increase over 30% with no claims',
    'Customer is very upset or threatening',
    'You cannot identify the reason for increase'
  ],
  scripts: {
    opening: [
      "I completely understand your frustration. Let me look into this for you.",
      "Nobody likes rate increases. Let me see exactly what changed."
    ],
    discovery: [
      "Let me review your policy... I see the increase was due to [reason].",
      "Have you had any claims or tickets in the past year?",
      "Are there any changes to your household we should update?"
    ],
    resolution: [
      "I found a discount that can help offset some of that increase.",
      "Would you like me to shop this with other carriers to compare?",
      "I can set up a review to make sure you're getting all available discounts."
    ]
  }
};

const lapseWarning: Playbook = {
  id: 'lapse-warning',
  domain: 'renewals',
  title: 'Lapse Warning',
  description: 'Policy has lapsed or is about to lapse',
  triggers: ['lapsed', 'expired', 'gap in coverage', 'cancelled', 'no longer active', 'not covered'],
  confirm: "This is important - let me check on your coverage status right away.",
  do: [
    'Determine exact lapse date',
    'Explain consequences of lapse',
    'Work urgently to reinstate if possible',
    'If cannot reinstate, requote immediately',
    'Document everything'
  ],
  dont: [
    'Never minimize the seriousness of a lapse',
    'Do not let them drive without coverage',
    'Avoid blaming payment issues on customer without verification'
  ],
  escalateIf: [
    'Customer was in accident during lapse',
    'Lapse over 30 days',
    'DMV/state involvement'
  ],
  scripts: {
    opening: [
      "I can see there's been a coverage interruption. Let's address this immediately.",
      "This is important - let me see what options we have to get you covered."
    ],
    discovery: [
      "When did you realize the policy had lapsed?",
      "Have you been driving without coverage?",
      "Were there any accidents or incidents during this time?"
    ],
    resolution: [
      "Good news - I can reinstate your policy effective today.",
      "I'll need to write a new policy due to the lapse. Let me get you quoted.",
      "Please don't drive until we have coverage in place."
    ]
  },
  complianceNotes: [
    'Document any gap in coverage clearly',
    'Advise customer not to drive uninsured'
  ]
};

// =============================================================================
// CLAIMS PLAYBOOKS
// =============================================================================

const newClaimReport: Playbook = {
  id: 'claims-new',
  domain: 'claims',
  title: 'New Claim Report',
  description: 'Customer reporting a new claim or accident',
  triggers: ['accident', 'damage', 'claim', 'file', 'report', 'hit', 'crash', 'broken into', 'stolen'],
  confirm: "I'm sorry to hear about this. Let me help you report this claim.",
  do: [
    'Express empathy first',
    'Verify they are safe',
    'Gather basic claim details',
    'Provide carrier claim number',
    'Explain next steps'
  ],
  dont: [
    'Never admit fault on behalf of the insured',
    'Do not promise specific coverage outcomes',
    'Avoid giving legal advice'
  ],
  escalateIf: [
    'Serious injuries involved',
    'Potential fraud indicators',
    'Major property damage (over $50k)',
    'Legal involvement'
  ],
  scripts: {
    opening: [
      "I'm so sorry to hear that. First, is everyone okay?",
      "Let's get this reported right away. Are you safe?"
    ],
    discovery: [
      "Can you tell me what happened?",
      "When and where did this occur?",
      "Were there any other vehicles or people involved?",
      "Did you get a police report?"
    ],
    resolution: [
      "I've reported your claim. Your claim number is [number].",
      "An adjuster will contact you within 24-48 hours.",
      "Here's what to expect next: [explanation]"
    ]
  },
  complianceNotes: [
    'Never admit fault or liability',
    'Direct complex questions to claims adjuster'
  ]
};

const claimStatusInquiry: Playbook = {
  id: 'claims-status',
  domain: 'claims',
  title: 'Claim Status Inquiry',
  description: 'Customer checking on existing claim status',
  triggers: ['claim status', 'adjuster', 'settlement', 'check on claim', 'my claim', 'when will', 'heard anything'],
  confirm: "Let me check on the status of your claim.",
  do: [
    'Pull up claim in carrier system',
    'Provide current status',
    'Explain any pending items',
    'Give realistic timeline if possible',
    'Offer to escalate if delayed'
  ],
  dont: [
    'Never promise specific settlement amounts',
    'Do not speak negatively about the adjuster',
    'Avoid making commitments on carrier\'s behalf'
  ],
  escalateIf: [
    'Claim open over 30 days with no contact',
    'Customer very frustrated with process',
    'Adjuster unresponsive'
  ],
  scripts: {
    opening: [
      "I understand you want an update. Let me look that up for you.",
      "Of course, let me check on your claim status."
    ],
    discovery: [
      "Do you have your claim number handy?",
      "Have you been in contact with your adjuster?",
      "What's the last update you received?"
    ],
    resolution: [
      "Your claim is currently in [status]. The adjuster is [name] at [phone].",
      "I see they're waiting on [item]. Once received, things should move quickly.",
      "Let me reach out to the claims department and have someone call you back."
    ]
  }
};

const claimDispute: Playbook = {
  id: 'claims-dispute',
  domain: 'claims',
  title: 'Claim Dispute',
  description: 'Customer disagreeing with claim decision',
  triggers: ['denied', 'dispute', 'appeal', 'disagree', 'not fair', 'won\'t pay', 'fighting the claim'],
  confirm: "I understand this is frustrating. Let me see what options you have.",
  do: [
    'Listen fully to their concerns',
    'Review the denial reason',
    'Explain appeal process',
    'Document everything',
    'Escalate to claims manager if needed'
  ],
  dont: [
    'Never promise to overturn a decision',
    'Do not argue with the customer',
    'Avoid criticizing the claims decision'
  ],
  escalateIf: [
    'Always - claims disputes should involve supervisor',
    'Customer mentions attorney',
    'Media or social media threats'
  ],
  scripts: {
    opening: [
      "I'm sorry you're dealing with this. Let me understand what happened.",
      "I want to help. Tell me more about the situation."
    ],
    discovery: [
      "What reason was given for the denial?",
      "Do you have any additional documentation to support your claim?",
      "Have you spoken with the adjuster about this?"
    ],
    resolution: [
      "You do have the right to appeal. Here's how that process works.",
      "Let me escalate this to our claims manager to review.",
      "I'll document your concerns and have someone from claims follow up with you."
    ]
  },
  complianceNotes: [
    'Document all dispute details thoroughly',
    'Do not make promises about outcomes'
  ]
};

// =============================================================================
// POLICY CHANGES PLAYBOOKS
// =============================================================================

const addVehicle: Playbook = {
  id: 'changes-add-vehicle',
  domain: 'policy_changes',
  title: 'Add Vehicle',
  description: 'Customer needs to add a new vehicle to policy',
  triggers: ['add vehicle', 'new car', 'bought a car', 'add a car', 'just purchased', 'got a new'],
  confirm: "Congratulations on the new vehicle! Let me add it to your policy.",
  do: [
    'Get VIN for accurate rating',
    'Verify ownership (purchased vs leased)',
    'Check for any lender requirements',
    'Review coverage with customer',
    'Issue updated ID cards'
  ],
  dont: [
    'Never add without VIN verification',
    'Do not assume same coverage as other vehicles',
    'Avoid backdating more than carrier allows'
  ],
  escalateIf: [
    'Exotic or high-value vehicle',
    'Commercial use vehicle on personal policy',
    'Customer wants to backdate significantly'
  ],
  scripts: {
    opening: [
      "That's exciting! Let's get your new vehicle covered.",
      "I can add that right away. Do you have the VIN number?"
    ],
    discovery: [
      "Is this purchased or leased?",
      "Who is the lienholder?",
      "When did you take possession of the vehicle?",
      "Will anyone new be driving this vehicle?"
    ],
    resolution: [
      "Your vehicle is added. Your new premium is [amount].",
      "I'm sending updated ID cards to your email now.",
      "Remember to put your ID card in the glove box!"
    ]
  }
};

const removeVehicle: Playbook = {
  id: 'changes-remove-vehicle',
  domain: 'policy_changes',
  title: 'Remove Vehicle',
  description: 'Customer needs to remove a vehicle from policy',
  triggers: ['remove vehicle', 'sold', 'traded', 'getting rid of', 'take off', 'no longer have'],
  confirm: "I can help you remove that vehicle. Let me verify the details.",
  do: [
    'Confirm which vehicle to remove',
    'Get date of sale/trade',
    'Verify remaining vehicles have coverage',
    'Process removal and credit',
    'Document reason for removal'
  ],
  dont: [
    'Never remove the only vehicle without discussing options',
    'Do not backdate removal before sale date',
    'Avoid removing without confirming new owner\'s coverage'
  ],
  escalateIf: [
    'Customer wants credit for period after sale',
    'Only vehicle on policy being removed',
    'Vehicle was in accident recently'
  ],
  scripts: {
    opening: [
      "I can take care of that for you. Which vehicle are we removing?",
      "No problem. Let me pull up your policy."
    ],
    discovery: [
      "When did you sell/trade the vehicle?",
      "Did the new owner get their own insurance?",
      "Do you have any other vehicles to add?"
    ],
    resolution: [
      "The vehicle has been removed effective [date].",
      "You'll receive a credit of approximately [amount].",
      "Your updated policy documents will be emailed shortly."
    ]
  }
};

const addRemoveDriver: Playbook = {
  id: 'changes-driver',
  domain: 'policy_changes',
  title: 'Add/Remove Driver',
  description: 'Customer needs to add or remove a driver',
  triggers: ['add driver', 'remove driver', 'new driver', 'my kid', 'spouse', 'ex', 'teenager'],
  confirm: "I can help you update the drivers on your policy.",
  do: [
    'Verify all household members are listed',
    'Get license information for new drivers',
    'Check for any violations or accidents',
    'Explain rate impact',
    'Update policy and document'
  ],
  dont: [
    'Never exclude a regular household driver',
    'Do not ignore unlisted drivers in household',
    'Avoid removing drivers without documentation'
  ],
  escalateIf: [
    'Driver has DUI/DWI',
    'Youthful driver with violations',
    'Customer wants to hide household member'
  ],
  scripts: {
    opening: [
      "I can update the drivers on your policy. Who are we adding/removing?",
      "Let me help you with that driver change."
    ],
    discovery: [
      "What is their date of birth and license number?",
      "How long have they been licensed?",
      "Have they had any accidents or tickets in the past 5 years?"
    ],
    resolution: [
      "The driver has been added. Your new rate is [amount].",
      "I've removed that driver. You'll see a credit on your next bill.",
      "I'm sending updated ID cards now."
    ]
  }
};

const addressChange: Playbook = {
  id: 'changes-address',
  domain: 'policy_changes',
  title: 'Address Change',
  description: 'Customer has moved or is moving',
  triggers: ['address', 'moved', 'moving', 'relocating', 'new address', 'change my address'],
  confirm: "I can update your address. This may affect your rate.",
  do: [
    'Get complete new address',
    'Verify garaging location for vehicles',
    'Check if new state requires different policy',
    'Explain any rate change',
    'Update all policies if applicable'
  ],
  dont: [
    'Never use incorrect garaging address',
    'Do not ignore out-of-state moves',
    'Avoid partial address updates'
  ],
  escalateIf: [
    'Moving to another state',
    'Address change significantly increases rate',
    'PO Box without physical address'
  ],
  scripts: {
    opening: [
      "I can update that for you. What's your new address?",
      "Moving is exciting! Let me get your new address updated."
    ],
    discovery: [
      "Is this where the vehicles will be parked?",
      "When did you move or when will you move?",
      "Will any vehicles be kept at a different location?"
    ],
    resolution: [
      "Your address is updated. Your new rate is [amount].",
      "All your policies have been updated with the new address.",
      "New documents will be mailed to your new address."
    ]
  }
};

const coverageChange: Playbook = {
  id: 'changes-coverage',
  domain: 'policy_changes',
  title: 'Coverage Change',
  description: 'Customer wants to adjust coverage levels',
  triggers: ['increase coverage', 'decrease', 'change limits', 'add coverage', 'remove coverage', 'lower my', 'raise my'],
  confirm: "I can review your coverage options with you.",
  do: [
    'Review current coverage',
    'Understand reason for change',
    'Explain impact of changes',
    'Document customer request',
    'Provide updated pricing'
  ],
  dont: [
    'Never remove coverage without explaining consequences',
    'Do not pressure specific coverage amounts',
    'Avoid changes without clear documentation'
  ],
  escalateIf: [
    'Customer wants state minimum only',
    'Removing comprehensive on financed vehicle',
    'Major reduction that leaves gaps'
  ],
  scripts: {
    opening: [
      "I can help you review your coverage options.",
      "Let's look at your current coverage and what changes you're considering."
    ],
    discovery: [
      "What changes are you looking to make?",
      "Is there a specific concern driving this change?",
      "Are you aware of the coverage you'd be giving up?"
    ],
    resolution: [
      "With those changes, your new premium would be [amount].",
      "I want to make sure you understand what this change means: [explanation].",
      "I've made the changes effective [date]. I'm sending updated documents now."
    ]
  },
  complianceNotes: [
    'Document all coverage reduction requests',
    'Explain liability gap risks for low limits'
  ]
};

// =============================================================================
// ESCALATION PLAYBOOKS
// =============================================================================

const upsetCustomer: Playbook = {
  id: 'escalation-upset',
  domain: 'escalations',
  title: 'Upset Customer',
  description: 'Customer is angry, frustrated, or demanding supervisor',
  triggers: ['supervisor', 'manager', 'complaint', 'frustrated', 'angry', 'unacceptable', 'ridiculous', 'terrible'],
  confirm: "I understand you're frustrated. I want to help resolve this.",
  do: [
    'Stay calm and professional',
    'Acknowledge their feelings',
    'Listen without interrupting',
    'Focus on solutions',
    'Involve supervisor if needed'
  ],
  dont: [
    'Never argue or get defensive',
    'Do not take it personally',
    'Avoid saying "calm down"'
  ],
  escalateIf: [
    'Customer uses profanity repeatedly',
    'Threats of any kind',
    'Customer specifically demands supervisor',
    'You cannot resolve the issue'
  ],
  scripts: {
    opening: [
      "I can hear how frustrated you are, and I want to help make this right.",
      "I understand this has been a difficult experience. Let me see what I can do."
    ],
    discovery: [
      "Help me understand what happened.",
      "What would be an acceptable resolution for you?",
      "How can I make this better for you today?"
    ],
    resolution: [
      "Here's what I can do for you...",
      "I'm going to get my supervisor involved to make sure we resolve this.",
      "I've documented everything and someone will follow up with you by [time]."
    ]
  },
  complianceNotes: [
    'Document all complaints thoroughly',
    'Never hang up on a customer'
  ]
};

const callbackRequest: Playbook = {
  id: 'escalation-callback',
  domain: 'escalations',
  title: 'Callback Request',
  description: 'Customer waiting for a callback or follow-up',
  triggers: ['call me back', 'waiting for', 'no one called', 'been waiting', 'supposed to call', 'never heard back'],
  confirm: "I apologize for the wait. Let me find out what happened and get this resolved.",
  do: [
    'Apologize for the delay',
    'Research previous interactions',
    'Determine who was supposed to follow up',
    'Resolve the issue if possible',
    'Set clear expectations'
  ],
  dont: [
    'Never blame the customer for not receiving callback',
    'Do not make excuses for delays',
    'Avoid vague promises about follow-up'
  ],
  escalateIf: [
    'Multiple missed callbacks',
    'Urgent matter that should have been handled',
    'Customer very upset about wait'
  ],
  scripts: {
    opening: [
      "I'm sorry you've been waiting. Let me look into this right away.",
      "That's not the service we want to provide. Let me make this right."
    ],
    discovery: [
      "When were you expecting the callback?",
      "What were they supposed to be calling you about?",
      "Do you remember who you spoke with?"
    ],
    resolution: [
      "I can handle this for you right now.",
      "I'm scheduling a callback for [specific time]. I'll personally follow up.",
      "I've flagged this as urgent. You'll hear from us within [timeframe]."
    ]
  }
};

// =============================================================================
// PLAYBOOKS EXPORT
// =============================================================================

export const PLAYBOOKS: Playbook[] = [
  // Billing & Payments
  billingPaymentInquiry,
  billingNSF,
  paymentPlanSetup,
  autopaySetup,
  
  // New Business
  newQuoteRequest,
  quoteFollowUp,
  bindingCoverage,
  
  // Renewals
  renewalDiscussion,
  rateIncreaseExplanation,
  lapseWarning,
  
  // Claims
  newClaimReport,
  claimStatusInquiry,
  claimDispute,
  
  // Policy Changes
  addVehicle,
  removeVehicle,
  addRemoveDriver,
  addressChange,
  coverageChange,
  
  // Escalations
  upsetCustomer,
  callbackRequest,
];

// Index by ID for quick lookup
export const PLAYBOOKS_BY_ID: Record<string, Playbook> = Object.fromEntries(
  PLAYBOOKS.map(p => [p.id, p])
);

// Index by domain for filtering
export const PLAYBOOKS_BY_DOMAIN: Record<string, Playbook[]> = PLAYBOOKS.reduce((acc, p) => {
  if (!acc[p.domain]) acc[p.domain] = [];
  acc[p.domain].push(p);
  return acc;
}, {} as Record<string, Playbook[]>);

// Get all trigger keywords for matching
export function getAllTriggers(): Map<string, string[]> {
  const triggerMap = new Map<string, string[]>();
  for (const playbook of PLAYBOOKS) {
    for (const trigger of playbook.triggers) {
      const existing = triggerMap.get(trigger) || [];
      existing.push(playbook.id);
      triggerMap.set(trigger, existing);
    }
  }
  return triggerMap;
}
