'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Printer, Mail, AlertTriangle } from 'lucide-react';
import { PublicNav } from '@/components/layout/PublicNav';
import { TicketCard } from '@/components/tickets/TicketCard';
import { Button } from '@/components/ui/Button';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Parameters<typeof TicketCard>[0]['ticket'] | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    // Clear the checkout cart now that we have a confirmed ticket
    sessionStorage.removeItem('ventry_cart');

    fetch(`/api/tickets/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const raw = d.data;
          setTicket({
            id:          raw.id,
            eventId:     raw.event?.id || '',
            event: {
              ...raw.event,
              name:        raw.event?.name || raw.event?.event_name || '',
              organizer:   raw.event?.organizer || {},
              tiers:       [],
              status:      'approved',
              totalSold:   0,
              bannerColor: raw.event?.banner_color || 'from-purple-900 to-indigo-900',
            },
            tier:         raw.tier || {},
            quantity:     raw.quantity,
            buyerName:    raw.buyer_name,
            buyerEmail:   raw.buyer_email,
            totalPaid:    raw.total_paid,
            status:       raw.status,
            purchasedAt:  raw.purchased_at,
            refundCode:   raw.refund_code,
            qrData:       raw.qr_token || raw.id,
            qrDataUrl:    raw.qrDataUrl,
          } as Parameters<typeof TicketCard>[0]['ticket']);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleResend = async () => {
    if (!ticket || resending) return;
    setResending(true);
    setResendMsg('');
    try {
      const res = await fetch(`/api/tickets/${id}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ticket.buyerEmail }),
      });
      const data = await res.json();
      setResendMsg(data.success ? 'Ticket resent successfully!' : (data.error || 'Failed to resend.'));
    } catch {
      setResendMsg('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  if (loading) return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-24 flex items-center justify-center">
        <p style={{ color: 'var(--color-text-muted)' }}>Loading ticket…</p>
      </div>
    </div>
  );

  if (notFound || !ticket) return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-24 text-center px-4">
        <p className="text-lg font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Ticket not found</p>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          This ticket ID doesn&apos;t exist or may have been removed.
        </p>
        <Link href="/retrieve"><Button>Retrieve Your Ticket</Button></Link>
      </div>
    </div>
  );

  return (
    <div style={{ backgroundColor: 'var(--color-bg)', minHeight: '100vh' }}>
      <PublicNav />
      <div className="pt-16 max-w-2xl mx-auto px-4 py-12 print:pt-4 print:px-0">
        <div className="flex flex-col items-center text-center mb-10 print:hidden">
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-full flex items-center justify-center relative z-10"
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
            Your ticket is confirmed
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            A copy has been sent to{' '}
            <span className="font-medium" style={{ color: 'var(--color-text)' }}>{ticket.buyerEmail}</span>
          </p>
        </div>

        <TicketCard ticket={ticket} />

        <div className="flex gap-3 mt-5 print:hidden">
          <Button variant="outline" fullWidth onClick={() => window.print()}>
            <Printer size={16} />Print / Save PDF
          </Button>
          <Button variant="ghost" fullWidth onClick={handleResend} disabled={resending}>
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
            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>Keep your QR code private.</span>{' '}
            Only show it at the venue entrance when you are ready to be scanned in. Each QR code is single-use.
          </p>
        </div>

        <div className="text-center mt-8 print:hidden">
          <Link href="/events" className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Discover more events
          </Link>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          nav, footer, .print\\:hidden { display: none !important; }
          body { background: #fff !important; }
          .print\\:pt-4 { padding-top: 1rem !important; }
        }
      `}</style>
    </div>
  );
}
