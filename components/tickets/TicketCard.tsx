import { QRDisplay } from './QRDisplay';
import { formatNGN, formatDate } from '@/lib/utils';
import type { Ticket } from '@/types';

interface TicketCardProps {
  ticket: Ticket;
}

export function TicketCard({ ticket }: TicketCardProps) {
  const isOnline = ticket.event.event_mode === 'online';
  const card = (
    <div
      className="rounded-xl border overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Top strip */}
      <div
        className="h-2"
        style={{ backgroundColor: 'var(--color-purple)' }}
      />

      <div className="flex flex-col sm:flex-row gap-0">
        {/* Left: QR */}
        <div
          className="p-6 flex flex-col items-center justify-center gap-3 border-b sm:border-b-0 sm:border-r"
          style={{ borderColor: 'var(--color-border)', minWidth: 180 }}
        >
          <QRDisplay dataUrl={ticket.qrDataUrl} ticketId={ticket.id} size={140} />
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
              {isOnline ? 'Ticket receipt' : 'Show at entrance'}
            </p>
          </div>
        </div>

        {/* Perforated divider */}
        <div
          className="hidden sm:flex w-px ticket-perforation"
          style={{ backgroundColor: 'var(--color-border)' }}
        />

        {/* Right: Details */}
        <div className="flex-1 p-6 flex flex-col gap-4">
          <div>
            {ticket.purchasedByMe && (
              <span
                className="inline-block text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full mb-2"
                style={{ backgroundColor: 'var(--color-purple-dim)', color: 'var(--color-purple-light)' }}
              >
                Purchased by you &middot; sent to {ticket.buyerEmail}
              </span>
            )}
            <h2
              className="text-xl font-bold leading-tight mb-1"
              style={{
                color: 'var(--color-text)',
                fontFamily: 'var(--font-syne), sans-serif',
              }}
            >
              {ticket.event.name}
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {formatDate(ticket.event.date)} &middot; {ticket.event.time}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {isOnline ? 'Online Event — join link arrives by email before the event' : ticket.event.venue}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                Ticket Type
              </p>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {ticket.tier.name}
              </p>
            </div>
            {ticket.quantity > 1 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                  Quantity
                </p>
                <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                  {ticket.quantity}×
                </p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                Attendee
              </p>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {ticket.buyerName}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--color-text-dim)' }}>
                Ticket Price
              </p>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {formatNGN(ticket.totalPaid)}
              </p>
            </div>
          </div>

          {/* Bottom strip */}
          <div
            className="pt-4 border-t flex flex-col gap-1.5"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Ticket ID
              </span>
              <span
                className="text-xs font-mono font-medium"
                style={{ color: 'var(--color-text)' }}
              >
                {ticket.id}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
                Refund Code
              </span>
              <span
                className="text-xs font-mono font-medium"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {ticket.refundCode}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Refunded/cancelled tickets keep the standard card (the visa route 404s).
  const showVisa = ticket.visaTicket && (ticket.status === 'valid' || ticket.status === 'used');
  if (!showVisa) return card;

  // IJGB Homecoming: the personalised visa ticket (same QR as below).
  return (
    <div className="flex flex-col gap-3">
      <a
        href={`/api/tickets/${ticket.id}/visa`}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl overflow-hidden border"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/tickets/${ticket.id}/visa`}
          alt={`IJGB Homecoming visa ticket ${ticket.id}`}
          width={1280}
          height={720}
          className="block w-full h-auto"
          style={{ aspectRatio: '16 / 9', backgroundColor: 'var(--color-surface)' }}
        />
      </a>
      <a
        href={`/api/tickets/${ticket.id}/visa?format=pdf`}
        className="self-start text-sm font-semibold underline"
        style={{ color: 'var(--color-purple-light)' }}
      >
        Download visa ticket (PDF)
      </a>
      {card}
    </div>
  );
}
