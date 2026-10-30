'use client';

import '@/app/v2.css';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MapPin, Share2, ShieldCheck, QrCode, Clock3, Info, Video } from 'lucide-react';
import { formatNGN } from '@/lib/utils';
import { buyerTotalForItems } from '@/lib/fees';
import { ticketUrgency, URGENCY_LABEL } from '@/lib/ticketUrgency';
import type { Event, TicketTier } from '@/types';
import { EventReviews } from '@/components/events/EventReviews';
import { SocialLinks } from '@/components/organizer/SocialLinks';
import { FollowButton } from '@/components/organizer/FollowButton';
import { useToast } from '@/components/ui/Toast';
import { useBuyerAuth } from '@/lib/hooks/useBuyerAuth';
import { useTheme } from '@/components/layout/ThemeProvider';
import { getContrastText, accentForBackground } from '@/lib/accentColors';
import { categoryMeta } from '@/lib/categories';
import { fmtDayYear, normalizeCity, initial } from '@/lib/publicEvents';
import { describeRefundPolicy, MINIMUM_STANDARDS } from '@/lib/refundPolicy';

// The two fixed v2 page backgrounds (app/v2.css --bg) — not user input, so
// safe to hardcode for the contrast walk.
const BG_DARK  = '#09070F';
const BG_LIGHT = '#F8F7FF';
const VENTRY_PURPLE = '#7c3aed';

// Free tickets are capped at 2 per order to curb bulk claiming — paid tiers
// keep the normal 10-per-tier cap.
const FREE_TIER_ORDER_CAP = 2;
const PAID_TIER_ORDER_CAP = 10;

export type DetailEvent = Event & { organizer: Event['organizer'] & { avatar_url?: string | null; cover_image_url?: string | null } };

/** Organiser preview: render a not-yet-saved event exactly as buyers will see it. */
export interface EventPreviewOptions {
  event: DetailEvent;
  theme: 'light' | 'dark';
  onClose: () => void;
  /** The scrolling element of the preview overlay (the page itself doesn't scroll). */
  scrollRoot: HTMLElement | null;
}

interface EventDetailContentProps {
  /** The event's slug (or, for the legacy /events/[id] shim, its UUID) — whatever was fetched to resolve this page. */
  identifier?: string;
  /** Preview mode: no fetch, no tracking, no checkout. */
  preview?: EventPreviewOptions;
}

