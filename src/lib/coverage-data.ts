/**
 * Coverage Data Library
 *
 * Detailed coverage information for agent education and customer conversations.
 * Maps coverage codes/types to comprehensive data including talking points,
 * objection handling, and real-world examples.
 */

import { CoverageCategory } from '@/components/features/coverage/CoverageScreen';
import type { Coverage as DetailedCoverage, Objection, RecommendedLimit } from '@/components/features/coverage/CoverageScreen';

// ============================================================================
// AUTO INSURANCE COVERAGES
// ============================================================================

const AUTO_COVERAGES: Record<string, Omit<DetailedCoverage, 'limit' | 'deductible' | 'premium'>> = {
  // Bodily Injury Liability
  'BI': {
    code: 'BI',
    fullName: 'Bodily Injury Liability',
    shortDescription: 'Pays for injuries you cause to others in an accident',
    longDescription: 'Bodily Injury Liability coverage pays for medical expenses, lost wages, and legal fees if you injure someone in an accident. This includes passengers in other vehicles, pedestrians, and bicyclists. It also covers your legal defense if you are sued.',
    category: CoverageCategory.Liability,
    icon: '🛡️',
    whatItCovers: [
      'Medical bills for injured parties',
      'Lost wages if the injured person cannot work',
      'Pain and suffering damages',
      'Legal defense costs if you are sued',
      'Settlement costs up to your policy limit'
    ],
    whatItDoesNotCover: [
      'Your own injuries (covered by Medical Payments or PIP)',
      'Damage to your own vehicle',
      'Intentional injuries you cause',
      'Injuries to your household members in the same vehicle',
      'Business-related accidents in personal auto policy'
    ],
    whyCustomersNeedIt: 'Without adequate Bodily Injury coverage, you could be personally responsible for medical bills that can easily exceed $100,000 in a serious accident. One lawsuit could wipe out your savings and garnish your future wages.',
    realClaimExample: 'Last year, one of our customers was involved in a serious intersection accident. The other driver required surgery and six months of physical therapy, totaling $187,000 in medical bills. Because they had 250/500 BI limits, their policy covered everything and protected their personal assets.',
    commonObjections: [
      {
        objection: "I'm a safe driver, I don't need high limits",
        response: "That's great that you're careful! But even the safest drivers can be in accidents caused by weather, road conditions, or other drivers. And medical costs have increased dramatically - a single hospital stay can exceed $50,000. Higher limits protect your savings and home from lawsuits."
      },
      {
        objection: "Higher limits are too expensive",
        response: "Actually, increasing from 50/100 to 100/300 often costs less than $15 per month - that's about 50 cents a day. For that small amount, you're protecting yourself against lawsuits that could cost hundreds of thousands."
      },
      {
        objection: "The minimum required by law should be enough",
        response: "State minimums were set decades ago and haven't kept up with medical costs. Texas minimum of 30/60 might cover a broken arm, but a serious injury like a spinal cord injury can cost over $1 million. The minimum protects you from tickets, not lawsuits."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '50,000/100,000', description: 'Basic protection - exposes you to personal liability' },
      { level: 'better', value: '100,000/300,000', description: 'Good protection for most families' },
      { level: 'best', value: '250,000/500,000', description: 'Best protection - pair with umbrella policy' }
    ],
    redFlags: [
      'Limits below 100/300 with assets over $50,000',
      'No umbrella policy with high net worth',
      'Teen drivers on policy with minimum limits'
    ],
    upsellOpportunities: [
      'Recommend 250/500 for homeowners to protect equity',
      'Bundle with umbrella policy for complete protection',
      'Higher limits often qualify for multi-policy discount'
    ],
    talkingPoints: [
      'Medical costs have tripled in the last 20 years',
      'Average lawsuit settlement is over $50,000',
      'Higher limits protect your home, savings, and future wages'
    ]
  },

  // Property Damage Liability
  'PD': {
    code: 'PD',
    fullName: 'Property Damage Liability',
    shortDescription: "Pays for damage you cause to other people's property",
    longDescription: "Property Damage Liability covers the cost to repair or replace other people's property that you damage in an accident. This includes other vehicles, buildings, fences, mailboxes, and any other property.",
    category: CoverageCategory.Liability,
    icon: '🚗',
    whatItCovers: [
      'Damage to other vehicles in an accident',
      'Damage to buildings, fences, or structures',
      'Loss of use while property is being repaired',
      'Legal defense if you are sued'
    ],
    whatItDoesNotCover: [
      'Damage to your own vehicle',
      'Personal property inside your vehicle',
      'Intentional damage',
      'Property owned by household members'
    ],
    whyCustomersNeedIt: "Luxury vehicles can cost $60,000-$150,000 to replace. Commercial trucks and equipment can cost even more. If you damage someone else's property, you're responsible for the full cost.",
    realClaimExample: "A customer lost control on an icy road and slid into a parked Tesla Model X. The repair bill was $47,000. Fortunately, their $100,000 PD limit covered it entirely. With minimum coverage of $25,000, they would have owed $22,000 out of pocket.",
    commonObjections: [
      {
        objection: "Most cars aren't that expensive",
        response: "You're right that average cars aren't, but you don't get to choose what you hit. Teslas, Mercedes, and BMWs are everywhere now. And if you damage a commercial vehicle or building, costs add up quickly. Last year we had a claim where someone hit a food truck - $85,000 in damages."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$50,000', description: 'Risky - many vehicles cost more than this' },
      { level: 'better', value: '$100,000', description: 'Adequate for most situations' },
      { level: 'best', value: '$250,000', description: 'Best protection against lawsuits' }
    ],
    redFlags: [
      'Limits below $50,000 in areas with expensive vehicles',
      'Commercial drivers with personal policy limits'
    ],
    upsellOpportunities: [
      'Match PD to BI limits for comprehensive protection',
      'Higher limits often cost only a few dollars more'
    ],
    talkingPoints: [
      'Average new car costs over $48,000',
      'Tesla repairs average $4,000-$7,000 for minor damage',
      'Low limits could leave you personally liable for the difference'
    ]
  },

  // Comprehensive
  'COMP': {
    code: 'COMP',
    fullName: 'Comprehensive Coverage',
    shortDescription: 'Covers theft, vandalism, weather, and animal strikes',
    longDescription: 'Comprehensive coverage pays for damage to your vehicle from non-collision events. This includes theft, vandalism, hail, floods, fire, falling objects, and animal strikes.',
    category: CoverageCategory.PhysicalDamage,
    icon: '🌪️',
    whatItCovers: [
      'Vehicle theft',
      'Vandalism and break-ins',
      'Hail and storm damage',
      'Flood damage',
      'Fire damage',
      'Falling objects (trees, debris)',
      'Animal strikes (deer, etc.)',
      'Windshield damage'
    ],
    whatItDoesNotCover: [
      'Collision damage',
      'Mechanical breakdown',
      'Normal wear and tear',
      'Personal belongings inside the vehicle',
      'Damage from lack of maintenance'
    ],
    whyCustomersNeedIt: "Texas has the highest rate of vehicle theft in the country. We also experience severe hail storms that can total a vehicle in minutes. Without comprehensive, you'd have to pay the full replacement cost yourself.",
    realClaimExample: "During the April hail storm, we had dozens of customers with hail damage claims. One customer's brand new truck had $18,000 in hail damage. Their $500 deductible comp coverage saved them $17,500.",
    commonObjections: [
      {
        objection: "My car is old, I don't need comprehensive",
        response: "Let me look up your vehicle's value. Even a 10-year-old car might be worth $8,000-$15,000 in today's market. Would you want to replace that out of pocket after a hail storm? Comprehensive often costs less than $15/month for older vehicles."
      },
      {
        objection: "I'll just park in the garage during storms",
        response: "That's smart! But hail can hit without warning while you're at work or shopping. And comprehensive also covers theft - Texas has more vehicle thefts than any other state. It's peace of mind for events you can't control."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$1,000 deductible', description: 'Lower premium, higher out of pocket' },
      { level: 'better', value: '$500 deductible', description: 'Good balance of premium and protection' },
      { level: 'best', value: '$250 deductible', description: 'Best protection, worthwhile for newer vehicles' }
    ],
    redFlags: [
      'No comprehensive on vehicles worth over $10,000',
      'High deductible ($2,500+) on daily driver',
      'No coverage in hail-prone area'
    ],
    upsellOpportunities: [
      'Lower deductible before hail season (spring)',
      'Add glass coverage with $0 deductible',
      'Bundle with roadside assistance'
    ],
    talkingPoints: [
      'Texas has highest vehicle theft rate in the US',
      'Hail claims averaged $4,300 last year',
      'One deer strike can total a vehicle'
    ]
  },

  // Collision
  'COLL': {
    code: 'COLL',
    fullName: 'Collision Coverage',
    shortDescription: 'Pays to repair your vehicle after an accident',
    longDescription: 'Collision coverage pays to repair or replace your vehicle after an accident, regardless of who is at fault. This includes single-car accidents like hitting a tree, guardrail, or rolling your vehicle.',
    category: CoverageCategory.PhysicalDamage,
    icon: '💥',
    whatItCovers: [
      'Damage from accidents with other vehicles',
      'Single-car accidents (trees, poles, guardrails)',
      'Rollover accidents',
      'Potholes and road debris damage',
      'Hit-and-run damage (if vehicle is identified)'
    ],
    whatItDoesNotCover: [
      'Damage from theft, vandalism, or weather (covered by comprehensive)',
      'Mechanical breakdown',
      'Personal belongings',
      'Your medical expenses'
    ],
    whyCustomersNeedIt: "If you're in an accident and it's your fault, collision is the only way to get your car repaired. Even if the other driver is at fault, you may have to use your collision first and wait to be reimbursed.",
    realClaimExample: "A customer hit a patch of black ice and slid into a guardrail. Since there was no other driver to blame, their $1,000 collision deductible was all they paid on a $12,000 repair. Without collision, they would have paid the full amount or had no car.",
    commonObjections: [
      {
        objection: "I'll just save the premium and pay out of pocket if needed",
        response: "That's a strategy, but consider: the average collision repair is $4,000-$8,000. Most people don't have that sitting in savings. And without coverage, you might be stuck paying for a totaled car while also needing to buy a new one."
      },
      {
        objection: "My car isn't worth much anymore",
        response: "Used car values are still elevated. Let me check your vehicle's current value. If it's worth more than 10x your annual collision premium, it's usually worth keeping the coverage."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$1,000 deductible', description: 'Lower premium, suitable for older vehicles' },
      { level: 'better', value: '$500 deductible', description: 'Good balance for most drivers' },
      { level: 'best', value: '$250 deductible', description: 'Minimal out of pocket, best for new vehicles' }
    ],
    redFlags: [
      'No collision on financed/leased vehicles (lender requires it)',
      'High deductible with no emergency savings',
      'Dropping collision on car worth $15,000+'
    ],
    upsellOpportunities: [
      'Vanishing deductible for good drivers',
      'New car replacement coverage for vehicles under 2 years old',
      'Gap coverage for financed vehicles'
    ],
    talkingPoints: [
      'Average collision repair costs $4,000-$8,000',
      'Even not-at-fault claims may require using collision first',
      'Protects you from single-car accidents'
    ]
  },

  // Medical Payments
  'MED': {
    code: 'MED',
    fullName: 'Medical Payments Coverage',
    shortDescription: 'Pays medical bills for you and your passengers',
    longDescription: 'Medical Payments coverage pays for medical expenses for you and your passengers after an accident, regardless of who is at fault. It covers hospital bills, surgery, X-rays, and ambulance fees.',
    category: CoverageCategory.Medical,
    icon: '🏥',
    whatItCovers: [
      'Hospital and emergency room visits',
      'Surgery and medical procedures',
      'X-rays and diagnostic tests',
      'Ambulance transportation',
      'Dental work for injuries',
      'Funeral expenses'
    ],
    whatItDoesNotCover: [
      'Long-term rehabilitation',
      'Lost wages',
      'Pain and suffering',
      'Pre-existing conditions aggravated by accident'
    ],
    whyCustomersNeedIt: "Medical Payments coverage kicks in immediately without waiting to determine fault. This means your medical bills get paid right away. It also stacks with health insurance, so it can cover copays and deductibles.",
    realClaimExample: "A customer and their child were rear-ended at a stoplight. Both needed X-rays and the child needed 3 stitches. Total bills: $4,800. Their $10,000 Med Pay covered everything immediately, before the at-fault driver's insurance even started processing the claim.",
    commonObjections: [
      {
        objection: "I already have health insurance",
        response: "That's great! Med Pay works alongside your health insurance. It can cover your health insurance deductible, copays, and even pays for things health insurance might not cover like ambulance fees. Plus, it pays immediately without waiting for a claim investigation."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$5,000', description: 'Basic coverage for minor injuries' },
      { level: 'better', value: '$10,000', description: 'Covers most ER visits and minor procedures' },
      { level: 'best', value: '$25,000', description: 'Comprehensive medical protection' }
    ],
    redFlags: [
      'No Med Pay with high-deductible health plan',
      'Family with children and only $1,000 Med Pay',
      'Long commute with no Med Pay'
    ],
    upsellOpportunities: [
      'Upgrade to $25,000 for families with children',
      'Stack Med Pay benefits across multiple vehicles',
      'Combine with UM/UIM for complete protection'
    ],
    talkingPoints: [
      'Pays immediately, no fault determination needed',
      'Average ER visit costs $2,200',
      'Ambulance ride can cost $400-$1,200'
    ]
  },

  // Uninsured/Underinsured Motorist Bodily Injury
  'UMBI': {
    code: 'UMBI',
    fullName: 'Uninsured/Underinsured Motorist Bodily Injury',
    shortDescription: 'Protects you if hit by uninsured driver',
    longDescription: "UM/UIM Bodily Injury protects you and your passengers if you're injured by a driver who has no insurance or not enough insurance to cover your injuries. It also covers hit-and-run accidents.",
    category: CoverageCategory.Additional,
    icon: '⚠️',
    whatItCovers: [
      'Your medical expenses from uninsured driver accidents',
      'Passenger injuries in your vehicle',
      'Hit-and-run accident injuries',
      'Lost wages from injuries',
      'Pain and suffering damages'
    ],
    whatItDoesNotCover: [
      'Damage to your vehicle (covered by UMPD)',
      'Injuries in vehicles you don\'t own',
      'Commercial vehicle accidents on personal policy'
    ],
    whyCustomersNeedIt: "One in five Texas drivers has no insurance. If they seriously injure you, you'd have to pay your own medical bills and sue them personally. Most uninsured drivers have no assets to recover. UMBI protects your family.",
    realClaimExample: "A customer was hit by a red-light runner with only state minimum 30/60 coverage. The customer's injuries required surgery and 3 months of physical therapy totaling $95,000. The at-fault driver's policy only paid $30,000. Their UMBI coverage paid the remaining $65,000.",
    commonObjections: [
      {
        objection: "Most people have insurance",
        response: "In Texas, about 20% of drivers - one in five - have no insurance at all. And many more have only state minimum limits that won't cover a serious injury. You can't control who hits you, but you can protect yourself."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '50,000/100,000', description: 'Basic protection' },
      { level: 'better', value: '100,000/300,000', description: 'Match your BI limits' },
      { level: 'best', value: '250,000/500,000', description: 'Maximum protection' }
    ],
    redFlags: [
      'UMBI limits lower than BI limits',
      'No UMBI coverage at all',
      'Family with young children and low UMBI'
    ],
    upsellOpportunities: [
      'Match UMBI to BI limits for consistency',
      'Add umbrella policy for additional protection',
      'Stacking option if you have multiple vehicles'
    ],
    talkingPoints: [
      '20% of Texas drivers are uninsured',
      'Serious injury costs can exceed $100,000',
      'You can\'t choose who hits you'
    ]
  },

  // Uninsured Motorist Property Damage
  'UMPD': {
    code: 'UMPD',
    fullName: 'Uninsured Motorist Property Damage',
    shortDescription: 'Covers vehicle damage from uninsured drivers',
    longDescription: "Uninsured Motorist Property Damage pays to repair or replace your vehicle if an uninsured driver damages it. In Texas, approximately 20% of drivers are uninsured.",
    category: CoverageCategory.Additional,
    icon: '🚨',
    whatItCovers: [
      'Damage to your vehicle from uninsured drivers',
      'Hit-and-run damage where driver flees',
      'Damage from underinsured drivers (up to your limits)'
    ],
    whatItDoesNotCover: [
      'Collision damage you cause',
      'Damage covered by other insurance',
      'Commercial vehicle damage on personal policy'
    ],
    whyCustomersNeedIt: "One in five Texas drivers has no insurance. If they hit you, you'd have to sue them personally to recover damages - most likely unsuccessfully. UMPD protects you from irresponsible drivers.",
    realClaimExample: "A customer was sitting at a red light when an uninsured driver ran the light and T-boned their SUV. The damage was $14,000. Without UMPD, they would have had to file a lawsuit against someone with no assets and likely recover nothing.",
    commonObjections: [
      {
        objection: "I have collision coverage, isn't that enough?",
        response: "Collision would cover this, but you'd pay your collision deductible. With UMPD, your deductible is typically lower ($250 vs $500-$1,000), and it doesn't count against your collision claims history. It's designed specifically for these situations."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$25,000', description: 'State minimum, covers most vehicles' },
      { level: 'better', value: '$50,000', description: 'Better protection for newer vehicles' },
      { level: 'best', value: '$100,000', description: 'Maximum protection available' }
    ],
    redFlags: [
      'No UMPD in high-uninsured areas',
      'New or expensive vehicle with no UMPD',
      'UMPD limit lower than vehicle value'
    ],
    upsellOpportunities: [
      'Bundle with UMBI for complete uninsured protection',
      'Lower deductible options available',
      'Stacks with collision for hit-and-run'
    ],
    talkingPoints: [
      '20% of Texas drivers are uninsured',
      'Lower deductible than collision',
      'Protects you from irresponsible drivers'
    ]
  },

  // Personal Injury Protection
  'PIP': {
    code: 'PIP',
    fullName: 'Personal Injury Protection',
    shortDescription: 'No-fault coverage for medical and lost wages',
    longDescription: 'Personal Injury Protection (PIP) is a no-fault coverage that pays for your medical expenses and lost wages regardless of who caused the accident. In Texas, insurers must offer PIP.',
    category: CoverageCategory.Medical,
    icon: '🩺',
    whatItCovers: [
      'Medical expenses for you and passengers',
      'Lost wages (up to 80%)',
      'Essential services (childcare, housekeeping)',
      'Funeral expenses'
    ],
    whatItDoesNotCover: [
      'Vehicle damage',
      'Pain and suffering',
      'Full lost wages (only covers 80%)'
    ],
    whyCustomersNeedIt: 'PIP pays immediately without waiting to determine fault. It covers lost wages that health insurance and Med Pay don\'t cover. Texas requires insurers to offer it, and you have to sign a waiver to decline.',
    realClaimExample: 'A self-employed contractor was injured in an accident and couldn\'t work for 6 weeks. His PIP coverage paid 80% of his lost income ($8,000) plus his $3,500 in medical bills - benefits his health insurance couldn\'t provide.',
    commonObjections: [
      {
        objection: "What's the difference between PIP and Med Pay?",
        response: "Med Pay only covers medical bills. PIP also covers 80% of lost wages and essential services like childcare. If you're injured and can't work, PIP provides income protection that Med Pay doesn't."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$2,500', description: 'State minimum' },
      { level: 'better', value: '$5,000', description: 'Better protection for most' },
      { level: 'best', value: '$10,000', description: 'Maximum available in Texas' }
    ],
    redFlags: [
      'PIP waived without understanding benefits',
      'Self-employed with no disability insurance and no PIP',
      'Single income household with no PIP'
    ],
    upsellOpportunities: [
      'Max out PIP for self-employed clients',
      'Combine with Med Pay for comprehensive medical coverage',
      'Essential for single-income families'
    ],
    talkingPoints: [
      'Covers lost wages that health insurance doesn\'t',
      'Pays immediately, no fault determination',
      'Required to be offered in Texas'
    ]
  },

  // Rental Reimbursement
  'RENTAL': {
    code: 'RENTAL',
    fullName: 'Rental Reimbursement',
    shortDescription: 'Pays for rental car while yours is being repaired',
    longDescription: 'Rental Reimbursement covers the cost of a rental car while your vehicle is being repaired after a covered claim. Coverage is typically $30-$50 per day for up to 30 days.',
    category: CoverageCategory.Additional,
    icon: '🚙',
    whatItCovers: [
      'Rental car costs during repairs',
      'Alternative transportation (rideshare, taxi)',
      'Coverage up to daily/total limits'
    ],
    whatItDoesNotCover: [
      'Rental for mechanical breakdown',
      'Rental during routine maintenance',
      'Gas, insurance on rental, or upgrades'
    ],
    whyCustomersNeedIt: "When your car is in the shop for 2-3 weeks after an accident, rental costs add up fast. At $40/day, that's over $800 out of pocket. Rental reimbursement typically costs less than $5/month.",
    realClaimExample: "A customer's vehicle needed 18 days in the shop after a collision. At $45/day, the rental would have cost $810. Their $50/day rental coverage paid the entire bill. The coverage cost them $48/year.",
    commonObjections: [
      {
        objection: "I can just borrow a car or use rideshare",
        response: "That works for a day or two, but repairs often take 2-3 weeks, especially with parts delays. Rideshare to work every day could cost $500+ for a week. For less than $5/month, rental coverage gives you freedom and convenience."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$30/day, $900 max', description: 'Basic coverage' },
      { level: 'better', value: '$40/day, $1,200 max', description: 'Covers most rentals' },
      { level: 'best', value: '$50/day, $1,500 max', description: 'Full-size vehicle coverage' }
    ],
    redFlags: [
      'No rental coverage and no backup vehicle',
      'Long daily commute with no rental coverage',
      'Only one family vehicle with no rental coverage'
    ],
    upsellOpportunities: [
      'Increase limits for families needing SUVs',
      'Bundle with roadside assistance',
      'Essential for single-vehicle households'
    ],
    talkingPoints: [
      'Average repair takes 12-18 days',
      'Rental cars cost $40-60/day',
      'Coverage typically costs less than $5/month'
    ]
  },

  // Roadside Assistance/Towing
  'ROAD': {
    code: 'ROAD',
    fullName: 'Roadside Assistance & Towing',
    shortDescription: '24/7 help for breakdowns, flat tires, lockouts',
    longDescription: 'Roadside Assistance provides 24/7 help for common vehicle emergencies including towing, flat tire changes, jump starts, lockout service, and fuel delivery.',
    category: CoverageCategory.Additional,
    icon: '🔧',
    whatItCovers: [
      'Towing to nearest repair facility',
      'Flat tire changes',
      'Jump starts for dead batteries',
      'Lockout service',
      'Fuel delivery (you pay for fuel)',
      'Winching if stuck'
    ],
    whatItDoesNotCover: [
      'Mechanical repairs',
      'Cost of parts or fuel',
      'Towing for accidents (covered by comp/collision)',
      'Commercial vehicle towing'
    ],
    whyCustomersNeedIt: 'A single tow truck call can cost $100-$300. Locksmith services run $75-$150. Roadside assistance costs about $2-4/month and covers the whole family, any vehicle they drive.',
    realClaimExample: 'A customer got a flat tire on the highway late at night. Changing it themselves wasn\'t safe. Their roadside assistance had a truck there in 30 minutes, changed the tire, and got them safely home - all covered.',
    commonObjections: [
      {
        objection: "I already have AAA",
        response: "AAA is great, but our roadside coverage is usually cheaper and covers you in any vehicle you're driving, not just your own. It's worth comparing the cost and coverage limits."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: 'Basic', description: '$50 towing limit' },
      { level: 'better', value: 'Standard', description: '$100 towing limit' },
      { level: 'best', value: 'Premium', description: 'Unlimited towing' }
    ],
    redFlags: [
      'Older vehicle with no roadside coverage',
      'Long commute with no backup plan',
      'No AAA or other roadside coverage'
    ],
    upsellOpportunities: [
      'Bundle with rental reimbursement',
      'Upgrade for unlimited towing',
      'Coverage for whole family, any vehicle'
    ],
    talkingPoints: [
      'Average tow costs $100-$300',
      'Coverage is only $2-4/month',
      'Covers you in any vehicle you drive'
    ]
  }
};

// ============================================================================
// HOME INSURANCE COVERAGES
// ============================================================================

const HOME_COVERAGES: Record<string, Omit<DetailedCoverage, 'limit' | 'deductible' | 'premium'>> = {
  'DWELL': {
    code: 'DWELL',
    fullName: 'Dwelling Coverage (Coverage A)',
    shortDescription: 'Covers your home\'s structure',
    longDescription: 'Dwelling Coverage pays to repair or rebuild your home if damaged by covered perils like fire, wind, hail, or lightning. This includes the main structure, attached garage, and built-in appliances.',
    category: CoverageCategory.Property,
    icon: '🏠',
    whatItCovers: [
      'Main house structure',
      'Attached garage',
      'Built-in appliances and fixtures',
      'Electrical, plumbing, HVAC systems',
      'Permanent flooring and carpeting'
    ],
    whatItDoesNotCover: [
      'Flood damage (requires separate policy)',
      'Earthquake damage',
      'Normal wear and tear',
      'Detached structures (covered by Coverage B)',
      'Personal belongings (covered by Coverage C)'
    ],
    whyCustomersNeedIt: 'Your home is likely your largest asset. Dwelling coverage ensures you can rebuild after a disaster without losing everything you\'ve worked for.',
    realClaimExample: 'A customer\'s home was struck by lightning, causing a fire that destroyed the kitchen and damaged the roof. Their dwelling coverage paid $127,000 to repair the damage and restore the home to its original condition.',
    commonObjections: [
      {
        objection: "Why is my dwelling coverage more than what I paid for the house?",
        response: "That's because dwelling coverage is based on rebuilding cost, not market value. Land doesn't burn down, but rebuilding materials and labor have increased significantly. If you insure for purchase price, you might not be able to fully rebuild."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '80% of rebuild cost', description: 'Minimum for coinsurance' },
      { level: 'better', value: '100% of rebuild cost', description: 'Full replacement' },
      { level: 'best', value: 'Guaranteed replacement', description: 'Covers any rebuild cost' }
    ],
    redFlags: [
      'Dwelling limit less than 80% of rebuild cost',
      'No coverage update after major renovations',
      'Policy based on purchase price, not rebuild cost'
    ],
    upsellOpportunities: [
      'Guaranteed replacement cost endorsement',
      'Building code upgrade coverage',
      'Extended replacement cost (125% of limit)'
    ],
    talkingPoints: [
      'Rebuild costs often exceed market value',
      'Construction costs have increased 30%+ recently',
      'Underinsurance triggers coinsurance penalty'
    ]
  },

  'OTS': {
    code: 'OTS',
    fullName: 'Other Structures (Coverage B)',
    shortDescription: 'Covers detached structures on your property',
    longDescription: 'Other Structures coverage protects detached buildings and structures on your property. This typically includes detached garages, sheds, fences, and pools.',
    category: CoverageCategory.Property,
    icon: '🏚️',
    whatItCovers: [
      'Detached garage',
      'Storage sheds',
      'Fences and walls',
      'Swimming pools',
      'Gazebos and pergolas',
      'Driveways and walkways'
    ],
    whatItDoesNotCover: [
      'Structures used for business',
      'Structures rented to non-family',
      'Land value'
    ],
    whyCustomersNeedIt: 'Storms can damage your fence, shed, or pool just as easily as your home. Other structures coverage protects these investments.',
    realClaimExample: 'A windstorm knocked down 200 feet of a customer\'s privacy fence and damaged their detached workshop. Coverage B paid $12,000 to repair the fence and $8,000 for the workshop.',
    commonObjections: [
      {
        objection: "I don't have any detached structures",
        response: "Coverage B also includes fences, driveways, and walkways. A single hail storm can damage a driveway, or a fallen tree can destroy a fence. It's included at 10% of your dwelling coverage, so it's there when you need it."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '10% of dwelling', description: 'Standard inclusion' },
      { level: 'better', value: '15% of dwelling', description: 'For larger properties' },
      { level: 'best', value: '20%+ of dwelling', description: 'Multiple structures' }
    ],
    redFlags: [
      'Large detached garage/workshop with 10% limit',
      'In-ground pool with minimal Other Structures',
      'Expensive fencing not adequately covered'
    ],
    upsellOpportunities: [
      'Increase limit for properties with pools',
      'Add coverage for detached workshops',
      'Review after adding structures'
    ],
    talkingPoints: [
      'Standard is 10% of dwelling coverage',
      'Includes fences, driveways, pools',
      'Easy to increase if needed'
    ]
  },

  'PP': {
    code: 'PP',
    fullName: 'Personal Property (Coverage C)',
    shortDescription: 'Covers your belongings inside and outside the home',
    longDescription: 'Personal Property coverage protects your belongings including furniture, electronics, clothing, and appliances. It covers them at home and anywhere in the world.',
    category: CoverageCategory.Property,
    icon: '📦',
    whatItCovers: [
      'Furniture and appliances',
      'Electronics and computers',
      'Clothing and shoes',
      'Kitchen items and dishes',
      'Belongings away from home (college, travel)',
      'Items in storage units'
    ],
    whatItDoesNotCover: [
      'Motor vehicles and parts',
      'Animals and pets',
      'Business inventory',
      'Items insured elsewhere (jewelry, art)'
    ],
    whyCustomersNeedIt: 'Most people underestimate what they own. Add up your furniture, electronics, clothes, and kitchen items - it\'s often $50,000-$100,000. After a fire, you\'d need to replace everything.',
    realClaimExample: 'A burst pipe flooded a customer\'s first floor. They lost furniture, a TV, books, and ruined carpet. Their personal property coverage paid $28,000 to replace their belongings, while dwelling coverage fixed the pipe and floors.',
    commonObjections: [
      {
        objection: "I don't own that much stuff",
        response: "Let's do a quick mental inventory. Living room furniture, TV, kitchen appliances, all your clothes, books, decorations, garage tools... Most people are surprised when they add it up. The average home has $50,000+ in belongings."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '50% of dwelling', description: 'Standard coverage' },
      { level: 'better', value: '70% of dwelling', description: 'For well-furnished homes' },
      { level: 'best', value: '75%+ with replacement cost', description: 'Full replacement protection' }
    ],
    redFlags: [
      'Actual cash value (depreciated) coverage',
      'Low limits with expensive electronics/collections',
      'No scheduled items for jewelry, art, guns'
    ],
    upsellOpportunities: [
      'Upgrade to replacement cost coverage',
      'Schedule valuable items (jewelry, art)',
      'Review after major purchases'
    ],
    talkingPoints: [
      'Average home has $50,000+ in belongings',
      'Replacement cost vs. actual cash value',
      'Covers items worldwide (theft while traveling)'
    ]
  },

  'LOU': {
    code: 'LOU',
    fullName: 'Loss of Use (Coverage D)',
    shortDescription: 'Pays living expenses if you can\'t live in your home',
    longDescription: 'Loss of Use coverage pays for additional living expenses if you can\'t live in your home after a covered loss. This includes hotel bills, restaurant meals, and temporary rental costs.',
    category: CoverageCategory.Additional,
    icon: '🏨',
    whatItCovers: [
      'Hotel or temporary housing',
      'Restaurant meals above normal',
      'Laundry and dry cleaning',
      'Pet boarding if needed',
      'Storage fees for belongings'
    ],
    whatItDoesNotCover: [
      'Normal living expenses you would have anyway',
      'Expenses after you could have returned home',
      'Loss of income from home business'
    ],
    whyCustomersNeedIt: 'Major repairs can take 6-12 months. Hotel costs of $150/night add up to $4,500/month. Loss of Use ensures your family has a place to live while your home is rebuilt.',
    realClaimExample: 'A fire made a customer\'s home uninhabitable for 8 months. Their Loss of Use coverage paid for a rental home ($2,500/month), restaurant meals, pet boarding, and storage - over $25,000 in additional living expenses.',
    commonObjections: [
      {
        objection: "I could just stay with family",
        response: "That's great for a few days, but major damage can take 6-12 months to repair. Loss of Use gives you options - you can rent a home near your kids' school, keep your normal routine, and not impose on family for months."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '20% of dwelling', description: 'Standard coverage' },
      { level: 'better', value: '30% of dwelling', description: 'Extended coverage' },
      { level: 'best', value: 'Actual loss sustained', description: 'No limit on covered expenses' }
    ],
    redFlags: [
      'Large family with minimum Loss of Use',
      'Pets that would need boarding',
      'Children in school (need to stay in district)'
    ],
    upsellOpportunities: [
      'Upgrade to actual loss sustained',
      'Review for families with special needs',
      'Consider pet boarding costs'
    ],
    talkingPoints: [
      'Major repairs can take 6-12 months',
      'Hotel costs add up quickly',
      'Keeps family together during displacement'
    ]
  },

  'LIAB': {
    code: 'LIAB',
    fullName: 'Personal Liability (Coverage E)',
    shortDescription: 'Protects you from lawsuits for injuries on your property',
    longDescription: 'Personal Liability coverage protects you if someone is injured on your property or if you accidentally damage someone else\'s property. It pays for legal defense and settlements.',
    category: CoverageCategory.Liability,
    icon: '⚖️',
    whatItCovers: [
      'Injuries to guests on your property',
      'Dog bite claims',
      'Accidental damage to others\' property',
      'Legal defense costs',
      'Court judgments up to your limit'
    ],
    whatItDoesNotCover: [
      'Intentional acts',
      'Business activities',
      'Auto accidents (covered by auto policy)',
      'Workers compensation claims'
    ],
    whyCustomersNeedIt: 'If a guest slips on your icy walkway, you could be sued. If your dog bites a neighbor, you\'re liable. Personal Liability protects your savings and home from lawsuits.',
    realClaimExample: 'A delivery driver tripped on a customer\'s broken step and broke his wrist. The lawsuit claimed $85,000 in medical bills and lost wages. The customer\'s $300,000 liability coverage handled the defense and settlement.',
    commonObjections: [
      {
        objection: "$100,000 seems like a lot for liability",
        response: "A single lawsuit can easily exceed $100,000. Medical bills, lost wages, pain and suffering - it adds up fast. We recommend at least $300,000, and pairing with an umbrella policy if you have significant assets."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$100,000', description: 'Basic protection' },
      { level: 'better', value: '$300,000', description: 'Recommended minimum' },
      { level: 'best', value: '$500,000 + umbrella', description: 'Comprehensive protection' }
    ],
    redFlags: [
      'Pool or trampoline with $100,000 liability',
      'Dog breed on exclusion list',
      'High net worth with no umbrella policy'
    ],
    upsellOpportunities: [
      'Increase to $500,000 for pool/dog owners',
      'Add umbrella policy for additional $1M+',
      'Review after net worth increases'
    ],
    talkingPoints: [
      'Lawsuits can easily exceed $100,000',
      'Includes legal defense costs',
      'Pairs with umbrella for complete protection'
    ]
  },

  'MEDPAY': {
    code: 'MEDPAY',
    fullName: 'Medical Payments to Others (Coverage F)',
    shortDescription: 'Pays medical bills for guests injured on your property',
    longDescription: 'Medical Payments to Others covers medical expenses for guests injured on your property, regardless of fault. It\'s a goodwill coverage that pays quickly without requiring a lawsuit.',
    category: CoverageCategory.Medical,
    icon: '🩹',
    whatItCovers: [
      'Medical bills for injured guests',
      'Emergency room visits',
      'Ambulance transportation',
      'Minor surgical procedures'
    ],
    whatItDoesNotCover: [
      'Injuries to household members',
      'Injuries to regular employees',
      'Intentional injuries'
    ],
    whyCustomersNeedIt: 'Medical Payments is goodwill coverage that pays quickly without lawsuits. If a guest trips and needs stitches, you can pay their $2,000 ER bill immediately, preventing bad feelings and potential lawsuits.',
    realClaimExample: 'A neighbor\'s child fell off a swing in the backyard and needed 4 stitches. Medical Payments covered the $1,800 ER bill immediately, keeping the friendship intact without any lawsuit.',
    commonObjections: [
      {
        objection: "Why do I need this if I have liability?",
        response: "Liability only pays if you're found legally responsible after investigation. Medical Payments pays immediately regardless of fault - it's goodwill coverage. A quick payment often prevents a larger lawsuit."
      }
    ],
    recommendedLimits: [
      { level: 'minimum', value: '$1,000', description: 'Basic coverage' },
      { level: 'better', value: '$5,000', description: 'Covers most ER visits' },
      { level: 'best', value: '$10,000', description: 'Comprehensive coverage' }
    ],
    redFlags: [
      'Frequent guests with only $1,000 Med Pay',
      'Pool or play equipment with low Med Pay',
      'Elderly visitors (higher fall risk)'
    ],
    upsellOpportunities: [
      'Increase for homes with pools/play equipment',
      'Higher limits for frequent entertainers',
      'Combine with higher liability limits'
    ],
    talkingPoints: [
      'Pays regardless of fault',
      'Prevents potential lawsuits',
      'Preserves relationships with neighbors'
    ]
  }
};

// ============================================================================
// COVERAGE TYPE ALIASES
// Maps common coverage type names to their code
// ============================================================================

const COVERAGE_TYPE_ALIASES: Record<string, string> = {
  // Auto
  'bodily injury': 'BI',
  'bodily injury liability': 'BI',
  'bi': 'BI',
  'property damage': 'PD',
  'property damage liability': 'PD',
  'pd': 'PD',
  'comprehensive': 'COMP',
  'comp': 'COMP',
  'other than collision': 'COMP',
  'otc': 'COMP',
  'collision': 'COLL',
  'coll': 'COLL',
  'medical payments': 'MED',
  'med pay': 'MED',
  'medpay': 'MED',
  'medical pay': 'MED',
  'uninsured motorist': 'UMBI',
  'um': 'UMBI',
  'umbi': 'UMBI',
  'uim': 'UMBI',
  'underinsured motorist': 'UMBI',
  'uninsured motorist property damage': 'UMPD',
  'umpd': 'UMPD',
  'personal injury protection': 'PIP',
  'pip': 'PIP',
  'rental': 'RENTAL',
  'rental reimbursement': 'RENTAL',
  'transportation expense': 'RENTAL',
  'roadside': 'ROAD',
  'roadside assistance': 'ROAD',
  'towing': 'ROAD',
  'towing and labor': 'ROAD',

  // Home
  'dwelling': 'DWELL',
  'coverage a': 'DWELL',
  'cov a': 'DWELL',
  'other structures': 'OTS',
  'coverage b': 'OTS',
  'cov b': 'OTS',
  'personal property': 'PP',
  'contents': 'PP',
  'coverage c': 'PP',
  'cov c': 'PP',
  'loss of use': 'LOU',
  'additional living expense': 'LOU',
  'ale': 'LOU',
  'coverage d': 'LOU',
  'cov d': 'LOU',
  'liability': 'LIAB',
  'personal liability': 'LIAB',
  'coverage e': 'LIAB',
  'cov e': 'LIAB',
  'medical payments to others': 'MEDPAY',
  'coverage f': 'MEDPAY',
  'cov f': 'MEDPAY'
};

// ============================================================================
// LOOKUP FUNCTIONS
// ============================================================================

/**
 * Look up coverage code from type string
 */
export function getCoverageCode(coverageType: string): string | null {
  const normalized = coverageType.toLowerCase().trim();
  return COVERAGE_TYPE_ALIASES[normalized] || null;
}

/**
 * Get detailed coverage data by code
 */
export function getCoverageData(code: string): Omit<DetailedCoverage, 'limit' | 'deductible' | 'premium'> | null {
  const upperCode = code.toUpperCase();
  return AUTO_COVERAGES[upperCode] || HOME_COVERAGES[upperCode] || null;
}

/**
 * Enrich a simple coverage with detailed data
 * Returns null if coverage type is not recognized
 */
export function enrichCoverage(simpleCoverage: {
  type: string;
  limit?: string;
  deductible?: string;
  premium?: number;
}): DetailedCoverage | null {
  // Try direct code lookup first
  let data = getCoverageData(simpleCoverage.type);

  // If not found, try alias lookup
  if (!data) {
    const code = getCoverageCode(simpleCoverage.type);
    if (code) {
      data = getCoverageData(code);
    }
  }

  if (!data) {
    return null;
  }

  // Parse deductible if it's a string
  let deductible: number | undefined;
  if (simpleCoverage.deductible) {
    const parsed = parseInt(simpleCoverage.deductible.replace(/[^0-9]/g, ''));
    if (!isNaN(parsed)) {
      deductible = parsed;
    }
  }

  return {
    ...data,
    limit: simpleCoverage.limit || 'See Policy',
    deductible,
    premium: simpleCoverage.premium
  };
}

/**
 * Enrich multiple coverages, returning only those with detailed data available
 */
export function enrichCoverages(coverages: Array<{
  type: string;
  limit?: string;
  deductible?: string;
  premium?: number;
}>): DetailedCoverage[] {
  return coverages
    .map(enrichCoverage)
    .filter((c): c is DetailedCoverage => c !== null);
}

/**
 * Check if we have detailed data for a coverage type
 */
export function hasCoverageData(coverageType: string): boolean {
  const code = getCoverageCode(coverageType);
  return code ? !!getCoverageData(code) : !!getCoverageData(coverageType);
}

/**
 * Get all available coverage codes
 */
export function getAllCoverageCodes(): string[] {
  return [
    ...Object.keys(AUTO_COVERAGES),
    ...Object.keys(HOME_COVERAGES)
  ];
}
