'use client';

import { useEffect, useRef } from 'react';

const fmt = (n: number) => '₦' + Math.round(n).toLocaleString('en-NG');

/**
 * Pinned full-height section: the settled figure counts up with scroll
 * progress through the section, and the three stat cards reveal in turn.
 * One passive scroll listener, coalesced to a single rAF per frame, writing
 * only textContent and a class — no layout reads beyond one rect per frame.
 */
export function SettlementScrub({ total, id }: { total: number; id?: string }) {
  const sectionRef = useRef<HTMLElement>(null);
  const figRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const fig = figRef.current;
    const cards = cardsRef.current ? Array.from(cardsRef.current.children) as HTMLElement[] : [];
    if (!section || !fig) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      fig.textContent = fmt(total);
      cards.forEach(c => c.classList.add('in'));
      return;
    }

    let ticking = false;
    // Progress only ever moves forward: once the figure has counted up it
    // stays put when the reader scrolls back, instead of rewinding to ₦0.
    let shown = 0;
    const update = () => {
      ticking = false;
      const r = section.getBoundingClientRect();
      const span = section.offsetHeight - window.innerHeight;
      const p = Math.max(shown, span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 1);
      if (p === shown && p > 0) return;
      shown = p;
      // Ease out so the figure lands rather than stops dead.
      const eased = 1 - Math.pow(1 - Math.min(1, p / 0.75), 3);
      fig.textContent = fmt(total * eased);
      cards.forEach((c, i) => { if (p >= 0.28 + i * 0.18) c.classList.add('in'); });
    };
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [total]);

  return (
    <section className="v-scrub" ref={sectionRef} id={id} aria-label="Settled to organisers">
      <div className="v-scrub-pin">
        <div className="v-scrub-in">
          <div className="v-scrub-lab">Settled to organisers so far</div>
          {/* Server-rendered with the real figure so it's correct without JS. */}
          <div className="v-scrub-fig" ref={figRef} aria-live="off">{fmt(total)}</div>
          <p className="v-scrub-sub">
            Every working day&apos;s sales go out the next working day. No waiting until after the event, no holding your money back.
          </p>
          <div className="v-scrub-cards" ref={cardsRef}>
            <div className="v-sc"><div className="l">You keep</div><div className="v">97%</div><div className="v-bar"><i style={{ '--w': '97%' } as React.CSSProperties} /></div></div>
            <div className="v-sc"><div className="l">Time to payout</div><div className="v">1 working day</div><div className="v-bar"><i style={{ '--w': '18%' } as React.CSSProperties} /></div></div>
            <div className="v-sc"><div className="l">Cost to list</div><div className="v">₦0</div><div className="v-bar"><i style={{ '--w': '0%' } as React.CSSProperties} /></div></div>
          </div>
        </div>
      </div>
    </section>
  );
}
