// Agent Assist Playbooks Configuration
// 20+ playbooks across 6 domains for real-time call guidance

import { Playbook, PlaybookDomain } from './types';

// =============================================================================
// BILLING & PAYMENTS PLAYBOOKS
// =============================================================================

const billingPaymentInquiry: Playbook = {
  id: 'billing-inquiry',
  domain: 'billing_payments',
  name: 'Payment & Billing Inquiry',
  description: 'Customer asking about their bill, payment status, or balance due',
  triggerKeywords: ['bill', 'payment', 'pay', 'balance', 'due', 'owe', 'amount', 'statement', 'invoice'],
  doList: [
    'Verify customer identity before discussing account details',
    'Pull up the billing summary and payment history',
    'Explain each charge clearly if asked',
    'Offer multiple payment options',
    'Confirm payment due date'
  ],
  dontList: [
    'Never share account details without verification',
    'Do not make payment promises you cannot guarantee',
    'Avoid discussing other customers\' accounts'
  ],
  escalateIf: [
    'Customer disputes charges after explanation',
    'System shows account in collections',
    'Customer requests payment arrangement over 6 months'
  ],
  scripts: {
    opening: [
      "I can help you with your billing question. Let me pull up your account.",
      "I'll be happy to review your account with you. Can I verify some information first?"
    ],
    discovery: [
      "Can you tell me which bill or statement you're referring to?",
      "What specifically would you like to know about your balance?",
      "Are you looking at a particular charge you have questions about?"
    ],
    resolution: [
      "Your current balance is [amount], due on [date].",
      "I've explained the charges. Would you like to make a payment now?",
      "I can set up a payment reminder for you if that would help."
    ]
  },
  complianceNotes: [
    'Always verify identity before disclosing balance information',
    'Document any billing disputes in customer notes'
  ]
};

const billingNSF: Playbook = {
  id: 'billing-nsf',
  domain: 'billing_payments',
  name: 'NSF / Returned Payment',
  description: 'Customer calling about a bounced or declined payment',
  triggerKeywords: ['nsf', 'bounced', 'returned', 'declined', 'failed payment', 'rejected', 'insufficient'],
  doList: [
    'Verify customer identity first',
    'Check payment history for failed transaction',
    'Explain any NSF fees charged',
    'Offer alternative payment methods',
    'Set up autopay to prevent future issues'
  ],
  dontList: [
    'Never blame customer for failed payment',
    'Do not promise to waive fees without supervisor approval',
    'Do not take new payment info until confirming failed one'
  ],
  escalateIf: [
    'Multiple NSF incidents in 6 months',
    'Customer requests fee waiver over $50',
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
      "I've updated your payment method and processed the payment.",
      "Would you like to set up autopay to avoid this in the future?",
      "I've waived the NSF fee as a one-time courtesy. [Requires approval]"
    ]
  },
  complianceNotes: [
    'Document all fee waivers with supervisor approval',
    'PCI: Never write down full card numbers'
  ]
};

const billingPaymentPlan: Playbook = {
  id: 'billing-payment-plan',
  domain: 'billing_payments',
  name: 'Payment Plan Setup',
  description: 'Customer requesting to set up a payment plan or installments',
  triggerKeywords: ['payment plan', 'installments', 'split', 'monthly payments', 'can\'t afford', 'struggling'],
  doList: [
    'Show empathy for financial situation',
    'Review available payment plan options',
    'Explain any fees associated with plans',
    'Document the agreed plan clearly',
    'Set up automatic payments when possible'
  ],
  dontList: [
    'Never judge customer financial situation',
    'Do not create plans longer than policy allows',
    'Avoid promising specific approval without checking'
  ],
  escalateIf: [
    'Requested plan exceeds 6 months',
    'Customer has defaulted on previous plan',
    'Total amount exceeds $5,000'
  ],
  scripts: {
    opening: [
      "I understand, let's look at some options to help manage your payments.",
      "We do have payment plans available. Let me see what works for your account."
    ],
    discovery: [
      "What amount were you thinking per month?",
      "When would you like the first payment drafted?",
      "Do you prefer payments on a specific day of the month?"
    ],
    resolution: [
      "I've set up your payment plan: [X] payments of [amount] starting [date].",
      "You'll receive a confirmation email with the payment schedule.",
      "Would you like me to set up autopay for these installments?"
    ]
  }
};

