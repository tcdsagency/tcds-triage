/**
 * EZLynx Application CRUD
 * ========================
 * POST /api/ezlynx/application
 * body: { action: 'get'|'save'|'create'|'list', type: 'auto'|'home', applicantId?, openAppId?, data? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, type, applicantId, openAppId, data } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    let result: any;

    switch (action) {
      case 'list': {
        if (!applicantId) {
          return NextResponse.json({ error: 'applicantId is required for list' }, { status: 400 });
        }
        result = await ezlynxBot.getOpenApplications(applicantId);
        return NextResponse.json({ success: true, applications: result });
      }

      case 'get': {
        if (!openAppId || !type) {
          return NextResponse.json(
            { error: 'openAppId and type are required for get' },
            { status: 400 }
          );
        }
        if (type === 'auto') {
          result = await ezlynxBot.getAutoApplication(openAppId);
        } else {
          result = await ezlynxBot.getHomeApplication(openAppId);
        }
        return NextResponse.json({ success: true, application: result });
      }

      case 'save': {
        if (!openAppId || !type || !data) {
          return NextResponse.json(
            { error: 'openAppId, type, and data are required for save' },
            { status: 400 }
          );
        }
        if (type === 'auto') {
          await ezlynxBot.saveAutoApplication(openAppId, data);
        } else {
          await ezlynxBot.saveHomeApplication(openAppId, data);
        }
        return NextResponse.json({ success: true });
      }

      case 'create': {
        if (!applicantId || !type) {
          return NextResponse.json(
            { error: 'applicantId and type are required for create' },
            { status: 400 }
          );
        }
        if (type === 'auto') {
          result = await ezlynxBot.createAutoApplication(applicantId);
        } else {
          result = await ezlynxBot.createHomeApplication(applicantId);
        }
        return NextResponse.json({ success: true, ...result });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Valid: get, save, create, list` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Application API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Application request failed' },
      { status: 500 }
    );
  }
}
