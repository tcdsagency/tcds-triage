'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Phone,
  Users,
  FileText,
  ClipboardList,
  MessageSquare,
  BarChart3,
  GraduationCap,
  Building2,
  Settings,
  Home,
  UserPlus,
  Plus,
  Sparkles,
  Brain,
  CreditCard,
  FileSearch,
  ShieldAlert,
  IdCard,
  Target,
  Receipt,
  Star,
  Headphones,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Tasks', href: '/ai-tasks', icon: Brain },
  { name: 'Triage Queue', href: '/triage', icon: ClipboardList },
  { name: 'Lead Queue', href: '/leads', icon: UserPlus },
  { name: 'Calls', href: '/calls', icon: Phone },
  { name: 'Supervisor', href: '/supervisor', icon: Headphones },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Quotes', href: '/quotes', icon: FileText },
  { name: 'Quote Extractor', href: '/quote-extractor', icon: FileSearch },
  { name: 'Messages', href: '/messages', icon: MessageSquare },
  { name: 'Properties', href: '/properties', icon: Home },
  { name: 'ID Cards', href: '/id-cards', icon: IdCard },
  { name: 'Invoice', href: '/invoice', icon: Receipt },
  { name: 'Reviews', href: '/reviews', icon: Star },
  { name: 'Risk Monitor', href: '/risk-monitor', icon: ShieldAlert },
  { name: 'Payment Advance', href: '/payment-advance', icon: CreditCard },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Competitive Intel', href: '/competitive-intel', icon: Target },
  { name: 'Training', href: '/training', icon: GraduationCap },
];

const secondaryNavigation = [
  { name: 'Agency Settings', href: '/agency-settings', icon: Building2 },
  { name: 'My Settings', href: '/my-settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

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
          New AI Quote
        </Link>

        {/* Main Navigation */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <ul role="list" className="-mx-2 space-y-1">
                {navigation.map((item) => {
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

            {/* Secondary Navigation */}
            <li className="mt-auto">
              <ul role="list" className="-mx-2 space-y-1">
                {secondaryNavigation.map((item) => {
                  const isActive = pathname === item.href;
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
          </ul>
        </nav>
      </div>
    </div>
  );
}
