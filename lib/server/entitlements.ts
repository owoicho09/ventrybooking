// Newsletter sending is free during this phase. Every submission/approval
// point calls this single function rather than checking a plan or credit
// balance directly, so introducing real billing later (yearly subscription
// or pay-per-mail) is a change to this one function, not a rewrite of the
// routes that call it.
export async function checkNewsletterEntitlement(
  _organizerId: string,
): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  return { allowed: true };
}
