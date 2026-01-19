'use client';

import { CoverageScreen, CoverageCategory } from '@/components/features/coverage';
import type { Policy, Coverage } from '@/components/features/coverage';

// Sample coverage data for demonstration
const sampleCoverages: Coverage[] = [
  {
    code: 'BI',
    fullName: 'Bodily Injury Liability',
    shortDescription: 'Pays for injuries you cause to others in an accident',
    longDescription: 'Bodily Injury Liability coverage pays for medical expenses, lost wages, and legal fees if you injure someone in an accident. This includes passengers in other vehicles, pedestrians, and bicyclists. It also covers your legal defense if you are sued.',
    category: CoverageCategory.Liability,
    icon: '🛡️',
    limit: '100,000/300,000',
    premium: 450,
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
      {
        level: 'minimum',
        value: '50,000/100,000',
        description: 'Basic protection - exposes you to personal liability'
      },
      {
        level: 'better',
        value: '100,000/300,000',
        description: 'Good protection for most families'
      },
      {
        level: 'best',
        value: '250,000/500,000',
        description: 'Best protection - pair with umbrella policy'
      }
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
  {
    code: 'PD',
    fullName: 'Property Damage Liability',
    shortDescription: 'Pays for damage you cause to other people\'s property',
    longDescription: 'Property Damage Liability covers the cost to repair or replace other people\'s property that you damage in an accident. This includes other vehicles, buildings, fences, mailboxes, and any other property.',
    category: CoverageCategory.Liability,
    icon: '🚗',
    limit: '100,000',
    premium: 180,
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
    whyCustomersNeedIt: 'Luxury vehicles can cost $60,000-$150,000 to replace. Commercial trucks and equipment can cost even more. If you damage someone else\'s property, you\'re responsible for the full cost.',
    realClaimExample: 'A customer lost control on an icy road and slid into a parked Tesla Model X. The repair bill was $47,000. Fortunately, their $100,000 PD limit covered it entirely. With minimum coverage of $25,000, they would have owed $22,000 out of pocket.',
    commonObjections: [
      {
        objection: "Most cars aren't that expensive",
        response: "You're right that average cars aren't, but you don't get to choose what you hit. Teslas, Mercedes, and BMWs are everywhere now. And if you damage a commercial vehicle or building, costs add up quickly. Last year we had a claim where someone hit a food truck - $85,000 in damages."
      }
    ],
    recommendedLimits: [
      {
        level: 'minimum',
        value: '50,000',
        description: 'Risky - many vehicles cost more than this'
      },
      {
        level: 'better',
        value: '100,000',
        description: 'Adequate for most situations'
      },
      {
        level: 'best',
        value: '250,000',
        description: 'Best protection against lawsuits'
      }
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
  {
    code: 'COMP',
    fullName: 'Comprehensive Coverage',
    shortDescription: 'Covers theft, vandalism, weather, and animal strikes',
    longDescription: 'Comprehensive coverage pays for damage to your vehicle from non-collision events. This includes theft, vandalism, hail, floods, fire, falling objects, and animal strikes.',
    category: CoverageCategory.PhysicalDamage,
    icon: '🌪️',
    limit: 'Actual Cash Value',
    deductible: 500,
    premium: 220,
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
    whyCustomersNeedIt: 'Texas has the highest rate of vehicle theft in the country. We also experience severe hail storms that can total a vehicle in minutes. Without comprehensive, you\'d have to pay the full replacement cost yourself.',
    realClaimExample: 'During the April hail storm, we had dozens of customers with hail damage claims. One customer\'s brand new truck had $18,000 in hail damage. Their $500 deductible comp coverage saved them $17,500.',
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
      {
        level: 'minimum',
        value: '$1,000 deductible',
        description: 'Lower premium, higher out of pocket'
      },
      {
        level: 'better',
        value: '$500 deductible',
        description: 'Good balance of premium and protection'
      },
      {
        level: 'best',
        value: '$250 deductible',
        description: 'Best protection, worthwhile for newer vehicles'
      }
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
  {
    code: 'MED',
    fullName: 'Medical Payments Coverage',
    shortDescription: 'Pays medical bills for you and your passengers',
    longDescription: 'Medical Payments coverage pays for medical expenses for you and your passengers after an accident, regardless of who is at fault. It covers hospital bills, surgery, X-rays, and ambulance fees.',
    category: CoverageCategory.Medical,
    icon: '🏥',
    limit: '10,000',
    premium: 45,
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
    whyCustomersNeedIt: 'Medical Payments coverage kicks in immediately without waiting to determine fault. This means your medical bills get paid right away. It also stacks with health insurance, so it can cover copays and deductibles.',
    realClaimExample: 'A customer and their child were rear-ended at a stoplight. Both needed X-rays and the child needed 3 stitches. Total bills: $4,800. Their $10,000 Med Pay covered everything immediately, before the at-fault driver\'s insurance even started processing the claim.',
    commonObjections: [
      {
        objection: "I already have health insurance",
        response: "That's great! Med Pay works alongside your health insurance. It can cover your health insurance deductible, copays, and even pays for things health insurance might not cover like ambulance fees. Plus, it pays immediately without waiting for a claim investigation."
      }
    ],
    recommendedLimits: [
      {
        level: 'minimum',
        value: '$5,000',
        description: 'Basic coverage for minor injuries'
      },
      {
        level: 'better',
        value: '$10,000',
        description: 'Covers most ER visits and minor procedures'
      },
      {
        level: 'best',
        value: '$25,000',
        description: 'Comprehensive medical protection'
      }
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
  {
    code: 'UMPD',
    fullName: 'Uninsured Motorist Property Damage',
    shortDescription: 'Covers damage from uninsured drivers',
    longDescription: 'Uninsured Motorist Property Damage pays to repair or replace your vehicle if an uninsured driver damages it. In Texas, approximately 20% of drivers are uninsured.',
    category: CoverageCategory.Additional,
    icon: '⚠️',
    limit: '25,000',
    deductible: 250,
    premium: 85,
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
    whyCustomersNeedIt: 'One in five Texas drivers has no insurance. If they hit you, you\'d have to sue them personally to recover damages - most likely unsuccessfully. UMPD protects you from irresponsible drivers.',
    realClaimExample: 'A customer was sitting at a red light when an uninsured driver ran the light and T-boned their SUV. The damage was $14,000. Without UMPD, they would have had to file a lawsuit against someone with no assets and likely recover nothing.',
    commonObjections: [
      {
        objection: "I have collision coverage, isn't that enough?",
        response: "Collision would cover this, but you'd pay your collision deductible. With UMPD, your deductible is typically lower ($250 vs $500-$1,000), and it doesn't count against your collision claims history. It's designed specifically for these situations."
      }
    ],
    recommendedLimits: [
      {
        level: 'minimum',
        value: '$25,000',
        description: 'State minimum, covers most vehicles'
      },
      {
        level: 'better',
        value: '$50,000',
        description: 'Better protection for newer vehicles'
      },
      {
        level: 'best',
        value: '$100,000',
        description: 'Maximum protection available'
      }
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
  }
];

// Sample policy for demonstration
const samplePolicy: Policy = {
  policyNumber: 'TXA-2024-1234567',
  carrier: 'Progressive Insurance',
  effectiveDate: '2024-07-15',
  expirationDate: '2025-01-15',
  premium: 1850,
  type: 'auto',
  coverages: sampleCoverages
};

export default function CoverageDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Coverage Screen Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Agent-focused coverage view with talking points, objection handling, and real-world examples
          </p>
        </div>

        <CoverageScreen policy={samplePolicy} />
      </div>
    </div>
  );
}
