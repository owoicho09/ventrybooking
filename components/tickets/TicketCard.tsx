import { QRDisplay } from './QRDisplay';
import { formatNGN, formatDate } from '@/lib/utils';
import type { Ticket } from '@/types';

interface TicketCardProps {
  ticket: Ticket;
}

export function TicketCard({ ticket }: TicketCardProps) {
  return (
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
              Show at entrance
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
              {ticket.event.venue}
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
}
