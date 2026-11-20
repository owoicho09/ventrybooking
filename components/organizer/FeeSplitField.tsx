'use client';

import { FEE_SPLITS, feeRatesFor, type FeeSplit } from '@/lib/feeSplit';
import { ticketPriceWithService } from '@/lib/fees';
import { formatNGN } from '@/lib/utils';

/**
 * Who pays Ventry's 5% (062). One choice for the whole event, applied to
 * every tier. Under the options, a live line per tier shows what a buyer
 * pays and what the organiser receives at the chosen split. Every option
 * totals exactly 5%.
 */
export function FeeSplitField({
  value, onChange, organizerRate, tiers, disabled = false, lockedReason,
}: {
  value: FeeSplit;
  onChange: (v: FeeSplit) => void;
  organizerRate?: number | null;
  /** The event's tiers as currently entered; the preview follows them. */
  tiers: { name: string; price: number }[];
  disabled?: boolean;
  lockedReason?: string;
}) {
  const rates = feeRatesFor(value, organizerRate);
  const paid = tiers.filter(t => Number.isFinite(t.price) && t.price > 0);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Fee split</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
          Ventry&apos;s fee is 5% of the ticket price. Choose who pays it; this applies to every tier. The buyer&apos;s
          share is included in the price they see; your share comes off your payout. Card processing is always paid by
          the buyer. You can&apos;t change this once a ticket sells.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Fee split">
        {FEE_SPLITS.map(opt => {
          const on = value === opt.value;
          return (
            <button key={opt.value} type="button" role="radio" aria-checked={on} disabled={disabled}
              onClick={() => onChange(opt.value)}
              className="rounded-lg border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed"
              style={{
                borderColor: on ? 'var(--color-purple)' : 'var(--color-border)',
                backgroundColor: on ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
                opacity: disabled && !on ? 0.5 : 1,
              }}>
              <span className="block text-sm font-medium" style={{ color: on ? 'var(--color-purple-light)' : 'var(--color-text)' }}>
                {opt.label}{opt.value === 'host3_buyer2' ? ' (default)' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border px-3.5 py-3 flex flex-col gap-1.5" aria-live="polite"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
        <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>Preview per ticket</p>
        {paid.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Add a tier price to see what buyers pay and what you receive.</p>
        ) : paid.map((t, i) => (
          <p key={`${t.name}-${i}`} className="text-xs flex flex-wrap justify-between gap-x-3" style={{ color: 'var(--color-text-muted)' }}>
            <span style={{ color: 'var(--color-text)' }}>{t.name.trim() || `Tier ${i + 1}`} ({formatNGN(t.price)})</span>
            <span>
              Buyer pays {formatNGN(ticketPriceWithService(t.price, rates.buyer))} · You receive {formatNGN(t.price - t.price * rates.host)}
            </span>
          </p>
        ))}
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
          The buyer also pays a card processing fee at checkout.
        </p>
      </div>
      {disabled && lockedReason && <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{lockedReason}</p>}
    </div>
  );
}
