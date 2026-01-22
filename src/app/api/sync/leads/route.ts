import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, users } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

export const maxDuration = 300; // Pro plan: 5 minutes
export const dynamic = 'force-dynamic';

/**
 * Lead Sync from AgencyZoom
 * =========================
 * Syncs leads (not yet customers) from AgencyZoom
 * Leads are stored in customers table with isLead=true
 * 
 * POST /api/sync/leads
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`${((Date.now() - startTime) / 1000).toFixed(1)}s: ${msg}`);
  };

  const tenantId = process.env.DEFAULT_TENANT_ID;
  if (!tenantId) {
    return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 });
  }

  try {
    log('Starting lead sync from AgencyZoom...');
    
    const client = getAgencyZoomClient();
    
    // Build agent lookup map (AZ ID -> our user ID)
    const allUsers = await db.select({
      id: users.id,
      agencyzoomId: users.agencyzoomId,
    }).from(users).where(eq(users.tenantId, tenantId));
    
    const agentMap = new Map<string, string>();
    for (const u of allUsers) {
      if (u.agencyzoomId) {
        agentMap.set(u.agencyzoomId, u.id);
      }
    }
    log(`Agent map: ${agentMap.size} users`);

    // Get existing leads (by AZ ID) - include isLead flag to skip converted customers
    const existingLeads = await db.select({
      id: customers.id,
      agencyzoomId: customers.agencyzoomId,
      isLead: customers.isLead,
    })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));

    const existingMap = new Map<string, { id: string; isLead: boolean | null }>();
    for (const c of existingLeads) {
      if (c.agencyzoomId) {
        existingMap.set(c.agencyzoomId, { id: c.id, isLead: c.isLead });
      }
    }
    log(`Existing records: ${existingMap.size}`);

    // Fetch leads from AgencyZoom (paginated)
    let page = 1;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalLeads = 0;
    const seenIds = new Set<string>();

    while (true) {
      const result = await client.getLeads({ page, limit: 100 });
      const leads = result.data;
      
      if (leads.length === 0) {
        log(`Page ${page}: 0 leads, done`);
        break;
      }

      log(`Page ${page}: ${leads.length} leads`);
      totalLeads += leads.length;

      for (const lead of leads) {
        const azId = lead.id?.toString();
        if (!azId || seenIds.has(azId)) continue;
        seenIds.add(azId);

        const raw = lead as any;
        const firstName = raw.firstname || raw.firstName || lead.firstName || '';
        const lastName = raw.lastname || raw.lastName || lead.lastName || '';
        
        // Map AZ producer to our user ID if assigned
        const azProducerId = raw.producerId || raw.producer_id || raw.assignedTo || null;
        const producerId = azProducerId ? agentMap.get(azProducerId.toString()) || null : null;

        // Extract pipeline fields from AgencyZoom response
        const pipelineId = raw.pipelineId || raw.pipeline_id || null;
        const pipelineStageId = raw.stageId || raw.stage_id || raw.pipelineStageId || null;
        const quotedPremium = raw.premium || raw.quotedPremium || raw.quoted_premium || null;
        const stageEnteredAt = raw.stageEnteredAt || raw.stage_entered_at || raw.stageDate || null;

        const data = {
          tenantId,
          agencyzoomId: azId,
          firstName: firstName || 'Unknown',
          lastName: lastName || 'Lead',
          email: raw.email || lead.email || null,
          phone: normalizePhone(raw.phone || lead.phone),
          phoneAlt: normalizePhone(raw.phonecell || raw.secondaryphone),
          leadSource: raw.source || lead.source || null,
          pipelineStage: raw.pipelinestage || raw.stageName || null,
          pipelineId: pipelineId ? parseInt(pipelineId) : null,
          pipelineStageId: pipelineStageId ? parseInt(pipelineStageId) : null,
          stageEnteredAt: stageEnteredAt ? new Date(stageEnteredAt) : null,
          quotedPremium: quotedPremium ? parseFloat(quotedPremium) : null,
          isLead: true,
          leadStatus: raw.status || lead.status || 'new',
          producerId, // Set producer if assigned in AgencyZoom
          lastSyncedFromAz: new Date(),
        };

        const existing = existingMap.get(azId);

        try {
          // Skip if this record was converted to a customer (no longer a lead)
          if (existing && existing.isLead === false) {
            continue; // Don't overwrite customer records
          }

          // Use upsert to handle duplicates atomically
          // This will insert if not exists, or update if exists (based on unique index)
          await db.insert(customers)
            .values({
              ...data,
              createdAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [customers.tenantId, customers.agencyzoomId],
              set: {
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                phone: data.phone,
                phoneAlt: data.phoneAlt,
                leadSource: data.leadSource,
                pipelineStage: data.pipelineStage,
                pipelineId: data.pipelineId,
                pipelineStageId: data.pipelineStageId,
                stageEnteredAt: data.stageEnteredAt,
                quotedPremium: data.quotedPremium,
                leadStatus: data.leadStatus,
                producerId: data.producerId,
                lastSyncedFromAz: data.lastSyncedFromAz,
                updatedAt: new Date(),
              },
            });

          if (existing) {
            totalUpdated++;
          } else {
            totalCreated++;
            // Add to map for subsequent iterations
            existingMap.set(azId, { id: '', isLead: true });
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          log(`Error syncing lead ${azId}: ${errorMsg}`);
        }
      }

      page++;
      
      // Safety limit
      if (page > 50) {
        log('Reached page limit (50)');
        break;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`Complete! ${totalCreated} created, ${totalUpdated} updated`);

    return NextResponse.json({
      success: true,
      created: totalCreated,
      updated: totalUpdated,
      total: totalLeads,
      duration: `${duration}s`,
      logs,
    });

  } catch (error) {
    log(`Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed',
      logs,
    }, { status: 500 });
  }
}

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
