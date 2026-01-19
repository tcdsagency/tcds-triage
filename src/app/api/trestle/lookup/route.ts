/**
 * Trestle Phone Lookup API
 * =========================
 * Comprehensive phone number lookup that calls all relevant Trestle APIs
 * and combines results into a unified response.
 *
 * POST /api/trestle/lookup
 */

import { NextRequest, NextResponse } from 'next/server';
import { trestleIQClient, quickLeadCheck } from '@/lib/api/trestleiq';

// =============================================================================
// POST - Comprehensive Phone Lookup
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Normalize phone number
    const normalized = phone.replace(/\D/g, '').slice(-10);
    if (normalized.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number - must be 10 digits' },
        { status: 400 }
      );
    }

    const formattedPhone = `(${normalized.slice(0, 3)}) ${normalized.slice(3, 6)}-${normalized.slice(6)}`;

    console.log(`[Trestle Lookup] Searching: ${formattedPhone}`);

    // Call all Trestle APIs in parallel for speed
    const [reversePhoneResult, callerIdResult, phoneValidationResult, leadQualityResult] =
      await Promise.allSettled([
        trestleIQClient.reversePhone(normalized),
        trestleIQClient.getCallerId(normalized),
        trestleIQClient.validatePhone(normalized),
        quickLeadCheck(normalized),
      ]);

    // Extract results (handle both fulfilled and rejected)
    const reversePhone = reversePhoneResult.status === 'fulfilled' ? reversePhoneResult.value : null;
    const callerId = callerIdResult.status === 'fulfilled' ? callerIdResult.value : null;
    const phoneValidation = phoneValidationResult.status === 'fulfilled' ? phoneValidationResult.value : null;
    const leadQuality = leadQualityResult.status === 'fulfilled' ? leadQualityResult.value : null;

    // Build unified response
    const response = {
      success: true,
      phone: formattedPhone,
      phoneRaw: normalized,
      timestamp: new Date().toISOString(),

      // Overview data (combined from multiple sources)
      overview: {
        isValid: phoneValidation?.isValid ?? reversePhone?.isValid ?? true,
        lineType: reversePhone?.lineType || phoneValidation?.lineType || 'unknown',
        carrier: reversePhone?.carrier || phoneValidation?.carrier || 'Unknown',
        activityScore: leadQuality?.activityScore ?? 50,
        leadGrade: leadQuality?.grade ?? 'C',
        isCommercial: reversePhone?.address?.type === 'commercial',
        isPrepaid: false, // Not available in current API
        confidence: reversePhone?.confidence,
      },

      // Owner information
      owner: reversePhone?.person ? {
        name: reversePhone.person.name,
        firstName: reversePhone.person.firstName,
        lastName: reversePhone.person.lastName,
        age: reversePhone.person.age,
        gender: reversePhone.person.gender,
        alternateNames: [], // Could be populated from additional API calls
      } : callerId?.person ? {
        name: callerId.person.name,
        firstName: callerId.person.firstName,
        lastName: callerId.person.lastName,
      } : callerId?.business ? {
        name: callerId.business.name,
        isBusiness: true,
        industry: callerId.business.industry,
      } : null,

      // Contact information
      contact: {
        currentAddress: reversePhone?.address ? {
          street: reversePhone.address.street,
          city: reversePhone.address.city,
          state: reversePhone.address.state,
          zip: reversePhone.address.zip,
          type: reversePhone.address.type,
        } : null,
        emails: reversePhone?.emails || [],
        alternatePhones: reversePhone?.alternatePhones || [],
      },

      // Verification & quality
      verification: {
        phoneValid: phoneValidation?.isValid ?? true,
        activityScore: leadQuality?.activityScore ?? 50,
        leadGrade: leadQuality?.grade ?? 'C',
        canReceiveSms: phoneValidation?.canReceiveSms ?? true,
        isDisconnected: phoneValidation?.isDisposable === true,
        riskScore: phoneValidation?.riskScore,
        spamScore: callerId?.spamScore,
        isSpam: callerId?.isSpam ?? false,
      },

      // Caller ID specific data
      callerId: callerId ? {
        callerName: callerId.callerName,
        callerType: callerId.callerType,
        spamScore: callerId.spamScore,
        isSpam: callerId.isSpam,
      } : null,

      // Raw API responses for debugging
      raw: {
        reversePhone,
        callerId,
        phoneValidation,
        leadQuality,
      },

      // Error tracking
      errors: {
        reversePhone: reversePhoneResult.status === 'rejected' ? String(reversePhoneResult.reason) : null,
        callerId: callerIdResult.status === 'rejected' ? String(callerIdResult.reason) : null,
        phoneValidation: phoneValidationResult.status === 'rejected' ? String(phoneValidationResult.reason) : null,
        leadQuality: leadQualityResult.status === 'rejected' ? String(leadQualityResult.reason) : null,
      },
    };

    console.log(`[Trestle Lookup] Found: ${response.owner?.name || 'Unknown'}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Trestle Lookup] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Lookup failed' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET - Health check
// =============================================================================

export async function GET() {
  return NextResponse.json({
    name: 'Trestle Phone Lookup API',
    version: '1.0',
    endpoints: {
      'POST /api/trestle/lookup': 'Comprehensive phone number lookup',
    },
  });
}
