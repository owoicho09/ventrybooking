import Link from 'next/link';
import { initial } from '@/lib/publicEvents';
import type { PublicOrganizerSummary } from '@/lib/server/publicEvents';

const ORG_GRADIENTS = [
  ['#B45309', '#431407'], ['#7C3AED', '#2E1065'], ['#BE185D', '#4C0519'],
  ['#0F766E', '#042F2E'], ['#1D4ED8', '#0C1838'], ['#9333EA', '#2E1065'],
];

/**
 * Organisers as circular avatars sliding right to left in an infinite
 * marquee, paused on hover/focus. The track is two identical halves (the
 * keyframe moves exactly -50%), each half repeating the list enough times to
 * be wider than the screen, so the loop never shows a gap however few
 * organisers there are. Reduced motion turns it into a static row.
 */
export function OrganiserMarquee({ organisers }: { organisers: PublicOrganizerSummary[] }) {
  if (organisers.length === 0) return null;
  const copies = Math.max(1, Math.ceil(12 / organisers.length));
  const half = Array.from({ length: copies }, () => organisers).flat();

  return (
    <div className="v-omq">
      <div className="v-omq-track" style={{ '--dur': `${Math.max(24, half.length * 3)}s` } as React.CSSProperties}>
        {[0, 1].map(h => half.map((o, i) => {
          const [from, to] = ORG_GRADIENTS[organisers.indexOf(o) % ORG_GRADIENTS.length];
          const duplicate = h === 1 || i >= organisers.length;
          return (
            <Link
              key={`${h}-${i}`}
              className="v-oitem"
              href={`/${o.handle}`}
              aria-hidden={duplicate ? true : undefined}
              tabIndex={duplicate ? -1 : undefined}
            >
              <div className="v-oring">
                <div className="v-oring-in" style={{ background: `linear-gradient(140deg, ${o.accent ?? from}, ${to})` }}>
                  {o.avatarUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={o.avatarUrl} alt="" loading="lazy" />
                    : initial(o.name)}
                </div>
              </div>
              <div className="v-oname">{o.name}{o.verified ? ' ✓' : ''}</div>
              <div className="v-ometa">{[o.city, `${o.events} ${o.events === 1 ? 'event' : 'events'}`].filter(Boolean).join(' · ')}</div>
            </Link>
          );
        }))}
      </div>
    </div>
  );
}
