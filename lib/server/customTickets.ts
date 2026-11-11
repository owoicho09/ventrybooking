/**
 * Per-event custom ticket designs.
 *
 * Events listed here get a custom ticket (its own artwork, email and PDF)
 * instead of the standard Ventry ticket; every other event is unaffected.
 * To give another event a design, add its event ID with the design it uses;
 * to add a new design, add it to CustomTicketDesign and handle it where
 * `customTicketDesign()` is checked.
 *
 * Optional override without a code change: the CUSTOM_TICKET_EVENTS env var,
 * as comma-separated `eventId:design` pairs (e.g. `uuid-1:ijgb-visa`).
 */
export type CustomTicketDesign = 'ijgb-visa';

const EVENT_DESIGNS: Record<string, CustomTicketDesign> = {
  // IJGB: The Homecoming — Cruise Nation, 18 Dec 2026
  'd5643201-a37a-44eb-b733-41b7a5b9321b': 'ijgb-visa',
};

const KNOWN_DESIGNS = new Set<CustomTicketDesign>(['ijgb-visa']);

function envDesigns(): Record<string, CustomTicketDesign> {
  const out: Record<string, CustomTicketDesign> = {};
  for (const pair of (process.env.CUSTOM_TICKET_EVENTS || '').split(',')) {
    const [id, design] = pair.split(':').map(s => s?.trim());
    if (id && design && KNOWN_DESIGNS.has(design as CustomTicketDesign)) out[id] = design as CustomTicketDesign;
  }
  return out;
}

const DESIGNS: Record<string, CustomTicketDesign> = { ...EVENT_DESIGNS, ...envDesigns() };

/** The custom ticket design an event uses, or null for the standard ticket. */
export function customTicketDesign(eventId: string | null | undefined): CustomTicketDesign | null {
  return (eventId && DESIGNS[eventId]) || null;
}
