'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

// The fixed hero banner spans the full viewport width at a fixed height
// (25vh) — a wide strip, not a standard photo ratio. 3:1 is a reasonable
// fixed crop target for that: wide enough to read as a strip, not so
// extreme that organizers struggle to find or shoot a matching source image.
const CROP_RATIO = 3;
const MIN_SOURCE_WIDTH = 1200;

interface BannerCropInputProps {
  label: string;
  currentUrl?: string | null;
  onCropped: (file: File) => void;
  buttonText?: string;
}

/**
 * Upload + fixed-aspect-ratio crop control for the event hero banner.
 * Rejects sources narrower than MIN_SOURCE_WIDTH. Organizer picks which
 * horizontal slice of a wider source to keep (vertical framing matters most
 * for a short, wide strip — this keeps the interaction simple: one slider,
 * not a full drag-resize crop box) so header text near the top isn't cut
 * off by the hero's dark gradient scrim.
 */
export function BannerCropInput({ label, currentUrl, onCropped, buttonText }: BannerCropInputProps) {
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
      if (img.width < MIN_SOURCE_WIDTH) {
        setError(`Image is ${img.width}px wide — please upload one at least ${MIN_SOURCE_WIDTH}px wide.`);
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

    const outW = 1200;
    const outH = Math.round(outW / CROP_RATIO);
    canvas.width = outW;
    canvas.height = outH;

    const srcRatio = sourceImage.width / sourceImage.height;
    // Crop height = full source height (or as much as fits); crop width is
    // whatever keeps CROP_RATIO given that height, clamped to source width.
    let cropH = sourceImage.height;
    let cropW = cropH * CROP_RATIO;
    if (cropW > sourceImage.width) {
      cropW = sourceImage.width;
      cropH = cropW / CROP_RATIO;
    }
    const maxX = sourceImage.width - cropW;
    const srcX = maxX * panX;
    const srcY = (sourceImage.height - cropH) / 2;

    ctx.clearRect(0, 0, outW, outH);
    ctx.drawImage(sourceImage, srcX, srcY, cropW, cropH, 0, 0, outW, outH);
    void srcRatio;
  }, [sourceImage, panX]);

  const confirmCrop = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      onCropped(new File([blob], 'banner.jpg', { type: 'image/jpeg' }));
      setSourceImage(null);
    }, 'image/jpeg', 0.9);
  };

  const needsPan = sourceImage && sourceImage.width / sourceImage.height > CROP_RATIO;

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium block" style={{ color: 'var(--color-text)' }}>{label}</label>

      {!sourceImage && currentUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="Current banner" className="w-full h-32 object-cover rounded-lg" />
      )}

      {sourceImage ? (
        <div className="flex flex-col gap-3">
          <canvas ref={canvasRef} className="w-full rounded-lg border" style={{ borderColor: 'var(--color-border)' }} />
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
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Minimum {MIN_SOURCE_WIDTH}px wide, max 5MB. You&apos;ll crop it to a wide banner strip next.</p>
          </div>
        </label>
      )}

      {error && <p className="text-xs" style={{ color: 'var(--color-red)' }}>{error}</p>}
    </div>
  );
}
