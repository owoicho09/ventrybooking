'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Clock, ChevronRight, CheckCircle, Shield, Minus, Plus, Share2, Mic2 } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNGN, formatDate, eventsHostedLabel } from '@/lib/utils';
import { serviceFeePerTicket, processingFee as computeProcessingFee } from '@/lib/fees';
import { ticketUrgency, URGENCY_LABEL } from '@/lib/ticketUrgency';
import type { Event, TicketTier } from '@/types';
import { EventReviews } from '@/components/events/EventReviews';
import { useToast } from '@/components/ui/Toast';

// Most organiser banners are portrait flyers, not wide landscape photos —
// at 25vh/220px a cover-crop only ever revealed roughly the top 12% of a
// typical portrait flyer's height, i.e. one line of text and nothing else
// useful, no matter how it was cropped. This taller strip fixes that.
const BANNER_HEIGHT = 'max(46vh, 380px)';

interface EventDetailContentProps {
  /** The event's slug (or, for the legacy /events/[id] shim, its UUID) — whatever was fetched to resolve this page. */
  identifier: string;
}

export function EventDetailContent({ identifier }: EventDetailContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [checkingOut, setCheckingOut] = useState(false);
  const [orgReputation, setOrgReputation] = useState<{ avg: number | null; count: number } | null>(null);
  const refTracked = useRef(false);

  useEffect(() => {
    if (!identifier) return;
    setLoading(true);
    fetch(`/api/events/${identifier}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEvent(d.data);
          setQuantities(Object.fromEntries(d.data.tiers.map((t: TicketTier) => [t.id, 0])));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [identifier]);

  // Affiliate link tracking: capture ?ref=, credit one click, and remember it
  // so it can be attached to the order if this buyer checks out.
  useEffect(() => {
    if (!event) return;
    const ref = searchParams.get('ref');
    if (!ref || refTracked.current) return;
    refTracked.current = true;
    sessionStorage.setItem(`ventry_ref_${event.id}`, ref);
    fetch('/api/affiliates/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: ref }),
    }).catch(() => {});
  }, [event, searchParams]);

  const updateQty = (tierId: string, delta: number) => {
    if (!event) return;
    const tier = event.tiers.find(t => t.id === tierId);
    if (!tier) return;
    const remaining = tier.available - tier.sold;
    setQuantities(prev => ({ ...prev, [tierId]: Math.max(0, Math.min(Math.min(10, remaining), (prev[tierId] ?? 0) + delta)) }));
  };

  const selectedTiers    = event ? event.tiers.filter(t => (quantities[t.id] ?? 0) > 0) : [];
  const totalQty         = selectedTiers.reduce((s, t) => s + (quantities[t.id] ?? 0), 0);
  const hasSelection     = totalQty > 0;
  const allFree          = hasSelection && selectedTiers.every(t => t.price === 0);
  const subtotal            = selectedTiers.reduce((s, t) => s + t.price * (quantities[t.id] ?? 0), 0);
  const serviceFee          = selectedTiers.reduce((s, t) => s + serviceFeePerTicket(t.price) * (quantities[t.id] ?? 0), 0);
  const preProcessingAmount = subtotal + serviceFee;
  const total               = allFree ? preProcessingAmount : Math.round(preProcessingAmount + computeProcessingFee(preProcessingAmount));
  const processingFee       = total - preProcessingAmount;
  const isOnline = event?.event_mode === 'online';
  const exactLocationVisible = event ? !event.location_hidden : false;
  const locationSummary = event
    ? isOnline
      ? 'Online Event'
      : exactLocationVisible
      ? `${event.venue}, ${event.city}`
      : event.landmark
      ? `Near ${event.landmark}, ${event.city}`
      : `Exact location undisclosed, ${event.city}`
    : '';
  const mapQuery = event
    ? exactLocationVisible
      ? [event.venue, event.address, event.city].filter(Boolean).join(', ')
      : [event.landmark, event.city].filter(Boolean).join(', ')
    : '';
  const mapSrc = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`
    : '';

  const handlePurchase = async () => {
    if (!event || !hasSelection) return;
    if (selectedTiers.length === 0) return;
    const ref = sessionStorage.getItem(`ventry_ref_${event.id}`) || undefined;
    sessionStorage.setItem('ventry_cart', JSON.stringify({
      eventId:   event.id,
      eventName: event.name,
      eventDate: event.date,
      items: selectedTiers.map(tier => ({
        tierId:    tier.id,
        tierName:  tier.name,
        tierPrice: tier.price,
        quantity:  quantities[tier.id],
      })),
      ref,
    }));
    router.push('/checkout');
  };

  const handleShare = async () => {
    if (!event) return;
    const url = `${window.location.origin}/${event.slug || event.id}`;
    const shareData = {
      title: event.name,
      text: `Check out ${event.name} on Ventry`,
      url,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast('Event link copied', 'success');
    } catch (err) {
      if ((err as DOMException).name !== 'AbortError') {
        toast('Could not share event link', 'error');
      }
    }
  };

  const minimalHeader = (
    <div className="px-6 py-4">
      <Link href="/" className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
        <span style={{ color: 'var(--color-purple)' }}>V</span>
        <span style={{ color: 'var(--color-text)' }}>ENTRY</span>
      </Link>
    </div>
  );

  if (loading) return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      {minimalHeader}
      <div className="pt-16 flex items-center justify-center"><p style={{ color: 'var(--color-text-muted)' }}>Loading event...</p></div>
    </div>
  );

  if (!event) return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      {minimalHeader}
      <div className="pt-16 text-center"><p style={{ color: 'var(--color-text-muted)' }}>Event not found.</p></div>
    </div>
  );

  const accentStyle = event.accentColor
    ? ({ '--color-purple': event.accentColor } as React.CSSProperties)
    : undefined;

  // Defined once, rendered twice via responsive display utilities below: inline
  // in normal document flow on mobile (between the lineup and the map, per the
  // target section order), and pulled into a sticky right-hand sidebar on
  // desktop. This avoids CSS grid-order tricks that would otherwise put it
  // ahead of the title/description on mobile too, not just ahead of the map.
  const ticketCard = (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
      <div className="px-5 py-3.5 flex items-center gap-2 text-sm border-b" style={{ backgroundColor: 'var(--color-purple-dim)', borderColor: '#7c3aed30', color: 'var(--color-purple-light)' }}>
        <Shield size={15} />Ventry Escrow Protected
      </div>
      <div className="p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-base" style={{ color: 'var(--color-text)' }}>Select Tickets</h3>
        <div className="flex flex-col gap-3">
          {event.tiers.map((tier: TicketTier) => {
            const qty = quantities[tier.id] ?? 0;
            const remaining = tier.available - tier.sold;
            const isSoldOut = remaining <= 0;
            const urgency = ticketUrgency(tier.available, tier.sold);
            // Sold-out already gets its own badge on the right below — no need
            // to also show it here on the left.
            const urgencyVariant = urgency === 'almost_gone' ? 'red' as const : 'amber' as const;
            return (
              <div key={tier.id} className="rounded-lg border p-4" style={{ borderColor: qty > 0 ? 'var(--color-purple)' : 'var(--color-border)', backgroundColor: qty > 0 ? 'var(--color-purple-dim)' : 'var(--color-surface-2)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{tier.name}</p>
                    <p className="text-base font-bold" style={{ color: tier.price === 0 ? 'var(--color-green)' : 'var(--color-text)' }}>
                      {tier.price === 0 ? 'Free' : formatNGN(tier.price)}
                    </p>
                    {urgency && urgency !== 'sold_out' && (
                      <Badge variant={urgencyVariant} className="mt-1">{URGENCY_LABEL[urgency]}</Badge>
                    )}
                  </div>
                  {isSoldOut ? <Badge variant="gray">{URGENCY_LABEL.sold_out}</Badge> : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(tier.id, -1)} disabled={qty === 0} className="w-7 h-7 rounded-md flex items-center justify-center border transition-colors disabled:opacity-30" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', backgroundColor: 'var(--color-surface)' }}><Minus size={13} /></button>
                      <span className="w-5 text-center text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{qty}</span>
                      <button onClick={() => updateQty(tier.id, 1)} disabled={qty >= Math.min(10, remaining)} className="w-7 h-7 rounded-md flex items-center justify-center border transition-colors disabled:opacity-30" style={{ borderColor: 'var(--color-purple)', color: 'var(--color-purple)', backgroundColor: 'var(--color-purple-dim)' }}><Plus size={13} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {hasSelection && (
          <div className="rounded-lg border p-4 flex flex-col gap-2 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
            {allFree ? (
              <div className="flex justify-between font-semibold" style={{ color: 'var(--color-text)' }}>
                <span>Total</span>
                <span style={{ color: 'var(--color-green)' }}>Free</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span><span style={{ color: 'var(--color-text)' }}>{formatNGN(subtotal)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Ventry service fee</span><span style={{ color: 'var(--color-text)' }}>{formatNGN(serviceFee)}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Processing fee</span><span style={{ color: 'var(--color-text)' }}>{formatNGN(processingFee)}</span></div>
                <div className="flex justify-between font-semibold pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <span style={{ color: 'var(--color-text)' }}>Total</span><span style={{ color: 'var(--color-text)' }}>{formatNGN(total)}</span>
                </div>
                <p className="text-[10px] leading-snug mt-1" style={{ color: 'var(--color-text-dim)' }}>
                  The service fee (2%, capped at ₦3,000 per ticket for tickets above ₦150,000) and processing fee are non-refundable — only the base ticket price is refundable.
                </p>
              </>
            )}
          </div>
        )}

        <Button fullWidth size="lg" disabled={!hasSelection || checkingOut} onClick={handlePurchase}>
          {checkingOut ? 'Loading…' : allFree ? 'Get Free Tickets' : 'Purchase Tickets'}
        </Button>
        {!allFree && (
          <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>Your payment is held in escrow until the event happens. Full refund if cancelled.</p>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <div
        className="relative"
        style={{
          // Normal, static top banner — it scrolls away with the rest of
          // the page like any other content. An earlier version pinned this
          // with position:fixed so it stayed put while content scrolled
          // over it, but that made the banner read as a page background:
          // once you scrolled past the actual page content, the still-fixed
          // image kept showing through the gap at the bottom/edges. A plain
          // in-flow block avoids that entirely.
          height: BANNER_HEIGHT,
        }}
      >
        {event.banner_url ? (
          // object-contain looked "off" in practice: most organiser banners
          // are portrait flyers, and letterboxing a tall image inside this
          // short, full-bleed, wide strip leaves it a tiny sliver surrounded
          // by dead space on anything wider than a phone. object-cover with
          // a top-biased crop instead fills the strip cleanly on every
          // screen size and keeps the part of the flyer that actually
          // carries the title (almost always near the top).
          <Image
            src={event.banner_url}
            alt={event.name}
            fill
            className="object-cover"
            style={{ objectPosition: 'center top' }}
            sizes="100vw"
            priority
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${event.bannerColor} flex items-center justify-center`}>
            <p className="text-6xl opacity-20" style={{ color: '#fff', fontFamily: 'var(--font-syne), sans-serif' }}>{event.category[0]}</p>
          </div>
        )}
        <div
          className="absolute inset-x-0 top-0 h-24 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)' }}
        />
        <div className="absolute top-4 left-4 sm:left-6 z-10">
          <Link href="/" className="text-lg font-bold tracking-tight" style={{ fontFamily: 'var(--font-syne), sans-serif' }}>
            <span style={{ color: 'var(--color-purple)' }}>V</span>
            <span style={{ color: '#fff' }}>ENTRY</span>
          </Link>
        </div>
      </div>

      <div
        className="max-w-7xl mx-auto px-6 py-8"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <nav className="flex items-center gap-1.5 text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/" className="hover:text-[var(--color-text)] transition-colors">Home</Link>
          <ChevronRight size={14} />
          <Link href="/events" className="hover:text-[var(--color-text)] transition-colors">Events</Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--color-text)' }}>{event.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 flex flex-col gap-8">
            <div>
              {event.organizer?.verified && (
                <div className="mb-3"><Badge variant="green"><CheckCircle size={11} />Ventry Verified Event</Badge></div>
              )}
              <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>{event.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                <div className="flex items-center gap-2"><Calendar size={15} style={{ color: 'var(--color-purple)' }} />{formatDate(event.date)}</div>
                <div className="flex items-center gap-2"><Clock size={15} style={{ color: 'var(--color-purple)' }} />{event.time}</div>
                <div className="flex items-center gap-2"><MapPin size={15} style={{ color: 'var(--color-purple)' }} />{locationSummary}</div>
              </div>
              <Button variant="outline" size="sm" onClick={handleShare} className="mb-6">
                <Share2 size={15} />Share Event
              </Button>
              <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{event.description}</p>
            </div>

            {event.lineup && event.lineup.length > 0 && (
              <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                  <Mic2 size={16} style={{ color: 'var(--color-purple)' }} />Lineup
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {event.lineup.map((act, i) => (
                    <div key={i} className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{act.name}</p>
                      {act.role && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{act.role}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ticket panel, mobile position: inline between lineup and map, per the target section order. */}
            <div className="lg:hidden" style={accentStyle}>{ticketCard}</div>

            <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Event Details</h3>
              {isOnline ? (
                <div className="rounded-lg p-4 flex items-start gap-3 text-sm" style={{ backgroundColor: 'var(--color-surface-2)' }}>
                  <Shield size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-purple)' }} />
                  <div>
                    <p className="font-medium" style={{ color: 'var(--color-text)' }}>This is an online event</p>
                    <p className="mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      The join link will be emailed to ticket holders before the event starts, along with their reminders.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="h-52 rounded-lg mb-3 border overflow-hidden" style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
                    {mapSrc ? (
                      <iframe
                        title={`${event.name} location map`}
                        src={mapSrc}
                        className="w-full h-full border-0"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-1">
                        <MapPin size={24} style={{ color: 'var(--color-text-dim)' }} />
                        <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>Location unavailable</p>
                      </div>
                    )}
                  </div>
                  {exactLocationVisible ? (
                    <>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{event.venue}</p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{event.address}</p>
                      {event.landmark && (
                        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Landmark: {event.landmark}</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        Exact location undisclosed
                      </p>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {event.landmark
                          ? `Landmark: ${event.landmark}. Exact venue and address will be shared with ticket buyers.`
                          : `Exact venue and address will be shared with ticket buyers.`}
                      </p>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>Refund Policy</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                Your ticket price is protected in escrow and refunded automatically if this event is cancelled or flagged
                as fraudulent. The Ventry service fee and processing fee are non-refundable in all cases.
              </p>
              <Link
                href="/refund-policy"
                className="inline-flex items-center gap-1 text-sm font-medium mt-2 hover:underline"
                style={{ color: 'var(--color-purple-light)' }}
              >
                Read the full Refund Policy <ChevronRight size={14} />
              </Link>
            </div>

            {(() => {
              const organizerBlockInner = (
                <>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{ backgroundColor: 'var(--color-purple)' }}>{event.organizer?.name[0]}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{event.organizer?.name}</p>
                      {event.organizer?.verified && <Badge variant="green"><CheckCircle size={10} />Verified</Badge>}
                      <Badge variant="purple">{event.organizer?.tier}</Badge>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Member since {new Date(event.organizer?.memberSince || event.organizer?.member_since || '').getFullYear()} &middot; {eventsHostedLabel(event.organizer?.eventsHosted ?? event.organizer?.events_hosted ?? 0)}</p>
                    {orgReputation?.avg != null && (
                      <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
                        <span style={{ color: '#f59e0b' }}>{'★'.repeat(Math.round(orgReputation.avg))}{'☆'.repeat(5 - Math.round(orgReputation.avg))}</span>
                        <span className="font-medium" style={{ color: 'var(--color-text)' }}>{orgReputation.avg.toFixed(1)}</span>
                        <span>organizer rating · {orgReputation.count} {orgReputation.count === 1 ? 'review' : 'reviews'}</span>
                      </p>
                    )}
                  </div>
                </>
              );
              const cardStyle = { backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' } as const;
              return event.organizer?.handle ? (
                <Link href={`/${event.organizer.handle}`} className="rounded-xl border p-5 flex items-start gap-4 transition-opacity hover:opacity-80" style={cardStyle}>
                  {organizerBlockInner}
                </Link>
              ) : (
                <div className="rounded-xl border p-5 flex items-start gap-4" style={cardStyle}>
                  {organizerBlockInner}
                </div>
              );
            })()}

            <EventReviews
              eventId={event.id}
              eventDate={event.date}
              onOrgReputation={(avg, count) => setOrgReputation({ avg, count })}
            />
          </div>

          {/* Ticket panel, desktop position: sticky right-hand sidebar. */}
          <div className="hidden lg:block lg:col-span-2" style={accentStyle}>
            <div className="sticky top-24">{ticketCard}</div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
