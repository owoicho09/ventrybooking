'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Ticket, Wallet, Users, ScanLine, RefreshCw, MapPin, CalendarDays, Lock } from 'lucide-react';
import { formatNGN } from '@/lib/utils';
import type { MonitorSnapshot } from '@/lib/server/monitor';

/**
 * Sponsor / partner view of one event (056). Read-only, refreshes every
 * minute while the tab is visible. Revenue is the organiser's net, the same
 * figure on their own dashboard. No buyer is ever identified.
 */

const REFRESH_MS = 60_000;

const STATE_LABEL: Record<MonitorSnapshot['event']['state'], { text: string; color: string }> = {
  live:         { text: 'On sale',      color: 'var(--color-green)' },
  scheduled:    { text: 'Scheduled',    color: 'var(--color-amber)' },
  under_review: { text: 'Under review', color: 'var(--color-amber)' },
  ended:        { text: 'Ended',        color: 'var(--color-text-muted)' },
  cancelled:    { text: 'Cancelled',    color: 'var(--color-red)' },
  not_listed:   { text: 'Not listed',   color: 'var(--color-text-muted)' },
};

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' });
const num = (n: number) => n.toLocaleString('en-NG');

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function MonitorView({ token }: { token: string }) {
  const [data, setData] = useState<MonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const first = useRef(true);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/monitor/${encodeURIComponent(token)}${first.current ? '?view=1' : ''}`, { cache: 'no-store' });
      first.current = false;
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || 'This link isn’t working.'); setData(null); return; }
      setData(d.data); setError(null);
    } catch {
      // Keep showing the last figures on a blip; the next refresh retries.
    } finally {
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearTimeout(first); clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
        <div className="max-w-sm text-center flex flex-col items-center gap-3">
          <Lock size={28} style={{ color: 'var(--color-text-muted)' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Link not active</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{error}</p>
        </div>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading live figures&hellip;</p>
      </main>
    );
  }

  const { event, totals } = data;
  const state = STATE_LABEL[event.state];
  const pctSold = totals.ticketsAvailable > 0 ? Math.round((totals.ticketsSold / totals.ticketsAvailable) * 100) : 0;
  const pctIn = totals.validTickets > 0 ? Math.round((totals.checkedIn / totals.validTickets) * 100) : 0;

  return (
    <main className="min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: 'var(--color-purple-light)' }}>
              Ventry &middot; Live event report
            </span>
            <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              Updated {fmtClock(data.generatedAt)} &middot; refreshes every minute
            </span>
          </div>
          <div className="flex items-start gap-4">
            {event.bannerUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.bannerUrl} alt="" className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold break-words" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
                {event.name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <span className="inline-flex items-center gap-1.5"><CalendarDays size={14} />{fmtDate(event.date)}{event.time ? `, ${event.time.slice(0, 5)}` : ''}</span>
                <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{event.mode === 'online' ? 'Online' : [event.venue, event.city].filter(Boolean).join(', ')}</span>
                <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: state.color }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: state.color }} aria-hidden="true" />{state.text}
                </span>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--color-text-dim)' }}>
                Shared by {data.organizerName}{data.label ? ` for ${data.label}` : ''}. Read-only.
              </p>
            </div>
          </div>
        </header>

        {/* Headline figures */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Headline figures">
          <Tile icon={<Ticket size={15} />} label="Tickets sold" value={num(totals.ticketsSold)}
            sub={totals.ticketsAvailable ? `of ${num(totals.ticketsAvailable)} (${pctSold}%)` : undefined} pct={pctSold} />
          <Tile icon={<Wallet size={15} />} label="Revenue" value={formatNGN(totals.netRevenue)} sub="Organiser's net" />
          <Tile icon={<Users size={15} />} label="Buyers" value={num(totals.buyers)} sub={`${num(totals.orders)} order${totals.orders === 1 ? '' : 's'}`} />
          <Tile icon={<ScanLine size={15} />} label="Checked in" value={num(totals.checkedIn)}
            sub={totals.validTickets ? `of ${num(totals.validTickets)} tickets (${pctIn}%)` : 'Opens at the door'} pct={totals.validTickets ? pctIn : undefined} />
        </section>

        {/* Sales per day */}
        <Card title="Tickets sold per day">
          {data.daily.length === 0
            ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No sales yet. This fills in as tickets sell.</p>
            : <DailyChart daily={data.daily} />}
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Tiers */}
          <Card title="By ticket type" className="lg:col-span-2">
            {data.tiers.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No ticket types yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="text-left text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      <th className="font-medium px-1 pb-2">Ticket</th>
                      <th className="font-medium px-1 pb-2 text-right">Price</th>
                      <th className="font-medium px-1 pb-2">Sold</th>
                      <th className="font-medium px-1 pb-2 text-right">Revenue</th>
                      <th className="font-medium px-1 pb-2 text-right">Checked in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tiers.map(t => {
                      const pct = t.available ? Math.min(100, Math.round((t.sold / t.available) * 100)) : 0;
                      return (
                        <tr key={t.name} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <td className="px-1 py-2.5 font-medium" style={{ color: 'var(--color-text)' }}>{t.name}</td>
                          <td className="px-1 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{t.price === 0 ? 'Free' : formatNGN(t.price)}</td>
                          <td className="px-1 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 min-w-[60px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: 'var(--color-purple)' }} />
                              </div>
                              <span className="tabular-nums text-xs whitespace-nowrap" style={{ color: 'var(--color-text)' }}>{num(t.sold)} / {num(t.available)}</span>
                            </div>
                          </td>
                          <td className="px-1 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text)' }}>{formatNGN(t.netRevenue)}</td>
                          <td className="px-1 py-2.5 text-right tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{num(t.checkedIn)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Recent sales */}
          <Card title="Latest sales">
            {data.recent.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No sales yet.</p>
            ) : (
              <ul className="flex flex-col">
                {data.recent.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2 border-t first:border-t-0 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text)' }}>{r.tickets} &times; {r.tier}</span>
                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>{ago(r.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <p className="text-xs text-center pb-4" style={{ color: 'var(--color-text-dim)' }}>
          Revenue shown is the organiser&apos;s net revenue. Buyer names and contact details are never shared on this page.
          The organiser can switch this link off at any time.
        </p>
      </div>
    </main>
  );
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border p-5 flex flex-col gap-4 ${className}`} style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{title}</h2>
      {children}
    </section>
  );
}

