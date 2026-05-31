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

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || process.env.PAYSTACK_SECRET_KEY!;
  const hash = crypto.createHmac('sha512', secret).update(body).digest('hex');
  return hash === signature;
}
