'use client';

import { FEE_SPLITS, feeRatesFor, pct, type FeeSplit } from '@/lib/feeSplit';
import { serviceFeePerTicket } from '@/lib/fees';
import { formatNGN } from '@/lib/utils';

/**
 * Who pays Ventry's 5% (062). Each option shows what a buyer pays and what
 * the organiser receives for an example ticket, using the organiser's own
 * rate (any discount comes off their share).
 */
export function FeeSplitField({
  value, onChange, organizerRate, examplePrice, disabled = false, lockedReason,
}: {
  value: FeeSplit;
  onChange: (v: FeeSplit) => void;
  organizerRate?: number | null;
  /** A tier price to illustrate with; defaults to ₦10,000. */
  examplePrice?: number;
  disabled?: boolean;
  lockedReason?: string;
}) {
  const price = examplePrice && examplePrice > 0 ? examplePrice : 10_000;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>Who pays the Ventry fee?</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
          Ventry&apos;s fee is 5% of the ticket price. Choose who pays it. The buyer&apos;s share is added at checkout; your share comes off your payout.
          Card processing is always paid by the buyer. Example below: a {formatNGN(price)} ticket.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" role="radiogroup" aria-label="Who pays the Ventry fee">
        {FEE_SPLITS.map(opt => {
          const rates = feeRatesFor(opt.value, organizerRate);
          const buyerPays = price + serviceFeePerTicket(price, rates.buyer);
          const youGet = price - Math.round(price * rates.host);
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
              <span className="block text-sm font-medium" style={{ color: on ? 'var(--color-purple-light)' : 'var(--color-text)' }}>{opt.label}</span>
              <span className="block text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Buyer {pct(rates.buyer)} · You {pct(rates.host)}
              </span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-dim)' }}>
                Buyer pays {formatNGN(buyerPays)} · you get {formatNGN(youGet)}
              </span>
            </button>
          );
        })}
      </div>
      {disabled && lockedReason && <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{lockedReason}</p>}
    </div>
  );
}