const billingAutopay: Playbook = {
  id: 'billing-autopay',
  domain: 'billing_payments',
  name: 'Autopay Setup',
  description: 'Customer wants to set up or modify automatic payments',
  triggerKeywords: ['autopay', 'automatic', 'recurring', 'auto draft', 'direct debit', 'eft'],
  doList: [
    'Explain autopay benefits and timing',
    'Verify payment method details',
    'Confirm draft date preferences',
    'Provide confirmation number',
    'Explain how to cancel if needed'
  ],
  dontList: [
    'Never process without explicit authorization',
    'Do not set up autopay on disputed accounts',
    'Avoid promising specific draft dates if system determines them'
  ],
  escalateIf: [
    'Customer has history of NSF payments',
    'Account has pending disputes'
  ],
  scripts: {
    opening: [
      "Great choice! Autopay ensures you never miss a payment.",
      "I can get that set up for you right now."
    ],
    discovery: [
      "Would you like to use a bank account or credit card?",
      "What date works best for the monthly draft?",
      "Would you like the full amount or minimum due drafted?"
    ],
    resolution: [
      "Your autopay is now active. The first draft will be on [date].",
      "You'll receive a confirmation email with all the details.",
      "You can cancel anytime by calling us at least 5 days before the draft date."
    ]
  },
  complianceNotes: [
    'Obtain verbal authorization and document it',
    'PCI: Mask card numbers in notes'
  ]
};

const billingRefund: Playbook = {
  id: 'billing-refund',
  domain: 'billing_payments',
  name: 'Refund Request',
  description: 'Customer requesting a refund for overpayment or cancellation',
  triggerKeywords: ['refund', 'money back', 'overpaid', 'credit', 'reimbursement'],
  doList: [
    'Verify the refund amount and reason',
    'Check for any outstanding balances first',
    'Explain the refund timeline (7-10 business days)',
    'Confirm the refund method matches payment method',
    'Provide reference number'
  ],
  dontList: [
    'Never promise immediate refunds',
    'Do not process refunds to different accounts without approval',
    'Avoid processing refunds while disputes are pending'
  ],
  escalateIf: [
    'Refund amount exceeds $500',
    'Customer demands immediate refund',
    'Refund to different payment method requested'
  ],
  scripts: {
    opening: [
      "I can look into that refund for you. Let me check your account.",
      "Let me review your payment history to verify the refund amount."
    ],
    discovery: [
      "What payment are you expecting a refund for?",
      "When was the original payment made?",
      "Would you prefer the refund to the original payment method?"
    ],
    resolution: [
      "I've submitted your refund of [amount]. It will arrive in 7-10 business days.",
      "Your reference number is [number]. You'll receive an email confirmation.",
      "The refund will go back to your [card/account] ending in [last 4]."
    ]
  }
};

// =============================================================================
// NEW BUSINESS PLAYBOOKS
// =============================================================================

const newBusinessQuote: Playbook = {
  id: 'new-business-quote',
  domain: 'new_business',
  name: 'New Quote Request',
  description: 'Prospect calling for a new insurance quote',
  triggerKeywords: ['quote', 'rate', 'price', 'coverage', 'new policy', 'how much', 'estimate', 'shopping'],
  doList: [
    'Thank them for considering your agency',
    'Gather all required information methodically',
    'Explain coverage options, not just prices',
    'Identify cross-sell opportunities',
    'Set clear expectations for follow-up'
  ],
  dontList: [
    'Never provide a quote without full information',
    'Do not bash competitors',
    'Avoid making coverage recommendations without understanding needs'
  ],
  escalateIf: [
    'Commercial risk with over $1M in revenue',
    'Complex multi-policy household',
    'Prior carrier non-renewed for claims'
  ],
  scripts: {
    opening: [
      "Thank you for calling! I'd be happy to get you a quote. What type of coverage are you looking for?",
      "Great, let's find you the best coverage at a competitive price."
    ],
    discovery: [
      "Is this for auto, home, or both?",
      "How many vehicles/drivers do we need to include?",
      "What's your current coverage situation?",
      "When would you like the new coverage to start?"
    ],
    resolution: [
      "Based on what you've told me, here are your options...",
      "I can have your quotes ready by [time/date]. What's the best way to reach you?",
      "Would you like me to email you a comparison of the options we discussed?"
    ]
  },
  complianceNotes: [
    'Document all coverage discussions',
    'Provide state-required disclosures'
  ]
};

