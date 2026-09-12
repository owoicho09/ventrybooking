'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { extractDominantColor } from '@/lib/colorExtract';
import { compressImageFile } from '@/lib/compressImage';

interface FlyerUploadInputProps {
  label: string;
  currentUrl?: string | null;
  onFile: (file: File) => void;
  buttonText?: string;
  /** Minimum source image width accepted, in px. Defaults to 800. */
  minWidth?: number;
  /** Fires with a dominant colour sampled from the flyer, or null if nothing vivid enough was found. */
  onColorExtracted?: (hex: string | null) => void;
}

/**
 * Flyer upload — no forced crop. A flyer is a poster the organiser already
 * designed at whatever aspect ratio they chose (almost always portrait), so
 * unlike BannerCropInput (built for the wide, fixed-ratio header banner) this
 * just accepts the image as-is, downsized/compressed for upload size, and
 * previews it at its own natural shape.
 */
export function FlyerUploadInput({
  label,
  currentUrl,
  onFile,
  buttonText,
  minWidth = 800,
  onColorExtracted,
}: FlyerUploadInputProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      if (img.width < minWidth) {
        setError(`Image is ${img.width}px wide — please upload one at least ${minWidth}px wide.`);
        URL.revokeObjectURL(url);
        return;
      }

      if (onColorExtracted) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          onColorExtracted(extractDominantColor(canvas));
        }
      }

      setPreview(url);
      onFile(await compressImageFile(file));
    };
    img.onerror = () => {
      setError('Could not read that image file.');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium block" style={{ color: 'var(--color-text)' }}>{label}</label>

      {(preview || currentUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview || currentUrl || ''} alt="Flyer preview" className="max-w-[220px] w-full h-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }} />
      )}

      <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors hover:border-[var(--color-purple)]" style={{ borderColor: 'var(--color-border)' }}>
        <input ref={fileRef} type="file" className="sr-only" accept="image/*" onChange={e => handleFile(e.target.files?.[0])} />
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}><Upload size={18} /></div>
        <div className="text-center">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{buttonText || 'Click or drag to upload event flyer'}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
            Minimum {minWidth}px wide. Shown as-is, at its own size — no cropping.
          </p>
        </div>
      </label>

      {error && <p className="text-xs" style={{ color: 'var(--color-red)' }}>{error}</p>}
    </div>
  );
}
