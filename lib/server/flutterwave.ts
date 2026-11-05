import { timingSafeEqual } from 'node:crypto';

const BASE = 'https://api.flutterwave.com/v3';

export interface FlutterwaveTransaction {
  id: string | number;
  tx_ref: string;
  amount: number;
  currency: string;
  status: string;
  meta?: Record<string, unknown>;
  customer?: { email?: string; name?: string };
  created_at?: string;
  processor_response?: string;
}

interface FlutterwaveResponse<T> {
  status: string;
  message?: string;
  data: T;
}

async function flutterwaveRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) throw new Error('FLUTTERWAVE_SECRET_KEY is not configured');
  if (/^FLWPUBK/.test(secret)) throw new Error('FLUTTERWAVE_SECRET_KEY contains a public key; use the Flutterwave secret key');

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const result = await response.json() as FlutterwaveResponse<T>;
  if (!response.ok || result.status !== 'success') {
    throw new Error(result.message || `Flutterwave request failed (${response.status})`);
  }
  return result.data;
}

export async function initializeFlutterwaveTransaction(params: {
  email: string;
  name: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<{ link: string }> {
  const meta = Object.fromEntries(
    Object.entries(params.metadata)
      .map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)] as const)
      .filter((entry): entry is readonly [string, string] => typeof entry[1] === 'string'),
  );

  return flutterwaveRequest('/payments', {
    method: 'POST',
    body: JSON.stringify({
      tx_ref: params.reference,
      amount: params.amount,
      currency: 'NGN',
      redirect_url: params.callbackUrl,
      customer: { email: params.email, name: params.name },
      meta,
    }),
  });
}

export function verifyFlutterwaveWebhookHash(hash: string): boolean {
  const expected = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  if (!expected || !hash) return false;
  const actualBytes = Buffer.from(hash);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function verifyFlutterwaveTransaction(id: string | number): Promise<FlutterwaveTransaction> {
  return flutterwaveRequest(`/transactions/${encodeURIComponent(String(id))}/verify`);
}

export async function findFlutterwaveTransaction(reference: string, createdAt?: string): Promise<FlutterwaveTransaction | null> {
  const fromDate = createdAt ? new Date(new Date(createdAt).getTime() - 24 * 60 * 60 * 1000) : new Date('2020-01-01T00:00:00Z');
  const params = new URLSearchParams({
    from: fromDate.toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    tx_ref: reference,
  });
  const transactions = await flutterwaveRequest<FlutterwaveTransaction[]>(`/transactions?${params}`);
  const transaction = transactions.find(item => item.tx_ref === reference);
  return transaction ? verifyFlutterwaveTransaction(transaction.id) : null;
}

export async function refundFlutterwaveTransaction(params: { reference: string; amount?: number }) {
  const transaction = await findFlutterwaveTransaction(params.reference);
  if (!transaction || transaction.status !== 'successful') {
    throw new Error('Could not find a successful Flutterwave transaction to refund');
  }

  const amount = params.amount === undefined ? undefined : Math.round(params.amount) / 100;
  return flutterwaveRequest(`/transactions/${encodeURIComponent(String(transaction.id))}/refund`, {
    method: 'POST',
    body: JSON.stringify(amount === undefined ? {} : { amount }),
  });
}