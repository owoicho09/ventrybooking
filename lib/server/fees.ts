const PLATFORM_FEE_RATE = 0.025; // 2.5%
export const SERVICE_FEE = 100; // NGN 100 flat buyer fee, never refunded

export function calculateFees(grossAmount: number) {
  const fee = Math.round(grossAmount * PLATFORM_FEE_RATE);
  const net = grossAmount - fee;
  return { gross: grossAmount, fee, net };
}

export function buyerTotal(ticketPrice: number, quantity: number) {
  const subtotal = ticketPrice * quantity;
  const total = subtotal + SERVICE_FEE;
  return { subtotal, serviceFee: SERVICE_FEE, total };
}
