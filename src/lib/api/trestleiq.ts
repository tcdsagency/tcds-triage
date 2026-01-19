// =============================================================================
// TrestleIQ API Client - Identity & Contact Enrichment
// Documentation: https://docs.trestleiq.com/
// =============================================================================
// Provides:
// - Reverse Phone API: Caller enrichment from phone number
// - Caller ID API: Real-time caller identification
// - Phone Validation API: Validate numbers before SMS/calls
// - Reverse Address API: Resident info for property lookup
// - Real Contact API: Lead validation and verification
// =============================================================================

const TRESTLEIQ_API_URL = 'https://api.trestleiq.com';

// =============================================================================
// TYPES
// =============================================================================

export interface TrestlePhoneResult {
  phoneNumber: string;
  isValid: boolean;
  lineType: 'mobile' | 'landline' | 'voip' | 'toll_free' | 'unknown';
  carrier?: string;
  countryCode?: string;
  // Person data from reverse lookup
  person?: {
    name: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    gender?: string;
  };
  // Address data
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
    type?: 'residential' | 'commercial';
  };
  // Additional contacts
  emails?: string[];
  alternatePhones?: string[];
  // Metadata
  confidence?: number;
  lastUpdated?: string;
}

export interface TrestleCallerIdResult {
  phoneNumber: string;
  callerName: string;
  callerType: 'person' | 'business' | 'unknown';
  spamScore?: number;
  isSpam?: boolean;
  // Enhanced data
  person?: {
    name: string;
    firstName?: string;
    lastName?: string;
  };
  business?: {
    name: string;
    industry?: string;
  };
}

export interface TrestlePhoneValidation {
  phoneNumber: string;
  isValid: boolean;
  lineType: 'mobile' | 'landline' | 'voip' | 'toll_free' | 'unknown';
  carrier?: string;
  isMobile: boolean;
  canReceiveSms: boolean;
  countryCode: string;
  nationalFormat: string;
  internationalFormat: string;
  // Risk indicators
  isDisposable?: boolean;
  isPorted?: boolean;
  riskScore?: number;
}

export interface TrestleAddressResult {
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    county?: string;
  };
  // Residents at this address
  residents: Array<{
    name: string;
    firstName?: string;
    lastName?: string;
    age?: number;
    phones?: string[];
    emails?: string[];
    residenceType?: 'owner' | 'renter' | 'unknown';
    lengthOfResidence?: number; // months
  }>;
  // Property data
  property?: {
    type: 'single_family' | 'multi_family' | 'condo' | 'apartment' | 'commercial' | 'unknown';
    yearBuilt?: number;
    estimatedValue?: number;
  };
  confidence?: number;
}

export interface TrestleRealContactResult {
  phone: string;
  email?: string;
  // Verification results
  phoneValid: boolean;
  emailValid?: boolean;
  nameMatch?: boolean;
  addressMatch?: boolean;
  // Person data
  person?: {
    name: string;
    firstName?: string;
    lastName?: string;
  };
  // Overall score
  confidence: number;
  verificationStatus: 'verified' | 'partial' | 'unverified' | 'invalid';
}

// =============================================================================
// API CLIENT
// =============================================================================

