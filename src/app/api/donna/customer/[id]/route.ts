import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { customers, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { syncCustomerFromDonna } from '@/lib/api/donna-sync';
import { getDonnaCustomerId } from '@/lib/api/donna';

/**
 * GET /api/donna/customer/{id}
 * Get Donna AI data for a specific customer
 *
 * Query params:
 * - refresh: true - Force refresh from Donna API (otherwise returns cached data)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Await params to get the id
    const { id: customerId } = await params;

    // Get current user and their tenant
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

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

    // Parse query params
    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh') === 'true';

    // If refresh requested, sync from Donna first
    if (refresh) {
      const syncResult = await syncCustomerFromDonna(
        dbUser.tenantId,
        customerId
      );

      if (!syncResult.success) {
        // If customer not found in Donna, return existing cached data
        if (syncResult.error === 'Customer not found in Donna') {
          // Continue to return cached data below
        } else {
          return NextResponse.json(
            {
              success: false,
              error: syncResult.error,
              cached: false,
            },
            { status: syncResult.error === 'Customer not found' ? 404 : 500 }
          );
        }
      }
    }

    // Fetch customer with Donna data
    const customer = await db.query.customers.findFirst({
      where: and(
        eq(customers.tenantId, dbUser.tenantId),
        eq(customers.id, customerId)
      ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        hawksoftClientCode: true,
        donnaData: true,
        lastSyncedFromDonna: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      customerName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
      donnaId: getDonnaCustomerId(customer.hawksoftClientCode),
      data: customer.donnaData,
      lastSyncedAt: customer.lastSyncedFromDonna,
      hasDonnaData: !!customer.donnaData,
    });
  } catch (error) {
    console.error('[DonnaAPI] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch Donna data',
      },
      { status: 500 }
    );
  }
}
