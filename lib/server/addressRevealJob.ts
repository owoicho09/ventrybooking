import { getServerSupabase } from '@/lib/supabase/server';
import { sendAddressRevealEmail } from '@/lib/server/email';
import { addressHiddenNow } from '@/lib/addressReveal';

// Releases hidden addresses at their reveal time (Refund Policy §10.3):
// every ticket holder is emailed the full address, then the event is marked
// revealed. Each buyer's send is recorded in email_deliveries under a
// per-event, per-email purpose key, so a run that runs out of time picks up
// where it left off without emailing anyone twice. Runs from the hourly cron.

const SEND_SPACING_MS = 550;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ventrybooking.com';

export async function runAddressReveals(budgetMs = 30_000): Promise<{ events: number; sent: number; done: number }> {
  const started = Date.now();
  const db = getServerSupabase();
  const { data: candidates, error } = await db.from('events')
    .select('id, slug, event_name, date, time, venue, address, city, lga, landmark, location_hidden, address_reveal_at, status')
    .eq('location_hidden', true)
    .is('address_revealed_at', null)
    .eq('status', 'approved');
  if (error) throw new Error(error.message);

  // Due = the reveal time has passed (or, with no reveal time, 24h before doors).
  const due = (candidates ?? []).filter(e => !addressHiddenNow({ location_hidden: true, address_reveal_at: e.address_reveal_at, date: String(e.date), time: e.time }));

  let sent = 0;
  let done = 0;
  let last = 0;
  for (const ev of due) {
    const { data: tickets } = await db.from('tickets')
      .select('buyer_email, buyer_name')
      .eq('event_id', ev.id)
      .in('status', ['valid', 'used']);
    const holders = new Map<string, string>();
    for (const t of tickets ?? []) if (t.buyer_email) holders.set(t.buyer_email.toLowerCase(), t.buyer_name ?? '');

    const purposeOf = (email: string) => `address_reveal:${ev.id}:${email}`;
    const emails = [...holders.keys()];
    const { data: already } = emails.length
      ? await db.from('email_deliveries').select('purpose').in('purpose', emails.map(purposeOf))
      : { data: [] as { purpose: string }[] };
    const sentBefore = new Set((already ?? []).map(r => r.purpose));

    let finished = true;
    for (const email of emails) {
      if (sentBefore.has(purposeOf(email))) continue;
      if (Date.now() - started > budgetMs) { finished = false; break; }
      const wait = SEND_SPACING_MS - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      last = Date.now();
      try {
        await sendAddressRevealEmail({
          to: email,
          buyerName: holders.get(email) ?? '',
          eventName: ev.event_name,
          eventDate: new Date(`${String(ev.date).slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }),
          eventTime: ev.time,
          venue: ev.venue,
          address: ev.address,
          lga: ev.lga,
          city: ev.city,
          landmark: ev.landmark,
          eventUrl: `${APP_URL}/${ev.slug ?? ''}`,
          purpose: purposeOf(email),
        });
        sent += 1;
      } catch (err) {
        console.error('address reveal: send failed', ev.id, err);
        finished = false;
      }
    }
    if (finished) {
      await db.from('events').update({ address_revealed_at: new Date().toISOString() }).eq('id', ev.id);
      done += 1;
    }
    if (Date.now() - started > budgetMs) break;
  }
  return { events: due.length, sent, done };
}
