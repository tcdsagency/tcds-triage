/**
 * Feature Permissions Configuration
 * Define all toggleable features and their defaults
 */

export interface FeatureConfig {
  key: string;
  label: string;
  description: string;
  category: 'core' | 'advanced' | 'admin';
  defaultEnabled: boolean;
}

export const FEATURES: FeatureConfig[] = [
  // Core Features
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Main dashboard with overview and stats',
    category: 'core',
    defaultEnabled: true,
  },
  {
    key: 'pendingReview',
    label: 'Pending Review',
    description: 'Review calls, messages, and leads awaiting action',
    category: 'core',
    defaultEnabled: true,
  },
  {
    key: 'afterHours',
    label: 'After Hours',
    description: 'Handle after-hours calls and messages',
    category: 'core',
    defaultEnabled: true,
  },
  {
    key: 'messages',
    label: 'Messages',
    description: 'SMS messaging with customers',
    category: 'core',
    defaultEnabled: true,
  },
  {
    key: 'calls',
    label: 'Calls',
    description: 'View call history and recordings',
    category: 'core',
    defaultEnabled: true,
  },
  {
    key: 'customers',
    label: 'Customers',
    description: 'View and manage customer profiles',
    category: 'core',
    defaultEnabled: true,
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Lead management and follow-up',
    category: 'core',
    defaultEnabled: true,
  },
  {
    key: 'quotes',
    label: 'Quotes',
    description: 'Create and manage insurance quotes',
    category: 'core',
    defaultEnabled: true,
  },

  // Advanced Features
  {
    key: 'canopyConnect',
    label: 'Canopy Connect',
    description: 'Policy import via Canopy Connect',
    category: 'advanced',
    defaultEnabled: true,
  },
  {
    key: 'competitiveIntel',
    label: 'Competitive Intel',
    description: 'Competitor rate analysis tools',
    category: 'advanced',
    defaultEnabled: true,
  },
  {
    key: 'riskMonitor',
    label: 'Risk Monitor',
    description: 'Property risk monitoring with Nearmap',
    category: 'advanced',
    defaultEnabled: true,
  },
  {
    key: 'quoteExtractor',
    label: 'Quote Extractor',
    description: 'Extract data from quote documents',
    category: 'advanced',
    defaultEnabled: true,
  },
  {
    key: 'reports',
    label: 'Reports',
    description: 'Analytics and reporting',
    category: 'advanced',
    defaultEnabled: true,
  },
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'Invoice processing',
    category: 'advanced',
    defaultEnabled: true,
  },

  // Admin Features
  {
    key: 'settings',
    label: 'Settings',
    description: 'Personal settings and preferences',
    category: 'admin',
    defaultEnabled: true,
  },
  {
    key: 'adminSettings',
    label: 'Admin Settings',
    description: 'Agency-wide settings and user management',
    category: 'admin',
    defaultEnabled: false,
  },
  {
    key: 'userManagement',
    label: 'User Management',
    description: 'Create and manage users',
    category: 'admin',
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
  // Admins and owners have access to everything
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
