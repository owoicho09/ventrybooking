'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { EventImage } from '@/components/v2/EventImage';

export interface DeckCard {
  id: string;
  href: string;
  name: string;
  location: string;
  badge: string | null;
  images: string[];
}

/** Total time budget for the per-card stagger, spread across however many cards there are. */
const STAGGER_BUDGET_MS = 120;

/**
 * Per-card custom properties for the deck keyframes in app/v2.css, derived
 * only from the card's index and the number of cards — no hardcoded count.
 */
function cardVars(i: number, n: number): React.CSSProperties {
  const mid = (n - 1) / 2;
  const k = mid === 0 ? 0 : (i - mid) / mid;            // -1 … 1 across the fan
  const odd = i % 2 === 1;
  const r = odd ? 4 + (i - 1) * 1.5 : -11 + i * 3;        // alternating resting tilt
  const fyf = odd ? -0.42 : i === 0 ? 0 : 0.5;            // middle cards ride high
  const sign = odd ? -1 : 1;
  return {
    '--i': i,
    '--k': k,
    '--fyf': fyf,
    '--r': `${r}deg`,
    '--os': `${r >= 0 ? 4 : -4}deg`,
    '--fan': `${(i - mid) * 12}deg`,
    // Squared deck: each card sits a hair below and right of the one under it.
    '--cx': `${(i - mid) * 2}px`,
    '--cy': `${(i - mid) * -2}px`,
    // Riffle jitter: every card kicks out at its own angle.
    '--jx': `${sign * (12 + i * 5)}px`,
    '--jy': `${-(6 + i * 3)}px`,
    '--jr': `${sign * (9 + i * 3)}deg`,
    '--stg': `${n > 1 ? Math.min(45, STAGGER_BUDGET_MS / (n - 1)) : 0}ms`,
  } as React.CSSProperties;
}

export function HeroDeck({ cards }: { cards: DeckCard[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const running = useRef(true);   // the server-rendered .deal class starts it on first paint
  const leftView = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      running.current = false;
      return;
    }

    const cardCount = el.querySelectorAll('.v-card-f').length;
    let ended = 0;
    let unlock: ReturnType<typeof setTimeout> | undefined;
    const finish = () => { running.current = false; clearTimeout(unlock); };
    // animationend can be skipped (hidden tab, element not rendered), so a
    // timer unlocks the guard after the sequence's full length regardless.
    const armUnlock = () => { clearTimeout(unlock); unlock = setTimeout(finish, 1800); };
    const onEnd = (e: AnimationEvent) => {
      if (e.animationName !== 'v-deal') return;
      ended += 1;
      if (ended >= cardCount) finish();
    };
    const play = () => {
      if (running.current) return;     // never restart mid-deal
      running.current = true;
      ended = 0;
      el.classList.remove('deal');
      void el.offsetWidth;             // restart the keyframes
      el.classList.add('deal');
      armUnlock();
    };
    armUnlock();                       // covers the initial, server-started deal
    el.addEventListener('animationend', onEnd);

    // Replay when the stack comes back, but only after it has fully left view.
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) leftView.current = true;
        else if (entry.intersectionRatio >= 0.4 && leftView.current) {
          leftView.current = false;
          play();
        }
      }
    }, { threshold: [0, 0.4] });
    io.observe(el);

    const onClick = (e: MouseEvent) => {
      // The caption is the link to the event; everywhere else replays the deal.
      if ((e.target as HTMLElement).closest('a')) return;
      play();
    };
    el.addEventListener('click', onClick);

    return () => {
      io.disconnect();
      clearTimeout(unlock);
      el.removeEventListener('animationend', onEnd);
      el.removeEventListener('click', onClick);
    };
  }, []);

  return (
    <div className="v-stack-hero deal" ref={ref} role="group" aria-label="Recent events on Ventry">
      {cards.map((c, i) => (
        <div key={c.id} className="v-card-f" style={cardVars(i, cards.length)}>
          <EventImage sources={c.images} sizes="(max-width: 560px) 140px, (max-width: 900px) 166px, 222px" priority />
          <Link href={c.href} className="v-cap" aria-label={`${c.name}${c.badge ? `, ${c.badge}` : ''}`}>
            {c.badge && <span className="done">{c.badge}</span>}
            <b>{c.name}</b>
            <i>{c.location}</i>
          </Link>
        </div>
      ))}
    </div>
  );
}
