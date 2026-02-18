import { NextRequest, NextResponse } from 'next/server';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';

// GET /api/ezlynx/search?firstName=&lastName=&dateOfBirth=&state=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const firstName = searchParams.get('firstName') || undefined;
    const lastName = searchParams.get('lastName') || undefined;
    const dateOfBirth = searchParams.get('dateOfBirth') || undefined;
    const state = searchParams.get('state') || undefined;

    if (!firstName && !lastName) {
      return NextResponse.json(
        { success: false, error: 'At least firstName or lastName is required' },
        { status: 400 }
      );
    }

    // Primary search: full name
    const result = await ezlynxBot.searchApplicant({ firstName, lastName, dateOfBirth, state });

    // Fallback: if no results and we had both first+last, retry with last name only
    // Catches cases where first name differs (nicknames, initials, spouse primary)
    if (result.results?.length === 0 && firstName && lastName) {
      const fallback = await ezlynxBot.searchApplicant({ lastName, state });
      if (fallback.results?.length) {
        return NextResponse.json({ ...fallback, fallback: true });
      }
    }

    return NextResponse.json(result);
  } catch (err: any) {
    // Distinguish bot connection errors from other failures
    const message = err.message || 'Unknown error';
    const isConnectionError =
      message.includes('ECONNREFUSED') ||
      message.includes('timeout') ||
      message.includes('connect') ||
      message.includes('socket');

    return NextResponse.json(
      {
        success: false,
        error: isConnectionError ? `Bot connection failed: ${message}` : message,
      },
      { status: isConnectionError ? 502 : 500 }
    );
  }
}
