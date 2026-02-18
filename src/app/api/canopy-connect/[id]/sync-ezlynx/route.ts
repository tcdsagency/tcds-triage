/**
 * Sync Canopy Pull to EZLynx
 * ===========================
 * Creates or updates an EZLynx applicant from Canopy Connect pull data,
 * optionally pushes auto/home quotes.
 *
 * POST /api/canopy-connect/[id]/sync-ezlynx
 * Body: { customerId?, pushQuotes?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ezlynxBot } from "@/lib/api/ezlynx-bot";
import {
  canopyPullToApplicant,
  canopyPullToAutoQuote,
  canopyPullToHomeQuote,
  customerToUpdatePayload,
} from "@/lib/api/ezlynx-mappers";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { customerId: bodyCustomerId, pushQuotes = false } = body;

    // 1. Fetch the pull record
    const [pull] = await db
      .select()
      .from(canopyConnectPulls)
      .where(
        and(eq(canopyConnectPulls.id, id), eq(canopyConnectPulls.tenantId, tenantId))
      )
      .limit(1);

    if (!pull) {
      return NextResponse.json({ error: "Pull not found" }, { status: 404 });
    }

    // 2. Resolve customer
    const resolvedCustomerId = pull.matchedCustomerId || bodyCustomerId;
    if (!resolvedCustomerId) {
      return NextResponse.json(
        { error: "No matched customer. Match or provide customerId first." },
        { status: 400 }
      );
    }

    const [customer] = await db
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, resolvedCustomerId), eq(customers.tenantId, tenantId))
      )
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const auditMeta = { source: "canopy", sourceId: pull.pullId || id, performedBy: "tcds-canopy-sync" };

    let operation: "created" | "updated";
    let ezlynxAccountId = customer.ezlynxAccountId;

    // 3. Check if customer already has an EZLynx account
    if (!ezlynxAccountId) {
      // 4. Search EZLynx by name + DOB
      const firstName = pull.firstName || customer.firstName || "";
      const lastName = pull.lastName || customer.lastName || "";

      // DOB: pull-level is often null. Fall back to matching driver's DOB.
      let dob: string | undefined;
      if (pull.dateOfBirth) {
        dob = new Date(pull.dateOfBirth).toISOString().split("T")[0];
      } else {
        // Find the driver that matches the applicant name
        const drivers = (pull as any).drivers || [];
        const matchingDriver = drivers.find((d: any) =>
          (d.first_name || "").toLowerCase() === firstName.toLowerCase()
          && (d.last_name || "").toLowerCase() === lastName.toLowerCase()
        ) || drivers.find((d: any) => d.is_primary) || drivers[0];
        const rawDob = matchingDriver?.date_of_birth_str || matchingDriver?.date_of_birth;
        if (rawDob) {
          // Convert MM/DD/YYYY to YYYY-MM-DD if needed
          const parts = rawDob.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
          dob = parts
            ? `${parts[3]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`
            : rawDob.includes("T") ? rawDob.split("T")[0] : rawDob;
        }
      }

      try {
        const searchResult = await ezlynxBot.searchApplicant({
          firstName,
          lastName,
          dateOfBirth: dob,
        });

        if (searchResult.success && searchResult.results && searchResult.results.length > 0) {
          // Found existing — use the first (most recent) match
          ezlynxAccountId = searchResult.results[0].accountId;
        }
      } catch (e) {
        console.log("[Canopy Sync] EZLynx search failed, will create new:", e);
      }
    }

    if (ezlynxAccountId) {
      // 5. Update existing EZLynx applicant with fresh Canopy data
      const applicantData = canopyPullToApplicant(pull);
      const updatePayload = customerToUpdatePayload({
        firstName: applicantData.firstName,
        lastName: applicantData.lastName,
        dateOfBirth: applicantData.dateOfBirth,
        contact: {
          email: applicantData.email,
          phone: applicantData.phone,
        },
        address: {
          street: applicantData.addressLine1,
          city: applicantData.addressCity,
          state: applicantData.addressState,
          zip: applicantData.addressZip,
        },
      });

      const updateResult = await ezlynxBot.updateApplicant(
        ezlynxAccountId,
        updatePayload,
        auditMeta
      );

      if (!updateResult.success) {
        return NextResponse.json(
          { error: `Failed to update EZLynx applicant: ${updateResult.error}` },
          { status: 500 }
        );
      }
      operation = "updated";
    } else {
      // 6. Create new EZLynx applicant
      const applicantData = canopyPullToApplicant(pull);
      const createResult = await ezlynxBot.createApplicant(applicantData, auditMeta);

      if (!createResult.success || !createResult.ezlynxId) {
        return NextResponse.json(
          { error: `Failed to create EZLynx applicant: ${createResult.error}` },
          { status: 500 }
        );
      }
      ezlynxAccountId = createResult.ezlynxId;
      operation = "created";
    }

    // 7. Link ezlynxAccountId back to customer
    await db
      .update(customers)
      .set({
        ezlynxAccountId,
        ezlynxSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, resolvedCustomerId));

    // Update the pull status
    await db
      .update(canopyConnectPulls)
      .set({
        matchStatus: "created",
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, id));

    // 8. Push quotes if requested — use new application save APIs
    const quoteResults: any = {};
    if (pushQuotes && ezlynxAccountId) {
      // Auto application if vehicles exist
      const vehicles = (pull as any).vehicles || [];
      if (vehicles.length > 0) {
        try {
          // Create auto application
          const { openAppId } = await ezlynxBot.createAutoApplication(ezlynxAccountId);

          // Get the application template
          const appTemplate = await ezlynxBot.getAutoApplication(openAppId);

          // Map Canopy data into the application structure
          const autoQuoteData = canopyPullToAutoQuote(pull);
          const mergedApp = { ...appTemplate, _canopyData: autoQuoteData };

          // Save the application
          await ezlynxBot.saveAutoApplication(openAppId, mergedApp);
          quoteResults.auto = { success: true, method: "application-api", openAppId };
        } catch (e) {
          // Fall back to old quote method
          try {
            const autoQuoteData = canopyPullToAutoQuote(pull);
            const autoResult = await ezlynxBot.submitAutoQuote(ezlynxAccountId, autoQuoteData);
            quoteResults.auto = autoResult;
          } catch (e2) {
            quoteResults.auto = { success: false, error: (e2 as Error).message };
          }
        }
      }

      // Home application if dwellings exist
      const dwellings = (pull as any).dwellings || [];
      if (dwellings.length > 0) {
        try {
          // Create home application
          const { openAppId } = await ezlynxBot.createHomeApplication(ezlynxAccountId);

          // Get the application template
          const appTemplate = await ezlynxBot.getHomeApplication(openAppId);

          // Map Canopy data into the application structure
          const homeQuoteData = canopyPullToHomeQuote(pull);
          const mergedApp = { ...appTemplate, _canopyData: homeQuoteData };

          // Save the application
          await ezlynxBot.saveHomeApplication(openAppId, mergedApp);
          quoteResults.home = { success: true, method: "application-api", openAppId };
        } catch (e) {
          // Fall back to old quote method
          try {
            const homeQuoteData = canopyPullToHomeQuote(pull);
            const homeResult = await ezlynxBot.submitHomeQuote(ezlynxAccountId, homeQuoteData);
            quoteResults.home = homeResult;
          } catch (e2) {
            quoteResults.home = { success: false, error: (e2 as Error).message };
          }
        }
      }
    }

    console.log(
      `[Canopy Sync] ${operation} EZLynx applicant ${ezlynxAccountId} from pull ${pull.pullId || id}`
    );

    return NextResponse.json({
      success: true,
      operation,
      ezlynxAccountId,
      customerId: resolvedCustomerId,
      quoteResults: Object.keys(quoteResults).length > 0 ? quoteResults : undefined,
    });
  } catch (error) {
    console.error("[Canopy Sync] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync to EZLynx" },
      { status: 500 }
    );
  }
}
