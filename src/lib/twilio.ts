// Twilio SMS/MMS Client
// Handles sending SMS and MMS messages via Twilio API

// =============================================================================
// TYPES
// =============================================================================

export interface SendSMSParams {
  to: string;
  message: string;
  from?: string;
}

export interface SendMMSParams {
  to: string;
  message: string;
  mediaUrl: string;  // Public URL to the media (image/PDF)
  from?: string;
}

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface TwilioMessageResponse {
  sid: string;
  status: string;
  to: string;
  from: string;
  body: string;
  date_created: string;
  error_code?: string;
  error_message?: string;
}

// =============================================================================
// TWILIO CLIENT
// =============================================================================

class TwilioClient {
  private accountSid: string;
  private authToken: string;
  private phoneNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER || '';
  }

  /**
   * Check if Twilio is configured
   */
  isConfigured(): boolean {
    return !!(this.accountSid && this.authToken && this.phoneNumber);
  }

  /**
   * Send an SMS message
   */
  async sendSMS({ to, message, from }: SendSMSParams): Promise<SendSMSResult> {
    if (!this.isConfigured()) {
      console.error('Twilio not configured');
      return { success: false, error: 'Twilio credentials not configured' };
    }

    try {
      const fromNumber = from || this.phoneNumber;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: this.formatPhoneNumber(to),
          From: fromNumber,
          Body: message,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: TwilioMessageResponse = await response.json();

      if (!response.ok || data.error_code) {
        console.error('Twilio send error:', data);
        return {
          success: false,
          error: data.error_message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data.sid,
      };
    } catch (error) {
      console.error('Twilio send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send an MMS message with media attachment
   */
  async sendMMS({ to, message, mediaUrl, from }: SendMMSParams): Promise<SendSMSResult> {
    if (!this.isConfigured()) {
      console.error('Twilio not configured');
      return { success: false, error: 'Twilio credentials not configured' };
    }

    try {
      const fromNumber = from || this.phoneNumber;
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

      const params = new URLSearchParams({
        To: this.formatPhoneNumber(to),
        From: fromNumber,
        Body: message,
        MediaUrl: mediaUrl,
      });

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: TwilioMessageResponse = await response.json();

      if (!response.ok || data.error_code) {
        console.error('Twilio MMS send error:', data);
        return {
          success: false,
          error: data.error_message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        messageId: data.sid,
      };
    } catch (error) {
      console.error('Twilio MMS send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');

    // If it's 10 digits, assume US and add +1
    if (digits.length === 10) {
      return `+1${digits}`;
    }

    // If it's 11 digits starting with 1, add +
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }

    // If it already has country code
    if (digits.length > 10) {
      return `+${digits}`;
    }

    // Return as-is with + prefix
    return `+${digits}`;
  }

  /**
   * Validate Twilio webhook signature (optional security)
   */
  validateWebhookSignature(
    signature: string,
    url: string,
    params: Record<string, string>
  ): boolean {
    // In production, implement proper signature validation
    // using Twilio's signature validation algorithm
    // For now, return true if signature exists
    return !!signature;
  }

  /**
   * Get the configured phone number
   */
  getPhoneNumber(): string {
    return this.phoneNumber;
  }
}

// Export singleton instance
export const twilioClient = new TwilioClient();

// Export helper function for after-hours auto-reply
export async function sendAfterHoursReply(
  toPhone: string,
  message: string
): Promise<SendSMSResult> {
  return twilioClient.sendSMS({
    to: toPhone,
    message,
  });
}
