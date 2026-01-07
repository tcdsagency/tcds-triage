// API Route: /api/payment-advance/customer/policies
// Get policies for a customer from HawkSoft

import { NextRequest, NextResponse } from "next/server";
import { getHawkSoftClient } from "@/lib/api/hawksoft";
import { db } from "@/db";
import { policies } from "@/db/schema";
import { eq } from "drizzle-orm";

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
    let source: "hawksoft" | "cache" | "none" = "none";

    // If we have a HawkSoft client number, try live lookup first
    if (hawksoftClientNumber) {
      try {
        const hsClient = getHawkSoftClient();
        const clientNumber = parseInt(hawksoftClientNumber);

        if (!isNaN(clientNumber)) {
          // Get client with policies included
          const client = await hsClient.getClient(clientNumber, ["policies"]);

          if (client && client.policies) {
            // Filter out inactive policies
            customerPolicies = client.policies
              .filter((p) => {
                const status = (p.status || "").toLowerCase();
                return !INACTIVE_STATUSES.some((inactive) =>
                  status.includes(inactive)
                );
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
        console.warn("[Payment Advance] HawkSoft lookup failed, falling back to cache:", hsError);
        // Fall through to cache lookup
      }
    }

    // Fallback: Try to get cached policies from database
    if (customerPolicies.length === 0 && hawksoftClientNumber) {
      try {
        // Look up customer by HawkSoft client code
        const cachedPolicies = await db
          .select({
            policyNumber: policies.policyNumber,
            carrier: policies.carrier,
            lineOfBusiness: policies.lineOfBusiness,
            status: policies.status,
            expirationDate: policies.expirationDate,
          })
          .from(policies)
          .where(eq(policies.status, "active"));

        if (cachedPolicies.length > 0) {
          customerPolicies = cachedPolicies.map((p) => ({
            policyNumber: p.policyNumber,
            carrier: p.carrier || "Unknown Carrier",
            type: p.lineOfBusiness || "Unknown",
            status: p.status || undefined,
            expirationDate: p.expirationDate?.toISOString() || undefined,
          }));
          source = "cache";
        }
      } catch (cacheError) {
        console.warn("[Payment Advance] Cache lookup failed:", cacheError);
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
