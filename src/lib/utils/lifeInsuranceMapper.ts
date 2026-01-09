/**
 * Life Insurance Data Mapper
 * Maps MergedProfile data to CustomerProfileData for life insurance components
 */

import { MergedProfile } from "@/types/customer-profile";
import { CustomerProfileData, Gender } from "@/types/lifeInsurance.types";

/**
 * Convert a MergedProfile to CustomerProfileData for life insurance quotes
 */
export function mapMergedProfileToLifeInsurance(
  profile: MergedProfile
): CustomerProfileData {
  // Extract gender from household or drivers if available
  let gender: Gender | undefined;

  // Try to get gender from drivers in policies
  for (const policy of profile.policies) {
    if (policy.drivers && policy.drivers.length > 0) {
      const primaryDriver = policy.drivers.find(
        (d) => d.firstName?.toLowerCase() === profile.firstName?.toLowerCase()
      );
      if (primaryDriver?.gender) {
        gender = primaryDriver.gender.toLowerCase() === "female" ? Gender.FEMALE : Gender.MALE;
        break;
      }
    }
  }

  // Calculate number of dependents from household
  const dependents = profile.household?.filter(
    (member) =>
      member.relationship?.toLowerCase().includes("child") ||
      member.relationship?.toLowerCase().includes("son") ||
      member.relationship?.toLowerCase().includes("daughter") ||
      member.relationship?.toLowerCase().includes("dependent")
  ).length || 0;

  // Extract mortgage balance if available from property policies
  let mortgageBalance: number | undefined;
  for (const policy of profile.policies) {
    if (policy.property?.address && policy.lienholders && policy.lienholders.length > 0) {
      // If they have a mortgagee, estimate balance based on property value
      // This is a rough estimate - ideally this would come from actual data
      mortgageBalance = policy.premium * 1000; // Rough estimate
      break;
    }
  }

  // Map current policies for cross-sell analysis
  const currentPolicies = profile.policies
    .filter((p) => p.status === "active")
    .map((p) => ({
      type: p.type,
      premium: p.premium,
    }));

  // Extract state from address
  const state = profile.address?.state?.toUpperCase() || "";

  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    dateOfBirth: profile.dateOfBirth,
    gender,
    state: state.length === 2 ? state : undefined,
    mortgageBalance,
    estimatedIncome: undefined, // Would need external data source
    numberOfDependents: dependents,
    currentPolicies,
    recentLifeEvents: [], // Would come from call transcripts/notes
  };
}

/**
 * Check if a customer already has life insurance
 */
export function hasLifeInsurance(profile: MergedProfile): boolean {
  return profile.policies.some(
    (p) => p.type === "life" && p.status === "active"
  );
}

/**
 * Calculate life insurance opportunity score
 * Higher score = better candidate for life insurance
 */
export function calculateOpportunityScore(profile: MergedProfile): number {
  let score = 0;

  // Already has life insurance - no opportunity
  if (hasLifeInsurance(profile)) {
    return 0;
  }

  // Has P&C policies (engaged customer)
  const activePolicies = profile.policies.filter((p) => p.status === "active").length;
  if (activePolicies > 0) {
    score += 20;
  }
  if (activePolicies >= 2) {
    score += 10;
  }

  // Has home policy (mortgage protection opportunity)
  const hasHome = profile.policies.some(
    (p) => p.type === "home" && p.status === "active"
  );
  if (hasHome) {
    score += 25;
  }

  // Has dependents
  const dependents = profile.household?.filter(
    (member) =>
      member.relationship?.toLowerCase().includes("child") ||
      member.relationship?.toLowerCase().includes("son") ||
      member.relationship?.toLowerCase().includes("daughter")
  ).length || 0;
  if (dependents > 0) {
    score += 20 + Math.min(dependents * 5, 15);
  }

  // Premium tier (higher premium = more to protect)
  if (profile.totalPremium >= 5000) {
    score += 15;
  } else if (profile.totalPremium >= 2500) {
    score += 10;
  }

  // Age factor (25-55 is optimal)
  if (profile.dateOfBirth) {
    const age = calculateAge(profile.dateOfBirth);
    if (age >= 25 && age <= 45) {
      score += 15;
    } else if (age > 45 && age <= 55) {
      score += 10;
    } else if (age > 55 && age <= 65) {
      score += 5;
    }
  }

  // Long-term customer
  if (profile.customerSince) {
    const yearsAsCustomer = calculateYearsAsCustomer(profile.customerSince);
    if (yearsAsCustomer >= 3) {
      score += 10;
    }
  }

  return Math.min(score, 100);
}

function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function calculateYearsAsCustomer(customerSince: string): number {
  const sinceDate = new Date(customerSince);
  const today = new Date();
  return Math.floor(
    (today.getTime() - sinceDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
  );
}
