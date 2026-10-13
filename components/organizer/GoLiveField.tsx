'use client';

import { CalendarClock, Zap } from 'lucide-react';
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
}

/** "Go live now" or "Schedule": when tickets go on sale. */
export function GoLiveField({ scheduled, onScheduledChange, value, onChange, nowLabel = 'As soon as I publish' }: Props) {
  const iso = scheduled ? fromLagosInput(value) : null;
  const option = (active: boolean) => ({
    borderColor: active ? 'var(--color-purple)' : 'var(--color-border)',
    backgroundColor: active ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
    color: active ? 'var(--color-purple-light)' : 'var(--color-text-muted)',
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onScheduledChange(false)}
          className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors" style={option(!scheduled)}>
          <span className="flex items-center gap-1.5"><Zap size={14} />Go live now</span>
          <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>{nowLabel}</span>
        </button>
        <button type="button" onClick={() => onScheduledChange(true)}
          className="rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors" style={option(scheduled)}>
          <span className="flex items-center gap-1.5"><CalendarClock size={14} />Schedule</span>
          <span className="block text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-dim)' }}>Pick a date and time</span>
        </button>
      </div>
      {scheduled && (
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
    </div>
  );
}
