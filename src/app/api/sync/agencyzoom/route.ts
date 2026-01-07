import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { syncAgencyZoomCustomers } from '@/lib/api/sync';

/**
 * POST /api/sync/agencyzoom
 * Triggers a sync of customers from AgencyZoom
 */
export async function POST(request: NextRequest) {
  try {
    // Get current user and their tenant
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's tenant
    const dbUser = await db.query.users.findFirst({
      where: eq(users.authId, user.id),
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const modifiedSince = body.modifiedSince as string | undefined;

    // Run sync
    console.log(`Starting AgencyZoom sync for tenant ${dbUser.tenantId}`);
    const result = await syncAgencyZoomCustomers(dbUser.tenantId, {
      modifiedSince,
    });

    console.log(`Sync complete:`, result);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    );
  }
}