const newBusinessFollowUp: Playbook = {
  id: 'new-business-follow-up',
  domain: 'new_business',
  name: 'Quote Follow-Up',
  description: 'Prospect following up on a quote they previously requested',
  triggerKeywords: ['follow up', 'checking on', 'quote I requested', 'did you get', 'called before', 'waiting'],
  doList: [
    'Apologize if there was any delay',
    'Pull up the existing quote quickly',
    'Review any changes in their situation',
    'Address any objections proactively',
    'Attempt to close or set next steps'
  ],
  dontList: [
    'Never make excuses for delays',
    'Do not requote without checking for changes',
    'Avoid leaving them waiting again'
  ],
  escalateIf: [
    'Quote is more than 30 days old',
    'Customer complained about service',
    'Quote requires manager approval'
  ],
  scripts: {
    opening: [
      "Thank you for calling back! Let me pull up your quote right away.",
      "I apologize for any wait. Let me get your information up."
    ],
    discovery: [
      "Has anything changed since we last spoke?",
      "Did you have any questions about the quote I sent?",
      "What's holding you back from moving forward?"
    ],
    resolution: [
      "I can get you bound right now if you're ready to proceed.",
      "Let me address those concerns and see if we can adjust the coverage.",
      "I'll send you an updated quote today. When can I follow up with you?"
    ]
  }
};

const newBusinessBinding: Playbook = {
  id: 'new-business-binding',
  domain: 'new_business',
  name: 'Binding Coverage',
  description: 'Customer ready to purchase and bind new coverage',
  triggerKeywords: ['ready to buy', 'want to start', 'bind', 'purchase', 'sign up', 'get started', 'enroll'],
  doList: [
    'Verify all information is still accurate',
    'Review coverage limits and deductibles',
    'Collect payment information securely',
    'Provide binder number and effective date',
    'Explain what documents they will receive'
  ],
  dontList: [
    'Never bind without full payment or payment arrangement',
    'Do not skip coverage verification',
    'Avoid rushing through disclosures'
  ],
  escalateIf: [
    'Requested effective date is more than 30 days out',
    'Prior insurance has lapsed more than 30 days',
    'Underwriting flags appear'
  ],
  scripts: {
    opening: [
      "Excellent! Let's get you covered today.",
      "Great decision! I'll walk you through the final steps."
    ],
    discovery: [
      "Let me verify a few details before we finalize...",
      "What effective date would you like for the policy?",
      "How would you like to handle the down payment?"
    ],
    resolution: [
      "You're all set! Your policy number is [number], effective [date].",
      "You'll receive your ID cards and policy documents within 24-48 hours.",
      "Welcome to [Agency Name]! Do you have any other questions?"
    ]
  },
  complianceNotes: [
    'Read all required state disclosures',
    'Document coverage selections',
    'PCI: Process payment securely'
  ]
};

// =============================================================================
// RENEWALS PLAYBOOKS
// =============================================================================

const renewalDiscussion: Playbook = {
  id: 'renewal-discussion',
  domain: 'renewals',
  name: 'Renewal Discussion',
  description: 'Customer calling about their upcoming renewal',
  triggerKeywords: ['renewal', 'renew', 'expiring', 'coming up', 'policy ending'],
  doList: [
    'Review the renewal terms with them',
    'Identify any changes from current policy',
    'Look for discount opportunities',
    'Discuss any coverage improvements',
    'Confirm payment method for renewal'
  ],
  dontList: [
    'Never let a policy lapse without communication',
    'Do not make promises about rates you cannot guarantee',
    'Avoid dismissing their concerns about changes'
  ],
  escalateIf: [
    'Non-renewal notice was issued',
    'Rate increase exceeds 25%',
    'Customer threatens to cancel'
  ],
  scripts: {
    opening: [
      "I see your renewal is coming up. Let me review the details with you.",
      "Great timing! I have your renewal information right here."
    ],
    discovery: [
      "Have there been any changes we should know about?",
      "Are you happy with your current coverage levels?",
      "Have you had any claims this year?"
    ],
    resolution: [
      "Your renewal premium is [amount], effective [date].",
      "I found a discount that will save you [amount]. Let me apply that.",
      "Your policy will auto-renew. You don't need to do anything."
    ]
  }
};

