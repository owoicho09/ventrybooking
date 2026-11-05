import { getServerSupabase } from '@/lib/supabase/server';
import { createTicketFromPayment, type CartItem } from '@/lib/server/ticket';
import type { FlutterwaveTransaction } from '@/lib/server/flutterwave';

function parseItems(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const tierId = typeof row.tierId === 'string' ? row.tierId : row.tier_id;
    return typeof tierId === 'string' && typeof row.quantity === 'number' && row.quantity > 0
      ? [{ tierId, quantity: row.quantity }]
      : [];
  });
}

export async function createTicketFromFlutterwavePayment(
  reference: string,
  transaction: FlutterwaveTransaction,
): Promise<string | null> {
  if (transaction.status !== 'successful' || transaction.tx_ref !== reference || transaction.currency !== 'NGN') {
    throw new Error('Flutterwave transaction does not match the expected successful order');
  }

  const db = getServerSupabase();
  const { data: order, error } = await db
    .from('pending_orders')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();
  if (error) throw new Error(`Could not load pending Flutterwave order: ${error.message}`);

  const metadata = transaction.meta ?? {};
  const eventId = typeof metadata.eventId === 'string' ? metadata.eventId : order?.event_id;
  const metadataItems = parseItems(metadata.items);
  const orderItems = parseItems(order?.items);
  const items = metadataItems.length > 0
    ? metadataItems
    : orderItems.length > 0
      ? orderItems
      : order?.tier_id
        ? [{ tierId: order.tier_id as string, quantity: Number(order.quantity) }]
        : [];
  const buyerEmail = typeof metadata.buyerEmail === 'string' ? metadata.buyerEmail : order?.buyer_email;
  const buyerName = typeof metadata.buyerName === 'string' ? metadata.buyerName : order?.buyer_name;
  const total = Number(metadata.total ?? order?.total);

  if (!eventId || items.length === 0 || !buyerEmail || !Number.isFinite(total) || total <= 0) {
    throw new Error('Flutterwave payment is missing its matching order details');
  }
  if (Number(transaction.amount) < total) {
    throw new Error('Flutterwave transaction amount is less than the order total');
  }

  return createTicketFromPayment({
    reference,
    eventId,
    items,
    totalPaidKobo: Math.round(total * 100),
    buyerEmail,
    buyerName,
    customerEmail: transaction.customer?.email,
    marketingConsent: metadata.marketingConsent === true,
    ventryMarketingConsent: metadata.ventryMarketingConsent === true,
    refCode: typeof metadata.refCode === 'string' ? metadata.refCode : undefined,
    purchasedByEmail: typeof metadata.purchasedByEmail === 'string' ? metadata.purchasedByEmail : undefined,
    paidAt: transaction.created_at,
  });
}