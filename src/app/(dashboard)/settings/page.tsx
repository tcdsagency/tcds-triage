"use client";

import Link from "next/link";
import {
  Users,
  Building2,
  Link2,
  Bell,
  Shield,
  Server,
  ChevronRight,
} from "lucide-react";

const settingsSections = [
  {
    title: "User Management",
    description: "Add, edit, and manage team members",
    href: "/settings/users",
    icon: Users,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Agency Settings",
    description: "Business hours, timezone, and general settings",
    href: "/agency-settings",
    icon: Building2,
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "Integrations",
    description: "Connect AgencyZoom, 3CX, Twilio, and more",
    href: "/api-keys",
    icon: Link2,
    color: "bg-green-100 text-green-600",
    badge: "API Keys",
  },
  {
    title: "VM Bridge",
    description: "Monitor 3CX bridge status and WebSocket connection",
    href: "/settings/bridge",
    icon: Server,
    color: "bg-cyan-100 text-cyan-600",
  },
  {
    title: "Notifications",
    description: "Configure alerts and notification preferences",
    href: "/my-settings",
    icon: Bell,
    color: "bg-amber-100 text-amber-600",
    disabled: true,
    badge: "Coming Soon",
  },
  {
    title: "Security",
    description: "Passwords, two-factor auth, and access controls",
    href: "/settings/security",
    icon: Shield,
    color: "bg-red-100 text-red-600",
    disabled: true,
    badge: "Coming Soon",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage your agency settings and preferences
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const content = (
            <div
              className={`
                bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700
                p-5 flex items-start gap-4 transition-all
                ${section.disabled
                  ? "opacity-60 cursor-not-allowed"
                  : "hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm cursor-pointer"
                }
              `}
            >
              <div className={`p-3 rounded-lg ${section.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {section.title}
                  </h3>
                  {section.badge && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {section.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {section.description}
                </p>
              </div>
              {!section.disabled && (
                <ChevronRight className="w-5 h-5 text-gray-400 mt-1" />
              )}
            </div>
          );

          if (section.disabled) {
            return <div key={section.title}>{content}</div>;
          }

          return (
            <Link key={section.title} href={section.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
