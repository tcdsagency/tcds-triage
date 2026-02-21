// ePayPolicy v2 API Client
// Docs: https://docs.epaypolicy.com/v2

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
      detail = json.message || json.error || text;
    } catch {}
    throw new Error(`ePayPolicy API error ${res.status}: ${detail}`);
  }

  return res.json() as Promise<T>;
}

// =============================================================================
// TYPES
// =============================================================================

export interface EPayToken {
  id: string;
  last4: string;
  type: "card" | "ach";
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
  amount: number;
  fee: number;
  total: number;
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
  return epayFetch<EPayToken>("/api/v2/tokens", {
    method: "POST",
    body: JSON.stringify({
      type: "card",
      cardNumber: data.cardNumber,
      expirationMonth: data.expMonth,
      expirationYear: data.expYear,
      cvv: data.cvv,
      zipCode: data.zip,
      payer: data.payer,
      emailAddress: data.emailAddress,
    }),
  });
}

export async function tokenizeACH(data: {
  routingNumber: string;
  accountNumber: string;
  accountType?: string;
  payer: string;
  emailAddress: string;
}): Promise<EPayToken> {
  return epayFetch<EPayToken>("/api/v2/tokens", {
    method: "POST",
    body: JSON.stringify({
      type: "ach",
      routingNumber: data.routingNumber,
      accountNumber: data.accountNumber,
      accountType: data.accountType || "checking",
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
