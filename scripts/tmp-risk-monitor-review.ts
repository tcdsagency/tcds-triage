require('dotenv').config({ path: '.env.production.local' });

async function run() {
  const { db } = await import('../src/db');
  const { sql } = await import('drizzle-orm');

  // 1. Policy stats
  const [policyCounts] = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_active = true) as active,
      COUNT(*) FILTER (WHERE is_active = false) as inactive,
      COUNT(*) FILTER (WHERE current_status = 'off_market') as off_market,
      COUNT(*) FILTER (WHERE current_status = 'active') as listing_active,
      COUNT(*) FILTER (WHERE current_status = 'pending') as pending,
      COUNT(*) FILTER (WHERE current_status = 'sold') as sold,
      COUNT(*) FILTER (WHERE current_status = 'unknown') as unknown,
      COUNT(*) FILTER (WHERE last_checked_at IS NULL AND is_active = true) as never_checked,
      COUNT(*) FILTER (WHERE last_checked_at > NOW() - INTERVAL '7 days' AND is_active = true) as checked_7d,
      COUNT(*) FILTER (WHERE last_checked_at > NOW() - INTERVAL '24 hours' AND is_active = true) as checked_24h
    FROM risk_monitor_policies
  `);
  const p = policyCounts as any;
  console.log('=== MONITORED POLICIES ===');
  console.log(`  Total: ${p.total} (${p.active} active, ${p.inactive} inactive)`);
  console.log(`  Off-market: ${p.off_market} | Listed: ${p.listing_active} | Pending: ${p.pending} | Sold: ${p.sold} | Unknown: ${p.unknown}`);
  console.log(`  Never checked: ${p.never_checked} | Checked last 24h: ${p.checked_24h} | Checked last 7d: ${p.checked_7d}`);

  // 2. Alert stats
  const [alertCounts] = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'new') as new_alerts,
      COUNT(*) FILTER (WHERE status = 'acknowledged') as acknowledged,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
      COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as last_7d,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as last_30d
    FROM risk_monitor_alerts
  `);
  const a = alertCounts as any;
  console.log('\n=== ALERTS ===');
  console.log(`  Total: ${a.total} | New: ${a.new_alerts} | Acknowledged: ${a.acknowledged} | In Progress: ${a.in_progress} | Resolved: ${a.resolved} | Dismissed: ${a.dismissed}`);
  console.log(`  Last 7 days: ${a.last_7d} | Last 30 days: ${a.last_30d}`);

  // 3. Alert types breakdown (last 30 days)
  const alertTypes = await db.execute(sql`
    SELECT alert_type, COUNT(*) as count
    FROM risk_monitor_alerts
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY alert_type
    ORDER BY count DESC
  `);
  if (alertTypes.length > 0) {
    console.log('\n=== ALERT TYPES (last 30 days) ===');
    for (const row of alertTypes) {
      const r = row as any;
      console.log(`  ${r.alert_type}: ${r.count}`);
    }
  }

  // 4. Recent run logs
  const recentLogs = await db.execute(sql`
    SELECT
      started_at,
      completed_at,
      status,
      run_type,
      policies_checked,
      alerts_created,
      errors_encountered,
      rpr_calls_made,
      mmi_calls_made,
      duration_ms
    FROM risk_monitor_activity_log
    ORDER BY started_at DESC
    LIMIT 20
  `);
  console.log('\n=== RECENT RUNS (last 20) ===');
  if (recentLogs.length === 0) {
    console.log('  No activity logs found');
  }
  for (const log of recentLogs) {
    const l = log as any;
    const time = new Date(l.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const dur = l.duration_ms ? `${(l.duration_ms / 1000).toFixed(0)}s` : '?';
    console.log(`  ${time} | ${String(l.run_type).padEnd(10)} | ${String(l.status).padEnd(10)} | checked: ${String(l.policies_checked).padStart(4)} | alerts: ${String(l.alerts_created).padStart(2)} | errors: ${l.errors_encountered} | RPR: ${l.rpr_calls_made} MMI: ${l.mmi_calls_made} | ${dur}`);
  }

  // 5. Recent alerts with property details
  const recentAlerts = await db.execute(sql`
    SELECT
      a.created_at,
      a.alert_type,
      a.status,
      a.priority,
      a.title,
      p.contact_name,
      p.address_line1,
      p.city,
      p.current_status
    FROM risk_monitor_alerts a
    JOIN risk_monitor_policies p ON a.policy_id = p.id
    ORDER BY a.created_at DESC
    LIMIT 25
  `);
  console.log('\n=== RECENT ALERTS (last 25) ===');
  if (recentAlerts.length === 0) {
    console.log('  No alerts found');
  }
  for (const alert of recentAlerts) {
    const r = alert as any;
    const time = new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    console.log(`  ${time} | ${String(r.alert_type).padEnd(22)} | pri:${r.priority} | ${String(r.status).padEnd(12)} | ${r.contact_name} - ${r.address_line1}, ${r.city} (${r.current_status})`);
  }

  // 6. Unresolved alerts needing attention
  const unresolvedAlerts = await db.execute(sql`
    SELECT
      a.created_at,
      a.alert_type,
      a.status,
      a.priority,
      a.title,
      p.contact_name,
      p.address_line1,
      p.city,
      p.current_status
    FROM risk_monitor_alerts a
    JOIN risk_monitor_policies p ON a.policy_id = p.id
    WHERE a.status IN ('new', 'acknowledged', 'in_progress')
    ORDER BY a.priority ASC, a.created_at ASC
  `);
  console.log('\n=== UNRESOLVED ALERTS NEEDING ACTION (' + unresolvedAlerts.length + ') ===');
  for (const alert of unresolvedAlerts) {
    const r = alert as any;
    const time = new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric' });
    console.log(`  ${time} | pri:${r.priority} | ${String(r.alert_type).padEnd(22)} | ${String(r.status).padEnd(12)} | ${r.contact_name} - ${r.address_line1}, ${r.city} (${r.current_status})`);
  }

  // 7. Settings
  const settings = await db.execute(sql`SELECT * FROM risk_monitor_settings LIMIT 1`);
  if (settings.length > 0) {
    const s = settings[0] as any;
    console.log('\n=== SETTINGS ===');
    console.log(`  Scheduler: ${s.scheduler_enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`  Check interval: ${s.check_interval_days} days`);
    console.log(`  Window: ${s.window_start_hour}:00 - ${s.window_end_hour}:00`);
    console.log(`  Max per run: ${s.max_properties_per_run}`);
    console.log(`  RPR: ${s.rpr_enabled ? 'ON' : 'OFF'} | MMI: ${s.mmi_enabled ? 'ON' : 'OFF'}`);
  }

  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
