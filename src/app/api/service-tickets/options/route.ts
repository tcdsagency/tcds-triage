/**
 * Service Ticket Options API
 * GET /api/service-tickets/options
 *
 * Fetches and caches service ticket options (categories, priorities, pipelines, employees)
 * from AgencyZoom. Options are cached for 1 hour.
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { systemCache } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAgencyZoomClient } from '@/lib/api/agencyzoom';
import {
  SERVICE_CATEGORIES,
  SERVICE_PRIORITIES,
  SERVICE_PIPELINES,
  PIPELINE_STAGES,
} from '@/lib/api/agencyzoom-service-tickets';

const CACHE_KEY = 'service_ticket_options';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface ServiceTicketOptions {
  categories: Array<{ id: number; name: string; group?: string }>;
  priorities: Array<{ id: number; name: string }>;
  pipelines: Array<{
    id: number;
    name: string;
    stages: Array<{ id: number; name: string }>;
  }>;
  employees: Array<{ id: number; name: string; initials: string }>;
  fetchedAt: string;
}

// Fallback options using hardcoded constants
function getFallbackOptions(): ServiceTicketOptions {
  return {
    categories: [
      { id: SERVICE_CATEGORIES.GENERAL_SERVICE, name: 'General Service', group: 'General' },
      { id: SERVICE_CATEGORIES.SERVICE_QUESTION, name: 'Service Question', group: 'General' },
      { id: SERVICE_CATEGORIES.WRONG_NUMBER_HANGUP, name: 'Wrong Number / Hangup', group: 'General' },
      { id: SERVICE_CATEGORIES.CLAIMS_FILED, name: 'Claims - Filed', group: 'Claims' },
      { id: SERVICE_CATEGORIES.CLAIMS_NOT_FILED, name: 'Claims - Not Filed', group: 'Claims' },
      { id: SERVICE_CATEGORIES.CLAIMS_STATUS, name: 'Claims - Status', group: 'Claims' },
      { id: SERVICE_CATEGORIES.CLAIMS_PAYMENT, name: 'Claims - Payment', group: 'Claims' },
      { id: SERVICE_CATEGORIES.CLAIMS_CONSULT, name: 'Claims - Consult', group: 'Claims' },
      { id: SERVICE_CATEGORIES.SERVICE_DRIVER, name: '+/- Driver', group: 'Policy Changes' },
      { id: SERVICE_CATEGORIES.SERVICE_VEHICLE, name: '+/- Vehicle', group: 'Policy Changes' },
      { id: SERVICE_CATEGORIES.SERVICE_PROPERTY, name: '+/- Property', group: 'Policy Changes' },
      { id: SERVICE_CATEGORIES.SERVICE_INSURED, name: '+/- Insured', group: 'Policy Changes' },
      { id: SERVICE_CATEGORIES.SERVICE_LIENHOLDER, name: '+/- Lienholder', group: 'Policy Changes' },
      { id: SERVICE_CATEGORIES.SERVICE_COVERAGE_CHANGE, name: 'Coverage Change', group: 'Policy Changes' },
      { id: SERVICE_CATEGORIES.SERVICE_BILLING_QUESTIONS, name: 'Billing Question', group: 'Billing' },
      { id: SERVICE_CATEGORIES.SERVICE_BILLING_PAYMENTS, name: 'Billing Payment', group: 'Billing' },
      { id: SERVICE_CATEGORIES.SERVICE_BILLING_CHANGES, name: 'Billing Changes', group: 'Billing' },
      { id: SERVICE_CATEGORIES.SERVICE_ID_CARDS, name: 'ID Cards', group: 'Documents' },
      { id: SERVICE_CATEGORIES.SERVICE_COI, name: 'Certificate of Insurance', group: 'Documents' },
      { id: SERVICE_CATEGORIES.SERVICE_LOSS_RUN, name: 'Loss Run', group: 'Documents' },
      { id: SERVICE_CATEGORIES.SERVICE_CLIENT_CANCELLING, name: 'Client Cancelling', group: 'Other' },
      { id: SERVICE_CATEGORIES.SERVICE_PENDING_CANCELLATION, name: 'Pending Cancellation', group: 'Other' },
      { id: SERVICE_CATEGORIES.SERVICE_CARRIER_REQUEST, name: 'Carrier Request', group: 'Other' },
      { id: SERVICE_CATEGORIES.SERVICE_REMARKET, name: 'Remarket', group: 'Other' },
      { id: SERVICE_CATEGORIES.QUOTE_REQUEST, name: 'Quote Request', group: 'Other' },
    ],
    priorities: [
      { id: SERVICE_PRIORITIES.STANDARD, name: 'Standard' },
      { id: SERVICE_PRIORITIES.TWO_HOUR, name: '2 Hour' },
      { id: SERVICE_PRIORITIES.URGENT, name: 'Urgent' },
    ],
    pipelines: [
      {
        id: SERVICE_PIPELINES.POLICY_SERVICE,
        name: 'Policy Service Pipeline',
        stages: [
          { id: PIPELINE_STAGES.POLICY_SERVICE_NEW, name: 'New' },
          { id: PIPELINE_STAGES.POLICY_SERVICE_IN_PROGRESS, name: 'In Progress' },
          { id: PIPELINE_STAGES.POLICY_SERVICE_WAITING_ON_INFO, name: 'Waiting on Info' },
        ],
      },
    ],
    employees: [], // Will be populated from DB or API
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchOptionsFromAgencyZoom(): Promise<ServiceTicketOptions> {
  const azClient = getAgencyZoomClient();
  const options = getFallbackOptions();

  try {
    // Fetch categories from AgencyZoom
    const categories = await azClient.getServiceTicketCategories();
    if (categories.length > 0) {
      options.categories = categories.map(c => ({
        id: c.id,
        name: c.name,
        group: categorizeCategory(c.name),
      }));
    }
  } catch (error) {
    console.warn('[Options API] Failed to fetch categories, using fallback:', error);
  }

  try {
    // Fetch priorities from AgencyZoom
    const priorities = await azClient.getServiceTicketPriorities();
    if (priorities.length > 0) {
      options.priorities = priorities.map(p => ({ id: p.id, name: p.name }));
    }
  } catch (error) {
    console.warn('[Options API] Failed to fetch priorities, using fallback:', error);
  }

  try {
    // Fetch pipelines with stages from AgencyZoom
    const pipelines = await azClient.getServiceTicketPipelines();
    if (pipelines.length > 0) {
      options.pipelines = pipelines.map((p: any) => ({
        id: p.id,
        name: p.name,
        stages: (p.stages || []).map((s: any) => ({ id: s.id, name: s.name })),
      }));
    }
  } catch (error) {
    console.warn('[Options API] Failed to fetch pipelines, using fallback:', error);
  }

  try {
    // Fetch employees from AgencyZoom
    const employees = await azClient.getEmployees();
    if (employees.length > 0) {
      options.employees = employees.map((e: any) => ({
        id: e.id,
        name: `${e.firstName || ''} ${e.lastName || ''}`.trim() || e.email || 'Unknown',
        initials: `${(e.firstName || '?')[0]}${(e.lastName || '')[0] || ''}`.toUpperCase(),
      }));
    }
  } catch (error) {
    console.warn('[Options API] Failed to fetch employees, using fallback:', error);
  }

  options.fetchedAt = new Date().toISOString();
  return options;
}

// Helper to categorize categories by name pattern
function categorizeCategory(name: string): string {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('claim')) return 'Claims';
  if (nameLower.includes('billing') || nameLower.includes('payment')) return 'Billing';
  if (nameLower.includes('driver') || nameLower.includes('vehicle') || nameLower.includes('insured') ||
      nameLower.includes('property') || nameLower.includes('lienholder') || nameLower.includes('coverage')) return 'Policy Changes';
  if (nameLower.includes('id card') || nameLower.includes('coi') || nameLower.includes('certificate') ||
      nameLower.includes('loss run')) return 'Documents';
  if (nameLower.includes('renewal')) return 'Renewals';
  return 'General';
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get('refresh') === 'true';

  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const [cached] = await db
          .select()
          .from(systemCache)
          .where(eq(systemCache.key, CACHE_KEY))
          .limit(1);

        if (cached && cached.expiresAt && new Date(cached.expiresAt) > new Date()) {
          const options = cached.value as ServiceTicketOptions;
          return NextResponse.json({
            success: true,
            options,
            cached: true,
            expiresAt: cached.expiresAt,
          });
        }
      } catch (cacheError) {
        console.warn('[Options API] Cache read failed, will fetch fresh:', cacheError);
      }
    }

    // Fetch fresh options from AgencyZoom
    console.log('[Options API] Fetching fresh options from AgencyZoom...');
    const options = await fetchOptionsFromAgencyZoom();

    // Cache the results
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
    try {
      await db
        .insert(systemCache)
        .values({
          key: CACHE_KEY,
          value: options,
          expiresAt,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemCache.key,
          set: {
            value: options,
            expiresAt,
            updatedAt: new Date(),
          },
        });
    } catch (cacheError) {
      console.warn('[Options API] Failed to cache options:', cacheError);
    }

    return NextResponse.json({
      success: true,
      options,
      cached: false,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('[Options API] Error:', error);

    // Return fallback options on error
    const fallback = getFallbackOptions();
    return NextResponse.json({
      success: true,
      options: fallback,
      cached: false,
      fallback: true,
      error: error instanceof Error ? error.message : 'Failed to fetch options',
    });
  }
}
