'use client';

import Link from 'next/link';
import {
  REFUND_QUESTIONS, MINIMUM_STANDARDS, describeRefundPolicy, parseRefundPolicy,
} from '@/lib/refundPolicy';

/** Form-side draft: every answer optional until the organiser picks one. */
export interface RefundPolicyDraft {
  cancelDays?: string;
  postponement?: string;
  venueChange?: string;
  guestNoShow?: string;
  contactEmail?: string;
}

interface Props {
  value: RefundPolicyDraft;
  onChange: (next: RefundPolicyDraft) => void;
  /** The organiser's display name, used in the generated preview. */
  organizerName: string;
  /** "I confirm" tick, required before publishing. */
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
  /** When set, the answers can't be changed (e.g. tickets already sold). */
  lockedReason?: string | null;
}

function Choice({
  name, question, options, value, onPick, disabled,
}: {
  name: string;
  question: string;
  options: readonly { value: string; label: string }[];
  value?: string;
  onPick: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>{question}</legend>
      {options.map(o => {
        const on = value === o.value;
        return (
          <label
            key={o.value}
            className="flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm cursor-pointer transition-colors"
            style={{
              borderColor: on ? 'var(--color-purple)' : 'var(--color-border)',
              backgroundColor: on ? 'var(--color-purple-dim)' : 'var(--color-surface-2)',
              color: on ? 'var(--color-text)' : 'var(--color-text-muted)',
              opacity: disabled ? 0.7 : 1,
            }}
          >
            <input type="radio" name={name} value={o.value} checked={on} onChange={() => onPick(o.value)} className="mt-0.5 accent-[var(--color-purple)]" />
            {o.label}
          </label>
        );
      })}
    </fieldset>
  );
}

/**
 * The five refund questions from the Refund Policy (§5.2). The published
 * policy is generated from the answers and previewed live underneath, so the
 * organiser sees exactly what buyers will read before confirming.
 */
export function RefundPolicyFields({ value, onChange, organizerName, confirmed, onConfirmedChange, lockedReason }: Props) {
  const set = (k: keyof RefundPolicyDraft) => (v: string) => onChange({ ...value, [k]: v });
  const parsed = parseRefundPolicy(value);
  const locked = !!lockedReason;

  return (
    <div className="flex flex-col gap-6">
      {locked && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-surface-2)', color: 'var(--color-text-muted)' }}>
          {lockedReason}
        </p>
      )}

      <Choice name="cancelDays" question={`1. ${REFUND_QUESTIONS.cancelDays.question}`} options={REFUND_QUESTIONS.cancelDays.options}
        value={value.cancelDays} onPick={set('cancelDays')} disabled={locked} />
      <Choice name="postponement" question={`2. ${REFUND_QUESTIONS.postponement.question}`} options={REFUND_QUESTIONS.postponement.options}
        value={value.postponement} onPick={set('postponement')} disabled={locked} />
      <Choice name="venueChange" question={`3. ${REFUND_QUESTIONS.venueChange.question}`} options={REFUND_QUESTIONS.venueChange.options}
        value={value.venueChange} onPick={set('venueChange')} disabled={locked} />
      <Choice name="guestNoShow" question={`4. ${REFUND_QUESTIONS.guestNoShow.question}`} options={REFUND_QUESTIONS.guestNoShow.options}
        value={value.guestNoShow} onPick={set('guestNoShow')} disabled={locked} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="refund-contact" className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          5. {REFUND_QUESTIONS.contactEmail.question}
        </label>
        <input
          id="refund-contact"
          type="email"
          value={value.contactEmail ?? ''}
          onChange={e => set('contactEmail')(e.target.value)}
          disabled={locked}
          placeholder="refunds@yourbrand.com"
          className="rounded-lg border px-3 py-2.5 text-sm outline-none focus:border-[var(--color-purple)] disabled:opacity-70"
          style={{ backgroundColor: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        />
        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{REFUND_QUESTIONS.contactEmail.hint}</p>
      </div>

      <div className="rounded-lg border p-4 flex flex-col gap-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-2)' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>What buyers will see</p>
          <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Generated from your answers. Shown on your event page and at checkout.</p>
        </div>
        {parsed.ok ? (
          <ul className="flex flex-col gap-2">
            {describeRefundPolicy(parsed.value, organizerName).map(s => (
              <li key={s.title} className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                <strong style={{ color: 'var(--color-text)' }}>{s.title}:</strong> {s.text}
              </li>
            ))}
            <li className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <strong style={{ color: 'var(--color-text)' }}>Refund questions:</strong> {parsed.value.contactEmail}
            </li>
          </ul>
        ) : (
          <p className="text-sm" style={{ color: 'var(--color-text-dim)' }}>{parsed.error}.</p>
        )}
        <div className="border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text)' }}>Always applies, whatever you choose:</p>
          <ul className="list-disc pl-4 flex flex-col gap-1">
            {MINIMUM_STANDARDS.map(m => <li key={m} className="text-xs" style={{ color: 'var(--color-text-dim)' }}>{m}</li>)}
            <li className="text-xs" style={{ color: 'var(--color-text-dim)' }}>You refund the full base ticket price on every valid claim. Partial refunds on cancellation aren&apos;t allowed.</li>
          </ul>
        </div>
      </div>

      {!locked && (
        <label className="flex items-start gap-3 text-sm cursor-pointer" style={{ color: 'var(--color-text)' }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => onConfirmedChange(e.target.checked)}
            className="mt-0.5 w-4 h-4 flex-shrink-0 accent-[var(--color-purple)]"
          />
          <span>
            I confirm this is my refund policy for this event, and that I will pay valid refund claims as described above and in
            the <Link href="/terms/organisers" target="_blank" className="underline">Organiser Terms</Link>.
          </span>
        </label>
      )}
    </div>
  );
}
