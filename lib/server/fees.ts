import { PLATFORM_FEE_RATE } from '@/lib/fees';

export {
  SERVICE_FEE_RATE,
  SERVICE_FEE_THRESHOLD,
  SERVICE_FEE_FLAT,
  PLATFORM_FEE_RATE,
  PROCESSING_FEE_RATE,
  PROCESSING_FEE_FLAT,
  PROCESSING_FEE_THRESHOLD,
  PROCESSING_FEE_CAP,
  serviceFeePerTicket,
  processingFee,
  buyerTotalWithProcessing,
  buyerTotalForItems,
  basePriceFromTotalPaid,
} from '@/lib/fees';

/**
 * Platform fee deducted from organizer gross payout. Defaults to the 3%
 * standard rate for new organizers; pass an organizer's own
 * `platform_fee_rate` (e.g. 0.025 for accounts grandfathered before the
 * 3% rate took effect) to charge their actual rate instead.
 */
export function calculateFees(grossAmount: number, rate: number = PLATFORM_FEE_RATE) {
  const fee = Math.round(grossAmount * rate);
  const net = grossAmount - fee;
  return { gross: grossAmount, fee, net };
}
