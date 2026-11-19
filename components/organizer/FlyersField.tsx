'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, RefreshCw, Star, Trash2 } from 'lucide-react';
import { extractDominantColor } from '@/lib/colorExtract';
import { compressImageFile } from '@/lib/compressImage';

export const MAX_FLYERS = 3;
const MIN_WIDTH = 800;

export interface FlyerItem {
  /** Stable key for React. */
  key: string;
  /** Object URL (unsaved file) or public URL (saved flyer). */
  src: string;
}

/**
 * Up to 3 flyers (061) with the order the organiser wants. The first one is
 * the main flyer: it's on event cards, ticket emails and share previews, and
 * opens the swipeable flyers on the event page.
 *
 * Used both while creating an event (local files) and on the event page
 * (saved flyers); the parent decides what add/replace/remove/move do.
 */
export function FlyersField({
  items, onAdd, onReplace, onRemove, onMove, onColorExtracted, busy = false, label = 'Event Flyers',
}: {
  items: FlyerItem[];
  onAdd: (file: File) => void | Promise<void>;
  onReplace: (index: number, file: File) => void | Promise<void>;
  onRemove: (index: number) => void | Promise<void>;
  onMove: (from: number, to: number) => void | Promise<void>;
  /** Fires for the main flyer only, to suggest an accent colour. */
  onColorExtracted?: (hex: string | null) => void;
  busy?: boolean;
  label?: string;
}) {
  const [error, setError] = useState('');

  /** Size check + compression, same as the single-flyer input. */
  const prepare = (file: File | undefined, sampleColor: boolean) => new Promise<File | null>(resolve => {
    if (!file) return resolve(null);
    setError('');
    if (!file.type.startsWith('image/')) { setError('Flyers must be images.'); return resolve(null); }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      if (img.width < MIN_WIDTH) {
        setError(`That image is ${img.width}px wide. Please use one at least ${MIN_WIDTH}px wide.`);
        URL.revokeObjectURL(url);
        return resolve(null);
      }
      if (sampleColor && onColorExtracted) {
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const ctx = c.getContext('2d');
        if (ctx) { ctx.drawImage(img, 0, 0); onColorExtracted(extractDominantColor(c)); }
      }
      URL.revokeObjectURL(url);
      resolve(await compressImageFile(file));
    };
    img.onerror = () => { setError('Could not read that image file.'); URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

  const btn = 'w-7 h-7 rounded-md flex items-center justify-center disabled:opacity-30';
  const btnStyle = { backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-sm font-medium block" style={{ color: 'var(--color-text)' }}>{label}</label>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
          Up to {MAX_FLYERS}. The first is your main flyer (event cards, ticket emails, link previews). With more than one,
          buyers can swipe through them on your event page. Use the arrows to choose the order.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-md">
        {items.map((it, i) => (
          <div key={it.key} className="flex flex-col gap-1.5">
            <div className="relative rounded-lg overflow-hidden border aspect-[4/5]"
              style={{ borderColor: i === 0 ? 'var(--color-purple)' : 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.src} alt={`Flyer ${i + 1}`} className="w-full h-full object-contain" />
              <span className="absolute top-1 left-1 text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1"
                style={{ backgroundColor: i === 0 ? 'var(--color-purple)' : 'rgba(0,0,0,.55)', color: '#fff' }}>
                {i === 0 ? <><Star size={9} />Main</> : i + 1}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className={btn} style={btnStyle} disabled={busy || i === 0} title="Move left" aria-label={`Move flyer ${i + 1} left`}
                onClick={() => onMove(i, i - 1)}><ArrowLeft size={12} /></button>
              <button type="button" className={btn} style={btnStyle} disabled={busy || i === items.length - 1} title="Move right" aria-label={`Move flyer ${i + 1} right`}
                onClick={() => onMove(i, i + 1)}><ArrowRight size={12} /></button>
              <label className={`${btn} cursor-pointer`} style={btnStyle} title="Replace" aria-label={`Replace flyer ${i + 1}`}>
                <input type="file" accept="image/*" className="sr-only" disabled={busy}
                  onChange={async e => { const f = await prepare(e.target.files?.[0], i === 0); e.target.value = ''; if (f) await onReplace(i, f); }} />
                <RefreshCw size={12} />
              </label>
              <button type="button" className={btn} style={{ ...btnStyle, color: 'var(--color-red)' }} disabled={busy} title="Remove" aria-label={`Remove flyer ${i + 1}`}
                onClick={() => onRemove(i)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))}

        {items.length < MAX_FLYERS && (
          <label className="rounded-lg border-2 border-dashed aspect-[4/5] flex flex-col items-center justify-center gap-1.5 text-center px-2 cursor-pointer transition-colors hover:border-[var(--color-purple)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', opacity: busy ? 0.5 : 1 }}>
            <input type="file" accept="image/*" className="sr-only" disabled={busy}
              onChange={async e => { const f = await prepare(e.target.files?.[0], items.length === 0); e.target.value = ''; if (f) await onAdd(f); }} />
            <ImagePlus size={18} />
            <span className="text-xs">{items.length === 0 ? 'Add your flyer' : 'Add another flyer'}</span>
            <span className="text-[10px]" style={{ color: 'var(--color-text-dim)' }}>min {MIN_WIDTH}px wide</span>
          </label>
        )}
      </div>

      {busy && <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Saving…</p>}
      {error && <p className="text-xs" style={{ color: 'var(--color-red)' }}>{error}</p>}
    </div>
  );
}
