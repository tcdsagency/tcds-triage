import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { customers, users } from '@/db/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import type { DonnaCustomerData } from '@/types/donna.types';
import { formatFullName } from '@/lib/utils';

/**
 * GET /api/donna/alerts
 * Get customers with Donna AI alerts (high churn risk, low sentiment, cross-sell opportunities)
 *
 * Returns prioritized list of customers needing attention based on Donna AI insights.
 *
 * Query params:
 * - limit: number - Max alerts to return (default: 20)
 * - type: 'all' | 'churn_risk' | 'low_sentiment' | 'cross_sell' (default: 'all')
 */
export async function GET(request: Request) {
  try {
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
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const alertType = url.searchParams.get('type') || 'all';

    // Query customers with Donna data and concerning metrics
    const customersWithData = await db.query.customers.findMany({
      where: and(
        eq(customers.tenantId, dbUser.tenantId),
        eq(customers.isArchived, false),
        isNotNull(customers.donnaData)
      ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        donnaData: true,
      },
    });

    // Filter and categorize alerts
    type AlertType = 'churn_risk' | 'low_sentiment' | 'cross_sell';
    type Severity = 'high' | 'medium' | 'low';

    interface DonnaAlert {
      customerId: string;
      customerName: string;
      alertType: AlertType;
      value: number;
      severity: Severity;
      message: string;
    }

    const alerts: DonnaAlert[] = [];

    for (const customer of customersWithData) {
      const donna = customer.donnaData as DonnaCustomerData | null;
      if (!donna) continue;

      const name = formatFullName(customer.firstName, customer.lastName);

      // High churn risk (retention < 50%)
      // Only alert if retention is a valid numeric value (not empty string, null, undefined, or 0.7 default)
      // Note: DB may have empty strings despite the type definition
      const rawRetention = donna.retentionProbability as unknown;
      const retentionValue = typeof rawRetention === 'number'
        ? rawRetention
        : parseFloat(String(rawRetention || ''));

      // Skip if retention is empty string, null, NaN, or the 0.7 default
      const hasValidRetention =
        rawRetention !== '' &&
        rawRetention !== null &&
        rawRetention !== undefined &&
        !isNaN(retentionValue) &&
        retentionValue !== 0.7;

      if (
        (alertType === 'all' || alertType === 'churn_risk') &&
        hasValidRetention &&
        retentionValue < 0.5
      ) {
        const churnRisk = Math.round((1 - retentionValue) * 100);
        alerts.push({
          customerId: customer.id,
          customerName: name,
          alertType: 'churn_risk',
          value: retentionValue,
          severity: retentionValue < 0.3 ? 'high' : 'medium',
          message: `${churnRisk}% churn risk`,
        });
      }

      // Low sentiment (< 40)
      if (
        (alertType === 'all' || alertType === 'low_sentiment') &&
        donna.sentimentScore !== undefined &&
        donna.sentimentScore < 40
      ) {
        alerts.push({
          customerId: customer.id,
          customerName: name,
          alertType: 'low_sentiment',
          value: donna.sentimentScore,
          severity: donna.sentimentScore < 20 ? 'high' : 'medium',
          message: `Sentiment: ${donna.sentimentScore}/100`,
        });
      }

      // High cross-sell opportunity (> 70%)
      if (
        (alertType === 'all' || alertType === 'cross_sell') &&
        donna.crossSellProbability !== undefined &&
        donna.crossSellProbability > 0.7
      ) {
        const crossSellPct = Math.round(donna.crossSellProbability * 100);
        alerts.push({
          customerId: customer.id,
          customerName: name,
          alertType: 'cross_sell',
          value: donna.crossSellProbability,
          severity: donna.crossSellProbability > 0.85 ? 'high' : 'medium',
          message: `${crossSellPct}% cross-sell probability`,
        });
      }
    }

    // Sort by severity (high first), then by urgency
    alerts.sort((a, b) => {
      // Severity order: high > medium > low
      const severityOrder = { high: 0, medium: 1, low: 2 };
      if (a.severity !== b.severity) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }

      // For same severity, prioritize by alert type: churn > sentiment > cross-sell
      const typeOrder = { churn_risk: 0, low_sentiment: 1, cross_sell: 2 };
      return typeOrder[a.alertType] - typeOrder[b.alertType];
    });

    // Apply limit
    const limitedAlerts = alerts.slice(0, limit);

    // Group by type for summary
    const summary = {
      churnRisk: alerts.filter((a) => a.alertType === 'churn_risk').length,
      lowSentiment: alerts.filter((a) => a.alertType === 'low_sentiment').length,
      crossSell: alerts.filter((a) => a.alertType === 'cross_sell').length,
    };

    return NextResponse.json({
      success: true,
      alerts: limitedAlerts,
      summary,
      total: alerts.length,
      limited: alerts.length > limit,
    });
  } catch (error) {
    console.error('[DonnaAlerts] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}
