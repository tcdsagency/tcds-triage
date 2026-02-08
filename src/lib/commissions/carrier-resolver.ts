/**
 * Carrier Resolver
 * Resolves carrier names from CSV data against the commission carriers table.
 * Uses exact match, then alias lookup, then normalized fuzzy match.
 */

import { db } from '@/db';
import { commissionCarriers, commissionCarrierAliases } from '@/db/schema';
import { eq } from 'drizzle-orm';

interface ResolvedCarrier {
  id: string;
  name: string;
  matchType: 'exact' | 'alias' | 'normalized' | 'none';
}

/**
 * Normalize a carrier name for fuzzy comparison
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/insurance|ins|company|co|corp|corporation|group|grp|llc|inc/g, '');
}

/**
 * Resolve a carrier name to a commission carrier record.
 */
export async function resolveCarrier(
  tenantId: string,
  carrierName: string
): Promise<ResolvedCarrier> {
  if (!carrierName?.trim()) {
    return { id: '', name: carrierName, matchType: 'none' };
  }

  const trimmed = carrierName.trim();

  // 1. Exact name match
  const carriers = await db
    .select()
    .from(commissionCarriers)
    .where(eq(commissionCarriers.tenantId, tenantId));

  const exactMatch = carriers.find(
    (c) => c.name.toLowerCase() === trimmed.toLowerCase()
  );
  if (exactMatch) {
    return { id: exactMatch.id, name: exactMatch.name, matchType: 'exact' };
  }

  // 2. Alias match
  const aliases = await db
    .select()
    .from(commissionCarrierAliases)
    .where(eq(commissionCarrierAliases.tenantId, tenantId));

  const aliasMatch = aliases.find(
    (a) => a.alias.toLowerCase() === trimmed.toLowerCase()
  );
  if (aliasMatch) {
    const carrier = carriers.find((c) => c.id === aliasMatch.carrierId);
    if (carrier) {
      return { id: carrier.id, name: carrier.name, matchType: 'alias' };
    }
  }

  // 3. Normalized match
  const normalizedInput = normalize(trimmed);
  const normalizedMatch = carriers.find(
    (c) => normalize(c.name) === normalizedInput
  );
  if (normalizedMatch) {
    return { id: normalizedMatch.id, name: normalizedMatch.name, matchType: 'normalized' };
  }

  return { id: '', name: carrierName, matchType: 'none' };
}

/**
 * Batch resolve carrier names. Returns a map of input name -> resolved carrier.
 */
export async function resolveCarriers(
  tenantId: string,
  carrierNames: string[]
): Promise<Map<string, ResolvedCarrier>> {
  const results = new Map<string, ResolvedCarrier>();
  const unique = [...new Set(carrierNames.filter(Boolean))];

  // Load all carriers and aliases once
  const carriers = await db
    .select()
    .from(commissionCarriers)
    .where(eq(commissionCarriers.tenantId, tenantId));

  const aliases = await db
    .select()
    .from(commissionCarrierAliases)
    .where(eq(commissionCarrierAliases.tenantId, tenantId));

  for (const name of unique) {
    const trimmed = name.trim();

    // Exact match
    const exactMatch = carriers.find(
      (c) => c.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) {
      results.set(name, { id: exactMatch.id, name: exactMatch.name, matchType: 'exact' });
      continue;
    }

    // Alias match
    const aliasMatch = aliases.find(
      (a) => a.alias.toLowerCase() === trimmed.toLowerCase()
    );
    if (aliasMatch) {
      const carrier = carriers.find((c) => c.id === aliasMatch.carrierId);
      if (carrier) {
        results.set(name, { id: carrier.id, name: carrier.name, matchType: 'alias' });
        continue;
      }
    }

    // Normalized match
    const normalizedInput = normalize(trimmed);
    const normalizedMatch = carriers.find(
      (c) => normalize(c.name) === normalizedInput
    );
    if (normalizedMatch) {
      results.set(name, { id: normalizedMatch.id, name: normalizedMatch.name, matchType: 'normalized' });
      continue;
    }

    results.set(name, { id: '', name, matchType: 'none' });
  }

  return results;
}
