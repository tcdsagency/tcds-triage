// API Route: /api/property/nearmap-tile
// Server-side proxy for Nearmap tile URLs — keeps API key off the client.
// Accepts a full Nearmap tile URL (without apikey) and proxies it.

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tileUrl = searchParams.get('url');

  if (!tileUrl) {
    return NextResponse.json({ error: 'url query param required' }, { status: 400 });
  }

  const apiKey = (process.env.NEARMAP_API_KEY || '').trim();
  if (!apiKey) {
    return NextResponse.json({ error: 'NEARMAP_API_KEY not configured' }, { status: 500 });
  }

  // Append API key to the Nearmap URL
  const separator = tileUrl.includes('?') ? '&' : '?';
  const fullUrl = `${tileUrl}${separator}apikey=${apiKey}`;

  try {
    const upstream = await fetch(fullUrl);

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
