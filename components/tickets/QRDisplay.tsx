'use client';

interface QRDisplayProps {
  dataUrl?: string | null;
  ticketId?: string;
  size?: number;
}

export function QRDisplay({ dataUrl, ticketId, size = 140 }: QRDisplayProps) {
  if (dataUrl) {
    return (
      <div className="flex flex-col items-center gap-2">
        <img src={dataUrl} alt="Ticket QR Code" style={{ width: size, height: size, borderRadius: 8 }} />
        {ticketId && (
          <p className="text-[9px] font-mono tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
            {ticketId}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg"
      style={{ width: size, height: size, border: '2px dashed var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}
    >
      <p className="text-[9px] font-mono tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
        {ticketId ?? 'Loading QR...'}
      </p>
    </div>
  );
}
