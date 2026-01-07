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
    const client = getAgencyZoomClient();
    
    // Get AgencyZoom users
    const azUsers = await client.getUsers();
    
    // Get our internal users with agencyzoomId
    // Using a default tenant ID for now - in production this should be from auth
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
