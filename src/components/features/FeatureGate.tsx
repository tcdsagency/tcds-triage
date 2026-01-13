'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hasFeatureAccess } from '@/lib/feature-permissions';

interface UserData {
  role?: string;
  featurePermissions?: Record<string, boolean> | null;
}

interface FeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * FeatureGate - Protects content based on user's feature permissions
 *
 * Usage:
 * <FeatureGate featureKey="riskMonitor" redirectTo="/dashboard">
 *   <RiskMonitorPage />
 * </FeatureGate>
 */
export function FeatureGate({
  featureKey,
  children,
  fallback,
  redirectTo = '/dashboard'
}: FeatureGateProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          const user: UserData = data.user;
          const access = hasFeatureAccess(
            featureKey,
            user.featurePermissions,
            user.role
          );
          setHasAccess(access);

          if (!access && redirectTo) {
            router.replace(redirectTo);
          }
        } else {
          // Not authenticated - let auth middleware handle it
          setHasAccess(false);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setHasAccess(false);
      });
  }, [featureKey, redirectTo, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    // Return null if redirecting
    return null;
  }

  return <>{children}</>;
}

/**
 * useFeatureAccess - Hook to check feature access
 *
 * Usage:
 * const { hasAccess, loading } = useFeatureAccess('riskMonitor');
 */
export function useFeatureAccess(featureKey: string) {
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [user, setUser] = useState<UserData | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setUser(data.user);
          const access = hasFeatureAccess(
            featureKey,
            data.user.featurePermissions,
            data.user.role
          );
          setHasAccess(access);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [featureKey]);

  return { hasAccess, loading, user };
}
