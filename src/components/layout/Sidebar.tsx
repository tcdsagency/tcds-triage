'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { hasSupervisorAccess, hasAgencySettingsAccess } from '@/lib/permissions';
import { hasFeatureAccess, getDefaultPermissions } from '@/lib/feature-permissions';
import {
  LayoutDashboard,
  Phone,
  Users,
  FileText,
  ClipboardList,
  MessageSquare,
  Building2,
  Settings,
  Home,
  UserPlus,
  Sparkles,
  CreditCard,
  Zap,
  FileSearch,
  ShieldAlert,
  IdCard,
  Receipt,
  Star,
  Headphones,
  FilePen,
  ClipboardCheck,
  Bell,
  Link2,
  Moon,
} from 'lucide-react';

// Map routes to feature permission keys
const ROUTE_FEATURE_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/pending-review': 'pendingReview',
  '/after-hours': 'afterHours',
  '/leads': 'leads',
  '/calls': 'calls',
  '/messages': 'messages',
  '/customers': 'customers',
  '/quotes': 'quotes',
  '/quote-extractor': 'quoteExtractor',
  '/canopy-connect': 'canopyConnect',
  '/risk-monitor': 'riskMonitor',
  '/reports': 'reports',
  '/invoice': 'invoices',
  '/my-settings': 'settings',
  '/agency-settings': 'adminSettings',
  '/settings/users': 'userManagement',
};

// Dashboard section
const dashboardNav = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
];

// Intake & Reception section (base items - Supervisor added conditionally)
const getIntakeNav = (canAccessSupervisor: boolean) => {
  const baseItems = [
    { name: 'Pending Review', href: '/pending-review', icon: ClipboardCheck },
    { name: 'Lead Queue', href: '/leads', icon: UserPlus },
    { name: 'Calls', href: '/calls', icon: Phone },
  ];

  if (canAccessSupervisor) {
    baseItems.push({ name: 'Supervisor', href: '/supervisor', icon: Headphones });
  }

  baseItems.push({ name: 'Messages', href: '/messages', icon: MessageSquare });

  return baseItems;
};

// Customer Management section
const customerNav = [
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Policy Notices', href: '/policy-notices', icon: Bell },
  { name: 'Policy Change', href: '/policy-change', icon: FilePen },
  { name: 'Payment Advance', href: '/payment-advance', icon: CreditCard },
  { name: 'Same-Day Payment', href: '/same-day-payment', icon: Zap },
  { name: 'ID Cards', href: '/id-cards', icon: IdCard },
];

// Agent Tools & Resources section
const toolsNav = [
  { name: 'Quotes', href: '/quotes', icon: FileText },
  { name: 'Quote Extractor', href: '/quote-extractor', icon: FileSearch },
  { name: 'Canopy Connect', href: '/canopy-connect', icon: Link2 },
  { name: 'Properties', href: '/properties', icon: Home },
  { name: 'Invoice', href: '/invoice', icon: Receipt },
  { name: 'Reviews', href: '/reviews', icon: Star },
  { name: 'Risk Monitor', href: '/risk-monitor', icon: ShieldAlert },
  { name: 'Mortgagee Payments', href: '/mortgagee-payments', icon: CreditCard },
  // { name: 'Reports', href: '/reports', icon: BarChart3 }, // Temporarily disabled
];

// Settings section (Agency Settings conditionally added)
const getSettingsNav = (canAccessAgencySettings: boolean) => {
  const items = [];

  if (canAccessAgencySettings) {
    items.push({ name: 'Agency Settings', href: '/agency-settings', icon: Building2 });
  }

  items.push({ name: 'My Settings', href: '/my-settings', icon: Settings });

  return items;
};

interface NavItem {
  name: string;
  href: string;
  icon: any;
}

function NavSection({ title, items, className }: { title?: string; items: NavItem[]; className?: string }) {
  const pathname = usePathname();

  return (
    <li className={className}>
      {title && (
        <div className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2 mb-2">
          {title}
        </div>
      )}
      <ul role="list" className="-mx-2 space-y-1">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.name}>
              <Link
                href={item.href}
                className={cn(
                  'group flex gap-x-3 rounded-md p-2 text-sm font-medium leading-6',
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                  )}
                />
                {item.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}

export function Sidebar() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  const [featurePermissions, setFeaturePermissions] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    // Fetch current user info for role-based and feature-based access
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setUserEmail(data.user.email?.toLowerCase() || null);
          setUserRole(data.user.role);
          setFeaturePermissions(data.user.featurePermissions || null);
        }
      })
      .catch(() => {
        // Ignore errors - default to no special access
      });
  }, []);

  const canAccessSupervisor = hasSupervisorAccess(userEmail);
  const canAccessAgencySettings = hasAgencySettingsAccess(userEmail);

  // Helper to check if user can access a route
  const canAccessRoute = (href: string): boolean => {
    const featureKey = ROUTE_FEATURE_MAP[href];
    // If route not in map, allow access (for routes like /properties, /reviews, etc.)
    if (!featureKey) return true;
    return hasFeatureAccess(featureKey, featurePermissions, userRole);
  };

  const intakeNav = getIntakeNav(canAccessSupervisor).filter(item => canAccessRoute(item.href));
  const settingsNav = getSettingsNav(canAccessAgencySettings).filter(item => canAccessRoute(item.href));
  const filteredDashboardNav = dashboardNav.filter(item => canAccessRoute(item.href));
  const filteredCustomerNav = customerNav.filter(item => canAccessRoute(item.href));
  const filteredToolsNav = toolsNav.filter(item => canAccessRoute(item.href));

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 pb-4">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <Link href="/dashboard" className="flex items-center">
            <Image
              src="/tcds-logo.svg"
              alt="TCDS"
              width={120}
              height={68}
              className="h-10 w-auto"
              priority
            />
          </Link>
        </div>

        {/* New Quote Button */}
        <Link
          href="/quote/new"
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-3 rounded-xl",
            "bg-gradient-to-r from-amber-500 to-orange-600",
            "text-white font-semibold text-sm",
            "hover:from-amber-600 hover:to-orange-700",
            "transition-all duration-200 shadow-lg shadow-amber-500/20",
            "hover:shadow-xl hover:shadow-amber-500/30"
          )}
        >
          <Sparkles className="w-4 h-4" />
          New Quote
        </Link>

        {/* Main Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-6">
            {/* Dashboard */}
            {filteredDashboardNav.length > 0 && (
              <NavSection items={filteredDashboardNav} />
            )}

            {/* Intake & Reception */}
            {intakeNav.length > 0 && (
              <NavSection title="Intake & Reception" items={intakeNav} />
            )}

            {/* Customer Management */}
            {filteredCustomerNav.length > 0 && (
              <NavSection title="Customers" items={filteredCustomerNav} />
            )}

            {/* Agent Tools & Resources */}
            {filteredToolsNav.length > 0 && (
              <NavSection title="Tools & Resources" items={filteredToolsNav} />
            )}

            {/* Settings - pinned to bottom */}
            {settingsNav.length > 0 && (
              <NavSection title="Settings" items={settingsNav} className="mt-auto" />
            )}
          </ul>
        </nav>
      </div>
    </div>
  );
}
