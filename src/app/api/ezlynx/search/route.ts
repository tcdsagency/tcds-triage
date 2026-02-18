import { NextRequest, NextResponse } from 'next/server';
import { ezlynxBot } from '@/lib/api/ezlynx-bot';

// GET /api/ezlynx/search?firstName=&lastName=&dateOfBirth=&state=&address=&city=&zip=
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const firstName = searchParams.get('firstName') || undefined;
    const lastName = searchParams.get('lastName') || undefined;
    const dateOfBirth = searchParams.get('dateOfBirth') || undefined;
    const state = searchParams.get('state') || undefined;
    const address = searchParams.get('address') || undefined;
    const city = searchParams.get('city') || undefined;
    const zip = searchParams.get('zip') || undefined;

    if (!firstName && !lastName) {
      return NextResponse.json(
        { success: false, error: 'At least firstName or lastName is required' },
        { status: 400 }
      );
    }

    // Primary search: full name
    const result = await ezlynxBot.searchApplicant({ firstName, lastName, dateOfBirth, state });

    if (result.results?.length) {
      return NextResponse.json(result);
    }

    // Fallback 1: last name only (catches spouse under different first name)
    if (firstName && lastName) {
      const lastNameResult = await ezlynxBot.searchApplicant({ lastName, state });
      if (lastNameResult.results?.length) {
        return NextResponse.json({ ...lastNameResult, fallback: 'lastName' });
      }
    }

    // Fallback 2: address only (catches account under completely different name)
    if (address) {
      const addressResult = await ezlynxBot.searchApplicant({ address, city, state, zip });
      if (addressResult.results?.length) {
        return NextResponse.json({ ...addressResult, fallback: 'address' });
      }
    }

    // No results from any search
    return NextResponse.json(result);
  } catch (err: any) {
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
