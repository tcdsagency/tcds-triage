// API Route: /api/weather-alerts/test
// Test NWS API connectivity and fetch alerts for a given location

import { NextRequest, NextResponse } from "next/server";
import { fetchActiveAlerts, resolveNWSZone, isPDS, severityRank } from "@/lib/nws";

// POST - Test NWS API with a zip/address/lat+lon
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zip, lat, lon } = body;

    // Check Twilio configuration
    const twilioConfigured = Boolean(
      process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
    );

    let alerts;
    let zoneInfo = null;

    if (lat && lon) {
      // Resolve zone from coordinates
      zoneInfo = await resolveNWSZone(lat, lon);
      alerts = await fetchActiveAlerts({ zone: [zoneInfo.zoneId] });
    } else if (zip) {
      // Use zip-based area search — NWS doesn't directly support zip,
      // so we fetch all active alerts and filter by area description
      const allAlerts = await fetchActiveAlerts({ limit: 500 });
      alerts = {
        ...allAlerts,
        features: allAlerts.features.filter(f => {
          const area = f.properties.areaDesc || '';
          // Check if any UGC codes or area descriptions might match
          // This is a rough filter — proper implementation would geocode the zip
          return area.includes(zip);
        }),
      };

      // If no matches by area, return all alerts (let user see what's active)
      if (alerts.features.length === 0) {
        alerts = allAlerts;
      }
    } else {
      return NextResponse.json(
        { error: "Provide zip or lat/lon coordinates" },
        { status: 400 }
      );
    }

    // Format alerts for response
    const formattedAlerts = alerts.features
      .map(f => ({
        id: f.properties.id,
        event: f.properties.event,
        severity: f.properties.severity,
        headline: f.properties.headline,
        areaDesc: f.properties.areaDesc,
        description: f.properties.description,
        instruction: f.properties.instruction,
        onset: f.properties.onset,
        expires: f.properties.expires,
        senderName: f.properties.senderName,
        isPds: isPDS(f.properties),
        urgency: f.properties.urgency,
        certainty: f.properties.certainty,
      }))
      .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

    return NextResponse.json({
      success: true,
      zoneInfo,
      alertCount: formattedAlerts.length,
      alerts: formattedAlerts,
      twilioConfigured,
    });
  } catch (error: any) {
    console.error("[Weather Alerts] Test error:", error);
    return NextResponse.json(
      { error: "NWS API test failed", details: error.message },
      { status: 500 }
    );
  }
}
