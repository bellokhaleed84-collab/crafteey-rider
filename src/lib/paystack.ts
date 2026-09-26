import crypto from "crypto";

const BASE = "https://api.paystack.co";

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("Missing PAYSTACK_SECRET_KEY environment variable");
  return key;
}

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.status) {
    throw new Error(json?.message || `Paystack request failed (${res.status})`);
  }
  return json.data as T;
}

export interface PaystackInitData {
  authorization_url: string;
  access_code: string;
  reference: string;
}

/** Used for debt payoff — the rider paying Crafteey. */
export function initializeTransaction(input: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<PaystackInitData> {
  return paystack<PaystackInitData>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
}

export interface PaystackVerifyData {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  channel?: string;
  paid_at?: string;
}

export function verifyTransaction(reference: string): Promise<PaystackVerifyData> {
  return paystack<PaystackVerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/** Paystack signs the raw webhook body with HMAC-SHA512 using your secret key. */
export function isValidWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha512", secretKey()).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ── Transfers — used for the Monday/Thursday wallet withdrawal, Crafteey paying the rider ──

export interface PaystackRecipientData {
  recipient_code: string;
  details: { account_number: string; account_name: string; bank_code: string };
}

export function createTransferRecipient(input: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<PaystackRecipientData> {
  return paystack<PaystackRecipientData>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    }),
  });
}

export interface PaystackBankAccountData {
  account_number: string;
  account_name: string;
}

/** Confirms an account number/bank pair and returns the real account name before saving. */
export function resolveBankAccount(input: {
  accountNumber: string;
  bankCode: string;
}): Promise<PaystackBankAccountData> {
  return paystack<PaystackBankAccountData>(
    `/bank/resolve?account_number=${encodeURIComponent(input.accountNumber)}&bank_code=${encodeURIComponent(
      input.bankCode
    )}`
  );
}

export interface PaystackTransferData {
  reference: string;
  status: string; // "success" | "pending" | "otp" | "failed"
  transfer_code: string;
}

export function initiateTransfer(input: {
  amountKobo: number;
  recipientCode: string;
  reference: string;
  reason?: string;
}): Promise<PaystackTransferData> {
  return paystack<PaystackTransferData>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason ?? "Crafteey rider payout",
    }),
  });
}