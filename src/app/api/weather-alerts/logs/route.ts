// API Route: /api/weather-alerts/logs
// Get weather alert poll history and sent alert records

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { weatherAlertLog, sentWeatherAlerts, weatherAlertSubscriptions } from "@/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

// GET - Query logs with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not configured" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const alertType = searchParams.get('alertType');
    const view = searchParams.get('view') || 'runs'; // 'runs' or 'alerts'

    if (view === 'alerts') {
      // Query sent weather alerts
      const conditions = [eq(sentWeatherAlerts.tenantId, tenantId)];

      if (alertType) {
        conditions.push(eq(sentWeatherAlerts.event, alertType));
      }
      if (dateFrom) {
        conditions.push(gte(sentWeatherAlerts.createdAt, new Date(dateFrom)));
      }
      if (dateTo) {
        conditions.push(lte(sentWeatherAlerts.createdAt, new Date(dateTo)));
      }

      const alerts = await db
        .select({
          id: sentWeatherAlerts.id,
          nwsAlertId: sentWeatherAlerts.nwsAlertId,
          event: sentWeatherAlerts.event,
          severity: sentWeatherAlerts.severity,
          headline: sentWeatherAlerts.headline,
          areaDesc: sentWeatherAlerts.areaDesc,
          isPds: sentWeatherAlerts.isPds,
          onset: sentWeatherAlerts.onset,
          expires: sentWeatherAlerts.expires,
          subscriptionId: sentWeatherAlerts.subscriptionId,
          subscriptionLabel: weatherAlertSubscriptions.label,
          smsSentAt: sentWeatherAlerts.smsSentAt,
          smsStatus: sentWeatherAlerts.smsStatus,
          smsRecipient: sentWeatherAlerts.smsRecipient,
          createdAt: sentWeatherAlerts.createdAt,
        })
        .from(sentWeatherAlerts)
        .leftJoin(weatherAlertSubscriptions, eq(sentWeatherAlerts.subscriptionId, weatherAlertSubscriptions.id))
        .where(and(...conditions))
        .orderBy(desc(sentWeatherAlerts.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ success: true, alerts, view: 'alerts' });
    }

    // Default: query poll run history
    const conditions = [eq(weatherAlertLog.tenantId, tenantId)];

    if (status) {
      conditions.push(eq(weatherAlertLog.status, status));
    }
    if (dateFrom) {
      conditions.push(gte(weatherAlertLog.startedAt, new Date(dateFrom)));
    }
    if (dateTo) {
      conditions.push(lte(weatherAlertLog.startedAt, new Date(dateTo)));
    }

    const runs = await db
      .select()
      .from(weatherAlertLog)
      .where(and(...conditions))
      .orderBy(desc(weatherAlertLog.startedAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ success: true, runs, view: 'runs' });
  } catch (error: any) {
    console.error("[Weather Alerts] Error querying logs:", error);
    return NextResponse.json(
      { error: "Failed to query logs", details: error.message },
      { status: 500 }
    );
  }
}
