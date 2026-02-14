// API Route: /api/nearmap/tile
// Server-side proxy for Nearmap aerial tiles — keeps API key off the client

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const z = searchParams.get('z');
  const x = searchParams.get('x');
  const y = searchParams.get('y');

  if (!z || !x || !y) {
    return NextResponse.json({ error: 'z, x, y query params required' }, { status: 400 });
  }

  const apiKey = (process.env.NEARMAP_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'NEARMAP_API_KEY not configured' }, { status: 500 });
  }

  const tileUrl = `https://api.nearmap.com/tiles/v3/Vert/${z}/${x}/${y}.img?apikey=${apiKey}`;

  try {
    const upstream = await fetch(tileUrl);

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status, statusText: upstream.statusText });
    }

    const imageBuffer = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('[Nearmap Tile Proxy] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch tile' }, { status: 502 });
  }
}
