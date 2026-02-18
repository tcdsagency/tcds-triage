import { NextRequest, NextResponse } from 'next/server';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';

// POST /api/ezlynx/quote — Submit home or auto quote to EZLynx
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountId, type, ...quoteData } = body;

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: 'accountId is required' },
        { status: 400 }
      );
    }

    if (!type || !['home', 'auto'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'type must be "home" or "auto"' },
        { status: 400 }
      );
    }

    const result = type === 'home'
      ? await ezlynxBot.submitHomeQuote(accountId, quoteData)
      : await ezlynxBot.submitAutoQuote(accountId, quoteData);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
