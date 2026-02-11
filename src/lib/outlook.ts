// Microsoft Graph / Outlook Email Client
// Sends emails via Microsoft Graph API using OAuth2 client credentials

// =============================================================================
// TYPES
// =============================================================================

export interface SendEmailParams {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  attachments?: Array<{
    filename: string;
    content: string; // Base64 encoded
    contentType: string;
  }>;
  from?: string; // If not specified, uses default configured email
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface GraphTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// =============================================================================
// OUTLOOK CLIENT
// =============================================================================

class OutlookClient {
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private senderEmail: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.tenantId = process.env.OUTLOOK_TENANT_ID || process.env.AZURE_AD_TENANT_ID || "";
    this.clientId = process.env.OUTLOOK_CLIENT_ID || process.env.AZURE_AD_CLIENT_ID || "";
    this.clientSecret = process.env.OUTLOOK_CLIENT_SECRET || process.env.AZURE_AD_CLIENT_SECRET || "";
    this.senderEmail = process.env.OUTLOOK_SENDER_EMAIL || "agency@tcdsagency.com";
  }

  /**
   * Check if Outlook is configured
   */
  isConfigured(): boolean {
    return !!(this.tenantId && this.clientId && this.clientSecret && this.senderEmail);
  }

  /**
   * Get OAuth2 access token using client credentials flow
   */
  private async getAccessToken(): Promise<string | null> {
    // Return cached token if still valid (with 60s buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Outlook token error:", errorText);
        return null;
      }

      const data: GraphTokenResponse = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

      return this.accessToken;
    } catch (error) {
      console.error("Outlook token error:", error);
      return null;
    }
  }

  /**
   * Send an email via Microsoft Graph API
   */
  async sendEmail({
    to,
    cc,
    subject,
    body,
    isHtml = false,
    attachments = [],
    from,
  }: SendEmailParams): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "Outlook not configured. Set OUTLOOK_TENANT_ID, OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_SENDER_EMAIL.",
      };
    }

    const token = await this.getAccessToken();
    if (!token) {
      return { success: false, error: "Failed to get Outlook access token" };
    }

    try {
      const senderEmail = from || this.senderEmail;
      const recipients = Array.isArray(to) ? to : [to];

      // Build Graph API email message
      const message: any = {
        message: {
          subject,
          body: {
            contentType: isHtml ? "HTML" : "Text",
            content: body,
          },
          toRecipients: recipients.map((email) => ({
            emailAddress: { address: email },
          })),
        },
        saveToSentItems: true,
      };

      // Add CC recipients if provided
      if (cc) {
        const ccList = Array.isArray(cc) ? cc : [cc];
        if (ccList.length > 0) {
          message.message.ccRecipients = ccList.map((email) => ({
            emailAddress: { address: email },
          }));
        }
      }

      // Add attachments if any
      if (attachments.length > 0) {
        message.message.attachments = attachments.map((att) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: att.filename,
          contentType: att.contentType,
          contentBytes: att.content,
        }));
      }

      // Send via Graph API
      const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`;

      const response = await fetch(graphUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Outlook send error:", errorData);
        return {
          success: false,
          error: errorData.error?.message || `HTTP ${response.status}`,
        };
      }

      // Graph API returns 202 Accepted with no body on success
      return {
        success: true,
        messageId: `outlook-${Date.now()}`,
      };
    } catch (error) {
      console.error("Outlook send error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get the configured sender email
   */
  getSenderEmail(): string {
    return this.senderEmail;
  }
}

// Export singleton instance
export const outlookClient = new OutlookClient();

// Export helper function for ID cards
export async function sendIdCardEmail(
  to: string,
  insuredName: string,
  policyNumber: string,
  carrier: string,
  expirationDate: string,
  pdfBase64: string,
  filename: string
): Promise<SendEmailResult> {
  const subject = `Your Insurance ID Card - ${policyNumber}`;
  const body = `
Dear ${insuredName},

Please find your insurance ID card attached to this email.

Policy Details:
- Policy Number: ${policyNumber}
- Carrier: ${carrier}
- Expiration Date: ${expirationDate}

Please keep this ID card in your vehicle at all times as proof of insurance.

If you have any questions, please don't hesitate to contact us at (205) 847-5616.

Thank you for your business!

---
TCDS Insurance Agency
PO BOX 1283
Pinson, AL 35126
(205) 847-5616
agency@tcdsagency.com
  `.trim();

  return outlookClient.sendEmail({
    to,
    subject,
    body,
    attachments: [
      {
        filename,
        content: pdfBase64,
        contentType: "application/pdf",
      },
    ],
  });
}
