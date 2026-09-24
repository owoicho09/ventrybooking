import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// Everyone who has consented to marketing, across Ventry's own list and every
// organiser's Audience. Returns name, event, source and date — not email.
//
// Query params (all optional):
//   list    all | ventry | organizer
//   source  all | checkout | notify_me   ('checkout' covers merged consents too)
//   status  active | unsubscribed | all   (default active)
//   from,to YYYY-MM-DD, on subscribed_at (Lagos-agnostic; whole UTC days)
//   q       name search
//   before  ISO timestamp cursor for "load more"

const PAGE = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface Filters {
  status: string; from: string | null; to: string | null; q: string; before: string | null;
}

// Supabase's builder types are too deep to pass through a generic helper
// (TS2589), so filtered queries go through this minimal structural type.
type Result = { data: Record<string, unknown>[] | null; count: number | null; error: unknown };
interface Q extends PromiseLike<Result> {
  is(col: string, v: null): Q;
  not(col: string, op: string, v: null): Q;
  eq(col: string, v: string): Q;
  gte(col: string, v: string): Q;
  lt(col: string, v: string): Q;
  lte(col: string, v: string): Q;
  ilike(col: string, v: string): Q;
  order(col: string, o: { ascending: boolean }): Q;
  limit(n: number): Q;
}

