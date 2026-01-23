/**
 * Service Pipeline API
 * GET /api/service-pipeline
 *
 * Returns combined data for the Service Pipeline Kanban board:
 * - Triage items (pending wrapups + messages)
 * - Service tickets grouped by stage (New, In Progress, Waiting on Info)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { wrapupDrafts, messages, users, calls, serviceTickets, customers } from '@/db/schema';
import { eq, and, desc, sql, inArray, or } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { SERVICE_PIPELINES } from '@/lib/api/agencyzoom-service-tickets';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';

// Policy Service Pipeline stages
const PIPELINE_STAGES = {
  TRIAGE: 'triage',
  NEW: 111160,
  IN_PROGRESS: 111161,
  WAITING_ON_INFO: 111162,
  COMPLETED: 'completed',
} as const;

const STAGE_CONFIG = [
  { id: 'triage', name: 'Triage', color: 'amber', order: 0 },
  { id: 111160, name: 'New', color: 'blue', order: 1 },
  { id: 111161, name: 'In Progress', color: 'purple', order: 2 },
  { id: 111162, name: 'Waiting on Info', color: 'orange', order: 3 },
  { id: 'completed', name: 'Completed', color: 'green', order: 4 },
];

// Helper to get current user
async function getCurrentUser(): Promise<{ id: string; role: string | null; extension: string | null } | null> {
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser?.email) return null;

    const [dbUser] = await db
      .select({
        id: users.id,
        role: users.role,
        extension: users.extension,
      })
      .from(users)
      .where(eq(users.email, authUser.email))
      .limit(1);

    return dbUser || null;
  } catch (error) {
    console.error('[Service Pipeline] Failed to get current user:', error);
    return null;
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface TriageItem {
  id: string;
  itemType: 'wrapup' | 'message';
  direction: 'inbound' | 'outbound' | null;
  contactName: string | null;
  contactPhone: string;
  contactEmail: string | null;
  matchStatus: 'matched' | 'needs_review' | 'unmatched' | 'after_hours';
  summary: string;
  transcript?: string;
  requestType: string | null;
  handledBy: string | null;
  handledByAgent: {
    id: string;
    name: string;
    avatar: string | null;
    extension: string | null;
    initials: string;
  } | null;
  timestamp: string;
  ageMinutes: number;
  agencyzoomCustomerId?: string;
  agencyzoomLeadId?: string;
  callId?: string;
  messageIds?: string[];
}

export interface ServiceTicketItem {
  id: string;
  azTicketId: number;
  subject: string;
  description: string | null;
  customerName: string | null;
  customerPhone: string | null;
  stageId: number | null;
  stageName: string | null;
  csrId: number | null;
  csrName: string | null;
  csrInitials: string | null;
  priorityId: number | null;
  priorityName: string | null;
  categoryId: number | null;
  categoryName: string | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  ageMinutes: number;
  azHouseholdId: number | null;
  status: 'active' | 'completed';
}

export interface Employee {
  id: number;
  name: string;
  initials: string;
}

interface PipelineResponse {
  stages: typeof STAGE_CONFIG;
  items: {
    triage: TriageItem[];
    completed: ServiceTicketItem[];
    [key: number]: ServiceTicketItem[];
  };
  employees: Employee[];
  counts: Record<string | number, number>;
}

// =============================================================================
// GET - Fetch Pipeline Data
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const tenantIdEnv = process.env.DEFAULT_TENANT_ID;
    if (!tenantIdEnv) {
      return NextResponse.json({ error: 'Tenant not configured' }, { status: 500 });
    }
    const tenantId: string = tenantIdEnv;

    // Get current user for filtering
    const currentUser = await getCurrentUser();
    const isAgent = currentUser?.role === 'agent';
    const userExtension = currentUser?.extension;
    const agentCanSeeWrapups = !isAgent || (isAgent && userExtension);

    const now = new Date();

    // =======================================================================
    // PARALLEL DATA FETCHING
    // =======================================================================

    // Fetch triage items (pending wrapups + messages)
    async function fetchTriageItems(): Promise<TriageItem[]> {
      const items: TriageItem[] = [];

      // Fetch pending wrapups
      if (agentCanSeeWrapups) {
        const whereConditions = [
          eq(wrapupDrafts.tenantId, tenantId),
          eq(wrapupDrafts.status, 'pending_review'),
        ];

        if (isAgent && userExtension) {
          whereConditions.push(
            or(
              eq(wrapupDrafts.agentExtension, userExtension),
              eq(calls.extension, userExtension)
            )!
          );
        }

        const wrapups = await db
          .select({
            id: wrapupDrafts.id,
            callId: wrapupDrafts.callId,
            direction: wrapupDrafts.direction,
            customerName: wrapupDrafts.customerName,
            customerPhone: wrapupDrafts.customerPhone,
            customerEmail: wrapupDrafts.customerEmail,
            requestType: wrapupDrafts.requestType,
            summary: wrapupDrafts.summary,
            aiCleanedSummary: wrapupDrafts.aiCleanedSummary,
            aiExtraction: wrapupDrafts.aiExtraction,
            matchStatus: wrapupDrafts.matchStatus,
            createdAt: wrapupDrafts.createdAt,
            callFromNumber: calls.fromNumber,
            callToNumber: calls.toNumber,
            agentId: calls.agentId,
            transcript: calls.transcription,
            callStartedAt: calls.startedAt,
          })
          .from(wrapupDrafts)
          .leftJoin(calls, eq(wrapupDrafts.callId, calls.id))
          .where(and(...whereConditions))
          .orderBy(desc(wrapupDrafts.createdAt))
          .limit(100);

        // Get agent details
        const agentIds = wrapups.map(w => w.agentId).filter(Boolean) as string[];
        const agents = agentIds.length > 0
          ? await db
              .select({
                id: users.id,
                firstName: users.firstName,
                lastName: users.lastName,
                avatarUrl: users.avatarUrl,
                extension: users.extension,
              })
              .from(users)
              .where(inArray(users.id, agentIds))
          : [];

        const agentMap = new Map(agents.map(a => {
          const name = `${a.firstName} ${a.lastName}`.trim();
          const initials = `${a.firstName?.[0] || ''}${a.lastName?.[0] || ''}`.toUpperCase();
          return [a.id, { id: a.id, name, avatar: a.avatarUrl, extension: a.extension, initials }];
        }));

        for (const w of wrapups) {
          const extraction = w.aiExtraction as any || {};
          const isInbound = w.direction?.toLowerCase() === 'inbound';
          const externalPhone = isInbound ? w.callFromNumber : w.callToNumber;

          let matchStatus: TriageItem['matchStatus'] = 'unmatched';
          if (w.matchStatus === 'matched') {
            matchStatus = 'matched';
          } else if (w.matchStatus === 'multiple_matches') {
            matchStatus = 'needs_review';
          }

          items.push({
            id: w.id,
            itemType: 'wrapup',
            direction: w.direction?.toLowerCase() as 'inbound' | 'outbound' | null,
            contactName: w.customerName,
            contactPhone: w.customerPhone || externalPhone || '',
            contactEmail: w.customerEmail,
            matchStatus,
            summary: w.aiCleanedSummary || w.summary || '',
            transcript: w.transcript || undefined,
            requestType: w.requestType || extraction.serviceRequestType || null,
            handledBy: w.agentId ? agentMap.get(w.agentId)?.name || null : null,
            handledByAgent: w.agentId ? agentMap.get(w.agentId) || null : null,
            timestamp: (w.callStartedAt || w.createdAt).toISOString(),
            ageMinutes: Math.floor((now.getTime() - new Date(w.callStartedAt || w.createdAt).getTime()) / 60000),
            agencyzoomCustomerId: extraction.agencyZoomCustomerId,
            agencyzoomLeadId: extraction.agencyZoomLeadId,
            callId: w.callId || undefined,
          });
        }
      }

      // Fetch unread messages
      const unreadMessages = await db
        .select({
          id: messages.id,
          direction: messages.direction,
          fromNumber: messages.fromNumber,
          toNumber: messages.toNumber,
          body: messages.body,
          contactId: messages.contactId,
          contactName: messages.contactName,
          contactType: messages.contactType,
          isAfterHours: messages.isAfterHours,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(
          and(
            eq(messages.tenantId, tenantId),
            eq(messages.direction, 'inbound'),
            eq(messages.isAcknowledged, false)
          )
        )
        .orderBy(desc(messages.createdAt))
        .limit(100);

      // Group messages by phone number
      const messagesByPhone = new Map<string, typeof unreadMessages>();
      for (const m of unreadMessages) {
        const phone = m.fromNumber || '';
        if (!messagesByPhone.has(phone)) {
          messagesByPhone.set(phone, []);
        }
        messagesByPhone.get(phone)!.push(m);
      }

      for (const [phone, phoneMessages] of messagesByPhone) {
        const firstMsg = phoneMessages[0];
        const oldestMsg = phoneMessages[phoneMessages.length - 1];

        const unreadCount = phoneMessages.length;
        let summary = phoneMessages.map(m => m.body || '').filter(Boolean).join('\n---\n');
        if (unreadCount > 1) {
          summary = `[${unreadCount} unread messages]\n\n${summary}`;
        }

        const matchStatus: TriageItem['matchStatus'] = firstMsg.isAfterHours
          ? 'after_hours'
          : firstMsg.contactName && !firstMsg.contactName.match(/^[\d\(\)\-\s\.]+$/)
            ? 'matched'
            : 'unmatched';

        items.push({
          id: firstMsg.id,
          itemType: 'message',
          direction: 'inbound',
          contactName: firstMsg.contactName,
          contactPhone: phone,
          contactEmail: null,
          matchStatus,
          summary,
          requestType: firstMsg.isAfterHours ? 'After Hours' : (unreadCount > 1 ? `${unreadCount} Messages` : 'SMS'),
          handledBy: null,
          handledByAgent: null,
          timestamp: firstMsg.createdAt.toISOString(),
          ageMinutes: Math.floor((now.getTime() - new Date(oldestMsg.createdAt).getTime()) / 60000),
          agencyzoomCustomerId: firstMsg.contactId || undefined,
          messageIds: phoneMessages.map(m => m.id),
        });
      }

      // Sort by timestamp descending
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return items;
    }

    // Fetch service tickets directly from AgencyZoom (both active and completed)
    async function fetchServiceTickets(): Promise<ServiceTicketItem[]> {
      try {
        const azClient = getAgencyZoomClient();

        // Fetch both active and completed tickets in parallel
        const [activeResult, completedResult] = await Promise.all([
          azClient.getServiceTickets({
            pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
            status: 1, // Active
            limit: 100,
          }),
          azClient.getServiceTickets({
            pipelineId: SERVICE_PIPELINES.POLICY_SERVICE,
            status: 2, // Completed
            limit: 50, // Limit completed to recent ones
          }),
        ]);

        const activeTickets = activeResult.data || [];
        const completedTickets = completedResult.data || [];

        // Filter active tickets to only include those in our target stages
        const targetStages = new Set<number>([
          PIPELINE_STAGES.NEW,
          PIPELINE_STAGES.IN_PROGRESS,
          PIPELINE_STAGES.WAITING_ON_INFO,
        ]);

        const mapTicket = (t: any, isCompleted: boolean): ServiceTicketItem => {
          const createdDate = t.createDate ? new Date(t.createDate) : new Date();
          const completedDate = t.completeDate ? new Date(t.completeDate) : null;
          const customerName = [t.householdFirstname, t.householdLastname]
            .filter(Boolean)
            .join(' ')
            .trim() || t.name || null;
          const csrName = [t.csrFirstname, t.csrLastname].filter(Boolean).join(' ').trim() || null;
          // Compute initials from csr first/last name
          const csrInitials = t.csrFirstname || t.csrLastname
            ? `${t.csrFirstname?.[0] || ''}${t.csrLastname?.[0] || ''}`.toUpperCase()
            : null;

          return {
            id: t.id.toString(),
            azTicketId: t.id,
            subject: t.subject || 'No Subject',
            description: t.serviceDesc || null,
            customerName,
            customerPhone: t.phone || null,
            stageId: isCompleted ? null : t.workflowStageId,
            stageName: isCompleted ? 'Completed' : (t.workflowStageName || null),
            csrId: t.csr || null,
            csrName,
            csrInitials,
            priorityId: t.priorityId || null,
            priorityName: t.priorityName || null,
            categoryId: t.categoryId || null,
            categoryName: t.categoryName || null,
            dueDate: t.dueDate || null,
            createdAt: createdDate.toISOString(),
            completedAt: completedDate ? completedDate.toISOString() : null,
            ageMinutes: Math.floor((now.getTime() - createdDate.getTime()) / 60000),
            azHouseholdId: t.householdId || null,
            status: isCompleted ? 'completed' : 'active',
          };
        };

        // Map active tickets (filtered to target stages)
        const mappedActive = activeTickets
          .filter(t => t.workflowStageId && targetStages.has(t.workflowStageId))
          .map(t => mapTicket(t, false));

        // Map completed tickets (no stage filter needed)
        const mappedCompleted = completedTickets.map(t => mapTicket(t, true));

        return [...mappedActive, ...mappedCompleted];
      } catch (error) {
        console.error('[Service Pipeline] Error fetching from AgencyZoom:', error);
        // Fallback to local database if AZ fails
        // Filter to target stages only, like the AgencyZoom path does
        const targetStageIds = [
          PIPELINE_STAGES.NEW,
          PIPELINE_STAGES.IN_PROGRESS,
          PIPELINE_STAGES.WAITING_ON_INFO,
        ];

        const [activeTickets, completedTickets] = await Promise.all([
          db
            .select({
              id: serviceTickets.id,
              azTicketId: serviceTickets.azTicketId,
              subject: serviceTickets.subject,
              description: serviceTickets.description,
              azHouseholdId: serviceTickets.azHouseholdId,
              stageId: serviceTickets.stageId,
              stageName: serviceTickets.stageName,
              csrId: serviceTickets.csrId,
              csrName: serviceTickets.csrName,
              priorityId: serviceTickets.priorityId,
              priorityName: serviceTickets.priorityName,
              categoryId: serviceTickets.categoryId,
              categoryName: serviceTickets.categoryName,
              dueDate: serviceTickets.dueDate,
              createdAt: serviceTickets.createdAt,
              status: serviceTickets.status,
              azCompletedAt: serviceTickets.azCompletedAt,
            })
            .from(serviceTickets)
            .where(
              and(
                eq(serviceTickets.tenantId, tenantId),
                eq(serviceTickets.pipelineId, SERVICE_PIPELINES.POLICY_SERVICE),
                eq(serviceTickets.status, 'active'),
                inArray(serviceTickets.stageId, targetStageIds)
              )
            )
            .orderBy(desc(serviceTickets.createdAt))
            .limit(100),
          db
            .select({
              id: serviceTickets.id,
              azTicketId: serviceTickets.azTicketId,
              subject: serviceTickets.subject,
              description: serviceTickets.description,
              azHouseholdId: serviceTickets.azHouseholdId,
              stageId: serviceTickets.stageId,
              stageName: serviceTickets.stageName,
              csrId: serviceTickets.csrId,
              csrName: serviceTickets.csrName,
              priorityId: serviceTickets.priorityId,
              priorityName: serviceTickets.priorityName,
              categoryId: serviceTickets.categoryId,
              categoryName: serviceTickets.categoryName,
              dueDate: serviceTickets.dueDate,
              createdAt: serviceTickets.createdAt,
              status: serviceTickets.status,
              azCompletedAt: serviceTickets.azCompletedAt,
            })
            .from(serviceTickets)
            .where(
              and(
                eq(serviceTickets.tenantId, tenantId),
                eq(serviceTickets.pipelineId, SERVICE_PIPELINES.POLICY_SERVICE),
                eq(serviceTickets.status, 'completed')
              )
            )
            .orderBy(desc(serviceTickets.azCompletedAt))
            .limit(50),
        ]);

        const mapDbTicket = (t: typeof activeTickets[0]): ServiceTicketItem => ({
          id: t.id,
          azTicketId: t.azTicketId,
          subject: t.subject,
          description: t.description,
          customerName: null,
          customerPhone: null,
          stageId: t.status === 'completed' ? null : t.stageId,
          stageName: t.status === 'completed' ? 'Completed' : t.stageName,
          csrId: t.csrId,
          csrName: t.csrName,
          csrInitials: null, // Will be filled in by employee lookup
          priorityId: t.priorityId,
          priorityName: t.priorityName,
          categoryId: t.categoryId,
          categoryName: t.categoryName,
          dueDate: t.dueDate,
          createdAt: t.createdAt.toISOString(),
          completedAt: t.azCompletedAt ? t.azCompletedAt.toISOString() : null,
          ageMinutes: Math.floor((now.getTime() - new Date(t.createdAt).getTime()) / 60000),
          azHouseholdId: t.azHouseholdId,
          status: t.status === 'completed' ? 'completed' : 'active',
        });

        return [...activeTickets.map(mapDbTicket), ...completedTickets.map(mapDbTicket)];
      }
    }

    // Fetch employees for assignment
    async function fetchEmployees(): Promise<Employee[]> {
      const employees = await db
        .select({
          agencyzoomId: users.agencyzoomId,
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.isActive, true)
          )
        );

      return employees
        .filter(e => e.agencyzoomId && !isNaN(parseInt(e.agencyzoomId)))
        .map(e => ({
          id: parseInt(e.agencyzoomId!),
          name: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
          initials: `${e.firstName?.[0] || ''}${e.lastName?.[0] || ''}`.toUpperCase(),
        }));
    }

    // =======================================================================
    // RUN ALL FETCHES IN PARALLEL
    // =======================================================================
    const [triageItems, ticketItems, employees] = await Promise.all([
      fetchTriageItems(),
      fetchServiceTickets(),
      fetchEmployees(),
    ]);

    // Build employee lookup map for CSR name resolution
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // Populate CSR names and initials on tickets using employee lookup
    for (const ticket of ticketItems) {
      if (ticket.csrId) {
        const employee = employeeMap.get(ticket.csrId);
        if (employee) {
          // Fill in name if missing
          if (!ticket.csrName) {
            ticket.csrName = employee.name;
          }
          // Fill in initials if missing (use employee's pre-computed initials)
          if (!ticket.csrInitials) {
            ticket.csrInitials = employee.initials;
          }
        }
      }
    }

    // Group tickets by stage (active) and completed
    const ticketsByStage: Record<number, ServiceTicketItem[]> = {
      [PIPELINE_STAGES.NEW]: [],
      [PIPELINE_STAGES.IN_PROGRESS]: [],
      [PIPELINE_STAGES.WAITING_ON_INFO]: [],
    };
    const completedTickets: ServiceTicketItem[] = [];

    for (const ticket of ticketItems) {
      if (ticket.status === 'completed') {
        completedTickets.push(ticket);
      } else {
        const stageId = ticket.stageId;
        if (stageId && ticketsByStage[stageId]) {
          ticketsByStage[stageId].push(ticket);
        } else {
          // Default to New stage if no stage set
          ticketsByStage[PIPELINE_STAGES.NEW].push(ticket);
        }
      }
    }

    // Sort completed by completion date (most recent first)
    completedTickets.sort((a, b) => {
      const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return dateB - dateA;
    });

    // Calculate counts
    const counts: Record<string | number, number> = {
      triage: triageItems.length,
      [PIPELINE_STAGES.NEW]: ticketsByStage[PIPELINE_STAGES.NEW].length,
      [PIPELINE_STAGES.IN_PROGRESS]: ticketsByStage[PIPELINE_STAGES.IN_PROGRESS].length,
      [PIPELINE_STAGES.WAITING_ON_INFO]: ticketsByStage[PIPELINE_STAGES.WAITING_ON_INFO].length,
      completed: completedTickets.length,
    };

    const response: PipelineResponse = {
      stages: STAGE_CONFIG,
      items: {
        triage: triageItems,
        completed: completedTickets,
        ...ticketsByStage,
      },
      employees,
      counts,
    };

    return NextResponse.json({
      success: true,
      ...response,
    });
  } catch (error) {
    console.error('[Service Pipeline] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch pipeline data' },
      { status: 500 }
    );
  }
}
