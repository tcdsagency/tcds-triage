/**
 * Feature Permissions Configuration
 * Define all toggleable features/pages and their defaults
 */

export interface FeatureConfig {
  key: string;
  label: string;
  description: string;
  category: 'core' | 'tools' | 'advanced' | 'admin';
  defaultEnabled: boolean;
  route?: string; // Optional route path for navigation blocking
}

export const FEATURES: FeatureConfig[] = [
  // =============================================================================
  // CORE FEATURES - Essential daily workflow
  // =============================================================================
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Main dashboard with overview and stats',
    category: 'core',
    defaultEnabled: true,
    route: '/dashboard',
  },
  {
    key: 'pendingReview',
    label: 'Pending Review',
    description: 'Review calls, messages, and leads awaiting action',
    category: 'core',
    defaultEnabled: true,
    route: '/pending-review',
  },
  {
    key: 'afterHours',
    label: 'After Hours',
    description: 'Handle after-hours calls and messages',
    category: 'core',
    defaultEnabled: true,
    route: '/after-hours',
  },
  {
    key: 'messages',
    label: 'Messages',
    description: 'SMS messaging with customers',
    category: 'core',
    defaultEnabled: true,
    route: '/messages',
  },
  {
    key: 'calls',
    label: 'Calls',
    description: 'View call history and recordings',
    category: 'core',
    defaultEnabled: true,
    route: '/calls',
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'View and manage customer profiles',
    category: 'core',
    defaultEnabled: true,
    route: '/customers',
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Lead management and follow-up',
    category: 'core',
    defaultEnabled: true,
    route: '/leads',
  },
  {
    key: 'quotes',
    label: 'Quotes',
    description: 'Create and manage insurance quotes',
    category: 'core',
    defaultEnabled: true,
    route: '/quotes',
  },
  {
    key: 'policyNotices',
    label: 'Policy Notices',
    description: 'Cancellation and payment due notices',
    category: 'core',
    defaultEnabled: true,
    route: '/policy-notices',
  },

  // =============================================================================
  // TOOLS - Productivity and workflow tools
  // =============================================================================
  {
    key: 'invoice',
    label: 'Invoice Generator',
    description: 'Create and process invoices',
    category: 'tools',
    defaultEnabled: true,
    route: '/invoice',
  },
  {
    key: 'policyChange',
    label: 'Policy Change',
    description: 'Process policy change requests',
    category: 'tools',
    defaultEnabled: true,
    route: '/policy-change',
  },
  {
    key: 'idCards',
    label: 'ID Cards',
    description: 'Generate insurance ID cards',
    category: 'tools',
    defaultEnabled: true,
    route: '/id-cards',
  },
  {
    key: 'birthdayCards',
    label: 'Birthday Cards',
    description: 'Send birthday greetings to customers',
    category: 'tools',
    defaultEnabled: true,
    route: '/birthday-cards',
  },
  {
    key: 'mortgageePayments',
    label: 'Mortgagee Payments',
    description: 'Process mortgagee payment requests',
    category: 'tools',
    defaultEnabled: true,
    route: '/mortgagee-payments',
  },
  {
    key: 'paymentAdvance',
    label: 'Payment Advance',
    description: 'Process payment advance requests',
    category: 'tools',
    defaultEnabled: true,
    route: '/payment-advance',
  },
  {
    key: 'sameDayPayment',
    label: 'Same Day Payment',
    description: 'Process same-day payment requests',
    category: 'tools',
    defaultEnabled: true,
    route: '/same-day-payment',
  },
  {
    key: 'quoteExtractor',
    label: 'Quote Extractor',
    description: 'Extract data from quote documents',
    category: 'tools',
    defaultEnabled: true,
    route: '/quote-extractor',
  },
  {
    key: 'canopyConnect',
    label: 'Canopy Connect',
    description: 'Policy import via Canopy Connect',
    category: 'tools',
    defaultEnabled: true,
    route: '/canopy-connect',
  },

  // =============================================================================
  // ADVANCED - Analytics and monitoring features
  // =============================================================================
  {
    key: 'competitiveIntel',
    label: 'Competitive Intel',
    description: 'Competitor rate analysis tools',
    category: 'advanced',
    defaultEnabled: true,
    route: '/competitive-intel',
  },
  {
    key: 'riskMonitor',
    label: 'Risk Monitor',
    description: 'Property risk monitoring with Nearmap',
    category: 'advanced',
    defaultEnabled: true,
    route: '/risk-monitor',
  },
  {
    key: 'properties',
    label: 'Properties',
    description: 'View and manage property data',
    category: 'advanced',
    defaultEnabled: true,
    route: '/properties',
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Analytics and reporting',
    category: 'advanced',
    defaultEnabled: true,
    route: '/reports',
  },
  {
    key: 'reviews',
    label: 'Google Reviews',
    description: 'Manage Google review requests',
    category: 'advanced',
    defaultEnabled: true,
    route: '/reviews',
  },
  {
    key: 'aiTasks',
    label: 'AI Tasks',
    description: 'AI-powered automation tasks',
    category: 'advanced',
    defaultEnabled: true,
    route: '/ai-tasks',
  },
  {
    key: 'training',
    label: 'Training',
    description: 'Training materials and resources',
    category: 'advanced',
    defaultEnabled: true,
    route: '/training',
  },

  // =============================================================================
  // SUPERVISOR/ADMIN - Management and settings
  // =============================================================================
  {
    key: 'supervisor',
    label: 'Supervisor',
    description: 'Supervisor dashboard and team management',
    category: 'admin',
    defaultEnabled: false,
    route: '/supervisor',
  },
  {
    key: 'wrapupReview',
    label: 'Wrapup Review',
    description: 'Review call wrapups and agent performance',
    category: 'admin',
    defaultEnabled: false,
    route: '/wrapup-review',
  },
  {
    key: 'mySettings',
    label: 'My Settings',
    description: 'Personal settings and preferences',
    category: 'admin',
    defaultEnabled: true,
    route: '/my-settings',
  },
  {
    key: 'agencySettings',
    label: 'Agency Settings',
    description: 'Agency-wide configuration',
    category: 'admin',
    defaultEnabled: false,
    route: '/agency-settings',
  },
  {
    key: 'userManagement',
    label: 'User Management',
    description: 'Create and manage users',
    category: 'admin',
    defaultEnabled: false,
    route: '/settings/users',
  },

  // =============================================================================
  // SPECIAL FEATURES - Non-page features
  // =============================================================================
  {
    key: 'pendingReviewAlerts',
    label: 'Pending Review Alerts',
    description: 'Audio alert when items wait > 90 seconds',
    category: 'advanced',
    defaultEnabled: false,
  },
];

