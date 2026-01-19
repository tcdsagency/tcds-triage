import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ThreeCXClient, getThreeCXClient } from "@/lib/api/threecx";
import { VoIPToolsRelayClient, getVoIPToolsRelayClient } from "@/lib/api/voiptools-relay";

// 3CX Presence Status Types
type PresenceStatus = "available" | "away" | "dnd" | "on_call" | "offline";

interface TeamMember {
  id: string;
  name: string;
  extension: string;
  status: PresenceStatus;
  statusText?: string;
  avatarUrl?: string;
}

// Map 3CX/VoIPTools status to our format
function mapPresenceStatus(rawStatus: string | undefined): { status: PresenceStatus; text: string } {
  const status = (rawStatus || "").toLowerCase();

  switch (status) {
    case "available":
    case "online":
    case "idle":
      return { status: "available", text: "Available" };
    case "away":
    case "away_timeout":
    case "awayfromdesk":
      return { status: "away", text: "Away" };
    case "dnd":
    case "donotdisturb":
      return { status: "dnd", text: "Do Not Disturb" };
    case "busy":
    case "ringing":
    case "talking":
    case "oncall":
    case "on_call":
      return { status: "on_call", text: "On a call" };
    case "businesstrip":
      return { status: "away", text: "Business Trip" };
    case "lunch":
      return { status: "away", text: "Lunch" };
    default:
      return { status: "offline", text: "Offline" };
  }
}

// =============================================================================
// GET /api/3cx/presence - Get team presence status from 3CX or VoIPTools
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    console.log(`[Presence] ========== PRESENCE CHECK ==========`);
    console.log(`[Presence] Timestamp: ${new Date().toISOString()}`);

    // Get users from database to populate team
    const teamUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        extension: users.extension,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    console.log(`[Presence] Found ${teamUsers.length} team users with extensions:`, teamUsers.filter(u => u.extension).map(u => ({
      name: `${u.firstName} ${u.lastName}`.trim(),
      ext: u.extension
    })));

    // Try VoIPTools Relay first (preferred for presence)
    const voiptoolsClient = await getVoIPToolsRelayClient();
    console.log(`[Presence] VoIPTools client available: ${!!voiptoolsClient}`);
    if (voiptoolsClient) {
      try {
        // Get unique extension numbers from team users
        const extensionList = [...new Set(teamUsers.map(u => u.extension).filter(Boolean))] as string[];
        console.log(`[Presence] Querying VoIPTools for extensions: ${extensionList.join(', ')}`);
        const presenceData = await voiptoolsClient.getAllPresence(extensionList);
        console.log(`[Presence] VoIPTools raw response:`, presenceData.map(p => ({
          ext: p.Extension,
          status: p.Status,
          statusText: p.StatusText
        })));

        // Map VoIPTools presence to our format (only users with extensions)
        const teamMembers: TeamMember[] = teamUsers.filter(u => u.extension).map((user) => {
          const extData = presenceData.find(
            (p) => p.Extension === user.extension
          );

          const { status, text } = mapPresenceStatus(extData?.Status);

          // Clean up the status text from VoIPTools format
          let statusText = text;
          const rawStatus = extData?.StatusText || "";
          if (rawStatus.toLowerCase().includes("isincall: true")) {
            statusText = "On a call";
          } else if (rawStatus.toLowerCase().includes("out of office")) {
            statusText = "Out of Office";
          }

          return {
            id: user.id,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown",
            extension: user.extension || "",
            status,
            statusText,
            avatarUrl: user.avatarUrl || undefined,
          };
        });

        console.log(`[Presence] VoIPTools final mapping:`, teamMembers.map(m => ({
          name: m.name,
          ext: m.extension,
          status: m.status
        })));
        console.log(`[Presence] ========================================`);

        return NextResponse.json({
          success: true,
          connected: true,
          source: "voiptools",
          team: teamMembers,
        }, {
          headers: {
            // Cache presence for 10 seconds - status changes frequently
            'Cache-Control': 'public, max-age=10, stale-while-revalidate=5',
          },
        });
      } catch (voipError) {
        console.error("[Presence] VoIPTools API error:", voipError);
        // Fall through to 3CX Native
      }
    }

    // Try 3CX Native API with OAuth2
    const threecxClient = await getThreeCXClient();
    console.log(`[Presence] 3CX Native client available: ${!!threecxClient}`);
    if (threecxClient) {
      try {
        console.log(`[Presence] Querying 3CX Native API for presence`);
        const presenceData = await threecxClient.getAllExtensionStatuses();
        console.log(`[Presence] 3CX Native raw response:`, presenceData.map(p => ({
          ext: p.Extension || p.Number,
          status: p.Status || p.PresenceStatus
        })));

        // Map 3CX presence to our format (only users with extensions)
        const teamMembers: TeamMember[] = teamUsers.filter(u => u.extension).map((user) => {
          const extData = presenceData.find(
            (ext) => ext.Extension === user.extension || ext.Number === user.extension
          );

          const { status, text } = mapPresenceStatus(
            extData?.Status || extData?.PresenceStatus
          );
          const statusText = extData?.CallerName
            ? `On call with ${extData.CallerName}`
            : text;

          return {
            id: user.id,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown",
            extension: user.extension || "",
            status,
            statusText,
            avatarUrl: user.avatarUrl || undefined,
          };
        });

        console.log(`[Presence] 3CX Native final mapping:`, teamMembers.map(m => ({
          name: m.name,
          ext: m.extension,
          status: m.status
        })));
        console.log(`[Presence] ========================================`);

        return NextResponse.json({
          success: true,
          connected: true,
          source: "threecx",
          team: teamMembers,
        }, {
          headers: {
            'Cache-Control': 'public, max-age=10, stale-while-revalidate=5',
          },
        });
      } catch (apiError) {
        console.error("[Presence] 3CX API error:", apiError);
        // Fall through to mock data
      }
    }

    // Return mock/demo data if 3CX not configured or API failed (only users with extensions)
    console.log(`[Presence] WARNING: No presence source available, returning mock data`);
    const mockTeam: TeamMember[] = teamUsers.filter(u => u.extension).map((user, index) => {
      // Generate varied statuses for demo
      const statuses: { status: PresenceStatus; text: string }[] = [
        { status: "available", text: "Available" },
        { status: "on_call", text: "On a call" },
        { status: "dnd", text: "Do Not Disturb" },
        { status: "away", text: "Away" },
      ];
      const mockStatus = statuses[index % statuses.length];

      return {
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown',
        extension: user.extension || `10${index + 1}`,
        status: mockStatus.status,
        statusText: mockStatus.text,
        avatarUrl: user.avatarUrl || undefined,
      };
    });

    // If no users in database, return sample data
    if (mockTeam.length === 0) {
      return NextResponse.json({
        success: true,
        connected: false,
        team: [
          { id: "1", name: "Sarah Johnson", extension: "101", status: "available", statusText: "Available" },
          { id: "2", name: "Mike Chen", extension: "102", status: "on_call", statusText: "On a call" },
          { id: "3", name: "Emily Davis", extension: "103", status: "dnd", statusText: "Do Not Disturb" },
          { id: "4", name: "James Wilson", extension: "104", status: "away", statusText: "Away" },
        ] as TeamMember[],
      }, {
        headers: {
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=5',
        },
      });
    }

    return NextResponse.json({
      success: true,
      connected: false,
      team: mockTeam,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=5',
      },
    });
  } catch (error) {
    console.error("Error fetching 3CX presence:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team presence" },
      { status: 500 }
    );
  }
}
