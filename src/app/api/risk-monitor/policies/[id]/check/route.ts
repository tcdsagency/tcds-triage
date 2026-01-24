// API Route: /api/risk-monitor/policies/[id]/check
// Manually trigger a property check for a single policy

import { NextRequest, NextResponse } from "next/server";
import { createRiskMonitorScheduler } from "@/lib/riskMonitor/scheduler";

// POST - Manually check a property
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { id } = await params;
    const forceRescan = request.nextUrl.searchParams.get("force_rescan") === "true";

    // Create scheduler and run manual check
    const scheduler = createRiskMonitorScheduler(tenantId);
    const result = await scheduler.checkPropertyManual(id, forceRescan);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === "Policy not found" ? 404 : 500 }
      );
    }

    return NextResponse.json({
      success: true,
      result: {
        address: result.address,
        previousStatus: result.previousStatus,
        newStatus: result.newStatus,
        alertCreated: result.alertCreated,
        rprData: result.rprData
          ? {
              // Basic property details
              beds: result.rprData.beds,
              baths: result.rprData.baths,
              sqft: result.rprData.sqft,
              stories: result.rprData.stories,
              yearBuilt: result.rprData.yearBuilt,
              propertyType: result.rprData.propertyType,
              // Lot
              lotSqft: result.rprData.lotSqft,
              lotAcres: result.rprData.lotAcres,
              // Construction (insurance key)
              roofType: result.rprData.roofType,
              roofMaterial: result.rprData.roofMaterial,
              foundation: result.rprData.foundation,
              exteriorWalls: result.rprData.exteriorWalls,
              constructionType: result.rprData.constructionType,
              hvac: result.rprData.hvac,
              // Features (liability)
              hasPool: result.rprData.hasPool,
              pool: result.rprData.pool,
              garageSpaces: result.rprData.garageSpaces,
              garageType: result.rprData.garageType,
              hasFireplace: result.rprData.hasFireplace,
              fireplaces: result.rprData.fireplaces,
              basement: result.rprData.basement,
              // Owner
              ownerName: result.rprData.ownerName,
              ownerOccupied: result.rprData.ownerOccupied,
              // Valuation
              assessedValue: result.rprData.assessedValue,
              estimatedValue: result.rprData.estimatedValue,
              taxAmount: result.rprData.taxAmount,
              lastSaleDate: result.rprData.lastSaleDate,
              lastSalePrice: result.rprData.lastSalePrice,
              // Risk
              floodZone: result.rprData.floodZone,
              floodRisk: result.rprData.floodRisk,
              // HOA
              hasHoa: result.rprData.hasHoa,
              hoaFee: result.rprData.hoaFee,
              // Listing & Status
              listing: result.rprData.listing,
              currentStatus: result.rprData.currentStatus,
            }
          : null,
        mmiData: result.mmiData
          ? {
              currentStatus: result.mmiData.currentStatus,
              listingHistory: result.mmiData.listingHistory?.slice(0, 3) || [],
              deedHistory: result.mmiData.deedHistory?.slice(0, 3) || [],
              lastSaleDate: result.mmiData.lastSaleDate,
              lastSalePrice: result.mmiData.lastSalePrice,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("[Risk Monitor] Error checking property:", error);
    return NextResponse.json(
      { error: "Failed to check property", details: error.message },
      { status: 500 }
    );
  }
}
