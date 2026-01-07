import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// 3CX Presence Status Types
type PresenceStatus = "available" | "away" | "dnd" | "on_call" | "offline";

interface TeamMember {
  id: string;
  name: string;
  extension: string;
  status: PresenceStatus;
  statusText?: string;
  avatar?: string;
}

// =============================================================================
// GET /api/3cx/presence - Get team presence status from 3CX
// =============================================================================
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000001";

    // Get 3CX credentials from tenant integrations
    const [tenant] = await db
      .select({ integrations: tenants.integrations })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const integrations = (tenant?.integrations as Record<string, any>) || {};
    const threecxConfig = integrations.threecx || {};

    // Check environment variables as fallback
    const baseUrl = threecxConfig.baseUrl || process.env.THREECX_BASE_URL;
    const apiKey = threecxConfig.apiKey || process.env.THREECX_API_KEY;

    // Get users from database to populate team
    const teamUsers = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        role: users.role,
        extension: users.extension,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    // If 3CX is configured, try to fetch real presence data
    if (baseUrl && apiKey) {
      try {
        // 3CX API call to get system status / presence
        // Different 3CX versions have different API endpoints
        const presenceUrl = `${baseUrl}/api/SystemStatus/GetAllExtensionStatuses`;

        const response = await fetch(presenceUrl, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();

          // Map 3CX presence to our format
          const teamMembers: TeamMember[] = teamUsers.map((user) => {
            // Find matching extension in 3CX data
            const extData = data.find?.((ext: any) =>
              ext.Extension === user.extension || ext.Number === user.extension
            );

            let status: PresenceStatus = "offline";
            let statusText = "Offline";

            if (extData) {
              // Map 3CX status codes to our status
              switch (extData.Status?.toLowerCase() || extData.PresenceStatus?.toLowerCase()) {
                case "available":
                case "online":
                case "idle":
                  status = "available";
                  statusText = "Available";
                  break;
                case "away":
                case "away_timeout":
                  status = "away";
                  statusText = "Away";
                  break;
                case "dnd":
                case "donotdisturb":
                case "busy":
                  status = "dnd";
                  statusText = "Do Not Disturb";
                  break;
                case "ringing":
                case "talking":
                case "oncall":
                case "on_call":
                  status = "on_call";
                  statusText = extData.CallerName ? `On call with ${extData.CallerName}` : "On a call";
                  break;
                default:
                  status = "offline";
                  statusText = "Offline";
              }
            }

            return {
              id: user.id,
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown',
              extension: user.extension || '',
              status,
              statusText,
            };
          });

          return NextResponse.json({
            success: true,
            connected: true,
            team: teamMembers,
          });
        }
      } catch (apiError) {
        console.error("3CX API error:", apiError);
        // Fall through to mock data
      }
    }

    // Return mock/demo data if 3CX not configured or API failed
    const mockTeam: TeamMember[] = teamUsers.map((user, index) => {
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
      });
    }

    return NextResponse.json({
      success: true,
      connected: false,
      team: mockTeam,
    });
  } catch (error) {
    console.error("Error fetching 3CX presence:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch team presence" },
      { status: 500 }
    );
  }
}
