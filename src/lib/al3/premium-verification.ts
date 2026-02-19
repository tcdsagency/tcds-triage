/**
 * Premium Verification
 * ====================
 * Cross-checks AL3-parsed renewal premium against HawkSoft Cloud API's
 * rate change history. Catches parsing errors (bundled Allstate, EDIFACT
 * issues) that would otherwise go undetected.
 */

import { getHawkSoftHiddenClient } from '@/lib/api/hawksoft-hidden';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { PremiumVerification } from '@/types/renewal.types';

/**
 * Parse MM/DD/YYYY or YYYY-MM-DD to YYYY-MM-DD for comparison.
 */
function normalizeDate(dateStr: string): string {
  // If already YYYY-MM-DD or ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0];
  }
  // MM/DD/YYYY
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  return dateStr;
}

/**
 * Verify a renewal premium against HawkSoft Cloud rate change history.
 *
 * Returns null if verification is not possible (no UUID, no matching policy,
 * no rate change entry). Returns PremiumVerification with match/mismatch details
 * if the data is available.
 */
export async function verifyRenewalPremium(params: {
  policyNumber: string;
  effectiveDate: string;
  al3Premium: number | undefined;
  customerId: string;
  hawksoftClientCode: string | null;
  customerLastName: string;
}): Promise<PremiumVerification | null> {
  const { policyNumber, effectiveDate, al3Premium, customerId, hawksoftClientCode, customerLastName } = params;

  if (!hawksoftClientCode) {
    return null;
  }

  let hiddenClient;
  try {
    hiddenClient = getHawkSoftHiddenClient();
  } catch {
    // Hidden API not configured
    return null;
  }

  // 1. Resolve cloud UUID (needed for rate change history endpoint)
  const uuid = await hiddenClient.resolveCloudUuid(hawksoftClientCode, customerLastName);
  if (!uuid) {
    return null;
  }

  // 2. Get client with policies (uses client number)
  const clientNum = parseInt(hawksoftClientCode, 10);
  if (isNaN(clientNum)) {
    return null;
  }

  let client;
  try {
    client = await hiddenClient.getClient(clientNum);
  } catch (error) {
    console.error('[PremiumVerification] Failed to get client:', error);
    return null;
  }

  if (!client.policies?.length) {
    return null;
  }

  // 3. Find matching policy by number
  const matchingPolicy = client.policies.find(
    (p) => p.number === policyNumber
  );
  if (!matchingPolicy) {
    return null;
  }

  // 4. Get rate change history (uses UUID + policy hex ID)
  let rateChanges;
  try {
    rateChanges = await hiddenClient.getRateChangeHistory(uuid, matchingPolicy.id);
  } catch (error) {
    console.error('[PremiumVerification] Failed to get rate change history:', error);
    return null;
  }

  if (!rateChanges?.length) {
    return null;
  }

  // 5. Find matching rate change entry
  const normalizedEffective = normalizeDate(effectiveDate);

  const matchingEntry = rateChanges.find((rc) => {
    const rcDate = normalizeDate(rc.effective);
    return rcDate === normalizedEffective && (rc.al3_type === 40 || rc.al3_type === 41);
  });

  if (!matchingEntry) {
    return null;
  }

  // 6. Compare premiums
  const hiddenApiPremium = matchingEntry.premium_amt;
  const TOLERANCE = 5; // $5

  let premiumMatch = false;
  let discrepancy: number | undefined;
  let discrepancyPercent: number | undefined;

  if (al3Premium != null && hiddenApiPremium != null) {
    discrepancy = Math.abs(al3Premium - hiddenApiPremium);
    premiumMatch = discrepancy <= TOLERANCE;

    if (hiddenApiPremium > 0) {
      discrepancyPercent = (discrepancy / hiddenApiPremium) * 100;
    }
  } else if (al3Premium == null && hiddenApiPremium != null) {
    premiumMatch = false;
    discrepancy = hiddenApiPremium;
  } else {
    premiumMatch = true;
  }

  return {
    al3Premium,
    hiddenApiPremium,
    premiumMatch,
    discrepancy,
    discrepancyPercent,
    rateChangeEffective: matchingEntry.effective,
    rateChangePremiumChg: matchingEntry.premium_amt_chg,
    rateChangePctChg: matchingEntry.premium_pct_chg,
    verifiedAt: new Date().toISOString(),
  };
}
