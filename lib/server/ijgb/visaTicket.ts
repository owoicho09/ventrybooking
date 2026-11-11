import { getServerSupabase } from '@/lib/supabase/server';
import { createHash } from 'crypto';
import { customTicketDesign } from '@/lib/server/customTickets';
import { renderVisaTicketImages, jpegsToPdf, type VisaTicketData } from './render';

export { renderVisaTicketImages, jpegsToPdf, designForTier, type VisaTicketData } from './render';

/**
 * IJGB Homecoming (Cruise Nation) — personalised "digital visa" tickets.
 *
 * A per-event custom ticket design (see lib/server/customTickets.ts), used
 * only for events registered with the 'ijgb-visa' design; every other event
 * keeps the standard Ventry ticket untouched. It sits on top of the existing
 * ticket lifecycle — same ticket rows, same ticket IDs, same QR payload
 * (`${APP_URL}/scan/${ticketId}`) and therefore the same door-scan
 * verification.
 */

/** True when this event uses the IJGB visa tickets. No DB access. */
export async function isIjgbEvent(eventId: string): Promise<boolean> {
  return customTicketDesign(eventId) === 'ijgb-visa';
}

// ── DB-backed helpers ──────────────────────────────────────────────────────
function one<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Loads the data a visa needs for the given tickets. Returns only live
 * (valid/used) tickets that belong to an IJGB event — an empty array for any
 * other event — so callers can pass any ticket IDs safely.
 *
 * The sequence number is the ticket's 1-based position in the event's
 * issuance order (purchased_at, then id), derived from existing rows. A
 * ticket's printed identity is then frozen by ensureVisaAssets() on first
 * render, so a later order recovered with an earlier purchased_at can't
 * renumber visas that were already issued.
 */
