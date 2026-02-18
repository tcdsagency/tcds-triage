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

    const result = await ezlynxBot.searchApplicant({ firstName, lastName, dateOfBirth, state });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
