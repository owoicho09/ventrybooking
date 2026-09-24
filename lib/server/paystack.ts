import crypto from 'crypto';

const SECRET = process.env.PAYSTACK_SECRET_KEY!;
const BASE = 'https://api.paystack.co';

async function paystackRequest(method: string, path: string, body?: object) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!data.status) throw new Error(data.message || 'Paystack request failed');
  return data.data;
}

export async function initializeTransaction(params: {
  email: string;
  amount: number; // in kobo (NGN * 100)
  reference: string;
  metadata?: object;
  callback_url: string;
}) {
  return paystackRequest('POST', '/transaction/initialize', params);
}

export async function verifyTransaction(reference: string) {
  return paystackRequest('GET', `/transaction/verify/${reference}`);
}

export async function refundTransaction(params: {
  transaction: string;
  amount?: number;
}) {
  return paystackRequest('POST', '/refund', params);
}

/** Resolves the bank-registered account name for a number + bank code — used to catch a mistyped account or a name mismatch before it's trusted. */
export async function resolveAccountName(params: { accountNumber: string; bankCode: string }): Promise<string> {
  const data = await paystackRequest(
    'GET',
    `/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`,
  );
  return (data as { account_name: string }).account_name;
}

export async function createTransferRecipient(params: {
  type: string;
  name: string;
  account_number: string;
  bank_code: string;
  currency: string;
}) {
  return paystackRequest('POST', '/transferrecipient', params);
}

export async function initiateTransfer(params: {
  source: string;
  amount: number;
  recipient: string;
  reason: string;
  reference: string;
}) {
  return paystackRequest('POST', '/transfer', params);
}

/**
 * Transfer initiation for money movements that must never be retried blind.
 * Distinguishes a definitive rejection (Paystack answered and said no — no
 * transfer exists) from an unknown outcome (network error, timeout, garbled
 * response — a transfer MAY exist), which the caller must resolve with
 * {@link verifyTransfer} before treating it as failed.
 */
export async function initiateTransferChecked(params: {
  amount: number; // kobo
  recipient: string;
  reason: string;
  reference: string;
}): Promise<
  | { kind: 'ok'; status: string; transferCode: string | null }
  | { kind: 'rejected'; message: string }
  | { kind: 'unknown'; message: string }
> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/transfer`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'balance', ...params }),
    });
  } catch (err) {
    return { kind: 'unknown', message: err instanceof Error ? err.message : 'Network error' };
  }
  let data: { status?: boolean; message?: string; data?: { status?: string; transfer_code?: string } };
  try {
    data = await res.json();
  } catch {
    return { kind: 'unknown', message: `Unreadable Paystack response (HTTP ${res.status})` };
  }
  if (res.status >= 500) return { kind: 'unknown', message: data.message || `Paystack HTTP ${res.status}` };
  if (!data.status) return { kind: 'rejected', message: data.message || `Paystack HTTP ${res.status}` };
  return { kind: 'ok', status: data.data?.status ?? 'pending', transferCode: data.data?.transfer_code ?? null };
}

/** Looks a transfer up by our reference. `found: false` only on Paystack's own 404. */
export async function verifyTransfer(reference: string): Promise<
  | { found: true; status: string; transferCode: string | null; failureReason: string | null }
  | { found: false }
> {
  const res = await fetch(`${BASE}/transfer/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
  });
  if (res.status === 404) return { found: false };
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message || `Paystack HTTP ${res.status}`);
  const t = data.data as { status: string; transfer_code?: string; gateway_response?: string | null };
  return { found: true, status: t.status, transferCode: t.transfer_code ?? null, failureReason: t.gateway_response ?? null };
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY!;
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
  return hash === signature;
}
