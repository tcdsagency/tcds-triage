// API Route: /api/quick-links
// List and create quick links

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { quickLinks } from "@/db/schema";
import { eq, and, ilike, or, desc, asc } from "drizzle-orm";

// GET - List quick links with filtering
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const category = searchParams.get("category");
    const favorites = searchParams.get("favorites") === "true";

    const conditions = [eq(quickLinks.tenantId, tenantId)];

    if (favorites) {
      conditions.push(eq(quickLinks.isFavorite, true));
    }

    if (category) {
      conditions.push(eq(quickLinks.category, category));
    }

    let results;
    if (search) {
      results = await db
        .select()
        .from(quickLinks)
        .where(
          and(
            ...conditions,
            or(
              ilike(quickLinks.name, `%${search}%`),
              ilike(quickLinks.description, `%${search}%`),
              ilike(quickLinks.url, `%${search}%`)
            )
          )
        )
        .orderBy(desc(quickLinks.isFavorite), asc(quickLinks.sortOrder), quickLinks.name);
    } else {
      results = await db
        .select()
        .from(quickLinks)
        .where(and(...conditions))
        .orderBy(desc(quickLinks.isFavorite), asc(quickLinks.sortOrder), quickLinks.name);
    }

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: unknown) {
    console.error("[Quick Links] List error:", error);
    return NextResponse.json(
      { error: "Failed to list quick links", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// POST - Create new quick link
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const body = await request.json();

    if (!body.name || !body.url) {
      return NextResponse.json({ error: "Name and URL are required" }, { status: 400 });
    }

    const [newLink] = await db
      .insert(quickLinks)
      .values({
        tenantId,
        name: body.name,
        url: body.url,
        description: body.description || null,
        category: body.category || null,
        sortOrder: body.sortOrder || 0,
        isFavorite: body.isFavorite || false,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: newLink,
    });
  } catch (error: unknown) {
    console.error("[Quick Links] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create quick link", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
