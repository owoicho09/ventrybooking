import { findFlutterwaveTransaction, refundFlutterwaveTransaction } from '@/lib/server/flutterwave';
import { refundTransaction as refundPaystackTransaction, verifyTransaction as verifyPaystackTransaction } from '@/lib/server/paystack';

export interface VerifiedPayment {
  status: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  customer?: { email?: string };
  paid_at?: string;
  gateway_response?: string;
}

export async function verifyPaymentTransaction(reference: string, createdAt?: string): Promise<VerifiedPayment | null> {
  if (!reference.startsWith('VTF-')) {
    return await verifyPaystackTransaction(reference) as VerifiedPayment;
  }

  const transaction = await findFlutterwaveTransaction(reference, createdAt);
  if (!transaction) return null;

  return {
    status: transaction.status === 'successful' && transaction.currency === 'NGN' ? 'success' : transaction.status,
    amount: Math.round(Number(transaction.amount) * 100),
    currency: transaction.currency,
    metadata: transaction.meta,
    customer: { email: transaction.customer?.email },
    paid_at: transaction.created_at,
    gateway_response: transaction.processor_response,
  };
}

export async function refundTransaction(params: { transaction: string; amount?: number }) {
  if (params.transaction.startsWith('VTF-')) {
    return refundFlutterwaveTransaction({ reference: params.transaction, amount: params.amount });
  }
  return refundPaystackTransaction(params);
}