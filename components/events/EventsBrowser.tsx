'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, MapPin, Search, X } from 'lucide-react';
import { DragRail } from '@/components/v2/DragRail';
import { EventImage } from '@/components/v2/EventImage';
import { OrganiserMarquee } from '@/components/v2/OrganiserMarquee';
import { CategoryPill, EventCardV2, OrgAvatar } from '@/components/v2/EventCardV2';
import { CATEGORY_ORDER, ONLINE_META, categoryGradient, categoryMeta, categoryVars, type CategoryKey } from '@/lib/categories';
import { eventImages, initial, fmtLongDay, locationLine, naira, priceLabel, weekendRange, type PublicEvent } from '@/lib/publicEvents';
import { buildFeed, type Shelf } from '@/lib/shelves';
import type { CityCount, PublicOrganizerSummary } from '@/lib/server/publicEvents';

type When = 'any' | 'tonight' | 'weekend' | 'month';
type Price = 'under10k' | 'free';

const WHEN_CHIPS: { id: When; label: string }[] = [
  { id: 'any', label: 'Anytime' },
  { id: 'tonight', label: 'Tonight' },
  { id: 'weekend', label: 'This weekend' },
  { id: 'month', label: 'This month' },
];
const PRICE_CHIPS: { id: Price; label: string }[] = [
  { id: 'under10k', label: 'Under ₦10,000' },
  { id: 'free', label: 'Free' },
];
/** Category filter values: stored category names, plus 'online' for the event mode. */
const ONLINE = 'online';

interface Props {
  events: PublicEvent[];
  today: string;
  cities: CityCount[];
  organizers: PublicOrganizerSummary[];
}

function list(v: string | null) {
  return v ? v.split(',').filter(Boolean) : [];
}

