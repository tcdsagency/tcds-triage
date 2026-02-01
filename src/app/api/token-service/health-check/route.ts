// API Route: /api/token-service/health-check
// Vercel cron canary — pings token service /health every 15 min
// Sends alert email if unreachable or tokens are expired

import { NextResponse } from "next/server";
import { outlookClient } from "@/lib/outlook";

export const maxDuration = 30;

const TOKEN_SERVICE_URL = (process.env.TOKEN_SERVICE_URL || "http://75.37.55.209:8899")
  .replace(/\\n$/, '').replace(/\n$/, '').replace(/\/+$/, '').replace(/\/token$/, '');

export async function GET() {
  try {
    const response = await fetch(`${TOKEN_SERVICE_URL}/health`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      await sendAlert(
        `Token service returned HTTP ${response.status}`,
        `The token service health check returned status ${response.status}.\nURL: ${TOKEN_SERVICE_URL}/health`
      );
      return NextResponse.json({
        status: "unhealthy",
        error: `HTTP ${response.status}`,
      }, { status: 502 });
    }

    const health = await response.json();

    const issues: string[] = [];

    // Check RPR token
    const rpr = health.tokens?.rpr;
    if (rpr && !rpr.hasToken) {
      issues.push("RPR: no token available");
    } else if (rpr && rpr.expiresInMinutes !== undefined && rpr.expiresInMinutes <= 0) {
      issues.push(`RPR: token expired`);
    }

    // Check MMI token
    const mmi = health.tokens?.mmi;
    if (mmi && !mmi.hasToken) {
      issues.push("MMI: no token available");
    } else if (mmi && mmi.expiresInMinutes !== undefined && mmi.expiresInMinutes <= 0) {
      issues.push(`MMI: token expired`);
    }

    if (issues.length > 0) {
      await sendAlert(
        `Token service issues: ${issues.join(", ")}`,
        `Token service is reachable but has issues:\n\n${issues.map((i) => `- ${i}`).join("\n")}\n\n` +
        `Full health response:\n${JSON.stringify(health, null, 2)}`
      );
    }

    return NextResponse.json({
      status: issues.length > 0 ? "degraded" : "healthy",
      issues,
      uptime: health.uptime_human,
      rpr: rpr ? { hasToken: rpr.hasToken, expiresInMinutes: rpr.expiresInMinutes } : null,
      mmi: mmi ? { hasToken: mmi.hasToken, expiresInMinutes: mmi.expiresInMinutes } : null,
    });
  } catch (error: any) {
    await sendAlert(
      "Token service UNREACHABLE",
      `Could not reach token service at ${TOKEN_SERVICE_URL}/health\n\nError: ${error.message}`
    );

    return NextResponse.json({
      status: "unreachable",
      error: error.message,
    }, { status: 502 });
  }
}

async function sendAlert(subject: string, body: string) {
  try {
    const alertEmail = process.env.OUTLOOK_SENDER_EMAIL || "agency@tcdsagency.com";
    await outlookClient.sendEmail({
      to: alertEmail,
      subject: `[TCDS Token Service] ${subject}`,
      body,
    });
    console.log(`[Token Health Check] Alert sent: ${subject}`);
  } catch (e: any) {
    console.error(`[Token Health Check] Failed to send alert: ${e.message}`);
  }
}
