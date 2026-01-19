import { NextRequest, NextResponse } from 'next/server';
import { trestleIQClient, quickLeadCheck, type TrestlePhoneResult } from '@/lib/api/trestleiq';

// =============================================================================
// GET /api/trestle/caller-id - Fetch Trestle enrichment for a phone number
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const phone = request.nextUrl.searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Clean the phone number
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number' },
        { status: 400 }
      );
    }

    // Fetch both reverse phone and lead quality in parallel
    const [reversePhoneResult, leadQuality] = await Promise.all([
      trestleIQClient.reversePhone(cleanPhone).catch(() => null),
      quickLeadCheck(cleanPhone).catch(() => null),
    ]);

    if (!reversePhoneResult && !leadQuality) {
      return NextResponse.json({
        success: true,
        found: false,
        message: 'No data found for this phone number',
      });
    }

    // Build response with enrichment data
    const result: {
      success: boolean;
      found: boolean;
      caller: {
        name?: string;
        firstName?: string;
        lastName?: string;
        phone: string;
        lineType?: string;
        carrier?: string;
        address?: TrestlePhoneResult['address'];
        emails?: string[];
        confidence?: number;
      };
      leadQuality?: {
        grade: string;
        activityScore: number;
        isValid: boolean;
      };
    } = {
      success: true,
      found: true,
      caller: {
        phone: cleanPhone,
      },
    };

    if (reversePhoneResult) {
      result.caller = {
        ...result.caller,
        name: reversePhoneResult.person?.name,
        firstName: reversePhoneResult.person?.firstName,
        lastName: reversePhoneResult.person?.lastName,
        lineType: reversePhoneResult.lineType,
        carrier: reversePhoneResult.carrier,
        address: reversePhoneResult.address,
        emails: reversePhoneResult.emails,
        confidence: reversePhoneResult.confidence,
      };
    }

    if (leadQuality) {
      result.leadQuality = leadQuality;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Trestle CallerID] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch caller information' },
      { status: 500 }
    );
  }
}
