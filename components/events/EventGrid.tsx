import { EventCard } from './EventCard';
import type { Event } from '@/types';

interface EventGridProps {
  events: Event[];
}

export function EventGrid({ events }: EventGridProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-lg font-medium" style={{ color: 'var(--color-text-muted)' }}>
          No events found
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-dim)' }}>
          Try adjusting your filters
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
