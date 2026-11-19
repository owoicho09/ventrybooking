'use client';

import '@/app/v2.css';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, MapPin, Share2, ShieldCheck, QrCode, Clock3, Info, Video, Lock, Mail, Check } from 'lucide-react';
import { formatNGN } from '@/lib/utils';
import {
  buyerTotalForItems, listedTicketPrice, serviceFeePerTicket,
  SERVICE_FEE_RATE, SERVICE_FEE_FLAT, SERVICE_FEE_THRESHOLD,
  PROCESSING_FEE_RATE, PROCESSING_FEE_FLAT, PROCESSING_FEE_THRESHOLD, PROCESSING_FEE_CAP,
} from '@/lib/fees';
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
import { FlyerCarousel } from '@/components/events/FlyerCarousel';

// The two fixed v2 page backgrounds (app/v2.css --bg) — not user input, so
// safe to hardcode for the contrast walk.
const BG_DARK  = '#09070F';
const BG_LIGHT = '#F8F7FF';
const VENTRY_PURPLE = '#7c3aed';

/** Promo-code or tier-email-domain tier (054). */
const isGated = (t: TicketTier) => !!t.requiresCode || !!t.allowedEmailDomains?.length;

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
  // Quantity per tier: a buyer can mix tiers in one order (2 Regular + 1 VIP).
  const [qtys, setQtys] = useState<Record<string, number>>({});
  // The code-gated tier whose promo-code box is open.
  const [codeOpenId, setCodeOpenId] = useState<string | null>(null);
  const [feeOpenId, setFeeOpenId] = useState<string | null>(null);
  // The blurred hero backdrop follows the flyer currently on show.
  const [heroBg, setHeroBg] = useState<string | null>(null);
  // Gated tiers (054). unlocked: tierId -> the promo code that unlocked it.
  const [unlocked, setUnlocked] = useState<Record<string, string>>({});
  const [gateInfoId, setGateInfoId] = useState<string | null>(null);
  const [codeDraft, setCodeDraft] = useState('');
  const [codeErr, setCodeErr] = useState('');
  const [unlocking, setUnlocking] = useState(false);
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
        // Preselect the cheapest open tier still on sale, one ticket. Gated
        // tiers (promo code / email domain) are never preselected.
        const firstOnSale = [...ev.tiers].sort((a, b) => a.price - b.price).find(t => t.available - t.sold > 0 && !isGated(t));
        setQtys(firstOnSale ? { [firstOnSale.id]: 1 } : {});
        // Codes this buyer already unlocked in this tab survive a reload / back.
        try {
          const saved = JSON.parse(sessionStorage.getItem(`ventry_codes_${ev.id}`) || '{}');
          if (saved && typeof saved === 'object') setUnlocked(saved);
        } catch { /* storage unavailable */ }
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

  // In preview the event arrives as a prop, so start with the cheapest open tier.
  const defaultTierId = event ? [...event.tiers].sort((a, b) => a.price - b.price).find(t => t.available - t.sold > 0 && !isGated(t))?.id ?? null : null;
  const effectiveQtys: Record<string, number> = preview && Object.keys(qtys).length === 0 && defaultTierId ? { [defaultTierId]: 1 } : qtys;
  const locked = (t: TicketTier) => !!t.requiresCode && !unlocked[t.id];
  const qtyOf = (t: TicketTier) => (locked(t) ? 0 : effectiveQtys[t.id] ?? 0);

  // Free tickets are capped per ORDER (all free tiers together); paid tiers per tier.
  const freeInOrder = (event?.tiers ?? []).reduce((n, t) => n + (t.price === 0 ? qtyOf(t) : 0), 0);
  const maxQtyForTier = (tier: TicketTier) => {
    const left = Math.max(0, tier.available - tier.sold);
    if (tier.price > 0) return Math.min(PAID_TIER_ORDER_CAP, left);
    return Math.min(left, Math.max(0, FREE_TIER_ORDER_CAP - (freeInOrder - qtyOf(tier))));
  };

  const lines = [...(event?.tiers ?? [])]
    .sort((a, b) => a.price - b.price)
    .map(t => ({ tier: t, quantity: Math.min(qtyOf(t), Math.max(0, t.available - t.sold)) }))
    .filter(l => l.quantity > 0);
  const ticketCount = lines.reduce((n, l) => n + l.quantity, 0);
  const hasSelection = lines.length > 0;
  // A code tier the buyer opened but hasn't unlocked yet.
  const needsCode = !hasSelection && !!codeOpenId && !!event?.tiers.find(t => t.id === codeOpenId && locked(t));
  // The exact helper checkout charges with: the total shown is the total debited.
  const totals = buyerTotalForItems(lines.map(l => ({ price: l.tier.price, quantity: l.quantity })));
  // Per-event (060): advertise the exact tier prices and itemise the service
  // fee in the order summary instead of folding it into each price.
  const beforeFees = event?.priceBeforeFees === true;
  // Checkout paused (061): organiser asked to cancel, or the venue is overdue.
  const pausedMessage = event?.salesPausedMessage ?? null;
  const allFree = hasSelection && lines.every(l => l.tier.price === 0);
  const orderSummary = lines.length === 1 ? `${lines[0].quantity} \u00d7 ${lines[0].tier.name}` : `${ticketCount} tickets, ${lines.length} types`;

  const setTierQty = (tier: TicketTier, n: number) =>
    setQtys(q => {
      const next = { ...(preview && Object.keys(q).length === 0 && defaultTierId ? { [defaultTierId]: 1 } : q) };
      const v = Math.max(0, Math.min(n, maxQtyForTier(tier)));
      if (v > 0) next[tier.id] = v; else delete next[tier.id];
      return next;
    });

  // Tapping a tier adds one ticket (or opens the code box for a locked promo tier).
  const selectTier = (tier: TicketTier) => {
    if (tier.available - tier.sold <= 0) return;
    if (locked(tier)) {
      if (codeOpenId !== tier.id) { setCodeDraft(''); setCodeErr(''); }
      setCodeOpenId(id => (id === tier.id ? null : tier.id));
      return;
    }
    if (qtyOf(tier) === 0) setTierQty(tier, 1);
  };

  const unlockTier = async (tier: TicketTier) => {
    const code = codeDraft.replace(/\s+/g, '').toUpperCase();
    if (!code) { setCodeErr('Enter your code'); return; }
    if (preview) { toast('Preview: buyers type their code here to unlock this ticket.', 'success'); return; }
    if (!event) return;
    setUnlocking(true); setCodeErr('');
    try {
      const res = await fetch(`/api/events/${event.id}/tiers/${tier.id}/unlock`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setCodeErr(d.error || 'That code didn\u2019t work'); return; }
      const next = { ...unlocked, [tier.id]: d.data?.code || code };
      setUnlocked(next);
      try { sessionStorage.setItem(`ventry_codes_${event.id}`, JSON.stringify(next)); } catch { /* ignore */ }
      setCodeDraft('');
      setCodeOpenId(null);
      setQtys(q => ({ ...q, [tier.id]: Math.max(1, q[tier.id] ?? 0) }));
      toast(`Unlocked: ${tier.name}`, 'success');
    } catch {
      setCodeErr('Network error. Try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const handlePurchase = () => {
    if (preview) { toast('This is a preview. Checkout opens once your event is live.', 'success'); return; }
    if (pausedMessage) { toast(pausedMessage, 'error'); return; }
    if (!event || !hasSelection || event.status === 'completed') return;
    const ref = sessionStorage.getItem(`ventry_ref_${event.id}`) || undefined;
    sessionStorage.setItem('ventry_cart', JSON.stringify({
      eventId:   event.id,
      eventName: event.name,
      eventDate: event.date,
      items: lines.map(({ tier, quantity }) => ({
        tierId:    tier.id,
        tierName:  tier.name,
        tierPrice: tier.price,
        quantity,
        accessCode: unlocked[tier.id] || undefined,
        allowedEmailDomains: tier.allowedEmailDomains ?? null,
      })),
      ref,
      allowedEmailDomains: event.allowedEmailDomains ?? null,
      // Shown again at checkout so the buyer sees it right before paying.
      refundPolicy: event.refundPolicy ?? null,
      organizerName: event.organizer?.name?.trim() || null,
      eventSlug: event.slug || null,
      priceBeforeFees: beforeFees,
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
  // Up to 3 flyers (061); only events with more than one get the carousel.
  const flyers = (event.flyerUrls ?? []).filter(Boolean).slice(0, 3);
  const multiFlyer = flyers.length > 1;
  // Cheapest on-sale price to advertise: open tiers first, so a code-only tier doesn't set "From ₦X".
  const minOnSale = sortedTiers.find(t => t.available - t.sold > 0 && !isGated(t)) ?? sortedTiers.find(t => t.available - t.sold > 0);

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

      {!isCompleted && sortedTiers.length > 1 && <p className="v-hint">Pick as many ticket types as you like.</p>}
      <div role={isCompleted ? undefined : 'group'} aria-label="Ticket types">
        {sortedTiers.map(tier => {
          const remaining = tier.available - tier.sold;
          const out = remaining <= 0;
          const tierQty = qtyOf(tier);
          const on = !isCompleted && (tierQty > 0 || codeOpenId === tier.id);
          const urgency = ticketUrgency(tier.available, tier.sold);
          return (
            <div
              key={tier.id}
              className={`v-tier${on ? ' on' : ''}${out || isCompleted ? ' out' : ''}${isGated(tier) && !isCompleted ? ' gated' : ''}`}
              style={isCompleted && !out ? { opacity: .7 } : undefined}
            >
              <div
                className="v-tier-choice"
                role={isCompleted ? undefined : 'button'}
                aria-pressed={isCompleted ? undefined : tierQty > 0}
                aria-disabled={out || isCompleted || undefined}
                tabIndex={!out && !isCompleted ? 0 : -1}
                onClick={() => {
                  if (!out && !isCompleted) selectTier(tier);
                }}
                onKeyDown={e => {
                  if (out || isCompleted) return;
                  if (e.target === e.currentTarget && (e.key === ' ' || e.key === 'Enter')) {
                    e.preventDefault();
                    selectTier(tier);
                  }
                }}
              >
                <div className="v-tier-top">
                  <span className="v-tier-n">{tier.name}</span>
                  <span className="v-tier-pw">
                    <span className={`v-tier-p${tier.price === 0 ? ' free' : ''}`}>{tier.price === 0 ? 'Free' : formatNGN(listedTicketPrice(tier.price, beforeFees))}</span>
                    {beforeFees && tier.price > 0 && <span className="v-plus-fees">+ fees</span>}
                    {tier.price > 0 && (
                      <button
                        type="button"
                        className="v-fee-i"
                        aria-label={`See price breakdown for ${tier.name}`}
                        aria-expanded={feeOpenId === tier.id}
                        onClick={e => { e.stopPropagation(); setFeeOpenId(id => id === tier.id ? null : tier.id); }}
                        onKeyDown={e => e.stopPropagation()}
                      >
                        <Info size={14} aria-hidden="true" />
                      </button>
                    )}
                  </span>
                </div>
                <div className="v-tier-s">
                  {out ? URGENCY_LABEL.sold_out
                    : isCompleted ? 'Sales closed'
                    : urgency ? <><span className="urg">{URGENCY_LABEL[urgency]}</span><span>{remaining} left</span></>
                    : tier.price === 0 ? `Max ${FREE_TIER_ORDER_CAP} per order`
                    : 'On sale'}
                </div>
                {isGated(tier) && !isCompleted && (
                  <div className="v-gate-row">
                    {tier.requiresCode && (unlocked[tier.id]
                      ? <span className="v-gate ok"><Check size={11} aria-hidden="true" />Unlocked</span>
                      : <span className="v-gate"><Lock size={11} aria-hidden="true" />Promo code</span>)}
                    {!!tier.allowedEmailDomains?.length && (
                      <span className="v-gate"><Mail size={11} aria-hidden="true" />{tier.allowedEmailDomains.length === 1 ? `@${tier.allowedEmailDomains[0]} only` : 'Selected emails only'}</span>
                    )}
                    <button type="button" className="v-gate-i" aria-label={`Who can buy ${tier.name}?`} aria-expanded={gateInfoId === tier.id}
                      onClick={e => { e.stopPropagation(); setGateInfoId(id => id === tier.id ? null : tier.id); }}
                      onKeyDown={e => e.stopPropagation()}>
                      <Info size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              {isGated(tier) && !isCompleted && gateInfoId === tier.id && (
                <div className="v-gate-info">
                  {tier.requiresCode && <p>You need a <b>promo code</b> from {orgName} to buy this ticket. Enter it below to unlock it.</p>}
                  {!!tier.allowedEmailDomains?.length && (
                    <p style={{ marginTop: tier.requiresCode ? 6 : 0 }}>
                      Only for buyers with a {tier.allowedEmailDomains.map((d, i, arr) => <span key={d}><b>@{d}</b>{i < arr.length - 1 ? (i === arr.length - 2 ? ' or ' : ', ') : ''}</span>)} email address. You&apos;ll confirm your email at checkout.
                    </p>
                  )}
                </div>
              )}

              {!isCompleted && !out && !locked(tier) && (
                <div className="v-tier-qty">
                  <span>{tierQty > 0 ? `${tierQty} selected` : 'Add to order'}</span>
                  <div className="v-qty-ctrl">
                    <button type="button" className="v-qbtn" onClick={() => setTierQty(tier, tierQty - 1)} disabled={tierQty <= 0} aria-label={`One fewer ${tier.name}`}>−</button>
                    <span className="v-qnum" aria-live="polite">{tierQty}</span>
                    <button type="button" className="v-qbtn" onClick={() => setTierQty(tier, tierQty + 1)} disabled={tierQty >= maxQtyForTier(tier)} aria-label={`One more ${tier.name}`}>+</button>
                  </div>
                </div>
              )}

              {codeOpenId === tier.id && !out && locked(tier) && (
                <div onClick={e => e.stopPropagation()}>
                  <form className="v-code" onSubmit={e => { e.preventDefault(); unlockTier(tier); }}>
                    <input value={codeDraft} maxLength={8} autoComplete="off" autoCapitalize="characters" spellCheck={false}
                      placeholder="Enter promo code" aria-label={`Promo code for ${tier.name}`}
                      onChange={e => { setCodeDraft(e.target.value.replace(/\s+/g, '').toUpperCase()); setCodeErr(''); }}
                      onKeyDown={e => e.stopPropagation()} />
                    <button type="submit" disabled={unlocking || !codeDraft}>{unlocking ? 'Checking...' : 'Unlock'}</button>
                  </form>
                  {codeErr && <p className="v-code-err" role="alert">{codeErr}</p>}
                </div>
              )}

              {tier.price > 0 && feeOpenId === tier.id && (() => {
                const fee = serviceFeePerTicket(tier.price);
                const capped = tier.price > SERVICE_FEE_THRESHOLD;
                return (
                  <div className="v-fee-bd">
                    <div><span>Ticket price</span><span>{formatNGN(tier.price)}</span></div>
                    <div>
                      <span>Service fee ({capped ? `flat, capped at ${formatNGN(SERVICE_FEE_FLAT)}` : `${SERVICE_FEE_RATE * 100}%`})</span>
                      <span>{formatNGN(fee)}</span>
                    </div>
                    <div className="t"><span>{beforeFees ? 'With service fee' : 'Price per ticket'}</span><span>{formatNGN(tier.price + fee)}</span></div>
                    <p>
                      A payment processing fee of {PROCESSING_FEE_RATE * 100}% (+ {formatNGN(PROCESSING_FEE_FLAT)} on orders over {formatNGN(PROCESSING_FEE_THRESHOLD)}, max {formatNGN(PROCESSING_FEE_CAP)}) is added once per order and shown before you pay.
                    </p>
                  </div>
                );
              })()}

              {tier.description && tier.description.trim().length > 0 && (
                <details className="v-tier-desc">
                  <summary className="v-tier-desc-toggle">View description</summary>
                  <div className="v-tier-desc-body">{tier.description}</div>
                </details>
              )}
            </div>
          );
        })}
      </div>

      {!isCompleted && (
        <>
          {hasSelection && (
            <div className="v-order" aria-live="polite">
              {lines.map(({ tier, quantity }) => (
                <div className="v-sum" key={tier.id}>
                  <span>{quantity} × {tier.name}</span>
                  <span>{tier.price === 0 ? 'Free' : formatNGN(listedTicketPrice(tier.price, beforeFees) * quantity)}</span>
                </div>
              ))}
              {allFree ? (
                <div className="v-sum tot"><span>Total</span><span style={{ color: 'var(--green-lt)' }}>Free</span></div>
              ) : (
                <>
                  {beforeFees && totals.serviceFee > 0 && (
                    <div className="v-sum"><span>Service fee</span><span>{formatNGN(totals.serviceFee)}</span></div>
                  )}
                  <div className="v-sum"><span>Processing fee</span><span>{formatNGN(totals.processingFee)}</span></div>
                  <div className="v-sum tot"><span>Total{lines.length > 1 ? ` (${ticketCount} tickets)` : ''}</span><span>{formatNGN(totals.total)}</span></div>
                </>
              )}
            </div>
          )}

          {pausedMessage && <p className="v-paused-note" role="status">{pausedMessage}</p>}
          <button type="button" className="v-btn v-btn-accent v-btn-block" style={{ marginTop: 14 }} disabled={!hasSelection || !!pausedMessage} onClick={handlePurchase}>
            {!minOnSale ? 'Sold out' : needsCode ? 'Enter your code to continue' : allFree ? 'Get free tickets' : 'Get tickets'}
          </button>
          <p className="v-nb">
            {allFree ? '' : 'The total above is exactly what leaves your account. Processing fees are not refundable. '}
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
          {flyer && <div className="v-ed-hero-bg" style={{ backgroundImage: `url("${(multiFlyer && heroBg) || flyer}")` }} aria-hidden="true" />}
          {multiFlyer
            ? <FlyerCarousel urls={flyers} alt={`${event.name} flyer`} onSlideChange={setHeroBg} />
            : flyer
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

              {/* With a header banner the flyers aren't in the hero, so several
                  flyers get their own swipeable spot here. */}
              {banner && multiFlyer && (
                <div className="v-fc-section">
                  <FlyerCarousel urls={flyers} alt={`${event.name} flyer`} />
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
              {hasSelection ? (allFree ? 'Free' : formatNGN(totals.total)) : minOnSale ? (minOnSale.price === 0 ? 'Free' : `From ${formatNGN(listedTicketPrice(minOnSale.price, beforeFees))}${beforeFees ? ' + fees' : ''}`) : 'Sold out'}
              <i>{hasSelection ? `${orderSummary}${allFree ? '' : ', all fees in'} · change` : 'Choose tickets'}</i>
            </button>
            <button type="button" className="v-btn v-btn-accent" disabled={!hasSelection || !!pausedMessage} onClick={handlePurchase}>
              {allFree ? 'Get free tickets' : 'Get tickets'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
