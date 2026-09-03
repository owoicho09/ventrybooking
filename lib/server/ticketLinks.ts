import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET!;

export type TicketLinkPurpose = 'refund_opt_out' | 'review';

export interface TicketLinkPayload {
  ticketId: string;
  purpose: TicketLinkPurpose;
  /** refund_opt_out only — ties the link to one specific event_changes row. */
  changeId?: string;
}

/**
 * Signs a no-login link scoped to one ticket. Reused by the refund opt-out
 * flow (Phase 4) and the post-event review flow (Phase 5).
 *
 * expiresIn is passed in seconds (a plain number) rather than jsonwebtoken's
 * "48h"-style string, since the refund window's expiry is computed to the
 * second (capped at the event's start time) and can be fractional hours.
 */
export function signTicketLink(payload: TicketLinkPayload, expiresInSeconds: number): string {
  return jwt.sign(payload, SECRET, { expiresIn: Math.max(1, Math.floor(expiresInSeconds)) });
}

export function verifyTicketLink(token: string): TicketLinkPayload {
  return jwt.verify(token, SECRET) as TicketLinkPayload;
}
