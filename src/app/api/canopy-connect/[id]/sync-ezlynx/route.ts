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
  canopyPullToAutoApplication,
  canopyPullToHomeApplication,
  customerToUpdatePayload,
  type AutoSyncReport,
  type HomeSyncReport,
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
    const { customerId: bodyCustomerId } = body;

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

    // 8. Always update open applications with Canopy data
    const quoteResults: any = {};
    let autoSyncReport: AutoSyncReport | undefined;
    let homeSyncReport: HomeSyncReport | undefined;

    if (ezlynxAccountId) {
      // Check for existing open applications
      let openApps: any[] = [];
      try {
        const appsResult = await ezlynxBot.getOpenApplications(ezlynxAccountId);
        openApps = appsResult || [];
      } catch (e) {
        console.log("[Canopy Sync] Could not fetch open applications:", (e as Error).message);
      }

      const existingAutoApp = openApps.find((a: any) => a.lob === "AUTO");
      const existingHomeApp = openApps.find((a: any) => a.lob === "HOME");

      // Auto application — update existing or create if vehicles exist
      const vehicles = (pull as any).vehicles || [];
      if (existingAutoApp || vehicles.length > 0) {
        try {
          let openAppId: string;
          if (existingAutoApp) {
            openAppId = existingAutoApp.openAppID;
          } else {
            const created = await ezlynxBot.createAutoApplication(ezlynxAccountId);
            openAppId = created.openAppId;
          }

          const appTemplate = await ezlynxBot.getAutoApplication(openAppId);
          const { app: mergedApp, syncReport } = canopyPullToAutoApplication(pull, appTemplate);
          autoSyncReport = syncReport;

          await ezlynxBot.saveAutoApplication(openAppId, mergedApp);

          // Post-save verification: re-fetch and compare key fields
          let verification: any = {};
          try {
            const savedApp = await ezlynxBot.getAutoApplication(openAppId);
            const gc = savedApp.coverage?.generalCoverage;
            verification = {
              driverCount: savedApp.drivers?.length ?? 0,
              vehicleCount: savedApp.vehicles?.vehicleCollection?.length ?? 0,
              effectiveDate: savedApp.policyInformation?.effectiveDate,
              coverages: {
                bodilyInjury: gc?.bodilyInjury?.description ?? null,
                propertyDamage: gc?.propertyDamage?.description ?? null,
                uninsuredMotorist: gc?.uninsuredMotoristBI?.description ?? null,
                medicalPayments: gc?.medicalPayments?.description ?? null,
              },
              vehicleCoverages: (savedApp.vehicles?.vehicleCollection || []).map((v: any) => ({
                vin: v.vin,
                compDeductible: v.coverage?.comprehensiveDeductible?.description ?? null,
                collDeductible: v.coverage?.collisionDeductible?.description ?? null,
              })),
            };
            // Check for mismatches: compare expected vs actual
            const expected = syncReport.coverages.updated;
            const mismatches: string[] = [];
            if (expected.includes('bodilyInjury') && !gc?.bodilyInjury?.value && gc?.bodilyInjury?.value !== 0) mismatches.push('bodilyInjury');
            if (expected.includes('propertyDamage') && !gc?.propertyDamage?.value && gc?.propertyDamage?.value !== 0) mismatches.push('propertyDamage');
            if (expected.includes('uninsuredMotoristBI') && !gc?.uninsuredMotoristBI?.value && gc?.uninsuredMotoristBI?.value !== 0) mismatches.push('uninsuredMotoristBI');
            if (expected.includes('medicalPayments') && !gc?.medicalPayments?.value && gc?.medicalPayments?.value !== 0) mismatches.push('medicalPayments');
            if (mismatches.length > 0) {
              verification.mismatches = mismatches;
              console.log(`[Canopy Sync] Auto coverage mismatches: ${mismatches.join(', ')}`);
            }
          } catch (verifyErr) {
            console.log("[Canopy Sync] Post-save verify failed:", (verifyErr as Error).message);
          }

          quoteResults.auto = {
            success: true,
            method: "application-api",
            openAppId,
            syncReport,
            verification,
          };
        } catch (e) {
          console.log("[Canopy Sync] Auto application update failed:", (e as Error).message);
          quoteResults.auto = { success: false, error: (e as Error).message, syncReport: autoSyncReport };
        }
      }

      // Home application — update existing or create if dwellings exist
      // Check both top-level dwellings and policy-level dwellings (Canopy nests them)
      const dwellings = (pull as any).dwellings || [];
      const hasPolicyDwellings = ((pull as any).policies || []).some((p: any) => p.dwellings?.length > 0);
      if (existingHomeApp || dwellings.length > 0 || hasPolicyDwellings) {
        try {
          let openAppId: string;
          if (existingHomeApp) {
            openAppId = existingHomeApp.openAppID;
          } else {
            const created = await ezlynxBot.createHomeApplication(ezlynxAccountId);
            openAppId = created.openAppId;
          }

          const appTemplate = await ezlynxBot.getHomeApplication(openAppId);
          const { app: mergedApp, syncReport } = canopyPullToHomeApplication(pull, appTemplate);
          homeSyncReport = syncReport;

          await ezlynxBot.saveHomeApplication(openAppId, mergedApp);

          // Post-save verification: re-fetch and compare key fields
          let verification: any = {};
          try {
            const savedApp = await ezlynxBot.getHomeApplication(openAppId);
            const gc = savedApp.generalCoverage;
            verification = {
              effectiveDate: savedApp.policyInformation?.effectiveDate,
              coverages: {
                dwelling: gc?.dwelling ?? null,
                personalProperty: gc?.personalProperty ?? null,
                lossOfUse: gc?.lossOfUse ?? null,
                personalLiability: gc?.personalLiability?.description ?? null,
                medicalPayments: gc?.medicalPayments?.description ?? null,
                perilsDeductible: gc?.perilsDeductible?.description ?? null,
                windDeductible: gc?.windDeductible?.description ?? null,
                hurricaneDeductible: gc?.hurricaneDeductible?.description ?? null,
              },
            };
            // Check for mismatches
            const expected = syncReport.coverages.updated;
            const mismatches: string[] = [];
            if (expected.includes('dwelling') && !gc?.dwelling) mismatches.push('dwelling');
            if (expected.includes('personalLiability') && !gc?.personalLiability?.value && gc?.personalLiability?.value !== 0) mismatches.push('personalLiability');
            if (expected.includes('perilsDeductible') && !gc?.perilsDeductible?.value && gc?.perilsDeductible?.value !== 0) mismatches.push('perilsDeductible');
            if (mismatches.length > 0) {
              verification.mismatches = mismatches;
              console.log(`[Canopy Sync] Home coverage mismatches: ${mismatches.join(', ')}`);
            }
          } catch (verifyErr) {
            console.log("[Canopy Sync] Home post-save verify failed:", (verifyErr as Error).message);
          }

          quoteResults.home = {
            success: true,
            method: "application-api",
            openAppId,
            syncReport,
            verification,
          };
        } catch (e) {
          console.log("[Canopy Sync] Home application update failed:", (e as Error).message);
          quoteResults.home = { success: false, error: (e as Error).message, syncReport: homeSyncReport };
        }
      }
    }

    console.log(
      `[Canopy Sync] ${operation} EZLynx applicant ${ezlynxAccountId} from pull ${pull.pullId || id}`,
      autoSyncReport ? `| Auto: ${autoSyncReport.drivers.matched.length} drivers matched, ${autoSyncReport.drivers.added.length} added, ${autoSyncReport.vehicles.matched.length} vehicles matched, ${autoSyncReport.vehicles.added.length} added, ${autoSyncReport.coverages.updated.length} coverages` : '',
      homeSyncReport ? `| Home: ${homeSyncReport.coverages.updated.length} coverages, ${homeSyncReport.dwelling.updated.length} dwelling fields` : '',
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