const renewalRateIncrease: Playbook = {
  id: 'renewal-rate-increase',
  domain: 'renewals',
  name: 'Rate Increase Explanation',
  description: 'Customer upset about rate increase at renewal',
  triggerKeywords: ['increase', 'went up', 'more expensive', 'higher', 'rate hike', 'why did'],
  doList: [
    'Acknowledge their frustration',
    'Explain the specific reasons for increase',
    'Look for applicable discounts',
    'Offer to re-shop with other carriers',
    'Document the conversation'
  ],
  dontList: [
    'Never be defensive about rate increases',
    'Do not blame the customer for claims',
    'Avoid making promises about future rates'
  ],
  escalateIf: [
    'Increase exceeds 30%',
    'Customer demands to speak with management',
    'Retention discount needed over $200'
  ],
  scripts: {
    opening: [
      "I understand rate increases are frustrating. Let me look into this for you.",
      "Let me pull up your account and see exactly what changed."
    ],
    discovery: [
      "Were there any claims or violations this year?",
      "Did you make any changes to your coverage?",
      "Have there been any changes to your household?"
    ],
    resolution: [
      "The increase is due to [reason]. Here's what we can do...",
      "I found some discounts that will reduce your increase by [amount].",
      "Let me shop this with other carriers to see if we can find better rates."
    ]
  }
};

const renewalLapseWarning: Playbook = {
  id: 'renewal-lapse-warning',
  domain: 'renewals',
  name: 'Lapse Warning',
  description: 'Customer whose policy has or is about to lapse',
  triggerKeywords: ['lapsed', 'expired', 'gap in coverage', 'didn\'t renew', 'forgot to pay'],
  doList: [
    'Check exact lapse date and duration',
    'Explain consequences of coverage gap',
    'Attempt to reinstate immediately if possible',
    'Document reason for lapse',
    'Set up payment to prevent future lapse'
  ],
  dontList: [
    'Never dismiss the seriousness of a lapse',
    'Do not promise reinstatement without checking',
    'Avoid lecturing the customer'
  ],
  escalateIf: [
    'Lapse exceeds 30 days',
    'Claim occurred during lapse period',
    'State requires SR-22 due to lapse'
  ],
  scripts: {
    opening: [
      "Let me check your policy status right away.",
      "I can see there's been an issue with your coverage. Let me help."
    ],
    discovery: [
      "When did you realize the policy had lapsed?",
      "Was there a payment issue or did you intend to cancel?",
      "Have you had any incidents during the gap period?"
    ],
    resolution: [
      "I was able to reinstate your policy effective [date].",
      "Unfortunately, we'll need to write a new policy due to the gap length.",
      "Let's set up autopay to make sure this doesn't happen again."
    ]
  },
  complianceNotes: [
    'Document lapse reason for underwriting',
    'Check state requirements for lapse disclosure'
  ]
};

// =============================================================================
// CLAIMS PLAYBOOKS
// =============================================================================

const claimsNewReport: Playbook = {
  id: 'claims-new-report',
  domain: 'claims',
  name: 'New Claim Report',
  description: 'Customer reporting a new claim or incident',
  triggerKeywords: ['accident', 'damage', 'claim', 'file', 'report', 'incident', 'hit', 'stolen', 'broken'],
  doList: [
    'Express concern for their safety first',
    'Gather all details of the incident',
    'Verify coverage for the type of loss',
    'Provide claim number and next steps',
    'Set expectations for adjuster contact'
  ],
  dontList: [
    'Never guarantee coverage before investigation',
    'Do not assign fault',
    'Avoid discussing settlement amounts'
  ],
  escalateIf: [
    'Injuries are involved',
    'Claim involves litigation',
    'Damage estimate exceeds policy limits'
  ],
  scripts: {
    opening: [
      "I'm sorry to hear that. First, is everyone okay?",
      "Let me help you get this claim started. Are you in a safe place?"
    ],
    discovery: [
      "When and where did this happen?",
      "Can you describe what occurred?",
      "Were there any witnesses or a police report?",
      "Do you have photos of the damage?"
    ],
    resolution: [
      "Your claim number is [number]. An adjuster will contact you within 24-48 hours.",
      "Here's what to expect next: [explain process]",
      "Is there anything else you need help with right now?"
    ]
  },
  complianceNotes: [
    'Document all details exactly as stated',
    'Do not admit liability on behalf of insured'
  ]
};

