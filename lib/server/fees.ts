export { SERVICE_FEE_RATE, SERVICE_FEE_THRESHOLD, SERVICE_FEE_FLAT, serviceFeePerTicket, buyerTotal, basePriceFromTotalPaid } from '@/lib/fees';

const PLATFORM_FEE_RATE        = 0.025; // 2.5%  Ventry platform fee (deducted from organizer payout)
export const PAYSTACK_FEE_RATE = 0.015; // 1.5%  Paystack fee deducted by Paystack from settlement — not charged to buyer

/** Platform fee deducted from organizer gross payout (2.5%). */
export function calculateFees(grossAmount: number) {
  const fee = Math.round(grossAmount * PLATFORM_FEE_RATE);
  const net = grossAmount - fee;
  return { gross: grossAmount, fee, net };
}
