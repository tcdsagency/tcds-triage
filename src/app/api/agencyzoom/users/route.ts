import { NextRequest, NextResponse } from 'next/server';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/agencyzoom/users
 * Get all AgencyZoom users for agent mapping
 * Shows which users are already mapped vs unmapped
 */
export async function GET(request: NextRequest) {
  try {
    // Get our internal users with agencyzoomId first (fast - just DB query)
    const internalUsers = await db.query.users.findMany({
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        agencyzoomId: true,
        extension: true,
      },
    });

    // Try to get AgencyZoom users (may fail/be slow - don't block)
    let azUsers: any[] = [];
    try {
      const client = getAgencyZoomClient();
      azUsers = await Promise.race([
        client.getUsers(),
        // Timeout after 5 seconds - just use internal users if AZ is slow
        new Promise<any[]>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
    } catch (e) {
      // AgencyZoom API failed or timed out - that's OK, we have internal users
      console.log('[AgencyZoom Users] API failed/timed out, using internal users only');
    }

    // Create a set of mapped AZ IDs
    const mappedAzIds = new Set(
      internalUsers
        .filter(u => u.agencyzoomId)
        .map(u => u.agencyzoomId)
    );

    // Annotate AZ users with mapping status
    const annotatedUsers = azUsers.map(azUser => ({
      agencyzoomId: azUser.id,
      firstName: azUser.firstName,
      lastName: azUser.lastName,
      email: azUser.email,
      isMapped: mappedAzIds.has(azUser.id.toString()),
      mappedTo: internalUsers.find(u => u.agencyzoomId === azUser.id.toString()) || null,
    }));

    return NextResponse.json({
      success: true,
      agencyzoomUsers: annotatedUsers,
      internalUsers: internalUsers,
      summary: {
        totalAgencyzoomUsers: azUsers.length,
        mappedUsers: annotatedUsers.filter(u => u.isMapped).length,
        unmappedUsers: annotatedUsers.filter(u => !u.isMapped).length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agencyzoom/users
 * Map an AgencyZoom user to an internal user
 * 
 * Body: { internalUserId: string, agencyzoomId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { internalUserId, agencyzoomId } = body;
    
    if (!internalUserId || !agencyzoomId) {
      return NextResponse.json(
        { error: 'Missing internalUserId or agencyzoomId' },
        { status: 400 }
      );
    }
    
    // Update the internal user with the AgencyZoom ID
    await db
      .update(users)
      .set({ 
        agencyzoomId: agencyzoomId.toString(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, internalUserId));
    
    return NextResponse.json({
      success: true,
      message: `Mapped internal user ${internalUserId} to AgencyZoom ID ${agencyzoomId}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