const claimsStatusInquiry: Playbook = {
  id: 'claims-status',
  domain: 'claims',
  name: 'Claim Status Inquiry',
  description: 'Customer checking on status of existing claim',
  triggerKeywords: ['claim status', 'adjuster', 'settlement', 'check on claim', 'where\'s my', 'when will'],
  doList: [
    'Pull up the claim immediately',
    'Provide specific status updates',
    'Explain any pending items needed',
    'Offer to facilitate contact with adjuster',
    'Set realistic timeline expectations'
  ],
  dontList: [
    'Never guess at claim status',
    'Do not promise specific timelines',
    'Avoid criticizing the claims department'
  ],
  escalateIf: [
    'Claim has been open more than 30 days',
    'Customer is extremely frustrated',
    'There are unresolved coverage questions'
  ],
  scripts: {
    opening: [
      "Let me pull up your claim and give you an update.",
      "I can check on that for you right now."
    ],
    discovery: [
      "Do you have your claim number handy?",
      "Have you spoken with your adjuster recently?",
      "Are there any specific concerns about the claim?"
    ],
    resolution: [
      "Your claim is currently [status]. Next steps are [explanation].",
      "I've sent a message to your adjuster to follow up with you today.",
      "The estimate has been approved. Payment should arrive within [timeframe]."
    ]
  }
};

const claimsDispute: Playbook = {
  id: 'claims-dispute',
  domain: 'claims',
  name: 'Claim Dispute',
  description: 'Customer disputing claim denial or settlement amount',
  triggerKeywords: ['denied', 'dispute', 'appeal', 'disagree', 'not fair', 'not enough', 'won\'t pay'],
  doList: [
    'Listen to their complete concern',
    'Review the denial/settlement reason',
    'Explain the appeal process',
    'Document their dispute thoroughly',
    'Provide supervisor contact if requested'
  ],
  dontList: [
    'Never argue with the customer',
    'Do not make promises about reversals',
    'Avoid dismissing their concerns'
  ],
  escalateIf: [
    'Customer mentions attorney',
    'Dispute involves coverage interpretation',
    'Customer requests DOI complaint information'
  ],
  scripts: {
    opening: [
      "I understand you're not satisfied with the outcome. Let me review this with you.",
      "I want to make sure I understand your concerns completely."
    ],
    discovery: [
      "What specific part of the decision do you disagree with?",
      "Do you have additional documentation to support your position?",
      "Have you spoken with the adjuster about these concerns?"
    ],
    resolution: [
      "I've documented your dispute and submitted it for review.",
      "A supervisor will contact you within [timeframe] to discuss this further.",
      "Here's how to file a formal appeal: [process]"
    ]
  },
  complianceNotes: [
    'Document all dispute details verbatim',
    'Provide DOI information if requested'
  ]
};

// =============================================================================
// POLICY CHANGES PLAYBOOKS
// =============================================================================

const policyChangeAddVehicle: Playbook = {
  id: 'policy-change-add-vehicle',
  domain: 'policy_changes',
  name: 'Add Vehicle',
  description: 'Customer wants to add a vehicle to their policy',
  triggerKeywords: ['add vehicle', 'new car', 'bought a car', 'another vehicle', 'add car', 'just purchased'],
  doList: [
    'Get VIN and verify vehicle details',
    'Confirm who will be primary driver',
    'Review coverage options for new vehicle',
    'Calculate premium change',
    'Provide effective date and new ID cards'
  ],
  dontList: [
    'Never add vehicle without VIN verification',
    'Do not assume same coverage as existing vehicles',
    'Avoid backdating beyond carrier guidelines'
  ],
  escalateIf: [
    'Vehicle is commercial use',
    'Vehicle value exceeds $100,000',
    'VIN doesn\'t match stated vehicle'
  ],
  scripts: {
    opening: [
      "Congratulations on the new vehicle! Let's get it added to your policy.",
      "I can add that for you today. I'll just need some information."
    ],
    discovery: [
      "Do you have the VIN handy?",
      "Who will be the primary driver of this vehicle?",
      "What coverage would you like? Same as your current vehicles or different?",
      "When did you purchase it?"
    ],
    resolution: [
      "Your new vehicle is added effective [date]. Premium change is [amount].",
      "I'll email your new ID cards within the hour.",
      "Is there anything else you need for the new vehicle?"
    ]
  }
};

