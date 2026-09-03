/**
 * Single source of truth for the display name buyer-facing emails about an
 * organiser's event show as the sender. The address never changes (Ventry's
 * own verified domain, see lib/server/email.ts) — only this display name
 * does, so a ticket confirmation, reminder, or change notice reads as coming
 * from the organiser's brand rather than "Ventry" or the event's own name.
 * Reused by the newsletter sender (which needs exactly the same rule).
 */
export function getOrganizerSenderName(organizerName: string | null | undefined): string {
  return organizerName?.trim() || 'Ventry';
}
