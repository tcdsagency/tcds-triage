// API Route: /api/nearmap/test
// Diagnostic endpoint to test Nearmap API connectivity

import { NextRequest, NextResponse } from "next/server";

const NEARMAP_API_URL = 'https://api.nearmap.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '33.6891');
  const lng = parseFloat(searchParams.get('lng') || '-86.6833');

  const results: Record<string, any> = {
    keys: {
      NEARMAP_API_KEY: !!process.env.NEARMAP_API_KEY,
      NEARMAP_AI_API_KEY: !!process.env.NEARMAP_AI_API_KEY,
      NEARMAP_D3_API_KEY: !!process.env.NEARMAP_D3_API_KEY,
      NEARMAP_IMAGE_API_KEY: !!process.env.NEARMAP_IMAGE_API_KEY,
    },
    tests: {},
  };

  // Test coverage API
  try {
    const coverageUrl = `${NEARMAP_API_URL}/coverage/v2/point/${lng},${lat}?resources=tiles,aifeatures&apikey=${process.env.NEARMAP_API_KEY}`;
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

  // Test AI roof API
  try {
    const aiKey = process.env.NEARMAP_AI_API_KEY || process.env.NEARMAP_API_KEY;
    const roofUrl = `${NEARMAP_API_URL}/ai/features/v4/roof.json?point=${lng},${lat}&apikey=${aiKey}`;
    const roofRes = await fetch(roofUrl);
    const roofText = await roofRes.text();

    results.tests.roof = {
      status: roofRes.status,
      ok: roofRes.ok,
      data: roofRes.ok ? JSON.parse(roofText) : roofText.substring(0, 500),
    };
  } catch (e: any) {
    results.tests.roof = { error: e.message };
  }

  // Test AI building API
  try {
    const aiKey = process.env.NEARMAP_AI_API_KEY || process.env.NEARMAP_API_KEY;
    const buildingUrl = `${NEARMAP_API_URL}/ai/features/v4/building.json?point=${lng},${lat}&apikey=${aiKey}`;
    const buildingRes = await fetch(buildingUrl);
    const buildingText = await buildingRes.text();

    results.tests.building = {
      status: buildingRes.status,
      ok: buildingRes.ok,
      data: buildingRes.ok ? JSON.parse(buildingText) : buildingText.substring(0, 500),
    };
  } catch (e: any) {
    results.tests.building = { error: e.message };
  }

  // Test AI pool API
  try {
    const aiKey = process.env.NEARMAP_AI_API_KEY || process.env.NEARMAP_API_KEY;
    const poolUrl = `${NEARMAP_API_URL}/ai/features/v4/swimming_pool.json?point=${lng},${lat}&apikey=${aiKey}`;
    const poolRes = await fetch(poolUrl);
    const poolText = await poolRes.text();

    results.tests.pool = {
      status: poolRes.status,
      ok: poolRes.ok,
      data: poolRes.ok ? JSON.parse(poolText) : poolText.substring(0, 500),
    };
  } catch (e: any) {
    results.tests.pool = { error: e.message };
  }

  return NextResponse.json(results);
}
