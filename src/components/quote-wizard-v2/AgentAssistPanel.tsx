'use client';

/**
 * Agent Assist Panel
 * ==================
 * TurboTax-style contextual tips sidebar for quote wizards.
 * Shows relevant tips based on the current step.
 */

import { useMemo } from 'react';
import {
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Info,
  User,
  Car,
  Shield,
  CreditCard,
  FileText,
  GraduationCap,
  Home,
  Phone,
  Clock,
  Zap,
  DollarSign,
  BadgeCheck,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type TipType = 'info' | 'warning' | 'success' | 'upsell';

interface Tip {
  icon: React.ReactNode;
  title: string;
  description: string;
  type: TipType;
}

interface AgentAssistPanelProps {
  currentStepId: string;
  quoteType?: string;
}

const typeColors = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700',
    icon: 'text-blue-600 dark:text-blue-400',
    title: 'text-blue-900 dark:text-blue-100',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700',
    icon: 'text-amber-600 dark:text-amber-400',
    title: 'text-amber-900 dark:text-amber-100',
  },
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700',
    icon: 'text-emerald-600 dark:text-emerald-400',
    title: 'text-emerald-900 dark:text-emerald-100',
  },
  upsell: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-700',
    icon: 'text-purple-600 dark:text-purple-400',
    title: 'text-purple-900 dark:text-purple-100',
  },
};

