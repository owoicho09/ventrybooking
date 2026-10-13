import { v4 as uuidv4 } from 'uuid';
import { isScheduled } from '@/lib/goLive';
import { getServerSupabase } from '@/lib/supabase/server';
import { verifyTransaction } from '@/lib/server/paystack';
import { resendTicketByReference } from '@/lib/server/ticket';
import { resendChangeOptOutEmail } from '@/lib/server/eventChangeWindow';
import { regenerateTicketForReference } from '@/lib/server/reconcile';
import { sendComplaintFiledEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import type { AgentTool, ChatMessage } from '@/lib/server/agent/runLoop';

const NOT_FOUND = { found: false, message: "I couldn't find an order matching that email and event." };

async function logAction(email: string, toolName: string, detail: string, ticketId?: string) {
  const db = getServerSupabase();
  await db.from('agent_actions').insert({
    tool_name: toolName,
    buyer_email: email,
    ticket_id: ticketId ?? null,
    detail,
  });
}

export interface BuyerToolContext {
  /** Set when the caller has a Phase 4 buyer session — overrides any email the model supplies. */
  sessionEmail: string | null;
  /** Live reference to the conversation so far, for file_complaint's transcript snapshot. */
  transcript: ChatMessage[];
}

function resolveEmail(ctx: BuyerToolContext, input: Record<string, unknown>): string | null {
  if (ctx.sessionEmail) return ctx.sessionEmail;
  const raw = String(input.email ?? '').trim().toLowerCase();
  return raw.includes('@') ? raw : null;
}

export function createBuyerTools(ctx: BuyerToolContext): AgentTool[] {
  const db = getServerSupabase();

  return [
    {
      name: 'lookup_order',
      kind: 'read',
      description: "Find a buyer's ticket order by their purchase email and the event name. Always call this before anything else that needs a ticket — never guess a ticket ID from chat.",
      input_schema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Purchase email. Omit if the buyer is already signed in.' },
          eventName: { type: 'string', description: 'The event name as the buyer describes it — matched fuzzily.' },
        },
        required: ['eventName'],
      },
      handler: async (input) => {
        const email = resolveEmail(ctx, input);
        if (!email) return NOT_FOUND;
        const eventName = String(input.eventName ?? '').trim();
        if (!eventName) return NOT_FOUND;

        const { data } = await db
          .from('tickets')
          .select(`
            id, status, purchased_at, total_paid, paystack_reference,
            event:events!tickets_event_id_fkey(event_name, date)
          `)
          .ilike('buyer_email', email)
          .order('purchased_at', { ascending: false });

        type EvRow = { event_name: string; date: string };
        const match = (data ?? []).find(t => {
          const ev = (Array.isArray(t.event) ? t.event[0] : t.event) as EvRow | null;
          return ev?.event_name?.toLowerCase().includes(eventName.toLowerCase());
        });
        if (!match) return NOT_FOUND;

        const ev = (Array.isArray(match.event) ? match.event[0] : match.event) as EvRow | null;
        const sameEvent = (data ?? []).filter(t => {
          const e = (Array.isArray(t.event) ? t.event[0] : t.event) as EvRow | null;
          return e?.event_name === ev?.event_name;
        });
        return {
          found: true,
          ticketId: match.id,
          status: match.status,
          eventName: ev?.event_name,
          eventDate: ev?.date,
          purchasedAt: match.purchased_at,
          paystackReference: match.paystack_reference,
          ticketCount: sameEvent.length,
          tickets: sameEvent.slice(0, 10).map(t => ({ ticketId: t.id, status: t.status, paystackReference: t.paystack_reference })),
          buyerEmail: email,
        };
      },
    },
    {
      name: 'verify_payment',
      kind: 'read',
      description: "Check Paystack's own record of a transaction by its reference — the source of truth for whether a payment actually succeeded.",
      input_schema: {
        type: 'object',
        properties: { reference: { type: 'string', description: 'Paystack transaction reference, from lookup_order.' } },
        required: ['reference'],
      },
      handler: async (input) => {
        const reference = String(input.reference ?? '').trim();
        if (!reference) return { error: 'Missing reference' };
        try {
          const tx = await verifyTransaction(reference);
          return {
            status: tx?.status,
            amountKobo: tx?.amount,
            paidAt: tx?.paid_at,
            gatewayResponse: tx?.gateway_response,
          };
        } catch {
          return { error: 'Could not reach Paystack right now' };
        }
      },
    },
    {
      name: 'get_event_details',
      kind: 'read',
      description: 'Look up public details for an event by name: date, venue, city, lineup, email-domain restrictions, and whether it is sold out.',
      input_schema: {
        type: 'object',
        properties: { eventName: { type: 'string' } },
        required: ['eventName'],
      },
      handler: async (input) => {
        const eventName = String(input.eventName ?? '').trim();
        if (!eventName) return { found: false };

        const { data: event } = await db
          .from('events')
          .select('id, event_name, date, time, venue, city, lineup, allowed_email_domains, status, goes_live_at')
          .ilike('event_name', `%${eventName}%`)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle();
        if (!event) return { found: false };
        // Not public yet: don't reveal a scheduled event's details early.
        if (isScheduled(event.goes_live_at)) return { found: false };

        const { data: tiers } = await db
          .from('ticket_tiers')
          .select('available, sold')
          .eq('event_id', event.id)
          .eq('hidden', false);
        const soldOut = (tiers ?? []).length > 0 && (tiers ?? []).every(t => t.sold >= t.available);

        return {
          found: true,
          eventName: event.event_name,
          date: event.date,
          time: event.time,
          venue: event.venue,
          city: event.city,
          lineup: event.lineup,
          allowedEmailDomains: event.allowed_email_domains,
          soldOut,
        };
      },
    },
    {
      name: 'get_ticket_status',
      kind: 'read',
      description: "Check a specific ticket's current status (valid, used, refunded, cancelled). Use the ticketId from lookup_order.",
      input_schema: {
        type: 'object',
        properties: { ticketId: { type: 'string' } },
        required: ['ticketId'],
      },
      handler: async (input) => {
        const ticketId = String(input.ticketId ?? '').trim();
        const { data } = await db.from('tickets').select('status').eq('id', ticketId).maybeSingle();
        return data ? { status: data.status } : { error: 'Ticket not found' };
      },
    },
    {
      name: 'get_refund_window_status',
      kind: 'read',
      description: "Check whether a ticket's event has an open venue/date-change refund window, and whether this buyer already claimed it.",
      input_schema: {
        type: 'object',
        properties: { ticketId: { type: 'string' } },
        required: ['ticketId'],
      },
      handler: async (input) => {
        const ticketId = String(input.ticketId ?? '').trim();
        const { data: ticket } = await db.from('tickets').select('event_id').eq('id', ticketId).maybeSingle();
        if (!ticket) return { hasWindow: false };

        const { data: change } = await db
          .from('event_changes')
          .select('id, change_type, refund_window_closes_at')
          .eq('event_id', ticket.event_id)
          .gt('refund_window_closes_at', new Date().toISOString())
          .order('changed_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!change) return { hasWindow: false };

        const { data: claim } = await db
          .from('ticket_change_refunds')
          .select('status')
          .eq('ticket_id', ticketId)
          .eq('event_change_id', change.id)
          .maybeSingle();

        return {
          hasWindow: true,
          changeType: change.change_type,
          closesAt: change.refund_window_closes_at,
          alreadyClaimed: !!claim,
        };
      },
    },
    {
      name: 'get_complaint_status',
      kind: 'read',
      description: 'Look up a previously filed complaint by its reference code (format CMP-XXXXXXXX).',
      input_schema: {
        type: 'object',
        properties: { reference: { type: 'string' } },
        required: ['reference'],
      },
      handler: async (input) => {
        const reference = String(input.reference ?? '').trim().toUpperCase();
        const { data } = await db.from('complaints').select('id, status, category, submitted_at').eq('id', reference).maybeSingle();
        return data ? data : { error: 'No complaint found with that reference' };
      },
    },
    {
      name: 'find_payment_attempts',
      kind: 'read',
      description: "List recent checkout attempts (last 30 days) for the buyer's email, with their Paystack references and whether a ticket was issued. Use this when the buyer says they paid but lookup_order finds no ticket, then verify_payment the reference before regenerate_ticket.",
      input_schema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Purchase email. Omit if the buyer is already signed in.' },
          eventName: { type: 'string', description: 'Optional: narrows to one event, matched fuzzily.' },
        },
      },
      handler: async (input) => {
        const email = resolveEmail(ctx, input);
        if (!email) return { found: false, message: 'Need the purchase email first.' };
        const eventName = String(input.eventName ?? '').trim().toLowerCase();
        const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

        const { data } = await db
          .from('pending_orders')
          .select('reference, total, quantity, created_at, event:events(event_name)')
          .ilike('buyer_email', email)
          .gt('created_at', since)
          .order('created_at', { ascending: false })
          .limit(20);

        type EvRow = { event_name: string };
        const rows = (data ?? []).filter(o => {
          if (!eventName) return true;
          const ev = (Array.isArray(o.event) ? o.event[0] : o.event) as EvRow | null;
          return ev?.event_name?.toLowerCase().includes(eventName);
        }).slice(0, 8);
        if (rows.length === 0) return { found: false, message: 'No checkout attempts found for that email.' };

        const refs = rows.map(o => o.reference);
        const { data: issued } = await db.from('tickets').select('paystack_reference').in('paystack_reference', refs);
        const issuedRefs = new Set((issued ?? []).map(t => t.paystack_reference));

        return {
          found: true,
          attempts: rows.map(o => {
            const ev = (Array.isArray(o.event) ? o.event[0] : o.event) as EvRow | null;
            return {
              reference: o.reference,
              eventName: ev?.event_name,
              amountNaira: o.total,
              quantity: o.quantity,
              startedAt: o.created_at,
              ticketIssued: issuedRefs.has(o.reference),
            };
          }),
        };
      },
    },
    {
      name: 'get_refund_claim_status',
      kind: 'read',
      description: "Check whether a ticket's event has a refund case (cancellation, a venue/date change inside 7 days, or a headliner no-show), when its claim window closes, and whether this ticket has already been claimed. Use the ticketId from lookup_order.",
      input_schema: {
        type: 'object',
        properties: { ticketId: { type: 'string' } },
        required: ['ticketId'],
      },
      handler: async (input) => {
        const ticketId = String(input.ticketId ?? '').trim();
        const { data: ticket } = await db.from('tickets').select('event_id').eq('id', ticketId).maybeSingle();
        if (!ticket) return { error: 'Ticket not found' };

        const { data: cases } = await db
          .from('refund_cases')
          .select('id, kind, status, refundable, claims_close_at, list_sent_at, pay_by, paid_reported_at')
          .eq('event_id', ticket.event_id)
          .order('opened_at', { ascending: false })
          .limit(3);
        if (!cases || cases.length === 0) return { hasRefundCase: false };

        const { data: claims } = await db
          .from('refund_claims')
          .select('case_id, status, amount, claimed_at, ventry_refunded_at')
          .eq('ticket_id', ticketId)
          .in('case_id', cases.map(c => c.id));

        return {
          hasRefundCase: true,
          cases: cases.map(c => {
            const claim = (claims ?? []).find(cl => cl.case_id === c.id);
            return {
              kind: c.kind,
              status: c.status,
              refundable: c.refundable,
              claimsCloseAt: c.claims_close_at,
              claimWindowOpen: !!c.claims_close_at && new Date(c.claims_close_at) > new Date(),
              claimListSentToOrganiserAt: c.list_sent_at,
              organiserPayBy: c.pay_by,
              organiserReportedPaidAt: c.paid_reported_at,
              thisTicket: claim
                ? { claimStatus: claim.status, amountNaira: claim.amount, claimedAt: claim.claimed_at, refundedByVentryAt: claim.ventry_refunded_at }
                : { claimStatus: 'not_claimed' },
            };
          }),
          claimLink: '/refunds/claim',
        };
      },
    },
    {
      name: 'regenerate_ticket',
      kind: 'act',
      description: 'Recreate a missing ticket for a confirmed payment. Only call this after verify_payment shows the transaction succeeded.',
      input_schema: {
        type: 'object',
        properties: { reference: { type: 'string' } },
        required: ['reference'],
      },
      handler: async (input) => {
        const email = ctx.sessionEmail;
        const reference = String(input.reference ?? '').trim();
        if (!reference) return { ok: false, reason: 'Missing reference' };
        const result = await regenerateTicketForReference(reference);
        await logAction(email ?? 'unknown', 'regenerate_ticket', `reference=${reference} ok=${result.ok}`, result.ok ? result.ticketId : undefined);
        return result;
      },
    },
    {
      name: 'resend_ticket_email',
      kind: 'act',
      description: "Resend a ticket's confirmation email (with QR codes for every ticket on that order) to the email address the ticket was bought with, never anywhere else. Use a ticketId from lookup_order.",
      input_schema: {
        type: 'object',
        properties: { ticketId: { type: 'string' } },
        required: ['ticketId'],
      },
      handler: async (input) => {
        const ticketId = String(input.ticketId ?? '').trim();
        if (!ticketId) return { ok: false, reason: 'Missing ticketId' };
        // Signed-in buyers can only resend their own tickets. Guests can ask for
        // a ticket they looked up, but the email always goes to the address on
        // the order, so nobody but its owner ever receives the QR codes.
        let email = ctx.sessionEmail;
        if (!email) {
          const { data: t } = await db.from('tickets').select('buyer_email').eq('id', ticketId).maybeSingle();
          email = t?.buyer_email ?? null;
        }
        if (!email) return { ok: false, reason: 'Ticket not found' };
        const result = await resendTicketByReference(ticketId, email);
        await logAction(email, 'resend_ticket_email', `ticketId=${ticketId} ok=${result.ok}`, ticketId);
        return result.ok ? { ok: true, sentTo: maskEmail(email) } : result;
      },
    },
    {
      name: 'resend_opt_out_email',
      kind: 'act',
      description: 'Resend the venue/date-change refund opt-out link — only works if that window is still open (check get_refund_window_status first).',
      input_schema: {
        type: 'object',
        properties: { ticketId: { type: 'string' } },
        required: ['ticketId'],
      },
      handler: async (input) => {
        const ticketId = String(input.ticketId ?? '').trim();
        const { data: t } = await db.from('tickets').select('buyer_email').eq('id', ticketId).maybeSingle();
        const email = ctx.sessionEmail ?? t?.buyer_email ?? 'unknown';
        const result = await resendChangeOptOutEmail(db, ticketId);
        await logAction(email, 'resend_opt_out_email', `ticketId=${ticketId} ok=${result.ok}`, ticketId);
        return result.ok ? { ok: true, sentTo: maskEmail(t?.buyer_email ?? email) } : result;
      },
    },
    {
      name: 'file_complaint',
      kind: 'act',
      description: "File a complaint for a human to review — use this for anything you can't resolve yourself: refunds, disputes, or a lookup that came back empty. Always tell the buyer you've done this and that they'll hear back by email.",
      input_schema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: "The buyer's email for the reply. Omit if the buyer is signed in; otherwise ask for it first." },
          eventName: { type: 'string' },
          category: { type: 'string', enum: ['payment', 'ticket_delivery', 'refund_request', 'event_day', 'event_inquiry', 'other'] },
          summary: { type: 'string', description: 'One or two sentences summarizing the issue for the admin queue.' },
        },
        required: ['category', 'summary'],
      },
      handler: async (input) => {
        const email = resolveEmail(ctx, input) ?? 'unknown@ventrybooking.com';
        const category = String(input.category ?? 'other');
        const eventName = String(input.eventName ?? '');
        const reference = `CMP-${uuidv4().slice(0, 8).toUpperCase()}`;

        await db.from('complaints').insert({
          id: reference,
          type: category,
          category,
          buyer_email: email,
          event_name: eventName,
          submitted_at: new Date().toISOString(),
          status: 'open',
          priority: category === 'payment' || category === 'event_day' ? 'high' : 'medium',
          notes: String(input.summary ?? ''),
          transcript: JSON.stringify(ctx.transcript),
        });

        if (email !== 'unknown@ventrybooking.com') {
          await sendComplaintFiledEmail(email, reference, eventName).catch(err => console.error('sendComplaintFiledEmail error', err));
        }

        await notify(
          { type: 'admin' },
          {
            notifType: 'complaint',
            title: `New support complaint — ${category}`,
            body: `${email}: ${input.summary}`,
            link: '/admin/complaints',
          },
          { emailChannel: category === 'payment' || category === 'event_day' ? 'immediate' : 'digest' },
        ).catch(err => console.error('notify error', err));

        await logAction(email, 'file_complaint', `category=${category} reference=${reference}`);

        return { ok: true, reference };
      },
    },
  ];
}

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  return `${user[0] ?? '*'}***@${domain}`;
}
