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
  basePriceFromTotalPaid,
} from '@/lib/fees';

/** Platform fee deducted from organizer gross payout (3%). */
export function calculateFees(grossAmount: number) {
  const fee = Math.round(grossAmount * PLATFORM_FEE_RATE);
  const net = grossAmount - fee;
  return { gross: grossAmount, fee, net };
}
