import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import crypto from "crypto";

// Generate a secure API key
function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const prefix = "tcds_" + crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(24).toString("hex");
  const fullKey = `${prefix}_${secret}`;
  const hash = crypto.createHash("sha256").update(fullKey).digest("hex");
  return { fullKey, prefix, hash };
}

// =============================================================================
// GET /api/api-keys - List all API keys (without full key)
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        allowedIps: apiKeys.allowedIps,
        rateLimit: apiKeys.rateLimit,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        usageCount: apiKeys.usageCount,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId))
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({
      success: true,
      apiKeys: keys,
    });
  } catch (error) {
    console.error("Error fetching API keys:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST /api/api-keys - Create new API key
// =============================================================================
export async function POST(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { name, permissions, allowedIps, rateLimit, expiresAt } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Name is required" },
        { status: 400 }
      );
    }

    // Generate secure API key
    const { fullKey, prefix, hash } = generateApiKey();

    const [key] = await db
      .insert(apiKeys)
      .values({
        tenantId,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        permissions: permissions || ["read"],
        allowedIps: allowedIps || [],
        rateLimit: rateLimit || 1000,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      })
      .returning();

    // Return full key only on creation - it will never be shown again
    return NextResponse.json({
      success: true,
      apiKey: {
        id: key.id,
        name: key.name,
        key: fullKey, // Only returned once!
        keyPrefix: key.keyPrefix,
        permissions: key.permissions,
        allowedIps: key.allowedIps,
        rateLimit: key.rateLimit,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      },
      warning: "Save this API key now. It will not be shown again.",
    });
  } catch (error) {
    console.error("Error creating API key:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// =============================================================================
// PUT /api/api-keys - Update API key (name, permissions, etc. - not the key itself)
// =============================================================================
export async function PUT(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const body = await request.json();
    const { id, name, permissions, allowedIps, rateLimit, isActive } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "API key ID is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (allowedIps !== undefined) updateData.allowedIps = allowedIps;
    if (rateLimit !== undefined) updateData.rateLimit = rateLimit;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [key] = await db
      .update(apiKeys)
      .set(updateData)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)))
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        permissions: apiKeys.permissions,
        allowedIps: apiKeys.allowedIps,
        rateLimit: apiKeys.rateLimit,
        isActive: apiKeys.isActive,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        usageCount: apiKeys.usageCount,
        createdAt: apiKeys.createdAt,
      });

    return NextResponse.json({
      success: true,
      apiKey: key,
    });
  } catch (error) {
    console.error("Error updating API key:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update API key" },
      { status: 500 }
    );
  }
}

// =============================================================================
// DELETE /api/api-keys - Revoke API key (soft delete)
// =============================================================================
export async function DELETE(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "API key ID is required" },
        { status: 400 }
      );
    }

    // Soft delete - mark as revoked
    await db
      .update(apiKeys)
      .set({
        isActive: false,
        revokedAt: new Date(),
      })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));

    return NextResponse.json({
      success: true,
      message: "API key revoked",
    });
  } catch (error) {
    console.error("Error revoking API key:", error);
    return NextResponse.json(
      { success: false, error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}

// =============================================================================
// Verify API key (for middleware use)
// =============================================================================
export async function verifyApiKey(key: string): Promise<{ valid: boolean; tenantId?: string; permissions?: string[] }> {
  try {
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const prefix = key.split("_").slice(0, 2).join("_");

    const [apiKey] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyHash, hash),
          eq(apiKeys.keyPrefix, prefix),
          eq(apiKeys.isActive, true),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);

    if (!apiKey) {
      return { valid: false };
    }

    // Check expiration
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false };
    }

    // Update usage stats
    await db
      .update(apiKeys)
      .set({
        lastUsedAt: new Date(),
        usageCount: (apiKey.usageCount || 0) + 1,
      })
      .where(eq(apiKeys.id, apiKey.id));

    return {
      valid: true,
      tenantId: apiKey.tenantId,
      permissions: apiKey.permissions as string[],
    };
  } catch {
    return { valid: false };
  }
}
