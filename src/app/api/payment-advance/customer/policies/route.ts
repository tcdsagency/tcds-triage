// API Route: /api/payment-advance/customer/policies
// Get policies for a customer from local DB first, then HawkSoft

import { NextRequest, NextResponse } from "next/server";
import { getHawkSoftClient } from "@/lib/api/hawksoft";
import { db } from "@/db";
import { policies, customers } from "@/db/schema";
import { eq, and, or, ne, gt } from "drizzle-orm";

export interface CustomerPolicy {
  policyNumber: string;
  carrier: string;
  type: string;
  status?: string;
  expirationDate?: string;
}

// Inactive statuses to filter out
const INACTIVE_STATUSES = [
  "cancelled",
  "replaced:rewrite",
  "replaced",
  "expired",
  "deadfiled",
  "void",
];

// GET - Get policies for a customer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");
    const customerType = searchParams.get("customerType");
    const hawksoftClientNumber = searchParams.get("hawksoftClientNumber");

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "customerId is required" },
        { status: 400 }
      );
    }

    let customerPolicies: CustomerPolicy[] = [];
    let source: "local" | "hawksoft" | "none" = "none";

    // ==========================================================================
    // 1. Try local database first (fast)
    // ==========================================================================
    try {
      // Skip if customerId starts with "az-lead-" (AgencyZoom lead, no local data)
      if (!customerId.startsWith("az-lead-")) {
        const now = new Date();
        const cachedPolicies = await db
          .select({
            policyNumber: policies.policyNumber,
            carrier: policies.carrier,
            lineOfBusiness: policies.lineOfBusiness,
            status: policies.status,
            expirationDate: policies.expirationDate,
          })
          .from(policies)
          .where(
            and(
              eq(policies.customerId, customerId),
              or(
                eq(policies.status, "active"),
                eq(policies.status, "pending"),
                gt(policies.expirationDate, now)
              )
            )
          );

        if (cachedPolicies.length > 0) {
          customerPolicies = cachedPolicies
            .filter((p) => {
              const status = (p.status || "").toLowerCase();
              return !INACTIVE_STATUSES.some((inactive) => status.includes(inactive));
            })
            .map((p) => ({
              policyNumber: p.policyNumber,
              carrier: p.carrier || "Unknown Carrier",
              type: p.lineOfBusiness || "Unknown",
              status: p.status || undefined,
              expirationDate: p.expirationDate?.toISOString() || undefined,
            }));
          source = "local";
        }
      }
    } catch (localError) {
      console.warn("[Payment Advance] Local DB lookup failed:", localError);
    }

    // ==========================================================================
    // 2. If no local results and we have HawkSoft client number, try HawkSoft API
    // ==========================================================================
    if (customerPolicies.length === 0 && hawksoftClientNumber) {
      try {
        const hsClient = getHawkSoftClient();
        const clientNumber = parseInt(hawksoftClientNumber);

        if (!isNaN(clientNumber)) {
          const client = await hsClient.getClient(clientNumber, ["policies"]);

          if (client && client.policies) {
            customerPolicies = client.policies
              .filter((p) => {
                const status = (p.status || "").toLowerCase();
                return !INACTIVE_STATUSES.some((inactive) => status.includes(inactive));
              })
              .map((p) => ({
                policyNumber: p.policyNumber,
                carrier: p.carrier || "Unknown Carrier",
                type: p.lineOfBusiness || p.policyType || "Unknown",
                status: p.status,
                expirationDate: p.expirationDate,
              }));

            source = "hawksoft";
          }
        }
      } catch (hsError) {
        console.warn("[Payment Advance] HawkSoft lookup failed:", hsError);
      }
    }

    // Sort by policy number for consistency
    customerPolicies.sort((a, b) => a.policyNumber.localeCompare(b.policyNumber));

    return NextResponse.json({
      success: true,
      policies: customerPolicies,
      source,
      customerType,
      hasHawksoftLink: !!hawksoftClientNumber,
    });
  } catch (error: any) {
    console.error("[Payment Advance] Policies lookup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get policies", details: error.message },
      { status: 500 }
    );
  }
}
