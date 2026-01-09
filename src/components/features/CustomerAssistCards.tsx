"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { MergedProfile, Policy, Activity, getPolicyTypeEmoji } from "@/types/customer-profile";

interface CustomerAssistCardsProps {
  profile: MergedProfile;
  className?: string;
}

interface RenewalInfo {
  policy: Policy;
  daysUntil: number;
  urgency: "urgent" | "soon" | "upcoming";
}

// Calculate days between two dates
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

// Get upcoming renewals within 60 days
function getUpcomingRenewals(policies: Policy[]): RenewalInfo[] {
  const now = new Date();
  const renewals: RenewalInfo[] = [];

  for (const policy of policies) {
    if (policy.status !== "active") continue;

    const expirationDate = new Date(policy.expirationDate);
    const daysUntil = daysBetween(now, expirationDate);

    if (daysUntil > 0 && daysUntil <= 60) {
      renewals.push({
        policy,
        daysUntil,
        urgency: daysUntil <= 7 ? "urgent" : daysUntil <= 30 ? "soon" : "upcoming",
      });
    }
  }

  return renewals.sort((a, b) => a.daysUntil - b.daysUntil);
}

// Get significant recent activities (not just notes)
function getSignificantActivities(activities: Activity[]): Activity[] {
  const significantTypes = ["policy_change", "claim", "payment", "quote"];
  return activities
    .filter((a) => significantTypes.includes(a.type))
    .slice(0, 3);
}

// Renewal Card
function RenewalCard({ renewals }: { renewals: RenewalInfo[] }) {
  if (renewals.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-amber-600">📅</span>
        <span className="text-xs font-semibold text-amber-800 uppercase">
          Upcoming Renewals
        </span>
      </div>
      <div className="space-y-2">
        {renewals.map((renewal) => (
          <div
            key={renewal.policy.id}
            className={cn(
              "flex items-center justify-between text-sm p-2 rounded",
              renewal.urgency === "urgent" && "bg-red-100 text-red-800",
              renewal.urgency === "soon" && "bg-amber-100 text-amber-800",
              renewal.urgency === "upcoming" && "bg-gray-100 text-gray-700"
            )}
          >
            <div className="flex items-center gap-2">
              <span>{getPolicyTypeEmoji(renewal.policy.type)}</span>
              <span className="font-medium">
                {typeof renewal.policy.carrier === "string"
                  ? renewal.policy.carrier
                  : renewal.policy.carrier.name}
              </span>
            </div>
            <span
              className={cn(
                "text-xs font-bold",
                renewal.urgency === "urgent" && "text-red-700"
              )}
            >
              {renewal.daysUntil === 1
                ? "Tomorrow!"
                : renewal.daysUntil <= 7
                ? `${renewal.daysUntil} days`
                : `${renewal.daysUntil}d`}
            </span>
          </div>
        ))}
      </div>
      {renewals.some((r) => r.urgency === "urgent") && (
        <div className="mt-2 text-xs text-amber-700 flex items-center gap-1">
          <span>💡</span>
          <span>Ask: "I see your renewal is coming up - let's review your coverage"</span>
        </div>
      )}
    </div>
  );
}

