import Link from 'next/link';
import Image from 'next/image';
import { Calendar, MapPin, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatNGN, formatShortDate } from '@/lib/utils';
import type { Event } from '@/types';

interface EventCardProps {
  event: Event;
}

const categoryIcon: Record<string, string> = {
  Concert: '♪',
  'Uni Party': '★',
  Sports: '⬡',
  Theater: '◈',
  Festival: '◉',
  Conference: '◳',
  Other: '◆',
};

const tierColors: Record<string, string> = {
  Elite: 'var(--color-purple)',
  Trusted: 'var(--color-green)',
  Standard: 'var(--color-text-muted)',
};

export function EventCard({ event }: EventCardProps) {
  const minPrice  = event.tiers.length ? Math.min(...event.tiers.map((t) => t.price)) : 0;
  const freeTier  = minPrice === 0 ? (event.tiers.find(t => t.price === 0) ?? null) : null;

  return (
    <div
      className="rounded-xl border overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}
    >
      {/* Banner */}
      <div className={`relative h-40 bg-gradient-to-br ${event.bannerColor} flex items-center justify-center overflow-hidden`}>
        {event.banner_url ? (
          <Image
            src={event.banner_url}
            alt={event.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <span className="text-4xl opacity-30 select-none">{categoryIcon[event.category] ?? '◆'}</span>
        )}

        {/* Verified badge */}
        {event.organizer.verified && (
          <div className="absolute top-3 left-3 z-10">
            <span
              className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
              style={{
                backgroundColor: '#10b981cc',
                color: '#fff',
              }}
            >
              <CheckCircle size={11} />
              Ventry Verified
            </span>
          </div>
        )}

        {/* Status badge */}
        {event.badge === 'selling_fast' && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="amber">SELLING FAST</Badge>
          </div>
        )}
        {event.badge === 'limited' && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="red">
              {event.tiers.reduce((sum, t) => sum + (t.available - t.sold), 0)} LEFT
            </Badge>
          </div>
        )}
        {event.badge === 'sold_out' && (
          <div className="absolute top-3 right-3 z-10">
            <Badge variant="gray">SOLD OUT</Badge>
          </div>
        )}

        {/* Category tag */}
        <div className="absolute bottom-3 left-3 z-10">
          <span
            className="px-2 py-0.5 rounded text-xs font-medium"
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            {event.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div>
          <h3
            className="font-semibold text-base leading-snug mb-1"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-syne), sans-serif' }}
          >
            {event.name}
          </h3>

          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <Calendar size={12} className="flex-shrink-0" />
              {formatShortDate(event.date)} &middot; {event.time}
            </div>
            <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <MapPin size={12} className="flex-shrink-0" />
              {event.venue}, {event.city}
            </div>
          </div>
        </div>

        {/* Organizer */}
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ backgroundColor: 'var(--color-purple)' }}
          >
            {event.organizer.name[0]}
          </div>
          <span className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
            {event.organizer.name}
          </span>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded ml-auto"
            style={{
              color: tierColors[event.organizer.tier],
              backgroundColor: `${tierColors[event.organizer.tier]}18`,
            }}
          >
            {event.organizer.tier}
          </span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            {freeTier ? (
              <>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>{freeTier.name}</p>
                <p className="text-base font-bold" style={{ color: 'var(--color-green)' }}>Free</p>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>From</p>
                <p className="text-base font-bold" style={{ color: 'var(--color-text)' }}>{formatNGN(minPrice)}</p>
              </>
            )}
          </div>
          <Link href={`/events/${event.id}`}>
            <Button size="sm">Get Tickets</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
