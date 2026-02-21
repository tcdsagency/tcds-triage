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
  // Location format: /tokens/{id} or /paymentSchedules/{id}
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

// Schedule response from GET /api/v2/paymentSchedules/{id}
// Note: no "status" field — detect state via numberOfExecutedPayments and nextPaymentDate
export interface EPaySchedule {
  id: string;
  payer: string;
  emailAddress: string;
  tokenId: string;
  numberOfTotalPayments: number;
  numberOfExecutedPayments: number;
  amount: number;
  payerFee: number;
  startDate: string;
  endDate: string | null;
  nextPaymentDate: string | null;
  interval: number;
  intervalCount: number;
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
// SCHEDULE FUNCTIONS
// =============================================================================

// POST /api/v2/paymentSchedules → 201, Location: /paymentSchedules/{id}
// Required: payer, emailAddress, tokenId, amount, interval, startDate
// For one-time future payment: interval="Day", intervalCount=0, numberOfTotalPayments=1
export async function createSchedule(data: {
  tokenId: string;
  amount: number;
  payer: string;
  emailAddress: string;
  startDate: string; // YYYY-MM-DD
}): Promise<{ id: string }> {
  return epayFetch<{ id: string }>("/api/v2/paymentSchedules", {
    method: "POST",
    body: JSON.stringify({
      tokenId: data.tokenId,
      amount: data.amount,
      payer: data.payer,
      emailAddress: data.emailAddress,
      startDate: data.startDate,
      interval: "Day",
      intervalCount: 0,
      numberOfTotalPayments: 1,
    }),
  });
}

// GET /api/v2/paymentSchedules/{id} → 200, JSON body
// No "status" field. Detect state:
//   - Executed: numberOfExecutedPayments >= numberOfTotalPayments
//   - Cancelled: nextPaymentDate === null && numberOfExecutedPayments === 0
//   - Pending: nextPaymentDate !== null && numberOfExecutedPayments === 0
export async function getSchedule(id: string): Promise<EPaySchedule> {
  return epayFetch<EPaySchedule>(`/api/v2/paymentSchedules/${encodeURIComponent(id)}`);
}

// POST /api/v2/paymentSchedules/{id}/cancel → 200, empty body
export async function cancelSchedule(id: string): Promise<void> {
  await epayFetch<any>(`/api/v2/paymentSchedules/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

// =============================================================================
// TRANSACTION FUNCTIONS
// =============================================================================

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
