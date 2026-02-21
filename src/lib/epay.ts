// ePayPolicy v2 API Client
// Docs: https://docs.epaypolicy.com

const EPAY_BASE_URL = process.env.EPAY_BASE_URL || "https://api-sandbox.epaypolicy.com";
const EPAY_API_KEY = process.env.EPAY_API_KEY || "";
const EPAY_API_SECRET = process.env.EPAY_API_SECRET || "";

function getAuthHeader(): string {
  const credentials = Buffer.from(`${EPAY_API_KEY}:${EPAY_API_SECRET}`).toString("base64");
  return `Basic ${credentials}`;
}

async function epayFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${EPAY_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      // Include modelState validation errors for debugging
      if (json.modelState) {
        const errors = Object.values(json.modelState).flat().join("; ");
        detail = `${json.message || "Validation error"}: ${errors}`;
      } else {
        detail = json.message || json.error || text;
      }
    } catch {}
    throw new Error(`ePayPolicy API error ${res.status}: ${detail}`);
  }

  // Token creation returns 201 with empty body — ID is in Location header
  const contentLength = res.headers.get("content-length");
  if (contentLength === "0" || res.status === 204) {
    const location = res.headers.get("location") || "";
    // Location format: /tokens/{id}
    const id = location.split("/").pop() || "";
    return { id } as T;
  }

  return res.json() as Promise<T>;
}

// =============================================================================
// TYPES
// =============================================================================

export interface EPayToken {
  id: string;
  [key: string]: any;
}

export interface EPaySchedule {
  id: string;
  status: string;
  transactionId?: string;
  amount: number;
  startDate: string;
  [key: string]: any;
}

export interface EPayTransaction {
  id: string;
  status: string;
  amount: number;
  [key: string]: any;
}

export interface EPayTransactionFees {
  achPayerFee: number;
  creditCardPayerFee: number;
  [key: string]: any;
}

// =============================================================================
// TOKEN FUNCTIONS
// =============================================================================

export async function tokenizeCard(data: {
  cardNumber: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  zip: string;
  payer: string;
  emailAddress: string;
}): Promise<EPayToken> {
  // ePay v2 uses nested creditCardInformation object
  // Field names: month (int), year (int), cvc (string), accountHolder (string)
  return epayFetch<EPayToken>("/api/v2/tokens", {
    method: "POST",
    body: JSON.stringify({
      creditCardInformation: {
        cardNumber: data.cardNumber,
        month: parseInt(data.expMonth) || 0,
        year: parseInt(data.expYear) >= 100 ? parseInt(data.expYear) : 2000 + (parseInt(data.expYear) || 0),
        cvc: data.cvv,
        accountHolder: data.payer,
      },
      payer: data.payer,
      emailAddress: data.emailAddress,
    }),
  });
}

export async function tokenizeACH(data: {
  routingNumber: string;
  accountNumber: string;
  payer: string;
  emailAddress: string;
}): Promise<EPayToken> {
  // ePay v2 uses nested bankAccountInformation object
  // accountType: 1 = Checking, 2 = Savings
  return epayFetch<EPayToken>("/api/v2/tokens", {
    method: "POST",
    body: JSON.stringify({
      bankAccountInformation: {
        routingNumber: data.routingNumber,
        accountNumber: data.accountNumber,
        accountType: 1, // Checking
        accountHolder: data.payer,
        firstName: data.payer.split(" ")[0] || data.payer,
        lastName: data.payer.split(" ").slice(1).join(" ") || data.payer,
      },
      payer: data.payer,
      emailAddress: data.emailAddress,
    }),
  });
}

// =============================================================================
// SCHEDULE FUNCTIONS
// =============================================================================

export async function createSchedule(data: {
  tokenId: string;
  amount: number;
  payerName: string;
  email?: string;
  startDate: string; // YYYY-MM-DD
}): Promise<EPaySchedule> {
  return epayFetch<EPaySchedule>("/api/v2/paymentSchedules", {
    method: "POST",
    body: JSON.stringify({
      tokenId: data.tokenId,
      amount: data.amount,
      payerName: data.payerName,
      email: data.email || undefined,
      startDate: data.startDate,
      interval: 0,
      intervalCount: 0,
      numberOfTotalPayments: 1,
    }),
  });
}

export async function getSchedule(id: string): Promise<EPaySchedule> {
  return epayFetch<EPaySchedule>(`/api/v2/paymentSchedules/${encodeURIComponent(id)}`);
}

export async function cancelSchedule(id: string): Promise<EPaySchedule> {
  return epayFetch<EPaySchedule>(`/api/v2/paymentSchedules/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

// =============================================================================
// TRANSACTION FUNCTIONS
// =============================================================================

export async function getTransaction(id: string): Promise<EPayTransaction> {
  return epayFetch<EPayTransaction>(`/api/v2/transactions/${encodeURIComponent(id)}`);
}

export async function getTransactionFees(amount: number): Promise<EPayTransactionFees> {
  return epayFetch<EPayTransactionFees>(
    `/api/v2/transactionFees?amount=${encodeURIComponent(amount)}`
  );
}
