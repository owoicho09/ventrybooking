'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Printer, Mail, AlertTriangle } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Button } from '@/components/ui/Button';

type RawTicket = Parameters<typeof TicketCard>[0]['ticket'];

function buildTicket(raw: Record<string, unknown>): RawTicket {
  const event = raw.event as Record<string, unknown> | null;
  const tier  = raw.tier  as Record<string, unknown> | null;
  return {
    id:          raw.id as string,
    eventId:     (event?.id as string) || '',
    event: {
      ...(event as object),
      name:        (event?.event_name as string) || (event?.name as string) || '',
      organizer:   (event?.organizer as object) || {},
      tiers:       [],
      status:      'approved' as const,
      totalSold:   0,
      bannerColor: (event?.banner_color as string) || 'from-purple-900 to-indigo-900',
    } as unknown as RawTicket['event'],
    tier:         (tier as unknown as RawTicket['tier']) || {} as unknown as RawTicket['tier'],
    quantity:     (raw.quantity as number) ?? 1,
    buyerName:    raw.buyer_name as string,
    buyerEmail:   raw.buyer_email as string,
    totalPaid:    raw.total_paid as number,
    status:       raw.status as RawTicket['status'],
    purchasedAt:  raw.purchased_at as string,
    refundCode:   raw.refund_code as string,
    qrData:       (raw.qr_token as string) || (raw.id as string),
    qrDataUrl:    raw.qrDataUrl as string | null,
  };
}

function TicketsContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref') ?? '';

  const [tickets,   setTickets]   = useState<RawTicket[]>([]);
  const [buyerEmail, setBuyerEmail] = useState('');
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (!ref) { setNotFound(true); setLoading(false); return; }
    sessionStorage.removeItem('ventry_cart');

    fetch(`/api/tickets/by-reference?ref=${ref}`)
      .then(r => r.json())
      .then(async d => {
        if (!d.success || !d.data?.ids?.length) { setNotFound(true); return; }
        const results = await Promise.all(
          (d.data.ids as string[]).map(ticketId =>
            fetch(`/api/tickets/${ticketId}`).then(r => r.json())
          )
        );
        const loaded = results.filter(r => r.success).map(r => buildTicket(r.data));
        if (loaded.length === 0) { setNotFound(true); return; }
        setTickets(loaded);
        setBuyerEmail(loaded[0].buyerEmail);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [ref]);

  const handleResendAll = async () => {
    if (!tickets[0] || resending) return;
    setResending(true);
    setResendMsg('');
    try {
      const res = await fetch(`/api/tickets/${tickets[0].id}/resend`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: buyerEmail }),
      });
      const data = await res.json();
      setResendMsg(data.success ? 'Tickets resent successfully!' : (data.error || 'Failed to resend.'));
    } catch {
      setResendMsg('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (loading) return (
    <div className="pt-24 flex items-center justify-center">
      <p style={{ color: 'var(--color-text-muted)' }}>Loading your tickets…</p>
    </div>
  );

  if (notFound || tickets.length === 0) return (
    <div className="pt-24 text-center px-4">
      <p className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
        Tickets not found
      </p>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        This purchase reference doesn&apos;t match any tickets.
      </p>
      <Link href="/retrieve"><Button>Retrieve Your Ticket</Button></Link>
    </div>
  );

  return (
    <div className="pt-16 max-w-2xl mx-auto px-4 py-12 print:pt-4 print:px-0">
      {/* Confirmation header */}
      <div className="flex flex-col items-center text-center mb-10 print:hidden">
        <div className="relative mb-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#10b98120' }}>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="#10b981" strokeWidth="2" />
              <polyline points="12,20 18,26 28,14" stroke="#10b981" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}>
          {tickets.length === 1 ? 'Your ticket is confirmed' : `Your ${tickets.length} tickets are confirmed`}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          A copy has been sent to{' '}
          <span className="font-medium" style={{ color: 'var(--color-text)' }}>{buyerEmail}</span>
        </p>
      </div>

      {/* One TicketCard per ticket */}
      <div className="flex flex-col gap-6">
        {tickets.map((ticket, i) => (
          <div key={ticket.id}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2 print:hidden"
              style={{ color: 'var(--color-purple-light)' }}>
              Ticket {i + 1} of {tickets.length}
            </p>
            <TicketCard ticket={ticket} />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-5 print:hidden">
        <Button variant="outline" fullWidth onClick={() => window.print()}>
          <Printer size={16} />Print / Save PDF
        </Button>
        <Button variant="ghost" fullWidth onClick={handleResendAll} disabled={resending}>
          <Mail size={16} />{resending ? 'Sending…' : 'Send Again'}
        </Button>
      </div>

      {resendMsg && (
        <p className="text-sm text-center mt-3 print:hidden"
          style={{ color: resendMsg.includes('success') ? 'var(--color-green)' : 'var(--color-red)' }}>
          {resendMsg}
        </p>
      )}

      <div className="mt-6 rounded-xl border p-4 flex items-start gap-3 print:hidden"
        style={{ backgroundColor: '#f59e0b10', borderColor: '#f59e0b30' }}>
        <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-amber)' }} />
        <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
            Keep your QR codes private.
          </span>{' '}
          Only show them at the venue entrance when you are ready to be scanned in. Each QR code is single-use.
        </p>
      </div>

      <div className="text-center mt-8 print:hidden">
        <Link href="/events" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Discover more events
        </Link>
      </div>

      <style>{`
        @media print {
          nav, footer, .print\\:hidden { display: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

export default function TicketsPage() {
  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <Suspense fallback={
        <div className="pt-24 text-center" style={{ color: 'var(--color-text-muted)' }}>Loading…</div>
      }>
        <TicketsContent />
      </Suspense>
    </div>
  );
}
