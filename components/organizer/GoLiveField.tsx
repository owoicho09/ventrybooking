'use client';

import { CalendarClock, Zap, PauseCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { fmtGoLive, fromLagosInput } from '@/lib/goLive';

interface Props {
  /** Schedule a time instead of going live now. */
  scheduled: boolean;
  onScheduledChange: (v: boolean) => void;
  /** datetime-local value, Nigeria time. */
  value: string;
  onChange: (v: string) => void;
  /** Labels the "now" option for an event that's already been listed. */
  nowLabel?: string;
  /** "Keep it inactive until I turn it on". Shown only when a handler is given. */
  inactive?: boolean;
  onInactiveChange?: (v: boolean) => void;
  /** Labels the inactive option. */
  inactiveLabel?: string;
}

/** "Go live now", "Schedule" or "Keep inactive": when tickets go on sale. */
export function GoLiveField({
  scheduled, onScheduledChange, value, onChange, nowLabel = 'As soon as I publish',
  inactive = false, onInactiveChange, inactiveLabel = 'Hidden until I make it active',
}: Props) {
  const withInactive = !!onInactiveChange;
  const isInactive = withInactive && inactive;
  const isScheduled = !isInactive && scheduled;
  const isNow = !isInactive && !scheduled;
  const iso = isScheduled ? fromLagosInput(value) : null;
  const option = (active: boolean) => ({
    borderColor: active ? 'var(--color-purple)' : 'var(--color-border)',
    backgroundColor: active ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
    color: active ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
  });
  const pick = (mode: 'now' | 'schedule' | 'inactive') => {
    onInactiveChange?.(mode === 'inactive');
    onScheduledChange(mode === 'schedule');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={`grid gap-3 ${withInactive ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
        <button type="button" onClick={() => pick('now')}
          className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors" style={option(isNow)}>
          <span className="flex items-center gap-1.5"><Zap size={14} />Go live now</span>
          <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>{nowLabel}</span>
        </button>
        <button type="button" onClick={() => pick('schedule')}
          className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors" style={option(isScheduled)}>
          <span className="flex items-center gap-1.5"><CalendarClock size={14} />Schedule</span>
          <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Pick a date and time</span>
        </button>
        {withInactive && (
          <button type="button" onClick={() => pick('inactive')}
            className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors" style={option(isInactive)}>
            <span className="flex items-center gap-1.5"><PauseCircle size={14} />Keep inactive</span>
            <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>{inactiveLabel}</span>
          </button>
        )}
      </div>
      {isScheduled && (
        <>
          <Input
            label="Tickets go on sale at"
            type="datetime-local"
            value={value}
            onChange={e => onChange(e.target.value)}
            helper="Nigeria time. You can move this as often as you like until it goes live."
            required
          />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
            {iso ? <>Your event stays hidden until <strong style={{ color: 'var(--color-text)' }}>{fmtGoLive(iso)}</strong>, then goes on sale automatically and we email you that it&apos;s live.</>
              : 'Your event stays hidden until then, goes on sale automatically, and we email you when it’s live.'}
          </p>
        </>
      )}
      {isInactive && (
        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-dim)' }}>
          Your event page stays hidden and no tickets can be bought, even after it&apos;s approved. Make it active any time from the event page by choosing <strong style={{ color: 'var(--color-text)' }}>Go live now</strong>.
        </p>
      )}
    </div>
  );
}
