'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Up to 3 event flyers (061), swiped sideways like a multi-photo post.
 * Two seconds after the page opens it peeks at the next flyer and springs
 * back, so visitors can see there's more to swipe. The peek runs once,
 * never after the visitor has touched it, and not at all for people who
 * prefer reduced motion.
 */
export function FlyerCarousel({ urls, alt, onSlideChange }: {
  urls: string[];
  alt: string;
  /** Lets the page tint its blurred backdrop with the flyer on show. */
  onSlideChange?: (url: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const [index, setIndex] = useState(0);
  const [ratio, setRatio] = useState<number | null>(null);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const next = Math.max(0, Math.min(urls.length - 1, i));
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
  }, [urls.length]);

  // Track the slide in view.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        setIndex(cur => (cur === i ? cur : i));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => { if (urls[index]) onSlideChange?.(urls[index]); }, [index, urls, onSlideChange]);

  // The peek: nudge right ~22% of a flyer, then spring back.
  useEffect(() => {
    if (urls.length < 2) return;
    let reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* old browser */ }
    if (reduce) return;
    let back: ReturnType<typeof setTimeout> | undefined;
    const t = setTimeout(() => {
      const el = trackRef.current;
      if (!el || touched.current || el.scrollLeft > 4) return;
      el.scrollTo({ left: el.clientWidth * 0.22, behavior: 'smooth' });
      back = setTimeout(() => {
        if (!touched.current) el.scrollTo({ left: 0, behavior: 'smooth' });
      }, 650);
    }, 2000);
    return () => { clearTimeout(t); if (back) clearTimeout(back); };
  }, [urls.length]);

  const markTouched = () => { touched.current = true; };

  if (urls.length === 0) return null;

  return (
    <div className="v-fc" style={ratio ? { aspectRatio: String(ratio) } : undefined}
      role="region" aria-roledescription="carousel" aria-label={`${alt}, ${urls.length} flyers`}>
      <div className="v-fc-track" ref={trackRef} tabIndex={0}
        onPointerDown={markTouched} onTouchStart={markTouched} onWheel={markTouched}
        onKeyDown={e => {
          if (e.key === 'ArrowRight') { markTouched(); e.preventDefault(); goTo(index + 1); }
          if (e.key === 'ArrowLeft') { markTouched(); e.preventDefault(); goTo(index - 1); }
        }}>
        {urls.map((u, i) => (
          <div className="v-fc-slide" key={u + i} aria-roledescription="slide" aria-label={`${i + 1} of ${urls.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={i === 0 ? alt : `${alt} (${i + 1} of ${urls.length})`}
              fetchPriority={i === 0 ? 'high' : 'auto'} loading={i === 0 ? 'eager' : 'lazy'} draggable={false}
              onLoad={i === 0 ? e => {
                const im = e.currentTarget;
                // The first flyer sets the frame; taller/wider ones letterbox inside it.
                if (im.naturalWidth && im.naturalHeight) setRatio(Math.min(1.25, Math.max(0.5, im.naturalWidth / im.naturalHeight)));
              } : undefined} />
          </div>
        ))}
      </div>
      {urls.length > 1 && (
        <>
          <button type="button" className="v-fc-nav prev" aria-label="Previous flyer" disabled={index === 0}
            onClick={() => { markTouched(); goTo(index - 1); }}><ChevronLeft size={18} /></button>
          <button type="button" className="v-fc-nav next" aria-label="Next flyer" disabled={index === urls.length - 1}
            onClick={() => { markTouched(); goTo(index + 1); }}><ChevronRight size={18} /></button>
          <div className="v-fc-dots" aria-hidden="true">
            {urls.map((u, i) => <span key={u + i} className={i === index ? 'on' : undefined} />)}
          </div>
          <span className="v-fc-count" aria-live="polite">{index + 1}/{urls.length}</span>
        </>
      )}
    </div>
  );
}