const policyChangeRemoveVehicle: Playbook = {
  id: 'policy-change-remove-vehicle',
  domain: 'policy_changes',
  name: 'Remove Vehicle',
  description: 'Customer wants to remove a vehicle from their policy',
  triggerKeywords: ['remove vehicle', 'sold', 'traded', 'take off', 'don\'t have anymore', 'got rid of'],
  doList: [
    'Verify which vehicle to remove',
    'Confirm sale/trade date',
    'Calculate premium credit',
    'Update driver assignments if needed',
    'Remind about gap in coverage risks'
  ],
  dontList: [
    'Never remove last vehicle without cancellation discussion',
    'Do not backdate beyond 30 days without documentation',
    'Avoid removing vehicle with open claim'
  ],
  escalateIf: [
    'Vehicle has open claim',
    'Removing would leave driver unassigned',
    'Customer wants significant backdating'
  ],
  scripts: {
    opening: [
      "I can help you remove that vehicle. Let me pull up your policy.",
      "No problem, let's get that taken care of."
    ],
    discovery: [
      "Which vehicle are you removing?",
      "When did you sell or trade it?",
      "Do you have a replacement vehicle to add?"
    ],
    resolution: [
      "I've removed the [vehicle] effective [date]. You'll receive a credit of [amount].",
      "Your updated ID cards will be sent to your email.",
      "Do you need anything else updated on your policy?"
    ]
  }
};

const policyChangeDriver: Playbook = {
  id: 'policy-change-driver',
  domain: 'policy_changes',
  name: 'Add/Remove Driver',
  description: 'Customer wants to add or remove a driver',
  triggerKeywords: ['add driver', 'remove driver', 'new driver', 'take off driver', 'household member', 'exclude'],
  doList: [
    'Get full driver information',
    'Run MVR for new drivers',
    'Explain rate impact',
    'Discuss exclusion options if removing',
    'Update vehicle assignments'
  ],
  dontList: [
    'Never add driver without license verification',
    'Do not exclude without signed form',
    'Avoid removing household members without exclusion'
  ],
  escalateIf: [
    'Driver has DUI/major violations',
    'Customer refuses to add household driver',
    'Underwriting questions arise'
  ],
  scripts: {
    opening: [
      "I can update the drivers on your policy. What change do you need?",
      "Let me help you with that driver change."
    ],
    discovery: [
      "What is the driver's full name and date of birth?",
      "Do they have a valid driver's license?",
      "Which vehicle will they primarily drive?"
    ],
    resolution: [
      "I've added [name] to your policy. Premium change is [amount].",
      "I've removed [name]. They are now excluded from coverage.",
      "I'll need a signed exclusion form. I'm sending it to your email now."
    ]
  }
};

const policyChangeAddress: Playbook = {
  id: 'policy-change-address',
  domain: 'policy_changes',
  name: 'Address Change',
  description: 'Customer has moved and needs to update their address',
  triggerKeywords: ['address', 'moved', 'moving', 'new address', 'relocated', 'different location'],
  doList: [
    'Get complete new address',
    'Verify garaging location for vehicles',
    'Check if new address affects rates',
    'Update all related policies',
    'Verify continued eligibility'
  ],
  dontList: [
    'Never change address without verification',
    'Do not assume garaging location is same as mailing',
    'Avoid missing multi-policy updates'
  ],
  escalateIf: [
    'Moving out of state',
    'New address is commercial',
    'Rate change exceeds 20%'
  ],
  scripts: {
    opening: [
      "I can update your address. What's the new location?",
      "Let me get your new address information."
    ],
    discovery: [
      "What is your new street address, city, state, and zip?",
      "Is this also where your vehicles will be garaged?",
      "When is your effective move date?"
    ],
    resolution: [
      "Your address is updated effective [date]. Rate change is [amount].",
      "I've updated your auto and home policies.",
      "Your new ID cards will be mailed to the new address."
    ]
  }
};