export async function loadVisaTickets(ticketIds: string[]): Promise<VisaTicketData[]> {
  const ids = Array.from(new Set(ticketIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const db = getServerSupabase();
  const { data, error } = await db
    .from('tickets')
    .select('id, event_id, status, buyer_name, purchased_at, tier:ticket_tiers!tickets_tier_id_fkey(name)')
    .in('id', ids);
  if (error) throw new Error(`loadVisaTickets: ${error.message}`);

  const rows = (data ?? []).filter(r => r.status === 'valid' || r.status === 'used');
  const eventIds = Array.from(new Set(rows.map(r => r.event_id as string)));
  const ijgb = new Set<string>();
  await Promise.all(eventIds.map(async id => { if (await isIjgbEvent(id)) ijgb.add(id); }));

  const out = await Promise.all(rows.filter(r => ijgb.has(r.event_id)).map(async r => {
    const ts = r.purchased_at as string;
    const { count, error: cErr } = await db
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', r.event_id)
      .or(`purchased_at.lt."${ts}",and(purchased_at.eq."${ts}",id.lt."${r.id}")`);
    if (cErr) throw new Error(`loadVisaTickets: sequence ${cErr.message}`);
    const t: VisaTicketData = {
      ticketId:  r.id as string,
      buyerName: (r.buyer_name as string) || '',
      tierName:  one(r.tier as { name: string }[] | { name: string } | null)?.name || '',
      issuedAt:  ts,
      sequence:  (count ?? 0) + 1,
    };
    return t;
  }));
  // Preserve the caller's order (email lists tickets in order).
  const order = new Map(ids.map((id, i) => [id, i]));
  return out.sort((a, b) => (order.get(a.ticketId)! - order.get(b.ticketId)!));
}

// ── Rendered-asset cache (Supabase Storage) ────────────────────────────────
// Each ticket is rendered ONCE; the preview JPEG and the PDF are stored in
// the existing public `event-assets` bucket and every later view, email
// image load, download or resend reuses them (CDN-served, no re-render).
// The cache key deliberately excludes the sequence number: whatever control
// number a ticket was first issued with is what it keeps. It does include
// the buyer name and tier, so a corrected name produces a fresh visa, and
// RENDER_VERSION, so a deliberate design change can invalidate old renders.
const BUCKET = 'event-assets';
const RENDER_VERSION = 'v1';

function assetPaths(t: VisaTicketData) {
  const key = createHash('sha256')
    .update(`${RENDER_VERSION}|${t.ticketId}|${t.buyerName.trim()}|${t.tierName.trim()}`)
    .digest('hex').slice(0, 16);
  const base = `ijgb-visas/${t.ticketId}-${key}`;
  return { preview: `${base}.jpg`, pdf: `${base}.pdf` };
}

export function visaPdfFilename(ticketId: string) {
  return `IJGB-Visa-${ticketId}.pdf`;
}

export interface VisaAssets {
  ticketId: string;
  /** Public URL of the inline preview (falls back to the on-demand route). */
  previewUrl: string;
  /** Public download URL of the PDF (falls back to the on-demand route). */
  pdfUrl: string;
  /** True when both files are in storage (URLs are CDN URLs). */
  stored: boolean;
  /** PDF bytes when this call produced or fetched them, else null. */
  pdf: Buffer | null;
  /** Preview bytes when this call rendered them, else null. */
  preview: Buffer | null;
}

function routeUrls(ticketId: string) {
  const app = process.env.NEXT_PUBLIC_APP_URL || '';
  return {
    previewUrl: `${app}/api/tickets/${ticketId}/visa`,
    pdfUrl:     `${app}/api/tickets/${ticketId}/visa?format=pdf`,
  };
}

/**
 * Returns the stored visa for a ticket, rendering + storing it first if it
 * doesn't exist yet. Storage problems never fail the caller: the visa is
 * still rendered in memory and URLs fall back to the on-demand route.
 * `withPdf` also returns the PDF bytes (for email attachments).
 */
export async function ensureVisaAssets(t: VisaTicketData, opts: { withPdf?: boolean } = {}): Promise<VisaAssets> {
  const storage = getServerSupabase().storage.from(BUCKET);
  const paths = assetPaths(t);
  const publicPreview = storage.getPublicUrl(paths.preview).data.publicUrl;
  const publicPdf     = storage.getPublicUrl(paths.pdf, { download: visaPdfFilename(t.ticketId) }).data.publicUrl;

  try {
    const [hasPreview, hasPdf] = await Promise.all([storage.exists(paths.preview), storage.exists(paths.pdf)]);
    if (hasPreview.data && hasPdf.data) {
      let pdf: Buffer | null = null;
      if (opts.withPdf) {
        const { data } = await storage.download(paths.pdf);
        pdf = data ? Buffer.from(await data.arrayBuffer()) : null;
      }
      if (!opts.withPdf || pdf) {
        return { ticketId: t.ticketId, previewUrl: publicPreview, pdfUrl: publicPdf, stored: true, pdf, preview: null };
      }
    }
  } catch (err) {
    console.error('ensureVisaAssets: storage lookup failed, rendering', t.ticketId, err);
  }

  const { full, preview } = await renderVisaTicketImages(t);
  const pdf = jpegsToPdf([full]);
  try {
    const up = await Promise.all([
      storage.upload(paths.preview, preview, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: true }),
      storage.upload(paths.pdf, pdf, { contentType: 'application/pdf', cacheControl: '31536000', upsert: true }),
    ]);
    const failed = up.find(u => u.error);
    if (failed?.error) throw failed.error;
    return { ticketId: t.ticketId, previewUrl: publicPreview, pdfUrl: publicPdf, stored: true, pdf, preview };
  } catch (err) {
    console.error('ensureVisaAssets: storage upload failed, using on-demand route URLs', t.ticketId, err);
    return { ticketId: t.ticketId, ...routeUrls(t.ticketId), stored: false, pdf, preview };
  }
}

/**
 * PDFs are attached only up to this total so the email stays small enough to
 * send reliably. Every ticket always also gets an inline image and a
 * download link in the email body, so a large order loses nothing.
 */
const ATTACH_BUDGET_BYTES = 6 * 1024 * 1024;

export interface VisaEmailParts {
  byTicket: Map<string, { previewUrl: string; pdfUrl: string; attached: boolean }>;
  attachments: { filename: string; content: Buffer }[];
}

/** Everything the ticket email needs for any IJGB tickets in the list (empty for other events). */
export async function prepareVisaEmail(ticketIds: string[]): Promise<VisaEmailParts> {
  const tickets = await loadVisaTickets(ticketIds);
  const assets = await Promise.all(tickets.map(t => ensureVisaAssets(t, { withPdf: true })));
  const byTicket: VisaEmailParts['byTicket'] = new Map();
  const attachments: VisaEmailParts['attachments'] = [];
  let used = 0;
  for (const a of assets) {
    const fits = !!a.pdf && used + a.pdf.length <= ATTACH_BUDGET_BYTES;
    if (fits) {
      attachments.push({ filename: visaPdfFilename(a.ticketId), content: a.pdf! });
      used += a.pdf!.length;
    }
    byTicket.set(a.ticketId, { previewUrl: a.previewUrl, pdfUrl: a.pdfUrl, attached: fits });
  }
  return { byTicket, attachments };
}
