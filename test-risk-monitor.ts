import { db } from './src/db';
import { riskMonitorPolicies, riskMonitorAlerts, riskMonitorActivityLog, riskMonitorSettings } from './src/db/schema';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

(async () => {
  try {
    const tenantId = process.env.DEFAULT_TENANT_ID!;
    console.log('Testing Drizzle ORM queries...');
    console.log('TenantId:', tenantId);

    // Query 1: Policy counts by status
    console.log('\n1. Policy counts by status:');
    const policyCounts = await db
      .select({
        status: riskMonitorPolicies.currentStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true)
        )
      )
      .groupBy(riskMonitorPolicies.currentStatus);
    console.log(policyCounts);

    // Query 2: Alert counts by status
    console.log('\n2. Alert counts by status:');
    const alertCounts = await db
      .select({
        status: riskMonitorAlerts.status,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorAlerts)
      .where(eq(riskMonitorAlerts.tenantId, tenantId))
      .groupBy(riskMonitorAlerts.status);
    console.log(alertCounts);

    // Query 3: Alert counts by type
    console.log('\n3. Alert counts by type:');
    const alertTypeCounts = await db
      .select({
        type: riskMonitorAlerts.alertType,
        count: sql<number>`count(*)::int`,
      })
      .from(riskMonitorAlerts)
      .where(eq(riskMonitorAlerts.tenantId, tenantId))
      .groupBy(riskMonitorAlerts.alertType);
    console.log(alertTypeCounts);

    // Query 4: Total policies
    console.log('\n4. Total policies:');
    const [{ totalPolicies }] = await db
      .select({ totalPolicies: sql<number>`count(*)::int` })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true)
        )
      );
    console.log({ totalPolicies });

    // Query 5: Unresolved alerts - this is the problematic one
    console.log('\n5. Unresolved alerts:');
    const [{ unresolvedAlerts }] = await db
      .select({ unresolvedAlerts: sql<number>`count(*)::int` })
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          sql`${riskMonitorAlerts.status} NOT IN ('resolved', 'dismissed')`
        )
      );
    console.log({ unresolvedAlerts });

    // Query 6: Recent alerts
    console.log('\n6. Recent alerts (last 7 days):');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentAlerts = await db
      .select()
      .from(riskMonitorAlerts)
      .where(
        and(
          eq(riskMonitorAlerts.tenantId, tenantId),
          gte(riskMonitorAlerts.createdAt, sevenDaysAgo)
        )
      )
      .orderBy(desc(riskMonitorAlerts.createdAt))
      .limit(5);
    console.log('Count:', recentAlerts.length);

    // Query 7: Last run
    console.log('\n7. Last run info:');
    const [lastRun] = await db
      .select()
      .from(riskMonitorActivityLog)
      .where(eq(riskMonitorActivityLog.tenantId, tenantId))
      .orderBy(desc(riskMonitorActivityLog.startedAt))
      .limit(1);
    console.log(lastRun);

    // Query 8: Settings
    console.log('\n8. Settings:');
    const [settings] = await db
      .select()
      .from(riskMonitorSettings)
      .where(eq(riskMonitorSettings.tenantId, tenantId))
      .limit(1);
    console.log(settings);

    // Query 9: Policies needing check
    console.log('\n9. Policies needing check:');
    const checkIntervalDays = settings?.recheckDays ?? 3;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - checkIntervalDays);

    const [{ needsCheck }] = await db
      .select({ needsCheck: sql<number>`count(*)::int` })
      .from(riskMonitorPolicies)
      .where(
        and(
          eq(riskMonitorPolicies.tenantId, tenantId),
          eq(riskMonitorPolicies.isActive, true),
          sql`(${riskMonitorPolicies.lastCheckedAt} IS NULL OR ${riskMonitorPolicies.lastCheckedAt} < ${cutoffDate})`
        )
      );
    console.log({ needsCheck });

    console.log('\n✅ All Drizzle queries passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
})();
