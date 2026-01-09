/**
 * Sync Canopy Pull to AgencyZoom Note
 * =====================================
 * Create a note in AgencyZoom with the policy data from Canopy.
 *
 * POST /api/canopy-connect/[id]/sync-note
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { canopyConnectPulls, customers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { CanopyClient } from "@/lib/api/canopy";
import { getAgencyZoomClient } from "@/lib/api/agencyzoom";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const tenantId = process.env.DEFAULT_TENANT_ID;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    // Get pull
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

    // Need a customer match to sync
    if (!pull.matchedAgencyzoomId && !pull.matchedCustomerId) {
      return NextResponse.json(
        { error: "Pull must be matched to a customer before syncing" },
        { status: 400 }
      );
    }

    // Get AgencyZoom ID
    let agencyzoomId = pull.matchedAgencyzoomId;
    if (!agencyzoomId && pull.matchedCustomerId) {
      const [customer] = await db
        .select({ agencyzoomId: customers.agencyzoomId })
        .from(customers)
        .where(eq(customers.id, pull.matchedCustomerId))
        .limit(1);
      agencyzoomId = customer?.agencyzoomId;
    }

    if (!agencyzoomId) {
      return NextResponse.json(
        { error: "Customer has no AgencyZoom ID" },
        { status: 400 }
      );
    }

    // Build note content from pull data
    const extractedData = {
      pullId: pull.pullId,
      pullStatus: (pull.pullStatus || "SUCCESS") as "SUCCESS" | "PENDING" | "FAILED" | "EXPIRED",
      firstName: pull.firstName,
      lastName: pull.lastName,
      email: pull.email,
      phone: pull.phone,
      dateOfBirth: pull.dateOfBirth,
      address: {
        street: (pull.address as any)?.street,
        city: (pull.address as any)?.city,
        state: (pull.address as any)?.state,
        zip: (pull.address as any)?.zip,
        fullAddress: (pull.address as any)?.fullAddress,
      },
      secondaryInsured: pull.secondaryInsured ? {
        firstName: (pull.secondaryInsured as any).firstName,
        lastName: (pull.secondaryInsured as any).lastName,
        dateOfBirth: (pull.secondaryInsured as any).dateOfBirth,
        relationship: (pull.secondaryInsured as any).relationship,
      } : null,
      carrierName: pull.carrierName,
      carrierFriendlyName: pull.carrierFriendlyName,
      policies: pull.policies || [],
      vehicles: pull.vehicles || [],
      drivers: pull.drivers || [],
      dwellings: pull.dwellings || [],
      coverages: pull.coverages || [],
      documents: pull.documents || [],
      claims: pull.claims || [],
      totalPremiumCents: pull.totalPremiumCents,
      canopyLinkUsed: pull.canopyLinkUsed,
    };

    const noteContent = CanopyClient.generateNoteContent(extractedData as any);

    // Get AgencyZoom client and create note
    let azClient;
    try {
      azClient = await getAgencyZoomClient();
    } catch (error) {
      return NextResponse.json(
        { error: "AgencyZoom not configured" },
        { status: 500 }
      );
    }

    // Create note in AgencyZoom
    const azId = parseInt(agencyzoomId);
    if (isNaN(azId)) {
      return NextResponse.json(
        { error: "Invalid AgencyZoom ID" },
        { status: 400 }
      );
    }

    let noteResult;
    if (pull.matchedAgencyzoomType === "lead") {
      noteResult = await azClient.addLeadNote(azId, noteContent);
    } else {
      noteResult = await azClient.addNote(azId, noteContent);
    }

    if (!noteResult.success) {
      return NextResponse.json(
        { error: "Failed to create note in AgencyZoom" },
        { status: 500 }
      );
    }

    // Update pull with sync status
    const [updated] = await db
      .update(canopyConnectPulls)
      .set({
        agencyzoomNoteSynced: true,
        agencyzoomNoteId: noteResult.id?.toString(),
        matchStatus: "created",
        updatedAt: new Date(),
      })
      .where(eq(canopyConnectPulls.id, id))
      .returning();

    console.log(`[Canopy API] Synced pull ${id} to AgencyZoom note ${noteResult.id}`);

    return NextResponse.json({
      success: true,
      noteId: noteResult.id,
      pull: updated,
    });
  } catch (error) {
    console.error("[Canopy API] Error syncing note:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync note" },
      { status: 500 }
    );
  }
}