function applyFilters(qb: Q, f: Filters, forCount = false): Q {
  if (f.status === 'active') qb = qb.is('unsubscribed_at', null);
  if (f.status === 'unsubscribed') qb = qb.not('unsubscribed_at', 'is', null);
  if (f.from) qb = qb.gte('subscribed_at', `${f.from}T00:00:00Z`);
  if (f.to) {
    const end = new Date(`${f.to}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    qb = qb.lt('subscribed_at', end.toISOString());
  }
  if (f.q) qb = qb.ilike('name', `%${f.q.replace(/[%_,()]/g, ' ')}%`);
  // lte, not lt: rows sharing the boundary timestamp aren't skipped; the
  // client drops the repeats by id.
  if (f.before && !forCount) qb = qb.lte('subscribed_at', f.before);
  return qb;
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const list   = ['ventry', 'organizer'].includes(sp.get('list') ?? '') ? sp.get('list')! : 'all';
  const source = ['checkout', 'notify_me'].includes(sp.get('source') ?? '') ? sp.get('source')! : 'all';
  const f: Filters = {
    status: ['unsubscribed', 'all'].includes(sp.get('status') ?? '') ? sp.get('status')! : 'active',
    from:   DATE_RE.test(sp.get('from') ?? '') ? sp.get('from') : null,
    to:     DATE_RE.test(sp.get('to') ?? '') ? sp.get('to') : null,
    q:      (sp.get('q') ?? '').trim().slice(0, 80),
    before: sp.get('before') && !Number.isNaN(Date.parse(sp.get('before')!)) ? sp.get('before') : null,
  };

  // Ventry's list only has checkout-sourced rows (Notify Me is organiser-scoped).
  const includeVentry    = list !== 'organizer' && source !== 'notify_me';
  const includeOrganizer = list !== 'ventry';

  const db = getServerSupabase();

  try {
    const since7  = new Date(Date.now() - 7 * 86400_000).toISOString();
    const since30 = new Date(Date.now() - 30 * 86400_000).toISOString();
    const countOf = (r: { count: number | null; error: unknown }) => {
      if (r.error) throw r.error;
      return r.count ?? 0;
    };
    const head = { count: 'exact' as const, head: true };
    const empty: Promise<Result> = Promise.resolve({ data: [], count: 0, error: null });

    const sel = (table: string, cols: string, count = false) =>
      (count ? db.from(table).select(cols, head) : db.from(table).select(cols)) as unknown as Q;
    const orgSourceFilter = (qb: Q): Q =>
      source === 'checkout' ? qb.eq('source', 'ticket_consent') : source === 'notify_me' ? qb.eq('source', 'notify_me') : qb;

    const [
      ventryActive, ventryMerged, ventryNew7, ventryNew30, ventryUnsub,
      orgActive, orgCheckout, orgNotify,
      matchVentry, matchOrg,
      ventryRows, orgRows,
    ] = await Promise.all([
      db.from('ventry_subscribers').select('id', head).is('unsubscribed_at', null),
      db.from('ventry_subscribers').select('id', head).is('unsubscribed_at', null).eq('source', 'checkout_consent_merged'),
      db.from('ventry_subscribers').select('id', head).is('unsubscribed_at', null).gte('subscribed_at', since7),
      db.from('ventry_subscribers').select('id', head).is('unsubscribed_at', null).gte('subscribed_at', since30),
      db.from('ventry_subscribers').select('id', head).not('unsubscribed_at', 'is', null),
      db.from('organizer_subscribers').select('id', head).is('unsubscribed_at', null),
      db.from('organizer_subscribers').select('id', head).is('unsubscribed_at', null).eq('source', 'ticket_consent'),
      db.from('organizer_subscribers').select('id', head).is('unsubscribed_at', null).eq('source', 'notify_me'),
      includeVentry
        ? applyFilters(sel('ventry_subscribers', 'id', true), f, true)
        : empty,
      includeOrganizer
        ? applyFilters(orgSourceFilter(sel('organizer_subscribers', 'id', true)), f, true)
        : empty,
      includeVentry
        ? applyFilters(
            sel('ventry_subscribers', 'id, name, source, subscribed_at, unsubscribed_at, event:events(event_name)')
              .order('subscribed_at', { ascending: false })
              .limit(PAGE),
            f,
          )
        : empty,
      includeOrganizer
        ? applyFilters(
            orgSourceFilter(
              sel('organizer_subscribers', 'id, name, source, subscribed_at, unsubscribed_at, event:events(event_name), organizer:users!organizer_subscribers_organizer_id_fkey(name)')
                .order('subscribed_at', { ascending: false })
                .limit(PAGE),
            ),
            f,
          )
        : empty,
    ]);

    if (ventryRows.error) throw ventryRows.error;
    if (orgRows.error) throw orgRows.error;

    const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

    type Row = {
      id: string; list: 'ventry' | 'organizer'; listName: string; name: string | null; eventName: string | null;
      source: 'checkout_consent' | 'checkout_consent_merged' | 'notify_me'; subscribedAt: string; unsubscribedAt: string | null;
    };
    const rows: Row[] = [
      ...(ventryRows.data ?? []).map(r => ({
        id:             `v-${r.id}`,
        list:           'ventry' as const,
        listName:       'Ventry',
        name:           (r.name as string | null) ?? null,
        eventName:      one(r.event as { event_name: string } | null)?.event_name ?? null,
        source:         r.source as Row['source'],
        subscribedAt:   r.subscribed_at as string,
        unsubscribedAt: (r.unsubscribed_at as string | null) ?? null,
      })),
      ...(orgRows.data ?? []).map(r => ({
        id:             `o-${r.id}`,
        list:           'organizer' as const,
        listName:       one(r.organizer as { name: string } | null)?.name ?? 'Organiser',
        name:           (r.name as string | null) ?? null,
        eventName:      one(r.event as { event_name: string } | null)?.event_name ?? null,
        source:         (r.source === 'notify_me' ? 'notify_me' : 'checkout_consent') as Row['source'],
        subscribedAt:   r.subscribed_at as string,
        unsubscribedAt: (r.unsubscribed_at as string | null) ?? null,
      })),
    ]
      .sort((a, b) => b.subscribedAt.localeCompare(a.subscribedAt))
      .slice(0, PAGE);

    // Each table returned up to PAGE rows; after merging, anything older than
    // the last row kept may still exist in either table.
    const total = countOf(matchVentry) + countOf(matchOrg);
    const nextCursor = rows.length === PAGE ? rows[rows.length - 1].subscribedAt : null;

    return NextResponse.json(
      {
        success: true,
        data: {
          stats: {
            ventryActive:       countOf(ventryActive),
            ventryMerged:       countOf(ventryMerged),
            ventryNewLast7:     countOf(ventryNew7),
            ventryNewLast30:    countOf(ventryNew30),
            ventryUnsubscribed: countOf(ventryUnsub),
            organizerActive:    countOf(orgActive),
            organizerCheckout:  countOf(orgCheckout),
            organizerNotifyMe:  countOf(orgNotify),
          },
          total,
          rows,
          nextCursor,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    console.error('GET /api/admin/subscribers error', err);
    return NextResponse.json({ error: 'Failed to load subscribers' }, { status: 500 });
  }
}
