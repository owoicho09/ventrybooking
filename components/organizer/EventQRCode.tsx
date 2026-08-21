'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Print-resolution backing size — the <canvas> is displayed much smaller via
// CSS, but the actual pixel data (and therefore the downloaded PNG) stays
// crisp at poster/flyer scale.
const CANVAS_SIZE = 1024;
const BRAND_DARK  = '#0a0a0f';
const BRAND_PURPLE = '#7c3aed';

export function EventQRCode({ url, eventName }: { url: string; eventName: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(false);

    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        const QRCode = (await import('qrcode')).default;
        // High error correction is required here — a big chunk of the code's
        // center is about to be covered by the brand mark, and the QR must
        // still scan cleanly through that.
        await QRCode.toCanvas(canvas, url, {
          errorCorrectionLevel: 'H',
          margin: 2,
          width: CANVAS_SIZE,
          color: { dark: BRAND_DARK, light: '#ffffff' },
        });
        if (cancelled) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Center brand mark: a white plate (quiet zone for the scanner) with a
        // purple rounded square carrying the Ventry "V". Kept to ~20% of the
        // code's width, comfortably inside what H-level correction tolerates.
        const plateSize = CANVAS_SIZE * 0.24;
        const plateX = (CANVAS_SIZE - plateSize) / 2;
        const plateY = plateX;
        const plateRadius = plateSize * 0.18;

        const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        };

        ctx.fillStyle = '#ffffff';
        roundedRect(plateX, plateY, plateSize, plateSize, plateRadius);
        ctx.fill();

        const badgeInset = plateSize * 0.12;
        const badgeSize = plateSize - badgeInset * 2;
        ctx.fillStyle = BRAND_PURPLE;
        roundedRect(plateX + badgeInset, plateY + badgeInset, badgeSize, badgeSize, plateRadius * 0.7);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = `700 ${badgeSize * 0.62}px Georgia, "Times New Roman", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('V', plateX + plateSize / 2, plateY + plateSize / 2 + badgeSize * 0.03);

        if (!cancelled) setReady(true);
      } catch (err) {
        console.error('EventQRCode: generation failed', err);
        if (!cancelled) setError(true);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${eventName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-qr-code.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div
        className="rounded-xl border p-3 flex-shrink-0"
        style={{ backgroundColor: '#ffffff', borderColor: 'var(--color-border)' }}
      >
        <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={{ width: 168, height: 168, display: 'block' }} />
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          A scannable, branded QR code for your event link — put it on flyers, posters, or screens. High
          error correction keeps it scannable even printed small.
        </p>
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-red)' }}>Failed to generate QR code — try refreshing the page.</p>
        )}
        <Button size="sm" variant="outline" disabled={!ready} onClick={handleDownload} className="self-start">
          <Download size={13} />Download High-Res PNG
        </Button>
      </div>
    </div>
  );
}
