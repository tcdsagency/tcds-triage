// ePayPolicy v2 API Client
// Auth: Basic Auth (API Key : API Secret)
// Docs: https://docs.epaypolicy.com, SDK: https://github.com/epay3/epay3.Sdk

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
      if (json.modelState) {
        const errors = Object.values(json.modelState).flat().join("; ");
        detail = `${json.message || "Validation error"}: ${errors}`;
      } else {
        detail = json.message || json.error || text;
      }
    } catch {}
    throw new Error(`ePayPolicy API error ${res.status}: ${detail}`);
  }

  // 201 Created responses return empty body — resource ID is in Location header
  // Location format: /tokens/{id} or /transactions/{id}
  const contentLength = res.headers.get("content-length");
  if (contentLength === "0" || res.status === 204) {
    const location = res.headers.get("location") || "";
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

export interface EPayTransaction {
  id: string;
  amount: number;
  payer: string;
  emailAddress: string;
  maskedAccountNumber: string;
  [key: string]: any;
}

export interface EPayTransactionFees {
  achPayerFee: number;
  creditCardPayerFee: number;
  [key: string]: any;
}

export interface EPaySchedule {
  id: string;
  status?: string;
  numberOfTotalPayments?: number;
  numberOfPaymentsMade?: number;
  [key: string]: any;
}

// =============================================================================
// TOKEN FUNCTIONS
// =============================================================================

// POST /api/v2/tokens → 201, Location: /tokens/{id}
// Card fields: creditCardInformation { cardNumber, month (int), year (int 4-digit), cvc, accountHolder, postalCode }
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
      creditCardInformation: {
        cardNumber: data.cardNumber,
        month: parseInt(data.expMonth) || 0,
        year: parseInt(data.expYear) >= 100 ? parseInt(data.expYear) : 2000 + (parseInt(data.expYear) || 0),
        cvc: data.cvv,
        accountHolder: data.payer,
        postalCode: data.zip,
      },
      payer: data.payer,
      emailAddress: data.emailAddress,
    }),
  });
}

// POST /api/v2/tokens → 201, Location: /tokens/{id}
// ACH fields: bankAccountInformation { routingNumber, accountNumber, accountType (enum string), accountHolder, firstName, lastName }
// AccountType values: "PersonalChecking", "PersonalSavings", "CorporateChecking", "CorporateSavings"
export async function tokenizeACH(data: {
  routingNumber: string;
  accountNumber: string;
  payer: string;
  emailAddress: string;
}): Promise<EPayToken> {
  const firstName = data.payer.split(" ")[0] || data.payer;
  const lastName = data.payer.split(" ").slice(1).join(" ") || data.payer;

  return epayFetch<EPayToken>("/api/v2/tokens", {
    method: "POST",
    body: JSON.stringify({
      bankAccountInformation: {
        routingNumber: data.routingNumber,
        accountNumber: data.accountNumber,
        accountType: "PersonalChecking",
        accountHolder: data.payer,
        firstName,
        lastName,
      },
      payer: data.payer,
      emailAddress: data.emailAddress,
    }),
  });
}

// =============================================================================
// TRANSACTION FUNCTIONS
// =============================================================================

// POST /api/v2/transactions → 201, Location: /transactions/{numericId}
// Creates a one-time direct charge against a stored token
// PaymentResponseCode: 1=Success, 0=GenericDecline, 4=InsufficientFunds, 13=InvalidToken, 12=HardDuplicate
export async function createTransaction(data: {
  tokenId: string;
  subTotal: number;
  payer: string;
  emailAddress: string;
  sendReceipt?: boolean;
}): Promise<{ id: string }> {
  return epayFetch<{ id: string }>("/api/v2/transactions", {
    method: "POST",
    body: JSON.stringify({
      tokenId: data.tokenId,
      subTotal: data.subTotal,
      payer: data.payer,
      emailAddress: data.emailAddress,
      sendReceipt: data.sendReceipt ?? false,
    }),
  });
}

// GET /api/v2/transactions/{id} → 200, JSON body
export async function getTransaction(id: string): Promise<EPayTransaction> {
  return epayFetch<EPayTransaction>(`/api/v2/transactions/${encodeURIComponent(id)}`);
}

// GET /api/v2/transactionFees?amount={amount} → 200, JSON body
// Returns { achPayerFee, creditCardPayerFee }
export async function getTransactionFees(amount: number): Promise<EPayTransactionFees> {
  return epayFetch<EPayTransactionFees>(
    `/api/v2/transactionFees?amount=${encodeURIComponent(amount)}`
  );
}

// =============================================================================
// SCHEDULE FUNCTIONS (recurring payments)
// =============================================================================

// POST /api/v2/paymentSchedules → 201, Location: /paymentSchedules/{id}
// Creates a recurring payment schedule against a stored token
// interval: "Week" or "Month", intervalCount: 1 (monthly/weekly) or 2 (bi-weekly)
export async function createSchedule(data: {
  tokenId: string;
  subTotal: number;
  payer: string;
  emailAddress: string;
  startDate: string; // YYYY-MM-DD
  totalNumberOfPayments: number;
  interval: "Week" | "Month";
  intervalCount: number;
  sendReceipt?: boolean;
}): Promise<{ id: string }> {
  return epayFetch<{ id: string }>("/api/v2/paymentSchedules", {
    method: "POST",
    body: JSON.stringify({
      tokenId: data.tokenId,
      subTotal: data.subTotal,
      payer: data.payer,
      emailAddress: data.emailAddress,
      startDate: data.startDate,
      totalNumberOfPayments: data.totalNumberOfPayments,
      interval: data.interval,
      intervalCount: data.intervalCount,
      sendReceipt: data.sendReceipt ?? false,
    }),
  });
}

// GET /api/v2/paymentSchedules/{id} → 200, JSON body
export async function getSchedule(id: string): Promise<EPaySchedule> {
  return epayFetch<EPaySchedule>(`/api/v2/paymentSchedules/${encodeURIComponent(id)}`);
}

// DELETE /api/v2/paymentSchedules/{id} → 200/204
export async function cancelSchedule(id: string): Promise<void> {
  await epayFetch<any>(`/api/v2/paymentSchedules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