// Open Tickets Card (from Donna activities or AgencyZoom)
function OpenTicketsCard({ profile }: { profile: MergedProfile }) {
  const openTickets = useMemo(() => {
    // Check Donna data for activities
    const donnaActivities = profile.donnaData?.activities || [];
    return donnaActivities
      .filter((a) => a.priority === "high" || a.type === "task")
      .slice(0, 3);
  }, [profile.donnaData]);

  if (openTickets.length === 0) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-blue-600">🎫</span>
        <span className="text-xs font-semibold text-blue-800 uppercase">
          Open Items
        </span>
        <span className="ml-auto text-xs bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full">
          {openTickets.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {openTickets.map((ticket, i) => (
          <div
            key={ticket.id || i}
            className="flex items-start gap-2 text-xs bg-white p-2 rounded border border-blue-100"
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                ticket.priority === "high" ? "bg-red-500" : "bg-blue-400"
              )}
            />
            <span className="text-gray-700 line-clamp-2">{ticket.summary}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-xs text-blue-700 flex items-center gap-1">
        <span>💡</span>
        <span>Address these open items during the call</span>
      </div>
    </div>
  );
}

// Recent Activity Card
function RecentActivityCard({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return null;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "policy_change":
        return "📝";
      case "claim":
        return "⚠️";
      case "payment":
        return "💳";
      case "quote":
        return "📋";
      default:
        return "📌";
    }
  };

  const getActivityLabel = (type: string) => {
    switch (type) {
      case "policy_change":
        return "Policy Change";
      case "claim":
        return "Claim";
      case "payment":
        return "Payment";
      case "quote":
        return "Quote";
      default:
        return type;
    }
  };

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-purple-600">📊</span>
        <span className="text-xs font-semibold text-purple-800 uppercase">
          Recent Activity
        </span>
      </div>
      <div className="space-y-1.5">
        {activities.map((activity, i) => (
          <div
            key={activity.id || i}
            className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-purple-100"
          >
            <span>{getActivityIcon(activity.type)}</span>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-700">
                {getActivityLabel(activity.type)}
              </span>
              {activity.subject && (
                <span className="text-gray-500 ml-1 truncate">
                  - {activity.subject}
                </span>
              )}
            </div>
            <span className="text-gray-400 flex-shrink-0">
              {new Date(activity.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        ))}
      </div>
      {activities.some((a) => a.type === "claim") && (
        <div className="mt-2 text-xs text-purple-700 flex items-center gap-1">
          <span>💡</span>
          <span>Recent claim - ask about their experience</span>
        </div>
      )}
    </div>
  );
}

// Donna Recommendations Card
function RecommendationsCard({ profile }: { profile: MergedProfile }) {
  const recommendations = profile.donnaData?.recommendations?.slice(0, 2) || [];

  if (recommendations.length === 0) return null;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-green-600">💡</span>
        <span className="text-xs font-semibold text-green-800 uppercase">
          Opportunities
        </span>
      </div>
      <div className="space-y-2">
        {recommendations.map((rec, i) => (
          <div
            key={rec.id || i}
            className="text-xs bg-white p-2 rounded border border-green-100"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium",
                  rec.priority === "high" && "bg-red-100 text-red-700",
                  rec.priority === "medium" && "bg-amber-100 text-amber-700",
                  rec.priority === "low" && "bg-gray-100 text-gray-700"
                )}
              >
                {rec.priority}
              </span>
              <span className="font-medium text-gray-700">{rec.title}</span>
            </div>
            <p className="text-gray-600 line-clamp-2">{rec.description}</p>
            {rec.estimatedPremium && (
              <div className="mt-1 text-green-700 font-medium">
                Est. ${rec.estimatedPremium.toLocaleString()}/yr
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomerAssistCards({
  profile,
  className,
}: CustomerAssistCardsProps) {
  const upcomingRenewals = useMemo(
    () => getUpcomingRenewals(profile.policies || []),
    [profile.policies]
  );

  const significantActivities = useMemo(
    () => getSignificantActivities(profile.recentActivity || []),
    [profile.recentActivity]
  );

  // Check if we have any content to show
  const hasContent =
    upcomingRenewals.length > 0 ||
    significantActivities.length > 0 ||
    (profile.donnaData?.activities?.length || 0) > 0 ||
    (profile.donnaData?.recommendations?.length || 0) > 0;

  if (!hasContent) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs font-semibold text-gray-500 uppercase">
          Agent Assist
        </span>
        <div className="flex-1 border-t border-gray-200" />
      </div>

      {/* Priority order: Renewals > Open Tickets > Recommendations > Recent Activity */}
      <RenewalCard renewals={upcomingRenewals} />
      <OpenTicketsCard profile={profile} />
      <RecommendationsCard profile={profile} />
      <RecentActivityCard activities={significantActivities} />
    </div>
  );
}
