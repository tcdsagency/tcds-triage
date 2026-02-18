/**
 * EZLynx Prefill Proxy
 * =====================
 * POST /api/ezlynx/prefill
 * body: { type: 'drivers'|'vehicles'|'home'|'vin', params: {...} }
 *
 * Proxies prefill requests to the EZLynx bot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, params } = body;

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    let result: any;

    switch (type) {
      case 'drivers': {
        if (!params?.applicantId) {
          return NextResponse.json({ error: 'params.applicantId is required' }, { status: 400 });
        }
        result = await ezlynxBot.prefillDrivers({
          applicantId: params.applicantId,
          address: params.address || {},
        });
        break;
      }
      case 'vehicles': {
        if (!params?.applicantId) {
          return NextResponse.json({ error: 'params.applicantId is required' }, { status: 400 });
        }
        result = await ezlynxBot.prefillVehicles({
          applicantId: params.applicantId,
          address: params.address || {},
        });
        break;
      }
      case 'home': {
        if (!params?.applicantId) {
          return NextResponse.json({ error: 'params.applicantId is required' }, { status: 400 });
        }
        result = await ezlynxBot.prefillHome({
          applicantId: params.applicantId,
          firstName: params.firstName || '',
          lastName: params.lastName || '',
          address: params.address || {},
        });
        break;
      }
      case 'vin': {
        if (!params?.vin) {
          return NextResponse.json({ error: 'params.vin is required' }, { status: 400 });
        }
        result = await ezlynxBot.vinLookup(params.vin);
        break;
      }
      default:
        return NextResponse.json(
          { error: `Unknown prefill type: ${type}. Valid types: drivers, vehicles, home, vin` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, type, result });
  } catch (error) {
    console.error('[Prefill API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Prefill request failed' },
      { status: 500 }
    );
  }
}
