/**
 * Donna AI Sync Service
 * ======================
 * Syncs Donna AI (AgencyIQ/Crux) insights to the customers table.
 *
 * Sync Strategy:
 * - Customers eligible: Must have hawksoftClientCode (for Donna ID derivation)
 * - Donna Customer ID format: TCDS-{hawksoftClientCode}
 * - Batch processing with delays to avoid rate limits
 * - Soft-fail: Skip not-found customers, continue sync
 * - Stale threshold: Re-sync records older than 24 hours
 */

import { db } from '@/db';
import { customers, syncLogs } from '@/db/schema';
import { eq, and, isNotNull, or, lt, isNull } from 'drizzle-orm';
import {
  getDonnaClient,
  getDonnaCustomerId,
  transformDonnaData,
} from './donna';
import type {
  DonnaSyncResult,
  DonnaSyncDetail,
  DonnaSyncOptions,
  DonnaCustomerData,
} from '@/types/donna.types';

// ============================================================================
// MAIN SYNC FUNCTION
// ============================================================================

/**
 * Sync Donna AI data for all eligible customers
 * Eligible: Has hawksoftClientCode (for Donna ID derivation)
 */
export async function syncFromDonna(
  options: DonnaSyncOptions
): Promise<DonnaSyncResult> {
  const startTime = Date.now();
  const result: DonnaSyncResult = {
    source: 'donna',
    synced: 0,
    skipped: 0,
    notFound: 0,
    errors: 0,
    total: 0,
    duration: 0,
    timestamp: new Date(),
    details: options.includeDetails ? [] : undefined,
  };

  const batchSize = options.batchSize || 25;
  const staleThreshold = new Date(
    Date.now() - (options.staleThresholdHours || 24) * 60 * 60 * 1000
  );

  try {
    const client = getDonnaClient();

    // Get customers eligible for Donna sync
    // Must have hawksoftClientCode to derive Donna ID
    const eligibleCustomers = await db.query.customers.findMany({
      where: and(
        eq(customers.tenantId, options.tenantId),
        isNotNull(customers.hawksoftClientCode),
        eq(customers.isArchived, false),
        // Only sync stale records (unless full sync)
        options.fullSync
          ? undefined
          : or(
              isNull(customers.lastSyncedFromDonna),
              lt(customers.lastSyncedFromDonna, staleThreshold)
            )
      ),
      columns: {
        id: true,
        hawksoftClientCode: true,
        lastSyncedFromDonna: true,
      },
      limit: options.maxRecords,
    });

    console.log(
      `[DonnaSync] Found ${eligibleCustomers.length} customers to sync`
    );

    // Process customers sequentially to avoid session issues
    for (let i = 0; i < eligibleCustomers.length; i++) {
      const customer = eligibleCustomers[i];
      result.total++;

      // Add delay between requests to avoid rate limiting (every 5 requests)
      if (i > 0 && i % 5 === 0) {
        await delay(500); // 0.5 second delay every 5 requests
      }

      const donnaId = getDonnaCustomerId(customer.hawksoftClientCode);

      if (!donnaId) {
        result.skipped++;
        if (options.includeDetails) {
          result.details!.push({
            customerId: customer.id,
            donnaId: '',
            action: 'skipped',
            message: 'No HawkSoft code for Donna ID',
          });
        }
        continue;
      }

      try {
        // Get customer data (skip activities for now - endpoint is slow/unreliable)
        console.log(`[DonnaSync] Fetching ${donnaId}...`);
        const data = await client.getCustomerData(donnaId);

        if (!data) {
          result.notFound++;
          if (options.includeDetails) {
            result.details!.push({
              customerId: customer.id,
              donnaId,
              action: 'not_found',
              message: 'Customer not found in Donna',
            });
          }
          continue;
        }

        // Transform and store Donna data (empty activities for now)
        const donnaData = transformDonnaData(data, [], donnaId);

        if (!options.dryRun) {
          await db
            .update(customers)
            .set({
              donnaData,
              lastSyncedFromDonna: new Date(),
              // Also update churn risk if Donna data is available
              ...(data.GbProbabilityRetention !== undefined && {
                churnRiskScore: String(
                  (1 - data.GbProbabilityRetention).toFixed(2)
                ),
              }),
              updatedAt: new Date(),
            })
            .where(eq(customers.id, customer.id));
        }

        result.synced++;
        if (options.includeDetails) {
          result.details!.push({
            customerId: customer.id,
            donnaId,
            action: 'synced',
          });
        }
      } catch (error) {
        result.errors++;
        console.error(`[DonnaSync] Error syncing ${customer.id}:`, error);
        if (options.includeDetails) {
          result.details!.push({
            customerId: customer.id,
            donnaId,
            action: 'error',
            message:
              error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Log progress every 25 records
      if ((i + 1) % batchSize === 0 || i === eligibleCustomers.length - 1) {
        console.log(
          `[DonnaSync] Progress: ${i + 1}/${eligibleCustomers.length}`
        );
      }
    }

    // Log sync result to database
    if (!options.dryRun) {
      await logSyncResult(options.tenantId, result);
    }
  } catch (error) {
    console.error('[DonnaSync] Fatal error:', error);
    result.errors++;
  }

  result.duration = Date.now() - startTime;
  console.log(
    `[DonnaSync] Complete: ${result.synced} synced, ${result.notFound} not found, ${result.errors} errors in ${result.duration}ms`
  );

  return result;
}

// ============================================================================
// SINGLE CUSTOMER SYNC
// ============================================================================

/**
 * Sync Donna data for a single customer
 * Used for on-demand refresh from customer profile
 */
export async function syncCustomerFromDonna(
  tenantId: string,
  customerId: string
): Promise<{ success: boolean; data?: DonnaCustomerData; error?: string }> {
  try {
    const customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, tenantId),
        eq(customers.id, customerId)
      ),
      columns: {
        id: true,
        hawksoftClientCode: true,
      },
    });

    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    const donnaId = getDonnaCustomerId(customer.hawksoftClientCode);
    if (!donnaId) {
      return { success: false, error: 'No HawkSoft code for Donna lookup' };
    }

    const client = getDonnaClient();
    const { data, activities } = await client.getFullCustomerProfile(donnaId);

    if (!data) {
      return { success: false, error: 'Customer not found in Donna' };
    }

    const donnaData = transformDonnaData(data, activities, donnaId);

    await db
      .update(customers)
      .set({
        donnaData,
        lastSyncedFromDonna: new Date(),
        ...(data.GbProbabilityRetention !== undefined && {
          churnRiskScore: String(
            (1 - data.GbProbabilityRetention).toFixed(2)
          ),
        }),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));

    return { success: true, data: donnaData };
  } catch (error) {
    console.error(`[DonnaSync] Single customer error:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Delay helper for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log sync result to database
 */
async function logSyncResult(
  tenantId: string,
  result: DonnaSyncResult
): Promise<void> {
  try {
    await db.insert(syncLogs).values({
      tenantId,
      integration: 'donna',
      direction: 'inbound',
      entityType: 'customer',
      status: result.errors > 0 ? 'partial' : 'success',
      errorMessage:
        result.errors > 0 ? `${result.errors} errors during sync` : null,
      requestData: {
        source: 'donna',
        timestamp: result.timestamp.toISOString(),
      },
      responseData: {
        synced: result.synced,
        skipped: result.skipped,
        notFound: result.notFound,
        errors: result.errors,
        total: result.total,
        duration: result.duration,
      },
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('[DonnaSync] Error logging sync result:', error);
  }
}
