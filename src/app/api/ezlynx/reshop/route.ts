/**
 * Reshop: Push Renewal Data to EZLynx Application API
 * =====================================================
 * Maps canonical renewal snapshot data (from AL3/HawkSoft) into EZLynx
 * application updates using identity-matching for drivers/vehicles.
 *
 * POST /api/ezlynx/reshop
 * Body: { comparisonId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { renewalComparisons, customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { ezlynxBot } from "@/lib/api/ezlynx-bot";
import {
  renewalToAutoApplication,
  renewalToHomeApplication,
  type AutoSyncReport,
  type HomeSyncReport,
} from "@/lib/api/ezlynx-mappers";

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { comparisonId } = body;

    if (!comparisonId) {
      return NextResponse.json({ error: "comparisonId is required" }, { status: 400 });
    }

    // 1. Fetch comparison record
    const [comparison] = await db
      .select({
        id: renewalComparisons.id,
        customerId: renewalComparisons.customerId,
        renewalSnapshot: renewalComparisons.renewalSnapshot,
        baselineSnapshot: renewalComparisons.baselineSnapshot,
        renewalEffectiveDate: renewalComparisons.renewalEffectiveDate,
        renewalExpirationDate: renewalComparisons.renewalExpirationDate,
        lineOfBusiness: renewalComparisons.lineOfBusiness,
        carrierName: renewalComparisons.carrierName,
      })
      .from(renewalComparisons)
      .where(
        and(eq(renewalComparisons.id, comparisonId), eq(renewalComparisons.tenantId, tenantId))
      )
      .limit(1);

    if (!comparison) {
      return NextResponse.json({ error: "Comparison not found" }, { status: 404 });
    }

    if (!comparison.customerId) {
      return NextResponse.json({ error: "No customer linked to this renewal" }, { status: 400 });
    }

    // 2. Fetch customer → get ezlynxAccountId
    const [customer] = await db
      .select()
      .from(customers)
      .where(
        and(eq(customers.id, comparison.customerId), eq(customers.tenantId, tenantId))
      )
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const ezlynxAccountId = customer.ezlynxAccountId;
    if (!ezlynxAccountId) {
      return NextResponse.json(
        { error: "Link EZLynx account first — no ezlynxAccountId on customer" },
        { status: 400 }
      );
    }

    const snapshot = comparison.renewalSnapshot as any;
    if (!snapshot) {
      return NextResponse.json({ error: "No renewal snapshot data" }, { status: 400 });
    }

    const lob = ((comparison as any).lineOfBusiness || '').toLowerCase();
    const isAuto = lob.includes('auto');

    // 3. Get open applications
    let openApps: any[] = [];
    try {
      const appsResult = await ezlynxBot.getOpenApplications(ezlynxAccountId);
      openApps = appsResult || [];
    } catch (e) {
      console.log("[Reshop] Could not fetch open applications:", (e as Error).message);
    }

    const result: any = { success: true, ezlynxAccountId };

    if (isAuto) {
      // =====================================================================
      // AUTO APPLICATION
      // =====================================================================
      const existingAutoApp = openApps.find((a: any) => a.lob === "AUTO");

      let openAppId: string;
      if (existingAutoApp) {
        openAppId = existingAutoApp.openAppID;
      } else {
        const created = await ezlynxBot.createAutoApplication(ezlynxAccountId);
        openAppId = created.openAppId;
      }

      const appTemplate = await ezlynxBot.getAutoApplication(openAppId);
      const { app: mergedApp, syncReport } = renewalToAutoApplication(snapshot, comparison, appTemplate);

      await ezlynxBot.saveAutoApplication(openAppId, mergedApp);

      // Post-save verification
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
            uninsuredMotorist: gc?.uninsuredMotorist?.description ?? null,
            medicalPayments: gc?.medicalPayments?.description ?? null,
          },
          vehicleCoverages: (savedApp.vehicles?.vehicleCollection || []).map((v: any) => ({
            vin: v.vin,
            compDeductible: v.coverage?.comprehensive?.description ?? null,
            collDeductible: v.coverage?.collision?.description ?? null,
          })),
        };
        // Check for mismatches
        const expected = syncReport.coverages.updated;
        const mismatches: string[] = [];
        const has = (prefix: string) => expected.some((s: string) => s.startsWith(prefix));
        if (has('BI') && !gc?.bodilyInjury?.description) mismatches.push('bodilyInjury');
        if (has('PD') && !gc?.propertyDamage?.description) mismatches.push('propertyDamage');
        if (has('UM') && !gc?.uninsuredMotorist?.description) mismatches.push('uninsuredMotorist');
        if (has('MedPay') && !gc?.medicalPayments?.description) mismatches.push('medicalPayments');
        if (mismatches.length > 0) {
          verification.mismatches = mismatches;
          console.log(`[Reshop] Auto coverage mismatches: ${mismatches.join(', ')}`);
        }
      } catch (verifyErr) {
        console.log("[Reshop] Post-save verify failed:", (verifyErr as Error).message);
      }

      result.type = 'auto';
      result.syncReport = syncReport;
      result.verification = verification;

      console.log(
        `[Reshop] Auto sync for ${ezlynxAccountId}:`,
        `${syncReport.drivers.matched.length} drivers matched, ${syncReport.drivers.added.length} added,`,
        `${syncReport.vehicles.matched.length} vehicles matched, ${syncReport.vehicles.added.length} added,`,
        `${syncReport.coverages.updated.length} coverages updated`,
      );
    } else {
      // =====================================================================
      // HOME APPLICATION
      // =====================================================================
      const existingHomeApp = openApps.find((a: any) => a.lob === "HOME");

      let openAppId: string;
      if (existingHomeApp) {
        openAppId = existingHomeApp.openAppID;
      } else {
        const created = await ezlynxBot.createHomeApplication(ezlynxAccountId);
        openAppId = created.openAppId;
      }

      const appTemplate = await ezlynxBot.getHomeApplication(openAppId);
      const baseline = comparison.baselineSnapshot as any;
      const { app: mergedApp, syncReport } = renewalToHomeApplication(snapshot, comparison, appTemplate, baseline);

      await ezlynxBot.saveHomeApplication(openAppId, mergedApp);

      // Post-save verification
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
        const has = (prefix: string) => expected.some((s: string) => s.startsWith(prefix));
        if (has('Dwelling') && !gc?.dwelling) mismatches.push('dwelling');
        if (has('Liability') && !gc?.personalLiability?.description) mismatches.push('personalLiability');
        if (has('All Peril') && !gc?.perilsDeductible?.description) mismatches.push('perilsDeductible');
        if (mismatches.length > 0) {
          verification.mismatches = mismatches;
          console.log(`[Reshop] Home coverage mismatches: ${mismatches.join(', ')}`);
        }
      } catch (verifyErr) {
        console.log("[Reshop] Home post-save verify failed:", (verifyErr as Error).message);
      }

      result.type = 'home';
      result.syncReport = syncReport;
      result.verification = verification;

      console.log(
        `[Reshop] Home sync for ${ezlynxAccountId}:`,
        `${syncReport.coverages.updated.length} coverages updated`,
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Reshop] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to push reshop data" },
      { status: 500 }
    );
  }
}
