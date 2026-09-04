'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { extractDominantColor } from '@/lib/colorExtract';

interface BannerCropInputProps {
  label: string;
  currentUrl?: string | null;
  onCropped: (file: File) => void;
  buttonText?: string;
  /** Output width:height ratio. Defaults to 3 (the original fixed hero strip). */
  ratio?: number;
  /** Minimum source image width accepted, in px. Defaults to 1200. */
  minWidth?: number;
  /** Minimum source image height accepted, in px. Unenforced if omitted. */
  minHeight?: number;
  /**
   * Shows a middle-60%-safe-zone overlay + hint text while cropping. Use for
   * uploads that get cropped further/differently per device (e.g. the wide
   * header banner, whose edges are cut more aggressively on mobile) so
   * organisers know to keep faces/text away from the outer edges.
   */
  safeZoneHint?: boolean;
  /** Fires alongside onCropped with a dominant colour sampled from the cropped image, or null if nothing vivid enough was found. */
  onColorExtracted?: (hex: string | null) => void;
}

/**
 * Upload + fixed-aspect-ratio crop control. Originally built for the event
 * hero strip (ratio 3, i.e. `events.banner_url`, the "flyer"); the `ratio`/
 * `minWidth`/`minHeight` props let it double for the wide 2:1 header banner
 * (`events.header_banner_url`) without duplicating the crop UI.
 */
export function BannerCropInput({
  label,
  currentUrl,
  onCropped,
  buttonText,
  ratio = 3,
  minWidth = 1200,
  minHeight,
  safeZoneHint,
  onColorExtracted,
}: BannerCropInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [panX, setPanX] = useState(0.5); // 0 = left edge, 1 = right edge
  const [error, setError] = useState('');

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError('');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (img.width < minWidth) {
        setError(`Image is ${img.width}px wide — please upload one at least ${minWidth}px wide.`);
        setSourceImage(null);
        URL.revokeObjectURL(url);
        return;
      }
      if (minHeight && img.height < minHeight) {
        setError(`Image is ${img.height}px tall — please upload one at least ${minHeight}px tall.`);
        setSourceImage(null);
        URL.revokeObjectURL(url);
        return;
      }
      setSourceImage(img);
      setPanX(0.5);
    };
    img.onerror = () => {
      setError('Could not read that image file.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  useEffect(() => {
    if (!sourceImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const outW = Math.max(1200, minWidth);
    const outH = Math.round(outW / ratio);
    canvas.width = outW;
    canvas.height = outH;

    // Crop height = full source height (or as much as fits); crop width is
    // whatever keeps `ratio` given that height, clamped to source width.
    let cropH = sourceImage.height;
    let cropW = cropH * ratio;
    if (cropW > sourceImage.width) {
      cropW = sourceImage.width;
      cropH = cropW / ratio;
    }
    const maxX = sourceImage.width - cropW;
    const srcX = maxX * panX;
    const srcY = (sourceImage.height - cropH) / 2;

    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(sourceImage, srcX, srcY, cropW, cropH, 0, 0, outW, outH);
  }, [sourceImage, panX, ratio, minWidth]);

  const confirmCrop = () => {
    if (!canvasRef.current) return;
    if (onColorExtracted) {
      onColorExtracted(extractDominantColor(canvasRef.current));
    }
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      onCropped(new File([blob], 'banner.jpg', { type: 'image/jpeg' }));
      setSourceImage(null);
    }, 'image/jpeg', 0.9);
  };

  const needsPan = sourceImage && sourceImage.width / sourceImage.height > ratio;

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium block" style={{ color: 'var(--color-text)' }}>{label}</label>

      {!sourceImage && currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="Current banner" className="w-full h-32 object-cover rounded-lg" />
      )}

      {sourceImage ? (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <canvas ref={canvasRef} className="w-full rounded-lg border" style={{ borderColor: 'var(--color-border)' }} />
            {safeZoneHint && (
              <>
                <div className="absolute inset-y-0 left-0 pointer-events-none rounded-l-lg" style={{ width: '20%', backgroundColor: 'rgba(0,0,0,0.35)' }} />
                <div className="absolute inset-y-0 right-0 pointer-events-none rounded-r-lg" style={{ width: '20%', backgroundColor: 'rgba(0,0,0,0.35)' }} />
              </>
            )}
          </div>
          {safeZoneHint && (
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
              Keep faces and text inside the unshaded middle area — phones crop the shaded edges on the event page.
            </p>
          )}
          {needsPan && (
            <div>
              <label className="text-xs block mb-1" style={{ color: 'var(--color-text-dim)' }}>Pan crop</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={panX}
                onChange={e => setPanX(Number(e.target.value))}
                className="w-full accent-[var(--color-purple)]"
              />
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={confirmCrop} className="text-sm font-medium px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--color-purple)', color: '#fff' }}>
              Use this crop
            </button>
            <button type="button" onClick={() => setSourceImage(null)} className="text-sm px-4 py-2 rounded-lg border" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors hover:border-[var(--color-purple)]" style={{ borderColor: 'var(--color-border)' }}>
          <input ref={fileRef} type="file" className="sr-only" accept="image/*" onChange={e => handleFile(e.target.files?.[0])} />
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}><Upload size={18} /></div>
          <div className="text-center">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{buttonText || 'Click or drag to upload event banner'}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
              Minimum {minWidth}px wide{minHeight ? ` × ${minHeight}px tall` : ''}, max 5MB. You&apos;ll crop it next.
            </p>
          </div>
        </label>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--color-red)' }}>{error}</p>}
    </div>
  );
}