const tipsByStep: Record<string, Tip[]> = {
  contact: [
    {
      icon: <BadgeCheck className="w-5 h-5" />,
      title: 'Verify Customer Identity',
      description: 'Confirm name spelling and date of birth match their ID to avoid issues at binding.',
      type: 'info',
    },
    {
      icon: <Phone className="w-5 h-5" />,
      title: 'Get Preferred Contact Method',
      description: 'Ask if they prefer calls, texts, or email for policy updates and renewal reminders.',
      type: 'info',
    },
    {
      icon: <Home className="w-5 h-5" />,
      title: 'Bundle & Save Opportunity',
      description: 'If they own their home, they may qualify for multi-policy discounts up to 25%.',
      type: 'upsell',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'License State Matters',
      description: 'License must be from the state where the vehicle is garaged for accurate rating.',
      type: 'warning',
    },
  ],
  vehicles: [
    {
      icon: <Car className="w-5 h-5" />,
      title: 'VIN Lookup Saves Time',
      description: 'Enter the VIN to auto-fill year, make, model, and safety features.',
      type: 'info',
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: 'Ask About Vehicle Usage',
      description: 'Commute vs. pleasure use can significantly impact premium. Verify daily mileage.',
      type: 'info',
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Multi-Car Discount Available',
      description: 'Adding a second vehicle often qualifies for 10-25% multi-car discount.',
      type: 'upsell',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Verify Ownership',
      description: 'Confirm if vehicle is owned, financed, or leased. Lienholders require full coverage.',
      type: 'warning',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Annual Mileage Impacts Rate',
      description: 'Under 7,500 miles/year may qualify for low-mileage discount.',
      type: 'success',
    },
  ],
  drivers: [
    {
      icon: <User className="w-5 h-5" />,
      title: 'List ALL Household Drivers',
      description: 'Include everyone with access to vehicles, even occasional drivers. Unlisted drivers may not be covered.',
      type: 'warning',
    },
    {
      icon: <GraduationCap className="w-5 h-5" />,
      title: 'Good Student Discount',
      description: 'Drivers under 25 with B average or better (3.0 GPA) qualify for up to 15% discount.',
      type: 'upsell',
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      title: 'Defensive Driving Course',
      description: 'Completed defensive driving course in last 3 years? May qualify for additional discount.',
      type: 'success',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'License Status Matters',
      description: 'Suspended, revoked, or international licenses may require additional documentation.',
      type: 'warning',
    },
    {
      icon: <Info className="w-5 h-5" />,
      title: 'Accidents & Violations',
      description: 'Disclose all incidents in past 3-5 years. Undisclosed claims can void coverage.',
      type: 'info',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Years Licensed Discount',
      description: 'Drivers with 5+ years experience typically get better rates.',
      type: 'success',
    },
  ],
  coverage: [
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Recommend Higher Liability Limits',
      description: '100/300 is recommended minimum. Assets over $100k should consider 250/500 or umbrella.',
      type: 'info',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'UM/UIM is Critical',
      description: '1 in 8 drivers is uninsured. UM/UIM protects you and passengers if hit by uninsured driver.',
      type: 'warning',
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Comp/Coll by Vehicle Value',
      description: 'For vehicles worth less than $3,000, comp/collision may not be cost-effective.',
      type: 'info',
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      title: 'Roadside is Great Value',
      description: 'Typically $2-3/month. Covers towing, flat tires, lockouts, and jump starts.',
      type: 'upsell',
    },
    {
      icon: <Car className="w-5 h-5" />,
      title: 'Rental Car Reimbursement',
      description: 'If customer relies on their car for work, rental coverage prevents major inconvenience.',
      type: 'upsell',
    },
    {
      icon: <Heart className="w-5 h-5" />,
      title: 'Medical Payments Coverage',
      description: 'MedPay covers medical bills regardless of fault. Great for customers without health insurance.',
      type: 'info',
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      title: 'Gap Insurance for Financed Vehicles',
      description: 'If loan balance exceeds vehicle value, gap insurance covers the difference in a total loss.',
      type: 'upsell',
    },
  ],
  property: [
    {
      icon: <Home className="w-5 h-5" />,
      title: 'RPR Auto-Fill Available',
      description: 'Use the Auto-Fill button to populate property details from public records.',
      type: 'info',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Verify Property Type',
      description: 'Condo vs. townhome vs. single family affects coverage needs and pricing significantly.',
      type: 'warning',
    },
    {
      icon: <Info className="w-5 h-5" />,
      title: 'Prior Address Required',
      description: 'If at current address less than 2 years, prior address is needed for accurate rating.',
      type: 'info',
    },
  ],
  details: [
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Safety Features = Savings',
      description: 'Security systems, deadbolts, and fire alarms can earn discounts of 5-15%.',
      type: 'success',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Roof Age is Critical',
      description: 'Roofs over 20 years old may need inspection. Some carriers decline roofs over 25 years.',
      type: 'warning',
    },
    {
      icon: <Info className="w-5 h-5" />,
      title: 'System Updates Matter',
      description: 'Updated electrical, plumbing, and heating can reduce premiums and improve eligibility.',
      type: 'info',
    },
  ],
  homeCoverage: [
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Dwelling Coverage = Rebuild Cost',
      description: 'Set dwelling limit to full rebuild cost, not market value. Include labor and materials.',
      type: 'info',
    },
    {
      icon: <DollarSign className="w-5 h-5" />,
      title: 'Higher Deductible = Lower Premium',
      description: 'Increasing deductible from $1,000 to $2,500 can save 10-20% on premium.',
      type: 'info',
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      title: 'Water Backup Coverage',
      description: 'Standard policies exclude sewer/drain backup. This endorsement is highly recommended.',
      type: 'upsell',
    },
  ],
  business: [
    {
      icon: <Info className="w-5 h-5" />,
      title: 'FEIN Required for WC',
      description: 'Workers compensation requires a valid Federal Employer Identification Number.',
      type: 'info',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Accurate Revenue Matters',
      description: 'Premiums are often based on revenue. Underreporting can void coverage at claim time.',
      type: 'warning',
    },
  ],
  underlying: [
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Minimum Underlying Limits',
      description: 'Most umbrella carriers require at least 250/500 auto and 300k home liability.',
      type: 'warning',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Pool Increases Risk',
      description: 'Swimming pools increase liability exposure. Fencing can help with eligibility.',
      type: 'info',
    },
  ],
  umbrellaCoverage: [
    {
      icon: <Shield className="w-5 h-5" />,
      title: '$1M is the Starting Point',
      description: 'Recommend coverage equal to net worth. Additional $1M increments are very affordable.',
      type: 'info',
    },
  ],
  floodDetails: [
    {
      icon: <Info className="w-5 h-5" />,
      title: 'Elevation Certificate Saves Money',
      description: 'An elevation certificate can significantly reduce flood insurance premiums.',
      type: 'success',
    },
  ],
  employees: [
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Accurate Payroll is Essential',
      description: 'WC premiums are based on payroll. Audits will adjust the final premium based on actual payroll.',
      type: 'warning',
    },
    {
      icon: <Info className="w-5 h-5" />,
      title: 'Experience Mod Impact',
      description: 'Experience modifier below 1.0 = discount. Above 1.0 = surcharge. Check with NCCI.',
      type: 'info',
    },
  ],
  review: [
    {
      icon: <FileText className="w-5 h-5" />,
      title: 'Review Coverage with Customer',
      description: 'Walk through each coverage and explain what it protects. Ensure they understand deductibles.',
      type: 'info',
    },
    {
      icon: <CreditCard className="w-5 h-5" />,
      title: 'Payment Options Available',
      description: 'Offer pay-in-full discount (typically 5-10%) or monthly payment plans.',
      type: 'success',
    },
    {
      icon: <Clock className="w-5 h-5" />,
      title: 'Effective Date Matters',
      description: 'Ensure no lapse in coverage. If switching carriers, align effective dates to avoid gaps.',
      type: 'warning',
    },
    {
      icon: <AlertTriangle className="w-5 h-5" />,
      title: 'Prior Insurance Required',
      description: 'Most carriers require proof of prior coverage. Lapse over 30 days may affect rate.',
      type: 'warning',
    },
    {
      icon: <CheckCircle className="w-5 h-5" />,
      title: 'Set Renewal Reminder',
      description: 'Note the renewal date and set a reminder to review coverage 45 days before expiration.',
      type: 'success',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Cross-Sell Opportunity',
      description: 'Good time to mention home, umbrella, or life insurance needs.',
      type: 'upsell',
    },
  ],
};

export function AgentAssistPanel({ currentStepId }: AgentAssistPanelProps) {
  const tips = useMemo(() => {
    return tipsByStep[currentStepId] || [];
  }, [currentStepId]);

  if (tips.length === 0) return null;

  return (
    <div className="sticky top-24 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            Agent Assist
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tips for this step
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {tips.map((tip, index) => (
          <TipCard key={index} tip={tip} />
        ))}
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <a
          href="/training"
          className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          <FileText className="w-4 h-4" />
          View knowledge base
        </a>
      </div>
    </div>
  );
}

function TipCard({ tip }: { tip: Tip }) {
  const colors = typeColors[tip.type];

  return (
    <div
      className={cn(
        'p-3 rounded-lg border transition-all hover:shadow-sm',
        colors.bg,
        colors.border
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5', colors.icon)}>
          {tip.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={cn('text-sm font-medium', colors.title)}>
            {tip.title}
          </h4>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {tip.description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default AgentAssistPanel;
