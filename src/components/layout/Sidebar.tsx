'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { hasSupervisorAccess, hasAgencySettingsAccess } from '@/lib/permissions';
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
  FileSearch,
  ShieldAlert,
  IdCard,
  Receipt,
  Star,
  Headphones,
  FilePen,
  ClipboardCheck,
} from 'lucide-react';

// Dashboard section
const dashboardNav = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
];

// Intake & Reception section (base items - Supervisor added conditionally)
const getIntakeNav = (canAccessSupervisor: boolean) => {
  const baseItems = [
    { name: 'Triage Queue', href: '/triage', icon: ClipboardList },
    { name: 'Lead Queue', href: '/leads', icon: UserPlus },
    { name: 'Calls', href: '/calls', icon: Phone },
  ];

  if (canAccessSupervisor) {
    baseItems.push({ name: 'Supervisor', href: '/supervisor', icon: Headphones });
  }

  baseItems.push({ name: 'Messages', href: '/messages', icon: MessageSquare });
  baseItems.push({ name: 'Wrapup Review', href: '/wrapup-review', icon: ClipboardCheck });

  return baseItems;
};

// Customer Management section
const customerNav = [
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Policy Change', href: '/policy-change', icon: FilePen },
  { name: 'Payment Advance', href: '/payment-advance', icon: CreditCard },
  { name: 'ID Cards', href: '/id-cards', icon: IdCard },
];

// Agent Tools & Resources section
const toolsNav = [
  { name: 'Quotes', href: '/quotes', icon: FileText },
  { name: 'Quote Extractor', href: '/quote-extractor', icon: FileSearch },
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
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
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
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-emerald-600' : 'text-gray-400 group-hover:text-gray-600'
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

  useEffect(() => {
    // Fetch current user email for role-based access
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user?.email) {
          setUserEmail(data.user.email.toLowerCase());
        }
      })
      .catch(() => {
        // Ignore errors - default to no special access
      });
  }, []);

  const canAccessSupervisor = hasSupervisorAccess(userEmail);
  const canAccessAgencySettings = hasAgencySettingsAccess(userEmail);

  const intakeNav = getIntakeNav(canAccessSupervisor);
  const settingsNav = getSettingsNav(canAccessAgencySettings);

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white px-6 pb-4">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">TC</span>
            </div>
            <span className="text-xl font-bold text-gray-900">TCDS-Triage</span>
          </div>
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
            <NavSection items={dashboardNav} />

            {/* Intake & Reception */}
            <NavSection title="Intake & Reception" items={intakeNav} />

            {/* Customer Management */}
            <NavSection title="Customers" items={customerNav} />

            {/* Agent Tools & Resources */}
            <NavSection title="Tools & Resources" items={toolsNav} />

            {/* Settings - pinned to bottom */}
            <NavSection title="Settings" items={settingsNav} className="mt-auto" />
          </ul>
        </nav>
      </div>
    </div>
  );
}
