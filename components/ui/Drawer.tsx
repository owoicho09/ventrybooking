'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: string;
}

export function Drawer({ open, onClose, title, children, width = '480px' }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    // overflow:hidden alone doesn't stop rubber-band scrolling on iOS Safari,
    // which lets touch drags scroll the page behind the drawer. Pinning the
    // body via position:fixed blocks that, and we restore the scroll
    // position on close.
    const scrollY = window.scrollY;
    const body = document.body;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      overflow: body.style.overflow,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.overflow = 'hidden';
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Drawer panel — z-[60] beats AdminBottomNav's z-50 fixed bar, which
          otherwise paints on top of (and intercepts touches on) the bottom
          of the drawer since it's later in the DOM at the same z-index. */}
      <div
        className={`fixed top-0 right-0 h-full z-[60] border-l flex flex-col shadow-2xl transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
        style={{
          width: `min(${width}, 100vw)`,
          maxWidth: '100vw',
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {title && (
          <div
            className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b flex-shrink-0"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h2 className="min-w-0 text-base font-semibold truncate" style={{ color: 'var(--color-text)' }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-md transition-colors"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div
          className="flex-1 min-w-0 overflow-y-auto p-4 sm:p-6"
          style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