function Tile({ icon, label, value, sub, pct }: { icon: React.ReactNode; label: string; value: string; sub?: string; pct?: number }) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-1 min-w-0" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>{icon}{label}</span>
      <span className="text-xl sm:text-2xl font-bold tabular-nums break-words" style={{ color: 'var(--color-text)' }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{sub}</span>}
      {pct !== undefined && (
        <div className="h-1 rounded-full overflow-hidden mt-1" style={{ backgroundColor: 'var(--color-surface-2)' }} aria-hidden="true">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: 'var(--color-purple)' }} />
        </div>
      )}
    </div>
  );
}

/** Single-series bar chart: one hue, thin bars rounded at the data end, recessive grid, hover tooltip, table fallback. */
function DailyChart({ daily }: { daily: { date: string; tickets: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = 200, padL = 32, padB = 22, padT = 8;
  const plotW = W - padL, plotH = H - padB - padT;
  const max = Math.max(1, ...daily.map(d => d.tickets));
  const step = Math.max(1, Math.ceil(max / 3));
  const top = step * 3;
  const slot = plotW / daily.length;
  const gap = Math.min(2, slot * 0.25);
  const barW = Math.max(1, Math.min(28, slot - gap));
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const labelIdx = new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1]);
  const total = daily.reduce((s, d) => s + d.tickets, 0);
  const best = daily.reduce((b, d) => (d.tickets > b.tickets ? d : b), daily[0]);

  const barPath = (x: number, v: number) => {
    const h = Math.max(0, (v / top) * plotH);
    if (h === 0) return '';
    const r = Math.min(4, barW / 2, h);
    const yTop = padT + plotH - h, yBase = padT + plotH;
    return `M${x},${yBase} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${yBase} Z`;
  };

  const h = hover !== null ? daily[hover] : null;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {num(total)} tickets over {daily.length} day{daily.length === 1 ? '' : 's'}. Best day: {fmtDay(best.date)} ({num(best.tickets)}).
      </p>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Tickets sold per day, ${daily.length} days`}
          onMouseLeave={() => setHover(null)}>
          {[0, 1, 2, 3].map(i => (
            <g key={i}>
              <line x1={padL} x2={W} y1={y(step * i)} y2={y(step * i)} stroke="var(--color-border)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : '2 4'} />
              <text x={padL - 6} y={y(step * i) + 3} textAnchor="end" fontSize={10} fill="var(--color-text-muted)">{step * i}</text>
            </g>
          ))}
          {daily.map((d, i) => {
            const x = padL + i * slot + (slot - barW) / 2;
            return (
              <g key={d.date}>
                <path d={barPath(x, d.tickets)} fill="var(--color-purple)" opacity={hover === null || hover === i ? 1 : 0.45} />
                {/* Hit target: the whole column, bigger than the bar. */}
                <rect x={padL + i * slot} y={padT} width={slot} height={plotH} fill="transparent"
                  onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
                {labelIdx.has(i) && (
                  <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor={i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'} fontSize={10} fill="var(--color-text-muted)">
                    {fmtDay(d.date)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {h && hover !== null && (
          <div className="absolute top-0 pointer-events-none rounded-lg border px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: `${((padL + hover * slot + slot / 2) / W) * 100}%`,
              transform: `translateX(${hover > daily.length * 0.7 ? '-100%' : hover < daily.length * 0.3 ? '0' : '-50%'})`,
              backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)',
            }}>
            <div style={{ color: 'var(--color-text-muted)' }}>{fmtDate(h.date)}</div>
            <div className="font-semibold tabular-nums">{num(h.tickets)} ticket{h.tickets === 1 ? '' : 's'}</div>
          </div>
        )}
      </div>
      <details>
        <summary className="text-xs cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>View as table</summary>
        <div className="max-h-56 overflow-y-auto mt-2">
          <table className="w-full text-xs">
            <tbody>
              {[...daily].reverse().map(d => (
                <tr key={d.date} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-1.5" style={{ color: 'var(--color-text-muted)' }}>{fmtDate(d.date)}</td>
                  <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--color-text)' }}>{num(d.tickets)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
