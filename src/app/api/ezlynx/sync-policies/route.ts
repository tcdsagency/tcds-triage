/**
 * Sync HawkSoft Policy Data to EZLynx Applications
 * ==================================================
 * Fetches active home/auto policies from HawkSoft, transforms them into
 * canonical snapshots, and pushes them to EZLynx applications using the
 * existing renewal-to-application mappers.
 *
 * POST /api/ezlynx/sync-policies
 * Body: { customerId: string, dryRun?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getHawkSoftClient } from "@/lib/api/hawksoft";
import { ezlynxBot } from "@/lib/api/ezlynx-bot";
import {
  renewalToAutoApplication,
  renewalToHomeApplication,
  hawksoftAutoToSnapshot,
  hawksoftHomeToSnapshot,
  type AutoSyncReport,
  type HomeSyncReport,
} from "@/lib/api/ezlynx-mappers";
import {
  getPolicyTypeFromLineOfBusiness,
} from "@/types/customer-profile";


// Inline the same transform logic from merged-profile (kept minimal)
function transformPolicy(hsPolicy: any, people?: any[]) {
  const lobCode = hsPolicy.loBs?.[0]?.code || hsPolicy.title || hsPolicy.lineOfBusiness || "";
  const policyType = getPolicyTypeFromLineOfBusiness(lobCode);
  const carrierName = typeof hsPolicy.carrier === 'string'
    ? hsPolicy.carrier
    : (hsPolicy.carrier?.name || hsPolicy.carrierName || "Unknown");

  // Separate policy-level vs vehicle-level coverages using parentId
  // HawkSoft links per-vehicle coverages via parentId matching vehicle.id
  // parentType is "Policy" for all (not "auto"), so we match by ID instead
  const allCoverages = hsPolicy.coverages || [];
  const vehicleIds = new Set(
    (hsPolicy.autos || hsPolicy.vehicles || []).map((v: any) => String(v.vehicleId || v.id))
  );
  const vehicleCoveragesByParent = new Map<string, any[]>();
  for (const cov of allCoverages) {
    if (cov.parentId && vehicleIds.has(String(cov.parentId))) {
      const list = vehicleCoveragesByParent.get(String(cov.parentId)) || [];
      list.push(cov);
      vehicleCoveragesByParent.set(String(cov.parentId), list);
    }
  }
  // Policy-level coverages = those NOT linked to a vehicle
  const policyCoverages = allCoverages.filter((cov: any) =>
    !cov.parentId || !vehicleIds.has(String(cov.parentId))
  );

  const coverages = policyCoverages.map((cov: any) => ({
    type: cov.code || cov.coverageType || cov.type || "",
    limit: cov.limits || cov.limit,
    deductible: cov.deductibles || cov.deductible,
    premium: cov.premium ? parseFloat(cov.premium) : undefined,
    description: cov.description || cov.name || "",
  })).filter((c: any) => c.type || c.description);

  // Vehicles — merge in vehicle-level coverages from policy coverages array
  const vehicles = (hsPolicy.autos || hsPolicy.vehicles || []).map((veh: any) => {
    const vehId = String(veh.vehicleId || veh.id);
    // Combine inline coverages (if any) with parent-linked coverages from policy level
    const inlineCovs = (veh.coverages || []).map((cov: any) => ({
      type: cov.code || cov.coverageType || cov.type,
      limit: cov.limits || cov.limit,
      deductible: cov.deductibles || cov.deductible,
    }));
    const parentCovs = (vehicleCoveragesByParent.get(vehId) || []).map((cov: any) => ({
      type: cov.code || cov.coverageType || cov.type,
      limit: cov.limits || cov.limit,
      deductible: cov.deductibles || cov.deductible,
    }));
    // Deduplicate by type, preferring parent-linked (more complete)
    const covByType = new Map<string, any>();
    for (const c of [...inlineCovs, ...parentCovs]) {
      if (c.type) covByType.set(c.type.toUpperCase(), c);
    }
    return {
      id: vehId,
      year: veh.year,
      make: veh.make,
      model: veh.model,
      vin: veh.vin,
      annualMiles: veh.annualMiles,
      usage: veh.usage || veh.use || veh.primaryUse,
      costNew: veh.costNew || veh.estimatedValue,
      coverages: Array.from(covByType.values()),
    };
  });

  // Drivers — enrich with people data for license info
  const drivers = (hsPolicy.drivers || []).map((drv: any) => {
    const matchingPerson = people?.find((p: any) => {
      const drvName = `${drv.firstName} ${drv.lastName}`.toLowerCase().trim();
      const personName = `${p.firstName} ${p.lastName}`.toLowerCase().trim();
      return drvName === personName;
    });
    return {
      firstName: drv.firstName,
      lastName: drv.lastName,
      name: `${drv.firstName || ""} ${drv.lastName || ""}`.trim(),
      dateOfBirth: drv.dateOfBirth || drv.dob || matchingPerson?.dateOfBirth,
      licenseNumber: drv.licenseNumber || matchingPerson?.licenseNumber,
      licenseState: drv.licenseState || matchingPerson?.licenseState,
      relationship: drv.relationship,
      gender: drv.gender || matchingPerson?.gender,
      maritalStatus: matchingPerson?.maritalStatus,
      excludedFromPolicy: drv.excluded,
    };
  });

  // Property (home)
  let property: any;
  if (policyType === "home" || policyType === "mobile_home") {
    const loc = hsPolicy.locations?.[0] || {};
    const addr = loc.address || loc;
    const building = loc.buildings?.[0] || {};
    const uw = building.personalUnderwriting || building.underwriting || {};
    property = {
      address: {
        street: addr.address1 || addr.street,
        city: addr.city,
        state: addr.state,
        zip: addr.zip || addr.zipCode,
      },
      yearBuilt: uw.yearBuilt || loc.yearBuilt,
      squareFeet: uw.squareFootage || uw.squareFeet || loc.squareFeet,
      constructionType: uw.dwellingType || uw.constructionType || loc.constructionType,
      roofType: uw.roofTypeCode !== 'Unknown' ? uw.roofTypeCode : undefined,
      stories: uw.stories || uw.numberOfStories,
      heatingType: uw.homeHeatSourceCode || uw.heatingType,
      protectionClass: uw.protectionClass,
      distanceToFireStation: uw.milesFromRFD || uw.distanceToFireStation,
      distanceToHydrant: uw.feetFromHydrant || uw.distanceToHydrant,
      roofYear: uw.roofYear,
      foundationType: uw.foundationType || uw.foundation,
      swimmingPool: uw.swimmingPoolType,
      trampoline: uw.trampolineType,
    };
  }

  // Active status check
  const isActive = calculateIsActive(hsPolicy);

  return {
    policyType,
    carrierName,
    policyNumber: hsPolicy.policyNumber,
    effectiveDate: hsPolicy.effectiveDate,
    expirationDate: hsPolicy.expirationDate,
    premium: hsPolicy.premium,
    coverages,
    vehicles,
    drivers,
    property,
    isActive,
  };
}

function calculateIsActive(hsPolicy: any): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parseDate = (d: string | null | undefined) => {
    if (!d) return null;
    const dt = new Date(d);
    dt.setHours(0, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  };
  const effectiveDate = parseDate(hsPolicy.effectiveDate);
  const expirationDate = parseDate(hsPolicy.expirationDate);
  const statusDate = parseDate(hsPolicy.statusDate);
  const rawStatus = (hsPolicy.status || "").toLowerCase().trim();

  switch (rawStatus) {
    case "new":
    case "active":
      return effectiveDate ? effectiveDate <= today : true;
    case "renewal":
    case "renew":
    case "reinstate":
      return true;
    case "rewrite":
      return expirationDate ? expirationDate > today : true;
    case "cancelled":
    case "canceled":
    case "nonrenew":
    case "non-renew":
      return statusDate ? statusDate > today : false;
    case "replaced":
    case "expired":
    case "deadfiled":
    case "prospect":
    case "void":
      return false;
    default:
      if (rawStatus.includes('replaced')) return false;
      return !expirationDate || expirationDate > today;
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { customerId, dryRun } = body;

    if (!customerId) {
      return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    // 1. Fetch customer
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
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

    const hawksoftClientCode = customer.hawksoftClientCode;
    if (!hawksoftClientCode) {
      return NextResponse.json(
        { error: "No HawkSoft client number on customer record" },
        { status: 400 }
      );
    }

    // 2. Fetch HawkSoft client data with policy expands
    const api = getHawkSoftClient();
    const hsClient = await api.getClient(
      parseInt(hawksoftClientCode),
      ['policies', 'people'],
      ['policies.drivers', 'policies.autos', 'policies.coverages', 'policies.locations']
    );

    const hsPolicies = hsClient.policies || [];
    const hsPeople = hsClient.people || [];

    // 3. Transform and filter active home/auto policies
    const transformed = hsPolicies
      .map((p: any) => transformPolicy(p, hsPeople))
      .filter((p: any) => p.isActive && (p.policyType === 'auto' || p.policyType === 'home'));

    if (transformed.length === 0) {
      return NextResponse.json(
        { error: "No active home or auto policies found in HawkSoft" },
        { status: 404 }
      );
    }

    // 4. Get EZLynx open applications
    let openApps: any[] = [];
    try {
      const appsResult = await ezlynxBot.getOpenApplications(ezlynxAccountId);
      openApps = appsResult || [];
    } catch (e) {
      console.log("[SyncPolicies] Could not fetch open applications:", (e as Error).message);
    }

    const results: any[] = [];
    const allBeforeAfter: { field: string; before: string; after: string }[] = [];

    // 5. Process each policy
    for (const policy of transformed) {
      try {
        if (policy.policyType === 'auto') {
          const { snapshot, comparison } = hawksoftAutoToSnapshot(policy);
          const existingAutoApp = openApps.find((a: any) => a.lob === "AUTO");

          let openAppId: string;
          if (existingAutoApp) {
            openAppId = existingAutoApp.openAppID;
          } else if (dryRun) {
            // For dry run, create a temp app to get template then note we'd create one
            allBeforeAfter.push({ field: 'Auto Application', before: '(none)', after: 'Will be created' });
            continue;
          } else {
            const created = await ezlynxBot.createAutoApplication(ezlynxAccountId);
            openAppId = created.openAppId;
          }

          const appTemplate = await ezlynxBot.getAutoApplication(openAppId);

          // Set prior carrier enum — EZLynx API resolves by name internally
          if (policy.carrierName) {
            const name = policy.carrierName;
            comparison.priorCarrierEnum = { value: 0, name, description: name };
          }

          const { app: mergedApp, syncReport } = renewalToAutoApplication(snapshot, comparison, appTemplate);

          // Build before/after diff
          const beforeAfter: { field: string; before: string; after: string }[] = [];
          const gc = appTemplate.coverage?.generalCoverage;
          const mgc = mergedApp.coverage?.generalCoverage;

          const oldEff = appTemplate.policyInformation?.effectiveDate || '';
          const newEff = mergedApp.policyInformation?.effectiveDate || '';
          if (oldEff !== newEff) beforeAfter.push({ field: 'Auto Effective Date', before: oldEff || '(empty)', after: newEff });

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
            beforeAfter.push({ field: `Driver: ${d.canopyName}`, before: '(new)', after: 'Added' });
          }
          for (const v of (syncReport.vehicles.added || [])) {
            beforeAfter.push({ field: `Vehicle: ${v.canopyDesc}`, before: '(new)', after: 'Added' });
          }

          allBeforeAfter.push(...beforeAfter);

          if (!dryRun) {
            await ezlynxBot.saveAutoApplication(openAppId, mergedApp);
          }

          results.push({
            type: 'auto',
            policyNumber: policy.policyNumber,
            carrier: policy.carrierName,
            syncReport,
            changeCount: beforeAfter.length,
          });

          console.log(
            `[SyncPolicies] Auto for ${ezlynxAccountId}:`,
            `${syncReport.drivers.matched.length} drivers matched, ${syncReport.drivers.added.length} added,`,
            `${syncReport.vehicles.matched.length} vehicles matched, ${(syncReport.vehicles.added || []).length} added,`,
            `${syncReport.coverages.updated.length} coverages updated`,
          );
        } else {
          // HOME
          const { snapshot, comparison, baselineSnapshot } = hawksoftHomeToSnapshot(policy);
          const existingHomeApp = openApps.find((a: any) => a.lob === "HOME");

          let openAppId: string;
          if (existingHomeApp) {
            openAppId = existingHomeApp.openAppID;
          } else if (dryRun) {
            allBeforeAfter.push({ field: 'Home Application', before: '(none)', after: 'Will be created' });
            continue;
          } else {
            const created = await ezlynxBot.createHomeApplication(ezlynxAccountId);
            openAppId = created.openAppId;
          }

          const appTemplate = await ezlynxBot.getHomeApplication(openAppId);

          // Set prior carrier enum — EZLynx API resolves by name internally
          if (policy.carrierName) {
            const name = policy.carrierName;
            comparison.priorCarrierEnum = { value: 0, name, description: name };
          }

          const { app: mergedApp, syncReport } = renewalToHomeApplication(snapshot, comparison, appTemplate, baselineSnapshot);

          // Build before/after diff
          const beforeAfter: { field: string; before: string; after: string }[] = [];
          const hgc = appTemplate.generalCoverage;
          const hmgc = mergedApp.generalCoverage;

          const oldEff = appTemplate.policyInformation?.effectiveDate || '';
          const newEff = mergedApp.policyInformation?.effectiveDate || '';
          if (oldEff !== newEff) beforeAfter.push({ field: 'Home Effective Date', before: oldEff || '(empty)', after: newEff });

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

          // Dwelling info changes
          for (const d of syncReport.dwelling.updated) {
            beforeAfter.push({ field: `Dwelling: ${d.split(' → ')[0]}`, before: '(empty)', after: d.split(' → ')[1] || d });
          }

          allBeforeAfter.push(...beforeAfter);

          if (!dryRun) {
            await ezlynxBot.saveHomeApplication(openAppId, mergedApp);
          }

          results.push({
            type: 'home',
            policyNumber: policy.policyNumber,
            carrier: policy.carrierName,
            syncReport,
            changeCount: beforeAfter.length,
          });

          console.log(
            `[SyncPolicies] Home for ${ezlynxAccountId}:`,
            `${syncReport.coverages.updated.length} coverages, ${syncReport.dwelling.updated.length} dwelling fields`,
          );
        }
      } catch (policyErr) {
        console.error(`[SyncPolicies] Error processing ${policy.policyType} policy ${policy.policyNumber}:`, policyErr);
        results.push({
          type: policy.policyType,
          policyNumber: policy.policyNumber,
          error: (policyErr as Error).message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: !!dryRun,
      ezlynxAccountId,
      policies: results,
      beforeAfter: allBeforeAfter,
    });
  } catch (error) {
    console.error("[SyncPolicies] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync policies" },
      { status: 500 }
    );
  }
}