const policyChangeCoverage: Playbook = {
  id: 'policy-change-coverage',
  domain: 'policy_changes',
  name: 'Coverage Change',
  description: 'Customer wants to modify coverage limits or deductibles',
  triggerKeywords: ['increase coverage', 'decrease', 'change limits', 'deductible', 'more coverage', 'less coverage'],
  doList: [
    'Understand what change they want',
    'Explain implications of change',
    'Quote the premium difference',
    'Document reasons for decrease',
    'Provide updated dec page'
  ],
  dontList: [
    'Never reduce coverage without documentation',
    'Do not encourage minimum limits',
    'Avoid making recommendations without understanding needs'
  ],
  escalateIf: [
    'Reducing below state minimums',
    'Removing coverage with open loan',
    'Customer seems confused about coverage'
  ],
  scripts: {
    opening: [
      "I can help you adjust your coverage. What did you have in mind?",
      "Let's review your options for coverage changes."
    ],
    discovery: [
      "Which coverage are you looking to change?",
      "Are you looking to increase or decrease?",
      "Is there a specific reason for the change?"
    ],
    resolution: [
      "I've updated your [coverage] to [new limit]. Premium change is [amount].",
      "Your updated declarations page will be emailed to you.",
      "Is there anything else you'd like to adjust?"
    ]
  },
  complianceNotes: [
    'Document customer acknowledgment of coverage reduction',
    'Verify lienholder requirements before removing coverage'
  ]
};

// =============================================================================
// ESCALATION PLAYBOOKS
// =============================================================================

const escalationUpset: Playbook = {
  id: 'escalation-upset',
  domain: 'escalations',
  name: 'Upset Customer',
  description: 'Customer is frustrated, angry, or threatening',
  triggerKeywords: ['supervisor', 'manager', 'complaint', 'frustrated', 'angry', 'terrible', 'worst', 'ridiculous'],
  doList: [
    'Let them vent without interrupting',
    'Acknowledge their feelings',
    'Apologize for their experience',
    'Focus on resolution, not blame',
    'Offer supervisor if they insist'
  ],
  dontList: [
    'Never argue or become defensive',
    'Do not take it personally',
    'Avoid saying "calm down"',
    'Do not make excuses'
  ],
  escalateIf: [
    'Customer threatens legal action',
    'Customer uses abusive language',
    'Customer demands specific supervisor by name',
    'Issue requires authority beyond your level'
  ],
  scripts: {
    opening: [
      "I can hear you're frustrated, and I want to help. Let me understand what happened.",
      "I'm sorry you're dealing with this. I'm here to help resolve it."
    ],
    discovery: [
      "Can you tell me what happened from the beginning?",
      "What would you like to see happen to resolve this?",
      "Have you spoken with anyone else about this?"
    ],
    resolution: [
      "Here's what I can do to fix this right now...",
      "I've documented your concerns and escalated to my supervisor.",
      "I'm going to personally follow up on this and call you back by [time]."
    ]
  },
  complianceNotes: [
    'Document all complaints thoroughly',
    'Note if customer mentions regulatory agencies'
  ]
};

const escalationCallback: Playbook = {
  id: 'escalation-callback',
  domain: 'escalations',
  name: 'Callback Request',
  description: 'Customer who was promised a callback that never came',
  triggerKeywords: ['call me back', 'waiting for', 'no one called', 'promised', 'never heard back', 'left message'],
  doList: [
    'Apologize sincerely for the delay',
    'Research what happened',
    'Resolve the issue now if possible',
    'Set specific callback time if needed',
    'Follow through personally'
  ],
  dontList: [
    'Never blame other departments',
    'Do not make promises you cannot keep',
    'Avoid vague timeline commitments'
  ],
  escalateIf: [
    'Customer has called more than 3 times',
    'Issue has been pending more than 1 week',
    'Customer threatens to cancel'
  ],
  scripts: {
    opening: [
      "I apologize that you didn't receive a callback. Let me help you now.",
      "I'm sorry for the delay. I want to make sure this gets resolved today."
    ],
    discovery: [
      "What were you calling about originally?",
      "Who did you speak with?",
      "What date were you promised a callback?"
    ],
    resolution: [
      "I've resolved [issue] for you today. Is there anything else?",
      "I will personally call you at [time] with an update.",
      "I've noted your account so whoever calls you back will have all the details."
    ]
  }
};