class TrestleIQClient {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.TRESTLEIQ_API_KEY || '';
  }

  /**
   * Make authenticated API request
   */
  private async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('TRESTLEIQ_API_KEY not configured');
    }

    const url = `${TRESTLEIQ_API_URL}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`TrestleIQ API error: ${response.status} ${response.statusText} - ${text}`);
    }

    return response.json();
  }

  // ---------------------------------------------------------------------------
  // Reverse Phone Lookup
  // ---------------------------------------------------------------------------

  /**
   * Get person/business info from phone number
   * Use case: Enrich caller data in CallPopup
   */
  async reversePhone(phoneNumber: string): Promise<TrestlePhoneResult | null> {
    try {
      // Normalize phone number (remove non-digits, ensure 10 digits)
      const normalized = phoneNumber.replace(/\D/g, '').slice(-10);
      if (normalized.length !== 10) {
        return null;
      }

      const data = await this.fetch<any>(`/3.1/phone/${normalized}`);

      // Map TrestleIQ response to our interface
      const person = data.belongs_to?.[0];
      const address = data.current_addresses?.[0];

      return {
        phoneNumber: normalized,
        isValid: data.is_valid !== false,
        lineType: this.mapLineType(data.line_type),
        carrier: data.carrier,
        countryCode: data.country_calling_code || '1',
        person: person ? {
          name: person.name || `${person.firstname || ''} ${person.lastname || ''}`.trim(),
          firstName: person.firstname,
          lastName: person.lastname,
          age: person.age_range ? parseInt(person.age_range.split('-')[0]) : undefined,
          gender: person.gender,
        } : undefined,
        address: address ? {
          street: address.street_line_1 || '',
          city: address.city || '',
          state: address.state_code || '',
          zip: address.postal_code || '',
          type: address.location_type === 'Commercial' ? 'commercial' : 'residential',
        } : undefined,
        emails: data.emails?.map((e: any) => e.address) || [],
        alternatePhones: data.associated_phones?.map((p: any) => p.phone_number) || [],
        confidence: data.confidence_score,
        lastUpdated: data.last_seen,
      };
    } catch (error) {
      console.error('TrestleIQ reversePhone error:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Caller ID
  // ---------------------------------------------------------------------------

  /**
   * Get real-time caller identification
   * Use case: Identify incoming calls before answering
   */
  async getCallerId(phoneNumber: string): Promise<TrestleCallerIdResult | null> {
    try {
      const normalized = phoneNumber.replace(/\D/g, '').slice(-10);
      if (normalized.length !== 10) {
        return null;
      }

      const data = await this.fetch<any>(`/3.0/caller_id?phone=${normalized}`);

      return {
        phoneNumber: normalized,
        callerName: data.name || data.caller_name || 'Unknown',
        callerType: data.type === 'Business' ? 'business' : data.type === 'Person' ? 'person' : 'unknown',
        spamScore: data.spam_score,
        isSpam: data.is_spam === true || (data.spam_score && data.spam_score > 70),
        person: data.person ? {
          name: data.person.name,
          firstName: data.person.first_name,
          lastName: data.person.last_name,
        } : undefined,
        business: data.business ? {
          name: data.business.name,
          industry: data.business.industry,
        } : undefined,
      };
    } catch (error) {
      console.error('TrestleIQ getCallerId error:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Phone Validation
  // ---------------------------------------------------------------------------

  /**
   * Validate phone number before SMS or calls
   * Use case: Verify numbers before sending marketing SMS
   */
  async validatePhone(phoneNumber: string): Promise<TrestlePhoneValidation | null> {
    try {
      const normalized = phoneNumber.replace(/\D/g, '');

      const data = await this.fetch<any>(`/3.0/phone_intel?phone=${normalized}`);

      const lineType = this.mapLineType(data.line_type);

      return {
        phoneNumber: normalized,
        isValid: data.is_valid === true,
        lineType,
        carrier: data.carrier,
        isMobile: lineType === 'mobile',
        canReceiveSms: lineType === 'mobile' || data.sms_capable === true,
        countryCode: data.country_code || 'US',
        nationalFormat: data.national_format || this.formatNational(normalized),
        internationalFormat: data.international_format || `+1${normalized}`,
        isDisposable: data.is_disposable,
        isPorted: data.is_ported,
        riskScore: data.risk_score,
      };
    } catch (error) {
      console.error('TrestleIQ validatePhone error:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Reverse Address Lookup
  // ---------------------------------------------------------------------------

  /**
   * Get residents and property info from address
   * Use case: Enrich property data in Property Intelligence
   */
  async reverseAddress(
    street: string,
    city: string,
    state: string,
    zip?: string
  ): Promise<TrestleAddressResult | null> {
    try {
      // URL encode address components
      const params = new URLSearchParams({
        street_line_1: street,
        city: city,
        state_code: state,
        ...(zip && { postal_code: zip }),
      });

      const data = await this.fetch<any>(`/3.0/location?${params.toString()}`);

      const residents = data.residents || data.current_residents || [];

      return {
        address: {
          street: data.street_line_1 || street,
          city: data.city || city,
          state: data.state_code || state,
          zip: data.postal_code || zip || '',
          county: data.county,
        },
        residents: residents.map((r: any) => ({
          name: r.name || `${r.firstname || ''} ${r.lastname || ''}`.trim(),
          firstName: r.firstname,
          lastName: r.lastname,
          age: r.age,
          phones: r.phones?.map((p: any) => p.phone_number) || [],
          emails: r.emails?.map((e: any) => e.address) || [],
          residenceType: r.residence_type?.toLowerCase() as 'owner' | 'renter' | 'unknown',
          lengthOfResidence: r.length_of_residence,
        })),
        property: data.property ? {
          type: this.mapPropertyType(data.property.property_type),
          yearBuilt: data.property.year_built,
          estimatedValue: data.property.estimated_value,
        } : undefined,
        confidence: data.confidence_score,
      };
    } catch (error) {
      console.error('TrestleIQ reverseAddress error:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Real Contact Verification
  // ---------------------------------------------------------------------------

  /**
   * Verify contact info matches a real person
   * Use case: Lead validation before follow-up
   */
  async verifyContact(params: {
    phone: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  }): Promise<TrestleRealContactResult | null> {
    try {
      const normalized = params.phone.replace(/\D/g, '').slice(-10);

      const requestParams = new URLSearchParams({
        phone: normalized,
        ...(params.email && { email: params.email }),
        ...(params.firstName && { firstname: params.firstName }),
        ...(params.lastName && { lastname: params.lastName }),
        ...(params.street && { street_line_1: params.street }),
        ...(params.city && { city: params.city }),
        ...(params.state && { state_code: params.state }),
        ...(params.zip && { postal_code: params.zip }),
      });

      const data = await this.fetch<any>(`/3.0/contact?${requestParams.toString()}`);

      // Determine verification status based on matches
      let verificationStatus: 'verified' | 'partial' | 'unverified' | 'invalid' = 'unverified';
      const confidence = data.confidence_score || 0;

      if (data.is_valid === false) {
        verificationStatus = 'invalid';
      } else if (confidence >= 80) {
        verificationStatus = 'verified';
      } else if (confidence >= 50) {
        verificationStatus = 'partial';
      }

      return {
        phone: normalized,
        email: params.email,
        phoneValid: data.phone_valid !== false,
        emailValid: data.email_valid,
        nameMatch: data.name_match,
        addressMatch: data.address_match,
        person: data.person ? {
          name: data.person.name,
          firstName: data.person.first_name,
          lastName: data.person.last_name,
        } : undefined,
        confidence,
        verificationStatus,
      };
    } catch (error) {
      console.error('TrestleIQ verifyContact error:', error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  private mapLineType(type: string): 'mobile' | 'landline' | 'voip' | 'toll_free' | 'unknown' {
    const normalized = (type || '').toLowerCase();
    if (normalized.includes('mobile') || normalized.includes('wireless')) return 'mobile';
    if (normalized.includes('landline') || normalized.includes('land')) return 'landline';
    if (normalized.includes('voip')) return 'voip';
    if (normalized.includes('toll')) return 'toll_free';
    return 'unknown';
  }

  private mapPropertyType(type: string): 'single_family' | 'multi_family' | 'condo' | 'apartment' | 'commercial' | 'unknown' {
    const normalized = (type || '').toLowerCase();
    if (normalized.includes('single')) return 'single_family';
    if (normalized.includes('multi')) return 'multi_family';
    if (normalized.includes('condo')) return 'condo';
    if (normalized.includes('apartment') || normalized.includes('apt')) return 'apartment';
    if (normalized.includes('commercial') || normalized.includes('business')) return 'commercial';
    return 'unknown';
  }

  private formatNational(phone: string): string {
    if (phone.length === 10) {
      return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
    }
    return phone;
  }

  /**
   * Check if the client is properly configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const trestleIQClient = new TrestleIQClient();

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Quick caller enrichment - combines reverse phone + caller ID
 */
export async function enrichCaller(phoneNumber: string): Promise<{
  name: string;
  phone: string;
  type: 'person' | 'business' | 'unknown';
  address?: string;
  email?: string;
  isSpam?: boolean;
  confidence?: number;
} | null> {
  if (!trestleIQClient.isConfigured()) {
    return null;
  }

  try {
    // Try reverse phone first for more complete data
    const phoneData = await trestleIQClient.reversePhone(phoneNumber);

    if (phoneData?.person) {
      return {
        name: phoneData.person.name,
        phone: phoneData.phoneNumber,
        type: 'person',
        address: phoneData.address
          ? `${phoneData.address.street}, ${phoneData.address.city}, ${phoneData.address.state} ${phoneData.address.zip}`
          : undefined,
        email: phoneData.emails?.[0],
        confidence: phoneData.confidence,
      };
    }

    // Fall back to caller ID for basic info
    const callerId = await trestleIQClient.getCallerId(phoneNumber);

    if (callerId) {
      return {
        name: callerId.callerName,
        phone: callerId.phoneNumber,
        type: callerId.callerType,
        isSpam: callerId.isSpam,
      };
    }

    return null;
  } catch (error) {
    console.error('enrichCaller error:', error);
    return null;
  }
}

/**
 * Validate phone for SMS capability
 */
export async function canReceiveSms(phoneNumber: string): Promise<boolean> {
  if (!trestleIQClient.isConfigured()) {
    // Assume mobile numbers can receive SMS if not configured
    return true;
  }

  const validation = await trestleIQClient.validatePhone(phoneNumber);
  return validation?.canReceiveSms ?? true;
}

// =============================================================================
// Lead Quality Scoring
// =============================================================================

export type LeadGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface LeadQualityScore {
  // Overall grade A-F
  grade: LeadGrade;
  // Activity score 0-100 (likelihood phone is active/connected)
  activityScore: number;
  // Phone validation details
  phoneValid: boolean;
  phoneLineType: 'mobile' | 'landline' | 'voip' | 'toll_free' | 'unknown';
  phoneCarrier?: string;
  // Risk indicators
  isDisconnected: boolean;
  isSpam: boolean;
  riskScore: number;
  // Match indicators (if name/email/address provided)
  nameMatch?: boolean;
  emailValid?: boolean;
  addressMatch?: boolean;
  // Confidence in overall data
  confidence: number;
}

/**
 * Calculate lead grade from activity score and risk factors
 */
function calculateGrade(activityScore: number, riskScore: number, isValid: boolean): LeadGrade {
  if (!isValid || activityScore < 20) return 'F';
  if (riskScore > 70 || activityScore < 30) return 'D';
  if (riskScore > 50 || activityScore < 50) return 'C';
  if (activityScore < 70) return 'B';
  return 'A';
}

/**
 * Get comprehensive lead quality score for a phone number
 * Combines phone validation + reverse lookup for complete assessment
 */
export async function getLeadQualityScore(
  phoneNumber: string,
  options?: {
    name?: string;
    email?: string;
    address?: { street?: string; city?: string; state?: string; zip?: string };
  }
): Promise<LeadQualityScore | null> {
  if (!trestleIQClient.isConfigured()) {
    return null;
  }

  try {
    // Get phone validation data (activity score, risk)
    const validation = await trestleIQClient.validatePhone(phoneNumber);

    // Get caller ID for spam detection
    const callerId = await trestleIQClient.getCallerId(phoneNumber);

    if (!validation) {
      return null;
    }

    // Calculate activity score (inverse of risk, with validation status)
    // If phone is valid, start at 70. If invalid, start at 20.
    // Adjust based on risk score.
    let activityScore = validation.isValid ? 70 : 20;

    // Adjust for risk score (0-100, higher = riskier)
    const riskScore = validation.riskScore || 0;
    activityScore -= Math.floor(riskScore * 0.3);

    // Bonus for mobile (more likely to be active)
    if (validation.isMobile) {
      activityScore += 15;
    }

    // Penalty for disposable numbers
    if (validation.isDisposable) {
      activityScore -= 30;
    }

    // Clamp to 0-100
    activityScore = Math.max(0, Math.min(100, activityScore));

    // Check for spam
    const isSpam = callerId?.isSpam || (callerId?.spamScore && callerId.spamScore > 70);
    if (isSpam) {
      activityScore = Math.max(0, activityScore - 40);
    }

    // Determine if likely disconnected
    const isDisconnected = !validation.isValid || activityScore < 20;

    // Calculate overall grade
    const grade = calculateGrade(activityScore, riskScore, validation.isValid);

    // Calculate confidence based on available data
    let confidence = validation.isValid ? 60 : 30;
    if (callerId) confidence += 20;
    if (options?.name || options?.email) confidence += 10;
    confidence = Math.min(100, confidence);

    return {
      grade,
      activityScore,
      phoneValid: validation.isValid,
      phoneLineType: validation.lineType,
      phoneCarrier: validation.carrier,
      isDisconnected,
      isSpam: isSpam || false,
      riskScore,
      confidence,
    };
  } catch (error) {
    console.error('getLeadQualityScore error:', error);
    return null;
  }
}

/**
 * Quick lead quality check - just validates phone
 * Use when you need fast response and don't need full enrichment
 */
export async function quickLeadCheck(phoneNumber: string): Promise<{
  grade: LeadGrade;
  activityScore: number;
  isValid: boolean;
} | null> {
  if (!trestleIQClient.isConfigured()) {
    return null;
  }

  try {
    const validation = await trestleIQClient.validatePhone(phoneNumber);
    if (!validation) return null;

    let activityScore = validation.isValid ? 70 : 20;
    const riskScore = validation.riskScore || 0;
    activityScore -= Math.floor(riskScore * 0.3);
    if (validation.isMobile) activityScore += 15;
    if (validation.isDisposable) activityScore -= 30;
    activityScore = Math.max(0, Math.min(100, activityScore));

    const grade = calculateGrade(activityScore, riskScore, validation.isValid);

    return {
      grade,
      activityScore,
      isValid: validation.isValid,
    };
  } catch (error) {
    console.error('quickLeadCheck error:', error);
    return null;
  }
}
