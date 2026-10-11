import Link from 'next/link';
import { EventImage } from './EventImage';
import { categoryMeta, categoryVars, categoryGradient, ONLINE_META } from '@/lib/categories';
import { eventImages, fmtDay, fmtShortDay, initial, locationLine, outcomeLabel, priceLabel, type PublicEvent } from '@/lib/publicEvents';
import { URGENCY_LABEL } from '@/lib/ticketUrgency';

interface Props {
  event: PublicEvent;
  /** Button label on upcoming cards. */
  cta?: string;
  /** Load the flyer eagerly (first cards above the fold). */
  priority?: boolean;
  sizes?: string;
}

export function CategoryPill({ event, className = 'v-cat' }: { event: Pick<PublicEvent, 'category' | 'eventMode'>; className?: string }) {
  if (event.eventMode === 'online') {
    return <span className={className} style={categoryVars('online')}>{ONLINE_META.label}</span>;
  }
  const meta = categoryMeta(event.category);
  // "Other" says nothing to a buyer, so it gets no pill.
  if (meta.key === 'other') return null;
  return <span className={className} style={categoryVars(meta.key)}>{meta.label}</span>;
}

export function OrgAvatar({ name, avatarUrl, className = 'v-av', style }: { name: string; avatarUrl: string | null; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={className} style={style} aria-hidden="true">
      {avatarUrl
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={avatarUrl} alt="" loading="lazy" />
        : initial(name)}
    </span>
  );
}

export function Stars({ avg, count }: { avg: number; count: number }) {
  const full = Math.round(avg);
  return (
    <span className="v-stars" aria-label={`Rated ${avg} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'}`}>
      {'★'.repeat(full)}{'☆'.repeat(5 - full)}
      <i>{avg.toFixed(1)} from {count} {count === 1 ? 'review' : 'reviews'}</i>
    </span>
  );
}

export function EventCardV2({ event, cta = 'Get tickets', priority = false, sizes = '(max-width: 760px) 50vw, 272px' }: Props) {
  const href = `/${event.slug}`;
  const meta = categoryMeta(event.category);
  const images = eventImages(event);
  const completed = event.status === 'completed';
  const price = priceLabel(event);
  const outcome = completed ? outcomeLabel(event) : null;

  return (
    <article className="v-ev">
      <Link href={href} className="v-ev-link" aria-label={event.name} />
      {/* Category gradient + initial sit underneath, so the slot is never
          blank while the picture loads or if the event has none at all. */}
      <div className="v-ev-img" style={{ background: categoryGradient(event.eventMode === 'online' ? 'online' : meta.key) }}>
        <span className="v-ev-ph" aria-hidden="true">{initial(event.name)}</span>
        <EventImage sources={images} sizes={sizes} priority={priority} />
        {event.organizer.verified && !completed && <span className="v-vfd">✓ Verified</span>}
        {completed
          ? <span className="v-flag muted">{event.soldOut ? 'Sold out' : 'Ended'}</span>
          : event.urgency && (
            <span className="v-flag">
              {event.urgency === 'sold_out' || !event.cheapestOnSale ? URGENCY_LABEL[event.urgency] : `${event.totalAvailable - event.totalSold} left`}
            </span>
          )}
        <CategoryPill event={event} />
      </div>
      <div className="v-ev-body">
        <h3 className="v-ev-t">{event.name}</h3>
        <p className="v-ev-m">
          {completed ? fmtShortDay(event.date) : fmtDay(event.date)}{event.time ? ` · ${event.time}` : ''}
          <br />{locationLine(event)}
        </p>
        {event.organizer.name && (
          <div className="v-org-mini">
            <OrgAvatar name={event.organizer.name} avatarUrl={event.organizer.avatarUrl} />
            {event.organizer.handle
              ? <Link href={`/${event.organizer.handle}`}>{event.organizer.name}</Link>
              : <span>{event.organizer.name}</span>}
          </div>
        )}
        <div className="v-ev-foot-in">
          {completed ? (
            <div>
              {event.rating
                ? <Stars avg={event.rating.avg} count={event.rating.count} />
                : outcome ? <div className="v-price-l" style={{ fontSize: 12 }}>{outcome}</div>
                : <div className="v-price-l" style={{ fontSize: 12 }}>Ticket sales closed</div>}
              {event.rating && outcome && <div className="v-price-l" style={{ marginTop: 2 }}>{outcome}</div>}
            </div>
          ) : price ? (
            <div><div className="v-price-l">{price.label}</div><div className={`v-price${price.free ? ' free' : ''}`}>{price.value}</div></div>
          ) : <div />}
          {!completed && (
            <Link href={href} className="v-btn v-btn-solid" tabIndex={-1}>{event.soldOut ? 'View' : cta}</Link>
          )}
        </div>
      </div>
    </article>
  );
}
