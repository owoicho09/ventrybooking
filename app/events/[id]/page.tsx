'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, Clock, ChevronRight, CheckCircle, Shield, Minus, Plus, AlertTriangle } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatNGN, formatDate } from '@/lib/utils';
import type { Event, TicketTier } from '@/types';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [checkingOut, setCheckingOut] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/events/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEvent(d.data);
          setQuantities(Object.fromEntries(d.data.tiers.map((t: TicketTier) => [t.id, 0])));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const updateQty = (tierId: string, delta: number) => {
    if (!event) return;
    const tier = event.tiers.find(t => t.id === tierId);
    if (!tier) return;
    const remaining = tier.available - tier.sold;
    setQuantities(prev => ({ ...prev, [tierId]: Math.max(0, Math.min(Math.min(10, remaining), (prev[tierId] ?? 0) + delta)) }));
  };

  const subtotal = event ? event.tiers.reduce((sum, tier) => sum + tier.price * (quantities[tier.id] ?? 0), 0) : 0;
  const serviceFee = subtotal > 0 ? 100 : 0;
  const total = subtotal + serviceFee;
  const hasSelection = subtotal > 0;

  const selectedTiers = event ? event.tiers.filter(t => (quantities[t.id] ?? 0) > 0) : [];
  const multiTierWarning = selectedTiers.length > 1;

  const handlePurchase = async () => {
    if (!event || !hasSelection) return;
    if (selectedTiers.length === 0) return;
    // Only the first selected tier is sent — multi-tier checkout not yet supported
    const tier = selectedTiers[0];
    const qty  = quantities[tier.id];
    sessionStorage.setItem('ventry_cart', JSON.stringify({
      eventId:   event.id,
      tierId:    tier.id,
      quantity:  qty,
      tierName:  tier.name,
      eventName: event.name,
      eventDate: event.date,
      tierPrice: tier.price,
    }));
    router.push('/checkout');
  };

  if (loading) return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-24 flex items-center justify-center"><p style={{ color: 'var(--color-text-muted)' }}>Loading event...</p></div>
    </div>
  );

  if (!event) return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-24 text-center"><p style={{ color: 'var(--color-text-muted)' }}>Event not found.</p></div>
    </div>
  );

  return (
    <div style={{ backgroundColor: 'var(--color-bg)' }}>
      <PublicNav />
      <div className="pt-16 max-w-7xl mx-auto px-6 py-8">
        <nav className="flex items-center gap-1.5 text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/" className="hover:text-[var(--color-text)] transition-colors">Home</Link>
          <ChevronRight size={14} />
          <Link href="/events" className="hover:text-[var(--color-text)] transition-colors">Events</Link>
          <ChevronRight size={14} />
          <span style={{ color: 'var(--color-text)' }}>{event.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 flex flex-col gap-8">
            <div className={`relative h-72 rounded-2xl bg-gradient-to-br ${event.bannerColor} flex items-center justify-center border overflow-hidden`} style={{ borderColor: 'var(--color-border)' }}>
              {event.banner_url ? (
                <Image
                  src={event.banner_url}
                  alt={event.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  priority
                />
              ) : (
                <p className="text-6xl opacity-20" style={{ color: '#fff', fontFamily: 'var(--font-syne), sans-serif' }}>{event.category[0]}</p>
              )}
            </div>

            <div>
              {event.organizer?.verified && (
                <div className="mb-3"><Badge variant="green"><CheckCircle size={11} />Ventry Verified Event</Badge></div>
              )}
              <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>{event.name}</h1>
              <div className="flex flex-wrap gap-4 text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
                <div className="flex items-center gap-2"><Calendar size={15} style={{ color: 'var(--color-purple)' }} />{formatDate(event.date)}</div>
                <div className="flex items-center gap-2"><Clock size={15} style={{ color: 'var(--color-purple)' }} />{event.time}</div>
                <div className="flex items-center gap-2"><MapPin size={15} style={{ color: 'var(--color-purple)' }} />{event.venue}, {event.city}</div>
              </div>
              <p className="text-base leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{event.description}</p>
            </div>

            <div className="rounded-xl border p-5 flex items-start gap-4" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white flex-shrink-0" style={{ backgroundColor: 'var(--color-purple)' }}>{event.organizer?.name[0]}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="font-semibold" style={{ color: 'var(--color-text)' }}>{event.organizer?.name}</p>
                  {event.organizer?.verified && <Badge variant="green"><CheckCircle size={10} />Verified</Badge>}
                  <Badge variant="purple">{event.organizer?.tier}</Badge>
                </div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Member since {new Date(event.organizer?.memberSince || event.organizer?.member_since || '').getFullYear()} &middot; {event.organizer?.eventsHosted || event.organizer?.events_hosted || 0} events hosted</p>
              </div>
            </div>

            <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Event Details</h3>
              <div className="h-36 rounded-lg mb-3 flex items-center justify-center border" style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)' }}>
                <div className="flex flex-col items-center gap-1"><MapPin size={24} style={{ color: 'var(--color-text-dim)' }} /><p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>Map placeholder</p></div>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{event.venue}</p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{event.address}</p>
            </div>

            <div className="rounded-xl border p-5" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <h3 className="font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Refund Policy</h3>
              <ul className="flex flex-col gap-2">
                {['Full refund if the event is cancelled by the organizer.', 'Full refund if the event is flagged as fraudulent by Ventry.', 'No refunds for no-shows or buyer change of mind after ticket purchase.', 'Refunds are processed within 3-5 business days to your original payment method.'].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}><CheckCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-green)' }} />{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="sticky top-24 rounded-xl border overflow-hidden" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
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
                    return (
                      <div key={tier.id} className="rounded-lg border p-4" style={{ borderColor: qty > 0 ? 'var(--color-purple)' : 'var(--color-border)', backgroundColor: qty > 0 ? 'var(--color-purple-dim)' : 'var(--color-surface-2)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm" style={{ color: 'var(--color-text)' }}>{tier.name}</p>
                            <p className="text-base font-bold" style={{ color: 'var(--color-text)' }}>{formatNGN(tier.price)}</p>
                          </div>
                          {isSoldOut ? <Badge variant="gray">Sold Out</Badge> : (
                            <div className="flex items-center gap-2">
                              <button onClick={() => updateQty(tier.id, -1)} disabled={qty === 0} className="w-7 h-7 rounded-md flex items-center justify-center border transition-colors disabled:opacity-30" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', backgroundColor: 'var(--color-surface)' }}><Minus size={13} /></button>
                              <span className="w-5 text-center text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{qty}</span>
                              <button onClick={() => updateQty(tier.id, 1)} disabled={qty >= Math.min(10, remaining)} className="w-7 h-7 rounded-md flex items-center justify-center border transition-colors disabled:opacity-30" style={{ borderColor: 'var(--color-purple)', color: 'var(--color-purple)', backgroundColor: 'var(--color-purple-dim)' }}><Plus size={13} /></button>
                            </div>
                          )}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{remaining} remaining</p>
                      </div>
                    );
                  })}
                </div>

                {hasSelection && (
                  <div className="rounded-lg border p-4 flex flex-col gap-2 text-sm" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
                    <div className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span><span style={{ color: 'var(--color-text)' }}>{formatNGN(subtotal)}</span></div>
                    <div className="flex justify-between"><span style={{ color: 'var(--color-text-muted)' }}>Service fee</span><span style={{ color: 'var(--color-text)' }}>{formatNGN(serviceFee)}</span></div>
                    <div className="flex justify-between font-semibold pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <span style={{ color: 'var(--color-text)' }}>Total</span><span style={{ color: 'var(--color-text)' }}>{formatNGN(total)}</span>
                    </div>
                  </div>
                )}

                {multiTierWarning && (
                  <div className="flex items-start gap-2 rounded-lg p-3 text-xs"
                    style={{ backgroundColor: '#f59e0b15', color: 'var(--color-amber)' }}>
                    <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                    Only one ticket type can be purchased per order. Only the first selected tier will be checked out.
                  </div>
                )}
                <Button fullWidth size="lg" disabled={!hasSelection || checkingOut} onClick={handlePurchase}>
                  {checkingOut ? 'Loading…' : 'Purchase Tickets'}
                </Button>
                <p className="text-xs text-center leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>Your payment is held in escrow until the event happens. Full refund if cancelled.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