// Get default permissions object
export function getDefaultPermissions(): Record<string, boolean> {
  return FEATURES.reduce((acc, feature) => {
    acc[feature.key] = feature.defaultEnabled;
    return acc;
  }, {} as Record<string, boolean>);
}

// Check if a user has access to a feature
export function hasFeatureAccess(
  featureKey: string,
  userPermissions?: Record<string, boolean> | null,
  userRole?: string
): boolean {
  // Admins have access to everything
  if (userRole === 'admin' || userRole === 'owner') {
    return true;
  }

  // If no permissions set, use defaults
  if (!userPermissions) {
    const feature = FEATURES.find(f => f.key === featureKey);
    return feature?.defaultEnabled ?? false;
  }

  // Check specific permission
  if (featureKey in userPermissions) {
    return userPermissions[featureKey];
  }

  // Fall back to default
  const feature = FEATURES.find(f => f.key === featureKey);
  return feature?.defaultEnabled ?? false;
}

// Check if user can access a route
export function canAccessRoute(
  route: string,
  userPermissions?: Record<string, boolean> | null,
  userRole?: string
): boolean {
  // Admins can access everything
  if (userRole === 'admin' || userRole === 'owner') {
    return true;
  }

  // Find feature by route
  const feature = FEATURES.find(f => f.route && route.startsWith(f.route));
  if (!feature) {
    return true; // Allow access to routes not in the list
  }

  return hasFeatureAccess(feature.key, userPermissions, userRole);
}

// Get feature key from route
export function getFeatureKeyFromRoute(route: string): string | null {
  const feature = FEATURES.find(f => f.route && route.startsWith(f.route));
  return feature?.key ?? null;
}

// Group features by category
export function getFeaturesByCategory(): Record<string, FeatureConfig[]> {
  return FEATURES.reduce((acc, feature) => {
    if (!acc[feature.category]) {
      acc[feature.category] = [];
    }
    acc[feature.category].push(feature);
    return acc;
  }, {} as Record<string, FeatureConfig[]>);
}

// Get category display name
export function getCategoryDisplayName(category: string): string {
  switch (category) {
    case 'core': return 'Core Features';
    case 'tools': return 'Tools';
    case 'advanced': return 'Advanced Features';
    case 'admin': return 'Admin & Supervisor';
    default: return category;
  }
}
