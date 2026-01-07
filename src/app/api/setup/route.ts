import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_TENANT_SLUG = 'tcds';

/**
 * GET /api/setup
 * Check if system is initialized
 */
export async function GET() {
  try {
    // Check if tenant exists
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, DEFAULT_TENANT_SLUG),
    });

    if (!tenant) {
      return NextResponse.json({
        initialized: false,
        message: 'System not initialized. POST to /api/setup to initialize.',
      });
    }

    // Count users
    const userList = await db.query.users.findMany({
      where: eq(users.tenantId, tenant.id),
      columns: { id: true, email: true, firstName: true, lastName: true, agencyzoomId: true },
    });

    return NextResponse.json({
      initialized: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      users: userList,
      userCount: userList.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/setup
 * Initialize the system with tenant and default user
 * 
 * Body (optional):
 * - tenantName: string (default: "TCDS Insurance")
 * - adminEmail: string (default: uses ADMIN_EMAIL env var)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantName = body.tenantName || 'TCDS Insurance';
    const adminEmail = body.adminEmail || process.env.ADMIN_EMAIL || 'admin@tcdsins.com';

    // Check if already initialized
    let tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, DEFAULT_TENANT_SLUG),
    });

    if (!tenant) {
      // Create tenant
      const [newTenant] = await db.insert(tenants).values({
        name: tenantName,
        slug: DEFAULT_TENANT_SLUG,
        timezone: 'America/Chicago',
      }).returning();
      tenant = newTenant;
      console.log(`[Setup] Created tenant: ${tenant.id}`);
    }

    // Check if admin user exists
    let adminUser = await db.query.users.findFirst({
      where: eq(users.email, adminEmail),
    });

    if (!adminUser) {
      // Create admin user
      const [newUser] = await db.insert(users).values({
        tenantId: tenant.id,
        email: adminEmail,
        firstName: 'Admin',
        lastName: 'User',
        role: 'admin',
        isActive: true,
      }).returning();
      adminUser = newUser;
      console.log(`[Setup] Created admin user: ${adminUser.id}`);
    }

    // Set the tenant ID in environment for other endpoints
    // (In production, this would come from auth context)
    process.env.DEFAULT_TENANT_ID = tenant.id;

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
      },
      nextSteps: [
        'Add DEFAULT_TENANT_ID to Vercel environment variables',
        'Visit /api/agencyzoom/users to see AgencyZoom users',
        'Map AgencyZoom users to internal users',
        'Run sync with POST /api/sync/customers',
      ],
    });
  } catch (error) {
    console.error('[Setup] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Setup failed' 
      },
      { status: 500 }
    );
  }
}