export function EventDetailContent({ identifier, preview }: EventDetailContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { loggedIn: buyerLoggedIn } = useBuyerAuth();
  const { theme: siteTheme } = useTheme();
  const theme = preview?.theme ?? siteTheme;
  const [fetchedEvent, setEvent] = useState<DetailEvent | null>(null);
  const event = preview?.event ?? fetchedEvent;
  const [loading, setLoading] = useState(!preview);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [orgReputation, setOrgReputation] = useState<{ avg: number | null; count: number } | null>(null);
  const [solidBar, setSolidBar] = useState(false);
  const refTracked = useRef(false);
  const tiersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!identifier || preview) return;
    fetch(`/api/events/${identifier}`)
      .then(r => r.json())
      .then(d => {
        if (!d.success) return;
        const ev = d.data as DetailEvent;
        setEvent(ev);
        // Preselect the cheapest tier still on sale, one ticket.
        const firstOnSale = [...ev.tiers].sort((a, b) => a.price - b.price).find(t => t.available - t.sold > 0);
        setSelectedId(firstOnSale?.id ?? null);
        setQty(1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifier]);

  // Affiliate link tracking: capture ?ref=, credit one click, and remember it
  // so it can be attached to the order if this buyer checks out.
  useEffect(() => {
    if (!event || preview) return;
    const ref = searchParams.get('ref');
    if (!ref || refTracked.current) return;
    refTracked.current = true;
    sessionStorage.setItem(`ventry_ref_${event.id}`, ref);
    fetch('/api/affiliates/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: ref }),
    }).catch(() => {});
  }, [event, searchParams, preview]);

  // Top bar turns solid once the banner has scrolled away (rAF-throttled).
  // In preview the overlay scrolls instead of the window.
  const scrollRoot = preview?.scrollRoot ?? null;
  useEffect(() => {
    let ticking = false;
    const target: HTMLElement | Window = scrollRoot ?? window;
    const update = () => {
      ticking = false;
      const y = scrollRoot ? scrollRoot.scrollTop : window.scrollY;
      const threshold = Math.max(120, window.innerHeight * (window.innerWidth <= 900 ? 0.4 : 0.52) - 80);
      setSolidBar(y > threshold);
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    target.addEventListener('scroll', onScroll, { passive: true });
    requestAnimationFrame(update);
    return () => target.removeEventListener('scroll', onScroll);
  }, [scrollRoot]);

  const maxQtyForTier = (tier: TicketTier) =>
    Math.max(0, Math.min(tier.price === 0 ? FREE_TIER_ORDER_CAP : PAID_TIER_ORDER_CAP, tier.available - tier.sold));

  // In preview the event arrives as a prop, so fall back to the cheapest tier on sale.
  const defaultTierId = event ? [...event.tiers].sort((a, b) => a.price - b.price).find(t => t.available - t.sold > 0)?.id ?? null : null;
  const selectedTier = event?.tiers.find(t => t.id === (selectedId ?? (preview ? defaultTierId : null))) ?? null;
  const maxQty = selectedTier ? maxQtyForTier(selectedTier) : 0;
  const quantity = selectedTier ? Math.min(qty, maxQty) : 0;
  const hasSelection = !!selectedTier && quantity > 0;
  // The exact helper checkout charges with — the total shown is the total debited.
  const totals = buyerTotalForItems(hasSelection ? [{ price: selectedTier!.price, quantity }] : []);
  const allFree = hasSelection && selectedTier!.price === 0;

  const selectTier = (tier: TicketTier) => {
    if (tier.available - tier.sold <= 0) return;
    setSelectedId(tier.id);
    setQty(q => Math.max(1, Math.min(q, maxQtyForTier(tier))));
  };

  const handlePurchase = () => {
    if (preview) { toast('This is a preview. Checkout opens once your event is live.', 'success'); return; }
    if (!event || !hasSelection || event.status === 'completed') return;
    const ref = sessionStorage.getItem(`ventry_ref_${event.id}`) || undefined;
    sessionStorage.setItem('ventry_cart', JSON.stringify({
      eventId:   event.id,
      eventName: event.name,
      eventDate: event.date,
      items: [{
        tierId:    selectedTier!.id,
        tierName:  selectedTier!.name,
        tierPrice: selectedTier!.price,
        quantity,
      }],
      ref,
      allowedEmailDomains: event.allowedEmailDomains ?? null,
      // Shown again at checkout so the buyer sees it right before paying.
      refundPolicy: event.refundPolicy ?? null,
      organizerName: event.organizer?.name?.trim() || null,
      eventSlug: event.slug || null,
    }));
    router.push('/checkout');
  };

  const handleShare = async () => {
    if (!event || preview) return;
    const url = `${window.location.origin}/${event.slug || event.id}`;
    const shareData = { title: event.name, text: `Check out ${event.name} on Ventry`, url };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Event link copied', 'success');
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') toast('Could not share event link', 'error');
    }
  };

  const goBack = () => {
    if (preview) { preview.onClose(); return; }
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) router.back();
    else router.push('/events');
  };

  // Contrast safety is never left to the raw pick: the accent used for
  // icons/borders/text is walked toward the active theme's background until
  // it clears a safe floor, and the button label colour is chosen from the
  // accent's own luminance rather than assumed white — a deliberately awful
  // colour stays legible in both themes.
  const safeAccent = accentForBackground(event?.accentColor || VENTRY_PURPLE, theme === 'light' ? BG_LIGHT : BG_DARK);
  const accentVars = {
    '--accent': safeAccent,
    '--accent-soft': `color-mix(in srgb, ${safeAccent} 14%, transparent)`,
    '--accent-line': `color-mix(in srgb, ${safeAccent} 42%, transparent)`,
    '--accent-fg': getContrastText(safeAccent),
  } as React.CSSProperties;

  const topbar = (
    <div className={`v-ed-topbar${solidBar ? ' solid' : ''}`}>
      <div className="v-ed-topbar-l">
        <button type="button" className="v-icbtn" onClick={goBack} aria-label="Back"><ChevronLeft size={18} /></button>
        <Link href="/" className="v-logo" aria-label="Ventry home"><span>V</span>ENTRY</Link>
      </div>
      {event && <div className="v-ed-mini-t" aria-hidden="true">{event.name}</div>}
      <div className="v-ed-topbar-r">
        {event && !preview && <button type="button" className="v-icbtn" onClick={handleShare} aria-label="Share event"><Share2 size={16} /></button>}
      </div>
    </div>
  );

  if (loading || !event) {
    return (
      <div className="v2 v-ed" style={accentVars} data-theme={preview?.theme}>
        {topbar}
        {loading ? (
          <>
            <div className="v-skel" style={{ height: '46vh', borderRadius: 0 }} />
            <div className="v-wrap" style={{ paddingTop: 28 }}>
              <div className="v-skel" style={{ height: 28, width: '40%', marginBottom: 14 }} />
              <div className="v-skel" style={{ height: 44, width: '70%', marginBottom: 30 }} />
              <div className="v-skel" style={{ height: 160 }} />
            </div>
          </>
        ) : (
          <div className="v-ed-loading">
            <div className="v-note" style={{ maxWidth: 420 }}>
              <b>We couldn&apos;t find this event</b>
              It may have been unpublished. <Link href="/events">See what&apos;s on</Link>.
            </div>
          </div>
        )}
      </div>
    );
  }

  const isCompleted = event.status === 'completed';
  const isOnline = event.event_mode === 'online';
  const locationHidden = !!event.location_hidden;
  const city = normalizeCity(event.city);
  const sortedTiers = [...event.tiers].sort((a, b) => a.price - b.price);
  const wasSoldOut = event.tiers.length > 0 && event.tiers.every(t => t.available - t.sold <= 0);
  const org = event.organizer;
  const orgName = org?.name?.trim() || 'The organiser';
  const cat = categoryMeta(event.category);
  const hostedCount = org?.eventsHosted ?? org?.events_hosted ?? 0;
  const memberYear = org?.memberSince || org?.member_since ? new Date(org.memberSince || org.member_since || '').getFullYear() : null;
  const banner = event.headerBannerUrl || null;
  // No flyer? Fall back to any other picture the organiser has given us.
  const flyer = event.banner_url || event.organizer?.cover_image_url || null;
  const minOnSale = sortedTiers.find(t => t.available - t.sold > 0);

  const mapQuery = !isOnline
    ? locationHidden
      ? null
      : [event.venue, event.address, event.city].filter(Boolean).join(', ')
    : null;

  const orgAvatar = (cls: string, style?: React.CSSProperties) => (
    <span className={cls} style={style} aria-hidden="true">
      {org?.avatar_url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={org.avatar_url} alt="" />
        : initial(orgName)}
    </span>
  );

  const ticketPanel = (
    <div className="v-tiers" ref={tiersRef} id="tickets">
      <h3>{isCompleted ? 'Tickets' : 'Choose your ticket'}</h3>

      {isCompleted && (
        <div className="v-closed">
          <b>{wasSoldOut ? 'This event has ended. It sold out.' : 'This event has ended'}</b>
          Ticket sales are closed.
        </div>
      )}

      {!isCompleted && event.allowedEmailDomains && event.allowedEmailDomains.length > 0 && (
        <p className="v-hint">
          Restricted to buyers with a{' '}
          {event.allowedEmailDomains.map((d, i, arr) => (
            <span key={d}><b>@{d}</b>{i < arr.length - 1 ? (i === arr.length - 2 ? ' or ' : ', ') : ''}</span>
          ))}{' '}
          email address.
        </p>
      )}

      <div role={isCompleted ? undefined : 'radiogroup'} aria-label="Ticket type">
        {sortedTiers.map(tier => {
          const remaining = tier.available - tier.sold;
          const out = remaining <= 0;
          const on = !isCompleted && tier.id === selectedTier?.id;
          const urgency = ticketUrgency(tier.available, tier.sold);
          return (
            <button
              key={tier.id}
              type="button"
              role={isCompleted ? undefined : 'radio'}
              aria-checked={isCompleted ? undefined : on}
              className={`v-tier${on ? ' on' : ''}${out || isCompleted ? ' out' : ''}`}
              disabled={out || isCompleted}
              onClick={() => selectTier(tier)}
              style={isCompleted && !out ? { opacity: .7 } : undefined}
            >
              <div className="v-tier-top">
                <span className="v-tier-n">{tier.name}</span>
                <span className={`v-tier-p${tier.price === 0 ? ' free' : ''}`}>{tier.price === 0 ? 'Free' : formatNGN(tier.price)}</span>
              </div>
              <div className="v-tier-s">
                {out ? URGENCY_LABEL.sold_out
                  : isCompleted ? 'Sales closed'
                  : urgency ? <><span className="urg">{URGENCY_LABEL[urgency]}</span><span>{remaining} left</span></>
                  : tier.price === 0 ? `Max ${FREE_TIER_ORDER_CAP} per order`
                  : 'On sale'}
              </div>
            </button>
          );
        })}
      </div>

      {!isCompleted && (
        <>
          <div className="v-qty">
            <span>How many{selectedTier ? ` × ${selectedTier.name}` : ''}?</span>
            <div className="v-qty-ctrl">
              <button type="button" className="v-qbtn" onClick={() => setQty(q => Math.max(1, Math.min(q, maxQty) - 1))} disabled={!selectedTier || quantity <= 1} aria-label="One fewer">−</button>
              <span className="v-qnum" aria-live="polite">{quantity}</span>
              <button type="button" className="v-qbtn" onClick={() => setQty(q => Math.min(maxQty, q + 1))} disabled={!selectedTier || quantity >= maxQty} aria-label="One more">+</button>
            </div>
          </div>

          {hasSelection && (allFree ? (
            <div className="v-sum tot"><span>Total</span><span style={{ color: 'var(--green-lt)' }}>Free</span></div>
          ) : (
            <>
              <div className="v-sum"><span>{quantity} × {selectedTier!.name}</span><span>{formatNGN(totals.subtotal)}</span></div>
              <div className="v-sum"><span>Service fee</span><span>{formatNGN(totals.serviceFee)}</span></div>
              <div className="v-sum"><span>Processing fee</span><span>{formatNGN(totals.processingFee)}</span></div>
              <div className="v-sum tot"><span>Total</span><span>{formatNGN(totals.total)}</span></div>
            </>
          ))}

          <button type="button" className="v-btn v-btn-accent v-btn-block" style={{ marginTop: 14 }} disabled={!hasSelection} onClick={handlePurchase}>
            {!minOnSale ? 'Sold out' : allFree ? 'Get free tickets' : 'Get tickets'}
          </button>
          <p className="v-nb">
            {allFree ? '' : 'The total above is exactly what leaves your account. Service and processing fees are not refundable. '}
            Ventry provides the platform; {orgName} runs the event and handles refunds.
          </p>
          {preview && <p className="v-preview-note">Preview: checkout is switched off until your event is live.</p>}
        </>
      )}
    </div>
  );

  return (
    <div className="v2 v-ed" style={accentVars} data-theme={preview?.theme}>
      {topbar}

      {banner ? (
        <>
          <div className="v-masthead">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner} alt="" fetchPriority="high" />
          </div>
          <div className="v-ed-spacer" />
        </>
      ) : (
        <div className="v-ed-hero">
          {flyer && <div className="v-ed-hero-bg" style={{ backgroundImage: `url("${flyer}")` }} aria-hidden="true" />}
          {flyer
            // eslint-disable-next-line @next/next/no-img-element
            ? <img className="v-ed-hero-img" src={flyer} alt={`${event.name} flyer`} fetchPriority="high" />
            : <div className="v-ed-hero-ph" style={{ background: `linear-gradient(150deg, var(--cat-${cat.key}-solid), var(--cat-${cat.key}-deep))` }}>{initial(event.name)}</div>}
        </div>
      )}

      <main className={`v-sheet${banner ? '' : ' overlap'}`}>
        <div className="v-wrap">
          <div className="v-titleblk">
            <div className="v-badges">
              {cat.key !== 'other' && <span className="v-apill">{cat.label}</span>}
              {isOnline && <span className="v-apill">Online</span>}
              {event.verified && <span className="v-vbadge">✓ Ventry Verified</span>}
              {isCompleted && <span className="v-gbadge">Ended</span>}
              {isCompleted && wasSoldOut && <span className="v-gbadge">Sold out</span>}
            </div>
            <h1>{event.name}</h1>
            <div className="v-byline">
              {orgAvatar('v-av')}
              <span>
                Hosted by{' '}
                {org?.handle ? <Link href={`/${org.handle}`}><b>{orgName}</b></Link> : <b>{orgName}</b>}
                {orgReputation?.avg != null && orgReputation.count > 0 && (
                  <> · {orgReputation.avg.toFixed(1)} <span className="star">★</span> from {orgReputation.count} {orgReputation.count === 1 ? 'review' : 'reviews'}</>
                )}
              </span>
            </div>
          </div>

          <div className="v-cols">
            {/* ── Left ── */}
            <div style={{ minWidth: 0 }}>
              <div className="v-card">
                <div className="v-when">
                  <div><div className="l">Date</div><div className="v">{fmtDayYear(event.date)}</div></div>
                  {event.time && <div><div className="l">Starts</div><div className="v">{event.time}</div><div className="s">Nigeria time (WAT)</div></div>}
                </div>
              </div>

              <div className="v-card">
                {isOnline ? (
                  <div className="v-loc">
                    <Video size={19} />
                    <div>
                      <b>Online event</b>
                      <span>The join link is emailed to ticket holders before it starts, along with their reminders.</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="v-loc">
                      <MapPin size={19} />
                      <div>
                        {locationHidden ? (
                          <>
                            <b>{event.landmark ? `Near ${event.landmark}` : [event.lga, city].filter(Boolean).join(', ')}</b>
                            {event.landmark && <span>{[event.lga, city].filter(Boolean).join(', ')}</span>}
                            <span>
                              Exact address {event.addressRevealAt
                                ? `revealed ${new Date(event.addressRevealAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' })} and emailed to ticket holders.`
                                : 'emailed to ticket holders no later than 24 hours before doors.'}
                            </span>
                          </>
                        ) : (
                          <>
                            <b>{event.venue}</b>
                            <span>{[event.address, event.lga, city].filter(Boolean).join(', ')}</span>
                            {event.landmark && <span>Landmark: {event.landmark}</span>}
                          </>
                        )}
                      </div>
                    </div>
                    {mapQuery ? (
                      <div className="v-map">
                        <iframe
                          title={`${event.name} location map`}
                          src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    ) : (
                      <div className="v-map abstract" role="img" aria-label={`Somewhere in ${city}; exact location hidden until you have a ticket`}>
                        <span className="v-map-note">{city} · revealed to ticket holders</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {event.lineup && event.lineup.length > 0 && (
                <div className="v-card">
                  <h3>On the night</h3>
                  <div className="v-lineup">
                    {event.lineup.map((act, i) => {
                      const surprise = act.liability === 'surprise';
                      const head = act.liability === 'headliner';
                      return (
                        <div key={i} className={`v-act${head ? ' head' : ''}`}>
                          <div className={`v-act-img${surprise ? ' v-mystery' : ''}`}>
                            {surprise ? '?' : act.photoUrl
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={act.photoUrl} alt="" loading="lazy" />
                              : initial(act.name || '?')}
                          </div>
                          <b>{surprise ? 'Surprise guest' : act.name}</b>
                          <i>{surprise ? 'Revealed on the night' : head ? (act.role ? `Headliner · ${act.role}` : 'Headliner') : (act.role || 'Guest')}</i>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {event.description && (
                <div className="v-card">
                  <h3>About this event</h3>
                  <div className="v-body-copy">{event.description}</div>
                </div>
              )}

              <div className="v-card">
                <h3>Your organiser</h3>
                <div className="v-orgcard">
                  {orgAvatar('v-orgav', { background: `linear-gradient(140deg, ${safeAccent}, #191033)` })}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div className="v-orgname">
                      {org?.handle ? <Link href={`/${org.handle}`}>{orgName}</Link> : orgName}
                      {org?.verified && <span style={{ color: 'var(--green-lt)', fontSize: 13 }} aria-label="Verified">✓</span>}
                    </div>
                    <div className="v-orgmeta">
                      {[
                        hostedCount > 0 ? `${hostedCount} ${hostedCount === 1 ? 'event' : 'events'} hosted` : 'New organiser',
                        memberYear ? `on Ventry since ${memberYear}` : null,
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {org?.handle && (buyerLoggedIn
                    ? <FollowButton handle={org.handle} />
                    : <Link className="v-btn v-btn-ghost" href={`/${org.handle}`}>View profile</Link>)}
                </div>
                {org?.socials && Object.values(org.socials).some(Boolean) && (
                  <div className="v-org-socials"><SocialLinks socials={org.socials} /></div>
                )}
              </div>

              <div className="v-card v-policy" id="refund-policy">
                {event.refundPolicy ? (
                  <>
                    <h3><Info size={16} />Refund policy for this event</h3>
                    <p>Published by {orgName} before tickets went on sale:</p>
                    <ul>
                      {describeRefundPolicy(event.refundPolicy, orgName).map(s => (
                        <li key={s.title}><b>{s.title}.</b> {s.text}</li>
                      ))}
                      <li><b>Always.</b> {MINIMUM_STANDARDS.slice(1).join(' ')}</li>
                    </ul>
                    <p style={{ marginTop: 10 }}>Refund questions: <a href={`mailto:${event.refundPolicy.contactEmail}`} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>{event.refundPolicy.contactEmail}</a></p>
                  </>
                ) : (
                  <>
                    <h3><Info size={16} />Refund terms for this event</h3>
                    <p>{orgName} is bound by Ventry&apos;s minimum refund standards:</p>
                    <ul>
                      {MINIMUM_STANDARDS.map(m => <li key={m}>{m}</li>)}
                    </ul>
                  </>
                )}
                <p className="fine">
                  Refunds are paid by the organiser, not Ventry. Ventry refunds automatically only where it still holds the money for a cancelled event.
                  The service fee and processing fee are not refundable, and changing your mind is not grounds for a refund.{' '}
                  <Link href="/terms/refunds">Full refund terms</Link>
                </p>
              </div>

              {!preview && <div className="v-sheet-block">
                <EventReviews
                  eventId={event.id}
                  eventDate={event.date}
                  canReview={isCompleted}
                  onOrgReputation={(avg, count) => setOrgReputation({ avg, count })}
                />
              </div>}
            </div>

            {/* ── Right: buy ── */}
            <aside className="v-buy" aria-label="Tickets">
              {ticketPanel}
              <div className="v-trust">
                {event.verified && (
                  <div><ShieldCheck size={15} color="#34D399" /><span>Venue booking confirmed by Ventry for this date.</span></div>
                )}
                {org?.verified && (
                  <div><ShieldCheck size={15} color="#34D399" /><span>Organiser identity checked by Ventry.</span></div>
                )}
                <div><QrCode size={15} color="var(--accent)" /><span>Your QR ticket arrives by email the moment you {allFree ? 'claim' : 'pay'}. It works once, at the door.</span></div>
                <div><Clock3 size={15} color="var(--muted)" /><span>Lost it? Get it back at <Link href="/retrieve">ventrybooking.com/retrieve</Link>.</span></div>
              </div>
            </aside>
          </div>
        </div>

        <footer className="v-ed-footer">
          <div className="v-wrap">
            <div className="v-flinks">
              <Link href="/events">More events</Link>
              <Link href="/terms/buyers">Buyer terms</Link>
              <Link href="/terms/refunds">Refunds</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/help">Support</Link>
              <Link href="/retrieve">Retrieve a ticket</Link>
            </div>
            <div className="v-fbot" style={{ borderTop: 0, paddingTop: 0 }}>
              <span>© {new Date().getFullYear()} Ventry Solutions · RC BN9586934</span>
              <span>Abuja, Nigeria</span>
            </div>
          </div>
        </footer>
      </main>

      {/* ── Mobile buy bar ── */}
      <div className="v-mbuy">
        {isCompleted ? (
          <>
            <div className="p">Sales closed<i>{wasSoldOut ? 'This event sold out' : 'This event has ended'}</i></div>
            <Link className="v-btn v-btn-ghost" href="/events">More events</Link>
          </>
        ) : (
          <>
            <button type="button" className="p" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0, cursor: 'pointer' }} onClick={() => tiersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              {hasSelection ? (allFree ? 'Free' : formatNGN(totals.total)) : minOnSale ? (minOnSale.price === 0 ? 'Free' : `From ${formatNGN(minOnSale.price)}`) : 'Sold out'}
              <i>{hasSelection ? `${quantity} × ${selectedTier!.name}${allFree ? '' : ', all fees in'} · change` : 'Choose a ticket'}</i>
            </button>
            <button type="button" className="v-btn v-btn-accent" disabled={!hasSelection} onClick={handlePurchase}>
              {allFree ? 'Get free tickets' : 'Get tickets'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
