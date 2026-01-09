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

    // Create scheduler and run manual check
    const scheduler = createRiskMonitorScheduler(tenantId);
    const result = await scheduler.checkPropertyManual(id);

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
              beds: result.rprData.beds,
              baths: result.rprData.baths,
              sqft: result.rprData.sqft,
              estimatedValue: result.rprData.estimatedValue,
              listing: result.rprData.listing,
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
