// API Route: /api/weather-alerts/subscriptions
// CRUD for weather alert monitored locations

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { weatherAlertSubscriptions, customers } from "@/db/schema";
import { eq, and, ilike, or, inArray } from "drizzle-orm";
import { resolveNWSZone } from "@/lib/nws";

// GET - List subscriptions
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const search = searchParams.get('search');

    const conditions = [eq(weatherAlertSubscriptions.tenantId, tenantId)];

    if (active === 'true') {
      conditions.push(eq(weatherAlertSubscriptions.isActive, true));
    } else if (active === 'false') {
      conditions.push(eq(weatherAlertSubscriptions.isActive, false));
    }

    if (search) {
      conditions.push(
        or(
          ilike(weatherAlertSubscriptions.label, `%${search}%`),
          ilike(weatherAlertSubscriptions.address, `%${search}%`),
          ilike(weatherAlertSubscriptions.zip, `%${search}%`),
        )!
      );
    }

    const subs = await db
      .select({
        id: weatherAlertSubscriptions.id,
        label: weatherAlertSubscriptions.label,
        address: weatherAlertSubscriptions.address,
        zip: weatherAlertSubscriptions.zip,
        lat: weatherAlertSubscriptions.lat,
        lon: weatherAlertSubscriptions.lon,
        nwsZone: weatherAlertSubscriptions.nwsZone,
        customerId: weatherAlertSubscriptions.customerId,
        customerFirstName: customers.firstName,
        customerLastName: customers.lastName,
        notifyPhone: weatherAlertSubscriptions.notifyPhone,
        notifyCustomer: weatherAlertSubscriptions.notifyCustomer,
        notifyStaff: weatherAlertSubscriptions.notifyStaff,
        isActive: weatherAlertSubscriptions.isActive,
        createdAt: weatherAlertSubscriptions.createdAt,
        updatedAt: weatherAlertSubscriptions.updatedAt,
      })
      .from(weatherAlertSubscriptions)
      .leftJoin(customers, eq(weatherAlertSubscriptions.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(weatherAlertSubscriptions.createdAt);

    // Map to include combined customer name
    const mapped = subs.map(s => ({
      ...s,
      customerName: s.customerFirstName ? `${s.customerFirstName} ${s.customerLastName}`.trim() : null,
    }));

    return NextResponse.json({ success: true, subscriptions: mapped });
  } catch (error: any) {
    console.error("[Weather Alerts] Error listing subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to list subscriptions", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create subscription
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.zip && !body.address && !(body.lat && body.lon)) {
      return NextResponse.json(
        { error: "At least one of zip, address, or lat/lon is required" },
        { status: 400 }
      );
    }

    // Try to resolve NWS zone if lat/lon provided
    let nwsZone: string | undefined;
    if (body.lat && body.lon) {
      try {
        const zoneInfo = await resolveNWSZone(body.lat, body.lon);
        nwsZone = zoneInfo.zoneId;
      } catch (err) {
        console.warn("[Weather Alerts] Could not resolve NWS zone:", err);
      }
    }

    const [sub] = await db
      .insert(weatherAlertSubscriptions)
      .values({
        tenantId,
        label: body.label || body.address || body.zip,
        address: body.address,
        zip: body.zip,
        lat: body.lat,
        lon: body.lon,
        nwsZone: nwsZone || body.nwsZone,
        customerId: body.customerId || null,
        notifyPhone: body.notifyPhone,
        notifyCustomer: body.notifyCustomer ?? false,
        notifyStaff: body.notifyStaff ?? true,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ success: true, subscription: sub }, { status: 201 });
  } catch (error: any) {
    console.error("[Weather Alerts] Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Update subscription(s)
export async function PATCH(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Subscription id is required" }, { status: 400 });
    }

    const updateData: Partial<typeof weatherAlertSubscriptions.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    if (updates.notifyPhone !== undefined) updateData.notifyPhone = updates.notifyPhone;
    if (updates.notifyCustomer !== undefined) updateData.notifyCustomer = updates.notifyCustomer;
    if (updates.notifyStaff !== undefined) updateData.notifyStaff = updates.notifyStaff;
    if (updates.label !== undefined) updateData.label = updates.label;

    const [updated] = await db
      .update(weatherAlertSubscriptions)
      .set(updateData)
      .where(and(
        eq(weatherAlertSubscriptions.id, id),
        eq(weatherAlertSubscriptions.tenantId, tenantId),
      ))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, subscription: updated });
  } catch (error: any) {
    console.error("[Weather Alerts] Error updating subscription:", error);
    return NextResponse.json(
      { error: "Failed to update subscription", details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove subscriptions
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();
    const ids: string[] = Array.isArray(body.ids) ? body.ids : [body.id];

    if (!ids.length) {
      return NextResponse.json({ error: "At least one id is required" }, { status: 400 });
    }

    const deleted = await db
      .delete(weatherAlertSubscriptions)
      .where(and(
        inArray(weatherAlertSubscriptions.id, ids),
        eq(weatherAlertSubscriptions.tenantId, tenantId),
      ))
      .returning({ id: weatherAlertSubscriptions.id });

    return NextResponse.json({ success: true, deleted: deleted.length });
  } catch (error: any) {
    console.error("[Weather Alerts] Error deleting subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to delete subscriptions", details: error.message },
      { status: 500 }
    );
  }
}
