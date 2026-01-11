/**
 * API Route: /api/mortgagee-payments/sync
 * Sync mortgagees from HawkSoft policies into the mortgagees table
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { mortgagees, policies, customers, properties } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getHawkSoftClient, FULL_CLIENT_INCLUDES, FULL_CLIENT_EXPANDS } from "@/lib/api/hawksoft";

interface HawkSoftLienholder {
  lienholderId?: string;
  name?: string;
  lienholderName?: string;
  loanNumber?: string;
  accountNumber?: string;
  address1?: string;
  address2?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  zipCode?: string;
  position?: number;
  type?: string; // mortgagee, lienholder, loss_payee, additional_interest
}

/**
 * POST /api/mortgagee-payments/sync
 * Sync mortgagees from HawkSoft for all home/property policies
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Get request options
    const body = await request.json().catch(() => ({}));
    const fullSync = body.fullSync === true;
    const limit = body.limit || 500;

    const results = {
      policiesScanned: 0,
      mortgageesFound: 0,
      mortgageesCreated: 0,
      mortgageesUpdated: 0,
      mortgageesDeactivated: 0,
      errors: 0,
    };
    const errorDetails: { policyId: string; error: string }[] = [];

    // Get all active home/property policies from DB
    const homePolicies = await db
      .select({
        id: policies.id,
        policyNumber: policies.policyNumber,
        customerId: policies.customerId,
        hawksoftPolicyId: policies.hawksoftPolicyId,
        carrier: policies.carrier,
        lineOfBusiness: policies.lineOfBusiness,
      })
      .from(policies)
      .where(
        and(
          eq(policies.tenantId, tenantId),
          eq(policies.status, "active"),
          // Filter to property policies (home, dwelling, etc.)
          sql`${policies.lineOfBusiness} IN ('homeowners', 'dwelling', 'home', 'ho3', 'ho4', 'ho6', 'dp1', 'dp3', 'condo', 'renters', 'landlord', 'Homeowners', 'Dwelling', 'Home')`
        )
      )
      .limit(limit);

    console.log(`[Mortgagee Sync] Found ${homePolicies.length} home policies to check`);

    // Get HawkSoft client
    const hsClient = getHawkSoftClient();

    // Track which mortgagees we've seen (to deactivate removed ones)
    const seenMortgageeKeys = new Set<string>();

    // Process each policy
    for (const policy of homePolicies) {
      results.policiesScanned++;

      try {
        // Get customer's HawkSoft client number
        let hawkSoftClientId: number | null = null;

        if (policy.customerId) {
          const [customer] = await db
            .select({ hawksoftClientCode: customers.hawksoftClientCode })
            .from(customers)
            .where(eq(customers.id, policy.customerId))
            .limit(1);

          if (customer?.hawksoftClientCode) {
            hawkSoftClientId = parseInt(customer.hawksoftClientCode);
          }
        }

        if (!hawkSoftClientId) {
          continue; // Skip if no HawkSoft link
        }

        // Fetch client with policy lienholders from HawkSoft
        const hsClientData = await hsClient.getClient(
          hawkSoftClientId,
          ["policies"],
          ["policies.lienholders"]
        );

        if (!hsClientData.policies) {
          continue;
        }

        // Find matching policy
        const hsPolicy = hsClientData.policies.find(
          (p) =>
            p.policyNumber === policy.policyNumber ||
            p.policyId === policy.hawksoftPolicyId
        );

        if (!hsPolicy) {
          continue;
        }

        // Get lienholders from policy
        const lienholders = (hsPolicy as any).lienholders as HawkSoftLienholder[] || [];

        for (const lh of lienholders) {
          if (!lh.name && !lh.lienholderName) {
            continue; // Skip if no name
          }

          results.mortgageesFound++;

          const name = lh.name || lh.lienholderName || "Unknown";
          const loanNumber = lh.loanNumber || lh.accountNumber || null;
          const mortgageeKey = `${policy.id}:${name}:${loanNumber || ""}`;
          seenMortgageeKeys.add(mortgageeKey);

          // Check if mortgagee already exists
          const [existing] = await db
            .select({ id: mortgagees.id })
            .from(mortgagees)
            .where(
              and(
                eq(mortgagees.tenantId, tenantId),
                eq(mortgagees.policyId, policy.id),
                eq(mortgagees.name, name),
                loanNumber
                  ? eq(mortgagees.loanNumber, loanNumber)
                  : sql`${mortgagees.loanNumber} IS NULL`
              )
            )
            .limit(1);

          const mortgageeData = {
            name,
            loanNumber,
            addressLine1: lh.address1 || lh.addressLine1 || null,
            addressLine2: lh.address2 || lh.addressLine2 || null,
            city: lh.city || null,
            state: lh.state || null,
            zipCode: lh.zip || lh.zipCode || null,
            type: normalizeLienholderType(lh.type),
            position: lh.position || 1,
            isActive: true,
            updatedAt: new Date(),
          };

          if (existing) {
            // Update existing
            await db
              .update(mortgagees)
              .set(mortgageeData)
              .where(eq(mortgagees.id, existing.id));
            results.mortgageesUpdated++;
          } else {
            // Create new
            await db.insert(mortgagees).values({
              tenantId,
              policyId: policy.id,
              customerId: policy.customerId,
              ...mortgageeData,
            });
            results.mortgageesCreated++;
          }
        }
      } catch (policyError: any) {
        console.error(
          `[Mortgagee Sync] Error processing policy ${policy.policyNumber}:`,
          policyError.message
        );
        errorDetails.push({
          policyId: policy.id,
          error: policyError.message,
        });
        results.errors++;
      }

      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }

    // Optionally deactivate mortgagees no longer in HawkSoft
    if (fullSync) {
      // This would require tracking all seen mortgagees and comparing
      // Skipping for now to avoid accidental deactivation
    }

    const duration = Date.now() - startTime;

    console.log(
      `[Mortgagee Sync] Completed in ${duration}ms:`,
      JSON.stringify(results)
    );

    return NextResponse.json({
      success: true,
      results,
      duration,
      timestamp: new Date().toISOString(),
      ...(errorDetails.length > 0 && {
        errorDetails: errorDetails.slice(0, 10),
      }),
    });
  } catch (error: any) {
    console.error("[Mortgagee Sync] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mortgagee-payments/sync
 * Check sync status
 */
export async function GET() {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not configured" },
        { status: 500 }
      );
    }

    // Count home policies
    const [{ count: homePolicyCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(policies)
      .where(
        and(
          eq(policies.tenantId, tenantId),
          eq(policies.status, "active"),
          sql`${policies.lineOfBusiness} IN ('homeowners', 'dwelling', 'home', 'ho3', 'ho4', 'ho6', 'dp1', 'dp3', 'condo', 'renters', 'landlord', 'Homeowners', 'Dwelling', 'Home')`
        )
      );

    // Count mortgagees
    const [{ count: mortgageeCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(mortgagees)
      .where(and(eq(mortgagees.tenantId, tenantId), eq(mortgagees.isActive, true)));

    return NextResponse.json({
      success: true,
      homePolicies: homePolicyCount,
      mortgagees: mortgageeCount,
      message: "POST to this endpoint to sync mortgagees from HawkSoft",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function normalizeLienholderType(type?: string): string {
  if (!type) return "mortgagee";

  const lower = type.toLowerCase();
  if (lower.includes("loss") || lower.includes("payee")) return "loss_payee";
  if (lower.includes("lien")) return "lienholder";
  if (lower.includes("additional")) return "additional_interest";
  return "mortgagee";
}