const escalationCancel: Playbook = {
  id: 'escalation-cancel',
  domain: 'escalations',
  name: 'Cancellation Request',
  description: 'Customer wants to cancel their policy',
  triggerKeywords: ['cancel', 'cancellation', 'end policy', 'stop coverage', 'done with you', 'leaving'],
  doList: [
    'Understand the reason for cancellation',
    'Attempt to resolve underlying issue',
    'Offer retention solutions if appropriate',
    'Explain cancellation process and timing',
    'Ensure they have replacement coverage'
  ],
  dontList: [
    'Never beg or be pushy',
    'Do not process without required documentation',
    'Avoid making the customer feel guilty'
  ],
  escalateIf: [
    'High-value customer (multiple policies)',
    'Cancellation reason involves complaint',
    'Customer retention offer needed'
  ],
  scripts: {
    opening: [
      "I'm sorry to hear you're considering cancellation. May I ask what's prompting this?",
      "Before we process that, I'd like to understand if there's anything we can do."
    ],
    discovery: [
      "Is this due to a rate increase or service issue?",
      "Do you have replacement coverage lined up?",
      "Is there anything we could do to keep your business?"
    ],
    resolution: [
      "I understand. I'll process your cancellation effective [date].",
      "I was able to [resolution]. Would you like to stay with us?",
      "You'll receive written confirmation and any refund owed within [timeframe]."
    ]
  },
  complianceNotes: [
    'Obtain written/signed cancellation request',
    'Verify no claims pending before processing'
  ]
};

// =============================================================================
// EXPORT ALL PLAYBOOKS
// =============================================================================

export const ALL_PLAYBOOKS: Playbook[] = [
  // Billing & Payments
  billingPaymentInquiry,
  billingNSF,
  billingPaymentPlan,
  billingAutopay,
  billingRefund,

  // New Business
  newBusinessQuote,
  newBusinessFollowUp,
  newBusinessBinding,

  // Renewals
  renewalDiscussion,
  renewalRateIncrease,
  renewalLapseWarning,

  // Claims
  claimsNewReport,
  claimsStatusInquiry,
  claimsDispute,

  // Policy Changes
  policyChangeAddVehicle,
  policyChangeRemoveVehicle,
  policyChangeDriver,
  policyChangeAddress,
  policyChangeCoverage,

  // Escalations
  escalationUpset,
  escalationCallback,
  escalationCancel,
];

// Group by domain for UI
export const PLAYBOOKS_BY_DOMAIN: Record<PlaybookDomain, Playbook[]> = {
  billing_payments: [billingPaymentInquiry, billingNSF, billingPaymentPlan, billingAutopay, billingRefund],
  new_business: [newBusinessQuote, newBusinessFollowUp, newBusinessBinding],
  renewals: [renewalDiscussion, renewalRateIncrease, renewalLapseWarning],
  claims: [claimsNewReport, claimsStatusInquiry, claimsDispute],
  policy_changes: [policyChangeAddVehicle, policyChangeRemoveVehicle, policyChangeDriver, policyChangeAddress, policyChangeCoverage],
  escalations: [escalationUpset, escalationCallback, escalationCancel],
};

// Domain display names
export const DOMAIN_NAMES: Record<PlaybookDomain, string> = {
  billing_payments: 'Billing & Payments',
  new_business: 'New Business',
  renewals: 'Renewals',
  claims: 'Claims',
  policy_changes: 'Policy Changes',
  escalations: 'Escalations',
};

// Find playbook by ID
export function getPlaybookById(id: string): Playbook | undefined {
  return ALL_PLAYBOOKS.find(p => p.id === id);
}

// Get playbooks for a domain
export function getPlaybooksByDomain(domain: PlaybookDomain): Playbook[] {
  return PLAYBOOKS_BY_DOMAIN[domain] || [];
}
