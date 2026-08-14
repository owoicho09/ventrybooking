import { PLATFORM_FEE_RATE } from '@/lib/fees';

export { SERVICE_FEE_RATE, SERVICE_FEE_THRESHOLD, SERVICE_FEE_FLAT, PLATFORM_FEE_RATE, serviceFeePerTicket, buyerTotal, basePriceFromTotalPaid } from '@/lib/fees';

export const PAYSTACK_FEE_RATE = 0.015; // 1.5%  Paystack fee deducted by Paystack from settlement — not charged to buyer

/** Platform fee deducted from organizer gross payout (2.5%). */
export function calculateFees(grossAmount: number) {
  const fee = Math.round(grossAmount * PLATFORM_FEE_RATE);
  const net = grossAmount - fee;
  return { gross: grossAmount, fee, net };
}