export function EventsBrowser({ events, today, cities, organizers }: Props) {
  const params = useSearchParams();
  const [query, setQuery] = useState(() => params.get('q') ?? '');
  const [when, setWhen] = useState<When>(() => (WHEN_CHIPS.some(c => c.id === params.get('when')) ? params.get('when') as When : 'any'));
  const [cats, setCats] = useState<string[]>(() => list(params.get('cat')));
  const [prices, setPrices] = useState<Price[]>(() => list(params.get('price')).filter((p): p is Price => p === 'under10k' || p === 'free'));
  const [city, setCity] = useState<string>(() => {
    const c = params.get('city');
    return c && cities.some(x => x.city.toLowerCase() === c.toLowerCase()) ? cities.find(x => x.city.toLowerCase() === c.toLowerCase())!.city : '';
  });
  const [cityOpen, setCityOpen] = useState(false);
  const cityRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Keep the URL shareable without a navigation (no server round trip).
  useEffect(() => {
    const sp = new URLSearchParams();
    if (query.trim()) sp.set('q', query.trim());
    if (when !== 'any') sp.set('when', when);
    if (cats.length) sp.set('cat', cats.join(','));
    if (prices.length) sp.set('price', prices.join(','));
    if (city) sp.set('city', city);
    const qs = sp.toString();
    window.history.replaceState(null, '', qs ? `/events?${qs}` : '/events');
  }, [query, when, cats, prices, city]);

  useEffect(() => {
    if (!cityOpen) return;
    const close = (e: MouseEvent) => { if (cityRef.current && !cityRef.current.contains(e.target as Node)) setCityOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setCityOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [cityOpen]);

  const inCity = useMemo(() => events.filter(e => !city || e.city === city), [events, city]);
  const upcoming = useMemo(() => inCity.filter(e => e.status === 'approved'), [inCity]);
  const past = useMemo(() => inCity.filter(e => e.status === 'completed'), [inCity]);

  // Chips only for categories that actually have events — a chip that can
  // only ever return nothing is noise.
  const catChips = useMemo(() => {
    const present = new Set(events.filter(e => e.eventMode !== 'online').map(e => e.category));
    const chips: { value: string; label: string; key: CategoryKey }[] = CATEGORY_ORDER
      .filter(c => present.has(c))
      .map(c => ({ value: c, label: categoryMeta(c).plural, key: categoryMeta(c).key }));
    if (events.some(e => e.eventMode === 'online')) chips.push({ value: ONLINE, label: 'Online', key: 'online' });
    return chips;
  }, [events]);

  const q = query.trim().toLowerCase();
  const filtering = !!q || when !== 'any' || cats.length > 0 || prices.length > 0;

  const matches = (e: PublicEvent) => {
    if (q) {
      const hay = [e.name, e.venue, e.city, e.landmark, e.organizer.name].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (cats.length) {
      const hit = cats.some(c => (c === ONLINE ? e.eventMode === 'online' : e.category === c && e.eventMode !== 'online'));
      if (!hit) return false;
    }
    if (prices.length) {
      const hit = prices.some(p => (p === 'free' ? e.minPrice === 0 : e.minPrice != null && e.minPrice > 0 && e.minPrice < 10_000));
      if (!hit) return false;
    }
    if (when !== 'any') {
      if (e.status !== 'approved') return false;
      if (when === 'tonight' && e.date !== today) return false;
      if (when === 'weekend') {
        const [from, to] = weekendRange(today);
        if (e.date < from || e.date > to) return false;
      }
      if (when === 'month' && e.date.slice(0, 7) !== today.slice(0, 7)) return false;
    }
    return true;
  };

  const results = useMemo(() => {
    if (!filtering) return null;
    const hits = inCity.filter(matches);
    return {
      upcoming: hits.filter(e => e.status === 'approved').sort((a, b) => a.date.localeCompare(b.date)),
      past: hits.filter(e => e.status === 'completed').sort((a, b) => b.date.localeCompare(a.date)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inCity, filtering, q, when, cats, prices, today]);

  const matchingOrganizers = useMemo(
    () => (q ? organizers.filter(o => o.name.toLowerCase().includes(q)).slice(0, 6) : []),
    [organizers, q],
  );

  const feed = useMemo(() => buildFeed({ upcoming, past, today }), [upcoming, past, today]);

  const toggleCat = (v: string) => setCats(cs => (cs.includes(v) ? cs.filter(c => c !== v) : [...cs, v]));
  const togglePrice = (v: Price) => setPrices(ps => (ps.includes(v) ? ps.filter(p => p !== v) : [...ps, v]));
  const clearAll = () => { setQuery(''); setWhen('any'); setCats([]); setPrices([]); };
  const pickCategory = (v: string) => {
    setCats([v]);
    setWhen('any');
    setPrices([]);
    requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const where = city || 'Nigeria';
  const headline = upcoming.length === 0
    ? `Nothing on sale${city ? ` in ${city}` : ''} right now. Here’s what just happened.`
    : `${upcoming.length} ${upcoming.length === 1 ? 'event' : 'events'} on sale${city ? ` in ${city}` : ''} right now.`;

  // Category tiles: real counts, upcoming first.
  const tiles = useMemo(() => {
    const out: { value: string; label: string; key: CategoryKey; onSale: number; total: number }[] = [];
    for (const c of CATEGORY_ORDER) {
      const all = inCity.filter(e => e.category === c && e.eventMode !== 'online');
      if (!all.length) continue;
      out.push({ value: c, label: categoryMeta(c).plural, key: categoryMeta(c).key, onSale: all.filter(e => e.status === 'approved').length, total: all.length });
    }
    const online = inCity.filter(e => e.eventMode === 'online');
    if (online.length) out.push({ value: ONLINE, label: ONLINE_META.plural, key: 'online', onSale: online.filter(e => e.status === 'approved').length, total: online.length });
    return out.sort((a, b) => b.onSale - a.onSale || b.total - a.total);
  }, [inCity]);

  const tileSection = tiles.length > 1 && (
    <section className="v-shelf">
      <div className="v-wrap">
        <div className="v-shelf-head"><div><h2>Browse by category</h2></div></div>
        <div className="v-cats">
          {tiles.map(t => (
            <button key={t.value} type="button" className="v-ctile" style={categoryVars(t.key)} onClick={() => pickCategory(t.value)}>
              <div className="inner">
                <b>{t.label}</b>
                <i>{t.onSale > 0 ? `${t.onSale} on sale` : `${t.total} past ${t.total === 1 ? 'event' : 'events'}`}</i>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );

  const followSection = organizers.length > 0 && (
    <section className="v-shelf">
      <div className="v-wrap">
        <div className="v-shelf-head">
          <div><h2>Follow an organiser</h2><p>Verified before their first ticket sells. Follow one to hear about their next event first.</p></div>
        </div>
        <OrganiserMarquee organisers={organizers} />
      </div>
    </section>
  );

  const invitation = (title: string) => (
    <div className="v-note" style={{ marginTop: 18 }}>
      <b>{title}</b>
      {city && cities.length > 1
        ? <>Try <button type="button" onClick={() => setCity('')} style={{ background: 'none', border: 0, padding: 0, color: 'var(--purple-lt)', cursor: 'pointer', font: 'inherit', borderBottom: '1px solid currentColor' }}>all cities</button>, or follow an organiser and hear about their next one first.</>
        : <>Follow an organiser and you&apos;ll hear about their next event first.</>}
    </div>
  );

  const shelfRail = (s: Shelf) => (
    <section key={s.id} className="v-shelf">
      <div className="v-wrap v-shelf-head">
        <div><h2>{s.heading}</h2>{s.sub && <p>{s.sub}</p>}</div>
      </div>
      <DragRail label={s.heading}>
        {s.events.map(e => <EventCardV2 key={e.id} event={e} cta="Tickets" sizes="(max-width: 760px) 206px, 244px" />)}
      </DragRail>
    </section>
  );

  return (
    <>
      {/* ── Page header ── */}
      <header className="v-phead">
        <div className="v-wrap v-phead-in">
          <div>
            <h1>What&apos;s on</h1>
            <p>{headline}</p>
          </div>
          {cities.length > 0 && (
            <div className="v-city-pick" ref={cityRef}>
              <button type="button" className="v-city-btn" onClick={() => setCityOpen(o => !o)} aria-expanded={cityOpen} aria-haspopup="listbox">
                <MapPin size={15} color="var(--purple-lt)" />
                <span>Showing events in <b>{city || 'all cities'}</b></span>
                <ChevronDown size={13} />
              </button>
              {cityOpen && (
                <div className="v-menu" role="listbox" aria-label="City">
                  <button type="button" role="option" aria-selected={!city} className={!city ? 'on' : undefined} onClick={() => { setCity(''); setCityOpen(false); }}>
                    All cities<small>{events.filter(e => e.status === 'approved').length} on sale</small>
                  </button>
                  {cities.map(c => (
                    <button key={c.city} type="button" role="option" aria-selected={city === c.city} className={city === c.city ? 'on' : undefined} onClick={() => { setCity(c.city); setCityOpen(false); }}>
                      {c.city}<small>{c.upcoming > 0 ? `${c.upcoming} on sale` : `${c.count} past`}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Sticky search + filters ── */}
      <div className="v-filters">
        <div className="v-wrap">
          <label className="v-srch">
            <Search size={17} color="var(--dim)" aria-hidden="true" />
            <span className="v-sr">Search events</span>
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search events, organisers or venues"
              enterKeyHint="search"
            />
            {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><X size={16} /></button>}
          </label>
          <div className="v-chiprow" role="toolbar" aria-label="Filters">
            {WHEN_CHIPS.map(c => (
              <button key={c.id} type="button" className={`v-chip${when === c.id ? ' on' : ''}`} aria-pressed={when === c.id} onClick={() => setWhen(c.id)}>
                {c.label}
              </button>
            ))}
            {catChips.length > 0 && <div className="v-divider" />}
            {catChips.map(c => (
              <button key={c.value} type="button" className={`v-chip${cats.includes(c.value) ? ' on' : ''}`} style={categoryVars(c.key)} aria-pressed={cats.includes(c.value)} onClick={() => toggleCat(c.value)}>
                {c.label}
              </button>
            ))}
            <div className="v-divider" />
            {PRICE_CHIPS.map(c => (
              <button key={c.id} type="button" className={`v-chip${prices.includes(c.id) ? ' on' : ''}`} aria-pressed={prices.includes(c.id)} onClick={() => togglePrice(c.id)}>
                {c.label}
              </button>
            ))}
            {filtering && <button type="button" className="v-chip v-chip-clear" onClick={clearAll}>Clear all</button>}
          </div>
        </div>
      </div>

      <div ref={resultsRef} style={{ scrollMarginTop: 180 }} />

      {results ? (
        /* ── Filtered results ── */
        <>
          {matchingOrganizers.length > 0 && (
            <section className="v-shelf" style={{ paddingTop: 28 }}>
              <div className="v-wrap">
                <div className="v-shelf-head"><div><h2>Organisers</h2></div></div>
                <div className="v-orgs">
                  {matchingOrganizers.map(o => (
                    <Link key={o.id} href={`/${o.handle}`} className="v-orgchip">
                      <OrgAvatar name={o.name} avatarUrl={o.avatarUrl} />
                      <span><b>{o.name}{o.verified ? ' ✓' : ''}</b><small>{[o.city, `${o.events} ${o.events === 1 ? 'event' : 'events'}`].filter(Boolean).join(' · ')}</small></span>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
          <section className="v-shelf" style={{ paddingTop: 28 }}>
            <div className="v-wrap">
              <div className="v-shelf-head">
                <div>
                  <h2>{results.upcoming.length ? 'On sale' : 'Nothing on sale matches'}</h2>
                  <p className="v-results-count"><b>{results.upcoming.length}</b> {results.upcoming.length === 1 ? 'event' : 'events'}{city ? ` in ${city}` : ''}, soonest first.</p>
                </div>
                <button type="button" className="v-seeall" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', cursor: 'pointer', font: 'inherit', fontSize: 13 }} onClick={clearAll}>Clear filters</button>
              </div>
              {results.upcoming.length > 0
                ? <div className="v-grid">{results.upcoming.map(e => <EventCardV2 key={e.id} event={e} cta="Tickets" sizes="(max-width: 760px) 50vw, (max-width: 980px) 33vw, 270px" />)}</div>
                : invitation(city ? `Nothing like that in ${city} right now` : 'Nothing like that on sale right now')}
            </div>
          </section>
          {results.past.length > 0 && (
            <section className="v-shelf">
              <div className="v-wrap">
                <div className="v-shelf-head"><div><h2>Already happened</h2><p>Past events that match, most recent first.</p></div></div>
                <div className="v-grid">{results.past.map(e => <EventCardV2 key={e.id} event={e} sizes="(max-width: 760px) 50vw, (max-width: 980px) 33vw, 270px" />)}</div>
              </div>
            </section>
          )}
        </>
      ) : (
        /* ── Discovery feed ── */
        <>
          {feed.featured && <Featured event={feed.featured} />}

          {feed.mode === 'full' && feed.shelves.map(shelfRail)}

          {feed.mode === 'thin' && (
            <section className="v-shelf">
              <div className="v-wrap">
                {(feed.grid.length > 0 || !feed.featured) && (
                  <div className="v-shelf-head">
                    <div>
                      <h2>{feed.featured ? 'Also on sale' : `All events${city ? ` in ${city}` : ''}`}</h2>
                      <p>Sorted by date, soonest first.</p>
                    </div>
                  </div>
                )}
                {feed.grid.length > 0
                  ? <div className="v-grid">{feed.grid.map(e => <EventCardV2 key={e.id} event={e} cta="Tickets" sizes="(max-width: 760px) 50vw, (max-width: 980px) 33vw, 270px" />)}</div>
                  : invitation(feed.featured ? `That’s everything on sale in ${where} right now` : `Nothing on sale in ${where} right now`)}
              </div>
            </section>
          )}

          {feed.recent && shelfRail(feed.recent)}

          {feed.mode === 'full' && !feed.recent && tileSection}

          {feed.mode === 'full' && (
            <section className="v-shelf">
              <div className="v-wrap">
                <div className="v-shelf-head"><div><h2>All events{city ? ` in ${city}` : ''}</h2><p>Sorted by date, soonest first.</p></div></div>
                {feed.grid.length > 0
                  ? <div className="v-grid">{feed.grid.map(e => <EventCardV2 key={e.id} event={e} cta="Tickets" sizes="(max-width: 760px) 50vw, (max-width: 980px) 33vw, 270px" />)}</div>
                  : invitation(`Nothing else in ${where} right now`)}
              </div>
            </section>
          )}

          {followSection}

          {(feed.mode === 'thin' || feed.recent) && tileSection}
        </>
      )}
    </>
  );
}

function Featured({ event: e }: { event: PublicEvent }) {
  const price = priceLabel(e);
  const href = `/${e.slug}`;
  const images = eventImages(e);
  const meta = categoryMeta(e.category);
  return (
    <section className="v-shelf">
      <div className="v-wrap">
        <article className="v-feat">
          <Link href={href} className="v-ev-link" aria-label={e.name} />
          <div className="v-feat-img" style={{ background: categoryGradient(e.eventMode === 'online' ? 'online' : meta.key) }}>
            <span className="v-ev-ph" aria-hidden="true">{initial(e.name)}</span>
            <EventImage sources={images} sizes="(max-width: 760px) 100vw, 300px" priority />
          </div>
          <div className="v-feat-body">
            <span className="v-feat-lab">{e.soldOut ? 'Sold out' : 'On sale now'}</span>
            <h3>{e.name}</h3>
            <p className="v-feat-meta">{fmtLongDay(e.date)}{e.time ? ` · ${e.time}` : ''}</p>
            <p className="v-feat-meta">
              {locationLine(e)}
              {e.locationHidden && e.eventMode !== 'online' ? ' · exact address shared with ticket holders' : ''}
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}><CategoryPill event={e} /></div>
            {e.organizer.name && (
              <div className="v-org-mini">
                <OrgAvatar name={e.organizer.name} avatarUrl={e.organizer.avatarUrl} />
                {e.organizer.handle
                  ? <Link href={`/${e.organizer.handle}`}>{e.organizer.name}{e.organizer.verified ? ' · Verified organiser' : ''}</Link>
                  : <span>{e.organizer.name}{e.organizer.verified ? ' · Verified organiser' : ''}</span>}
              </div>
            )}
            <div className="v-feat-cta">
              {price && (
                <div className="v-feat-price" style={price.free ? { color: 'var(--green-lt)' } : undefined}>
                  {e.cheapestOnSale ? (e.cheapestOnSale.price === 0 ? 'Free' : naira(e.cheapestOnSale.price)) : price.value}
                  {e.cheapestOnSale && (
                    <i>{e.cheapestOnSale.name}{e.urgency && e.cheapestOnSale.remaining <= 50 ? `, ${e.cheapestOnSale.remaining} left` : ''}</i>
                  )}
                </div>
              )}
              <Link className="v-btn v-btn-solid v-btn-lg" href={href}>{e.soldOut ? 'View event' : 'Get tickets'}</Link>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
