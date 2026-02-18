/**
 * EZLynx Reference Data
 * ======================
 * GET /api/ezlynx/reference-data/[category]
 * Returns dropdown options for the specified reference data category.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';

type RouteContext = { params: Promise<{ category: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { category } = await params;

    if (!category) {
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    }

    const data = await ezlynxBot.getReferenceData(category);

    // Format as dropdown options
    const options = Array.isArray(data)
      ? data.map((item: any) => ({
          label: item.description || item.name,
          value: item.value,
          name: item.name,
        }))
      : [];

    return NextResponse.json({ category, options, raw: data });
  } catch (error) {
    console.error('[Reference Data API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reference data' },
      { status: 500 }
    );
  }
}
