'use client';

import '@/app/v2.css';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { EventDetailContent, type DetailEvent } from '@/components/events/EventDetailContent';
import { useTheme } from '@/components/layout/ThemeProvider';

/**
 * Full-screen preview of an event page, built from the organiser's unsaved
 * form, so they can check their flyer, banner and accent colour in both light
 * and dark mode before the event goes live. Checkout and sharing are off.
 */
export function EventPreview({ event, onClose }: { event: DetailEvent; onClose: () => void }) {
  const { theme: siteTheme } = useTheme();
  const [theme, setTheme] = useState<'light' | 'dark'>(siteTheme);
  const [root, setRoot] = useState<HTMLDivElement | null>(null);

  // Lock the page behind the overlay and close on Escape.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="v-preview" ref={setRoot} role="dialog" aria-modal="true" aria-label="Event page preview">
      <EventDetailContent preview={{ event, theme, onClose, scrollRoot: root }} />
      <div className="v-preview-bar">
        <span className="lab">Preview · not live</span>
        <div className="seg" role="group" aria-label="Preview theme">
          <button type="button" className={theme === 'light' ? 'on' : undefined} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
          <button type="button" className={theme === 'dark' ? 'on' : undefined} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
        </div>
        <button type="button" className="close" onClick={onClose}>Back to editing</button>
      </div>
    </div>,
    document.body,
  );
}
