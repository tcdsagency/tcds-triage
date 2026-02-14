// API Route: /api/nearmap/test
// Diagnostic endpoint to test Nearmap API connectivity using verified endpoints

import { NextRequest, NextResponse } from "next/server";

const NEARMAP_API_URL = 'https://api.nearmap.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '33.6891');
  const lng = parseFloat(searchParams.get('lng') || '-86.6833');
  const apiKey = (process.env.NEARMAP_API_KEY || '').trim();

  const results: Record<string, any> = {
    keys: {
      NEARMAP_API_KEY: !!apiKey,
    },
    tests: {},
  };

  if (!apiKey) {
    return NextResponse.json({ ...results, error: 'NEARMAP_API_KEY not configured' });
  }

  // Build polygon for lat/lng
  const offset = 0.001;
  const polygon = `${lng - offset},${lat - offset},${lng + offset},${lat - offset},${lng + offset},${lat + offset},${lng - offset},${lat + offset},${lng - offset},${lat - offset}`;

  // Test 1: Packs endpoint
  try {
    const packsUrl = `${NEARMAP_API_URL}/ai/features/v4/packs.json?apikey=${apiKey}`;
    const packsRes = await fetch(packsUrl);
    const packsText = await packsRes.text();

    results.tests.packs = {
      status: packsRes.status,
      ok: packsRes.ok,
      data: packsRes.ok ? JSON.parse(packsText) : packsText.substring(0, 500),
    };
  } catch (e: any) {
    results.tests.packs = { error: e.message };
  }

  // Test 2: Coverage endpoint
  try {
    const coverageUrl = `${NEARMAP_API_URL}/ai/features/v4/coverage.json?polygon=${encodeURIComponent(polygon)}&apikey=${apiKey}`;
    const coverageRes = await fetch(coverageUrl);
    const coverageText = await coverageRes.text();

    results.tests.coverage = {
      status: coverageRes.status,
      ok: coverageRes.ok,
      data: coverageRes.ok ? JSON.parse(coverageText) : coverageText.substring(0, 500),
    };
  } catch (e: any) {
    results.tests.coverage = { error: e.message };
  }

  // Test 3: Rollups endpoint (roof_cond pack)
  try {
    const rollupsUrl = `${NEARMAP_API_URL}/ai/features/v4/rollups.json?polygon=${encodeURIComponent(polygon)}&packs=roof_cond&apikey=${apiKey}`;
    const rollupsRes = await fetch(rollupsUrl);
    const rollupsText = await rollupsRes.text();

    results.tests.rollups = {
      status: rollupsRes.status,
      ok: rollupsRes.ok,
      data: rollupsRes.ok ? JSON.parse(rollupsText) : rollupsText.substring(0, 500),
    };
  } catch (e: any) {
    results.tests.rollups = { error: e.message };
  }

  // Test 4: Tile endpoint
  try {
    // Calculate tile coords for zoom 19
    const n = Math.pow(2, 19);
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);

    const tileUrl = `${NEARMAP_API_URL}/tiles/v3/Vert/19/${x}/${y}.img?apikey=${apiKey}`;
    const tileRes = await fetch(tileUrl, { method: 'HEAD' });

    results.tests.tile = {
      status: tileRes.status,
      ok: tileRes.ok,
      contentType: tileRes.headers.get('content-type'),
      url: `tiles/v3/Vert/19/${x}/${y}.img`,
    };
  } catch (e: any) {
    results.tests.tile = { error: e.message };
  }

  return NextResponse.json(results);
}
