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
    const { comparisonId, dryRun } = body;

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

    const result: any = { success: true, ezlynxAccountId, dryRun: !!dryRun };

    if (isAuto) {
      // =====================================================================
      // AUTO APPLICATION
      // =====================================================================
      const existingAutoApp = openApps.find((a: any) => a.lob === "AUTO");

      let openAppId: string;
      if (existingAutoApp) {
        openAppId = existingAutoApp.openAppID;
      } else if (dryRun) {
        return NextResponse.json({ error: "No existing auto application to preview" }, { status: 400 });
      } else {
        const created = await ezlynxBot.createAutoApplication(ezlynxAccountId);
        openAppId = created.openAppId;
      }

      const appTemplate = await ezlynxBot.getAutoApplication(openAppId);

      // Build mapper comparison with prior carrier data
      const mapperComparison: any = { ...comparison };

      // Set prior carrier enum — EZLynx API resolves by name internally
      if (comparison.carrierName) {
        const name = comparison.carrierName;
        mapperComparison.priorCarrierEnum = { value: 0, name, description: name };
      }

      const { app: mergedApp, syncReport } = renewalToAutoApplication(snapshot, mapperComparison, appTemplate);

      // Build before/after diff for preview
      const beforeAfter: { field: string; before: string; after: string }[] = [];
      const gc = appTemplate.coverage?.generalCoverage;
      const mgc = mergedApp.coverage?.generalCoverage;
      // Policy dates
      const oldEff = appTemplate.policyInformation?.effectiveDate || '';
      const newEff = mergedApp.policyInformation?.effectiveDate || '';
      if (oldEff !== newEff) beforeAfter.push({ field: 'Effective Date', before: oldEff || '(empty)', after: newEff });
      // General coverages
      if (gc?.bodilyInjury?.description !== mgc?.bodilyInjury?.description)
        beforeAfter.push({ field: 'Bodily Injury', before: gc?.bodilyInjury?.description || '(empty)', after: mgc?.bodilyInjury?.description || '(empty)' });
      if (gc?.propertyDamage?.description !== mgc?.propertyDamage?.description)
        beforeAfter.push({ field: 'Property Damage', before: gc?.propertyDamage?.description || '(empty)', after: mgc?.propertyDamage?.description || '(empty)' });
      if (gc?.uninsuredMotorist?.description !== mgc?.uninsuredMotorist?.description)
        beforeAfter.push({ field: 'Uninsured Motorist', before: gc?.uninsuredMotorist?.description || '(empty)', after: mgc?.uninsuredMotorist?.description || '(empty)' });
      if (gc?.underinsuredMotorist?.description !== mgc?.underinsuredMotorist?.description)
        beforeAfter.push({ field: 'Underinsured Motorist', before: gc?.underinsuredMotorist?.description || '(empty)', after: mgc?.underinsuredMotorist?.description || '(empty)' });
      if (gc?.medicalPayments?.description !== mgc?.medicalPayments?.description)
        beforeAfter.push({ field: 'Medical Payments', before: gc?.medicalPayments?.description || '(empty)', after: mgc?.medicalPayments?.description || '(empty)' });
      // Prior carrier fields
      const oldPI = appTemplate.policyInformation;
      const newPI = mergedApp.policyInformation;
      if (oldPI?.priorCarrier?.description !== newPI?.priorCarrier?.description)
        beforeAfter.push({ field: 'Prior Carrier', before: oldPI?.priorCarrier?.description || '(empty)', after: newPI?.priorCarrier?.description || '(empty)' });
      if ((oldPI?.priorPolicyExpirationDate || '') !== (newPI?.priorPolicyExpirationDate || ''))
        beforeAfter.push({ field: 'Prior Expiration', before: oldPI?.priorPolicyExpirationDate || '(empty)', after: newPI?.priorPolicyExpirationDate || '(empty)' });
      // Vehicle coverages
      const oldVehicles = appTemplate.vehicles?.vehicleCollection || [];
      const newVehicles = mergedApp.vehicles?.vehicleCollection || [];
      for (let i = 0; i < newVehicles.length; i++) {
        const nv = newVehicles[i];
        const ov = oldVehicles[i];
        const label = `${nv.year?.description ?? nv.year ?? ''} ${nv.make?.description ?? nv.make ?? ''} ${nv.model?.description ?? nv.model ?? ''}`.trim() || `Vehicle ${i + 1}`;
        if (ov?.coverage?.comprehensive?.description !== nv.coverage?.comprehensive?.description)
          beforeAfter.push({ field: `${label} Comp Ded`, before: ov?.coverage?.comprehensive?.description || '(empty)', after: nv.coverage?.comprehensive?.description || '(empty)' });
        if (ov?.coverage?.collision?.description !== nv.coverage?.collision?.description)
          beforeAfter.push({ field: `${label} Coll Ded`, before: ov?.coverage?.collision?.description || '(empty)', after: nv.coverage?.collision?.description || '(empty)' });
      }
      // Drivers
      for (const d of syncReport.drivers.added) {
        beforeAfter.push({ field: `Driver: ${d}`, before: '(new)', after: 'Added' });
      }

      if (dryRun) {
        return NextResponse.json({ success: true, dryRun: true, type: 'auto', syncReport, beforeAfter, ezlynxAccountId });
      }

      await ezlynxBot.saveAutoApplication(openAppId, mergedApp);

      // Post-save verification
      let verification: any = {};
      try {
        const savedApp = await ezlynxBot.getAutoApplication(openAppId);
        const sgc = savedApp.coverage?.generalCoverage;
        verification = {
          driverCount: savedApp.drivers?.length ?? 0,
          vehicleCount: savedApp.vehicles?.vehicleCollection?.length ?? 0,
          effectiveDate: savedApp.policyInformation?.effectiveDate,
          coverages: {
            bodilyInjury: sgc?.bodilyInjury?.description ?? null,
            propertyDamage: sgc?.propertyDamage?.description ?? null,
            uninsuredMotorist: sgc?.uninsuredMotorist?.description ?? null,
            medicalPayments: sgc?.medicalPayments?.description ?? null,
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
        if (has('BI') && !sgc?.bodilyInjury?.description) mismatches.push('bodilyInjury');
        if (has('PD') && !sgc?.propertyDamage?.description) mismatches.push('propertyDamage');
        if (has('UM') && !sgc?.uninsuredMotorist?.description) mismatches.push('uninsuredMotorist');
        if (has('MedPay') && !sgc?.medicalPayments?.description) mismatches.push('medicalPayments');
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
      result.beforeAfter = beforeAfter;

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
      } else if (dryRun) {
        return NextResponse.json({ error: "No existing home application to preview" }, { status: 400 });
      } else {
        const created = await ezlynxBot.createHomeApplication(ezlynxAccountId);
        openAppId = created.openAppId;
      }

      const appTemplate = await ezlynxBot.getHomeApplication(openAppId);

      // Build mapper comparison with prior carrier data
      const homeMapperComparison: any = { ...comparison };

      // Set prior carrier enum — EZLynx API resolves by name internally
      if (comparison.carrierName) {
        const name = comparison.carrierName;
        homeMapperComparison.priorCarrierEnum = { value: 0, name, description: name };
      }

      const baseline = comparison.baselineSnapshot as any;
      const { app: mergedApp, syncReport } = renewalToHomeApplication(snapshot, homeMapperComparison, appTemplate, baseline);

      // Build before/after diff for preview
      const beforeAfter: { field: string; before: string; after: string }[] = [];
      const hgc = appTemplate.generalCoverage;
      const hmgc = mergedApp.generalCoverage;
      const oldEff = appTemplate.policyInformation?.effectiveDate || '';
      const newEff = mergedApp.policyInformation?.effectiveDate || '';
      if (oldEff !== newEff) beforeAfter.push({ field: 'Effective Date', before: oldEff || '(empty)', after: newEff });
      if (String(hgc?.dwelling || '') !== String(hmgc?.dwelling || ''))
        beforeAfter.push({ field: 'Dwelling', before: hgc?.dwelling ? `$${Number(hgc.dwelling).toLocaleString()}` : '(empty)', after: hmgc?.dwelling ? `$${Number(hmgc.dwelling).toLocaleString()}` : '(empty)' });
      if (String(hgc?.personalProperty || '') !== String(hmgc?.personalProperty || ''))
        beforeAfter.push({ field: 'Personal Property', before: hgc?.personalProperty ? `$${Number(hgc.personalProperty).toLocaleString()}` : '(empty)', after: hmgc?.personalProperty ? `$${Number(hmgc.personalProperty).toLocaleString()}` : '(empty)' });
      if (String(hgc?.lossOfUse || '') !== String(hmgc?.lossOfUse || ''))
        beforeAfter.push({ field: 'Loss of Use', before: hgc?.lossOfUse ? `$${Number(hgc.lossOfUse).toLocaleString()}` : '(empty)', after: hmgc?.lossOfUse ? `$${Number(hmgc.lossOfUse).toLocaleString()}` : '(empty)' });
      if (String(hgc?.otherStructures || '') !== String(hmgc?.otherStructures || ''))
        beforeAfter.push({ field: 'Other Structures', before: hgc?.otherStructures ? `$${Number(hgc.otherStructures).toLocaleString()}` : '(empty)', after: hmgc?.otherStructures ? `$${Number(hmgc.otherStructures).toLocaleString()}` : '(empty)' });
      if (hgc?.personalLiability?.description !== hmgc?.personalLiability?.description)
        beforeAfter.push({ field: 'Personal Liability', before: hgc?.personalLiability?.description || '(empty)', after: hmgc?.personalLiability?.description || '(empty)' });
      if (hgc?.medicalPayments?.description !== hmgc?.medicalPayments?.description)
        beforeAfter.push({ field: 'Medical Payments', before: hgc?.medicalPayments?.description || '(empty)', after: hmgc?.medicalPayments?.description || '(empty)' });
      if (hgc?.perilsDeductible?.description !== hmgc?.perilsDeductible?.description)
        beforeAfter.push({ field: 'All Perils Deductible', before: hgc?.perilsDeductible?.description || '(empty)', after: hmgc?.perilsDeductible?.description || '(empty)' });
      if (hgc?.windDeductible?.description !== hmgc?.windDeductible?.description)
        beforeAfter.push({ field: 'Wind/Hail Deductible', before: hgc?.windDeductible?.description || '(empty)', after: hmgc?.windDeductible?.description || '(empty)' });
      if (hgc?.hurricaneDeductible?.description !== hmgc?.hurricaneDeductible?.description)
        beforeAfter.push({ field: 'Hurricane Deductible', before: hgc?.hurricaneDeductible?.description || '(empty)', after: hmgc?.hurricaneDeductible?.description || '(empty)' });

      if (dryRun) {
        return NextResponse.json({ success: true, dryRun: true, type: 'home', syncReport, beforeAfter, ezlynxAccountId });
      }

      await ezlynxBot.saveHomeApplication(openAppId, mergedApp);

      // Post-save verification
      let verification: any = {};
      try {
        const savedApp = await ezlynxBot.getHomeApplication(openAppId);
        const sgc = savedApp.generalCoverage;
        verification = {
          effectiveDate: savedApp.policyInformation?.effectiveDate,
          coverages: {
            dwelling: sgc?.dwelling ?? null,
            personalProperty: sgc?.personalProperty ?? null,
            lossOfUse: sgc?.lossOfUse ?? null,
            personalLiability: sgc?.personalLiability?.description ?? null,
            medicalPayments: sgc?.medicalPayments?.description ?? null,
            perilsDeductible: sgc?.perilsDeductible?.description ?? null,
            windDeductible: sgc?.windDeductible?.description ?? null,
            hurricaneDeductible: sgc?.hurricaneDeductible?.description ?? null,
          },
        };
        // Check for mismatches
        const expected = syncReport.coverages.updated;
        const mismatches: string[] = [];
        const has = (prefix: string) => expected.some((s: string) => s.startsWith(prefix));
        if (has('Dwelling') && !sgc?.dwelling) mismatches.push('dwelling');
        if (has('Liability') && !sgc?.personalLiability?.description) mismatches.push('personalLiability');
        if (has('All Peril') && !sgc?.perilsDeductible?.description) mismatches.push('perilsDeductible');
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
      result.beforeAfter = beforeAfter;

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
