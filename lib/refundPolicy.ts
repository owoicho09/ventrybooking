// The organiser-published refund policy (Refund Policy v3 §5, Organiser
// Terms §4.4). The organiser answers five questions; everything else is a
// fixed platform minimum. Shared by the create/edit forms, the API
// (validation) and the event page / checkout (rendering).

export type CancelDays = 7 | 14 | 30;
export type PostponementChoice = 'refund_all' | 'refund_on_request' | 'no_refund';
export type YesNoRefund = 'refund_on_request' | 'no_refund';

export interface RefundPolicyAnswers {
  version: 1;
  cancelDays: CancelDays;
  postponement: PostponementChoice;
  venueChange: YesNoRefund;
  guestNoShow: YesNoRefund;
  contactEmail: string;
}

export const REFUND_QUESTIONS = {
  cancelDays: {
    question: 'If you cancel, how long after receiving the claim list will you refund buyers?',
    options: [
      { value: '7', label: 'Within 7 days' },
      { value: '14', label: 'Within 14 days' },
      { value: '30', label: 'Within 30 days' },
    ],
  },
  postponement: {
    question: 'If you postpone to a confirmed new date, what happens?',
    options: [
      { value: 'refund_all', label: 'Every buyer is refunded' },
      { value: 'refund_on_request', label: 'Tickets stay valid, and any buyer can ask for a refund instead' },
      { value: 'no_refund', label: 'Tickets stay valid for the new date, with no refund' },
    ],
  },
  venueChange: {
    question: 'If you change the venue more than 7 days before the event, what happens?',
    options: [
      { value: 'refund_on_request', label: 'Any buyer can ask for a refund' },
      { value: 'no_refund', label: 'No refund; tickets stay valid at the new venue' },
    ],
  },
  guestNoShow: {
    question: 'If a Guest Artist or Special Guest does not appear, what happens?',
    options: [
      { value: 'refund_on_request', label: 'Any buyer can ask for a refund' },
      { value: 'no_refund', label: 'No refund' },
    ],
  },
  contactEmail: {
    question: 'Which email address should buyers use for refund questions?',
    hint: 'Your own working address. You must monitor it and reply within five working days. Buyers see it on your event page.',
  },
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Validates raw input into answers, or returns a reason it can't be used. */
export function parseRefundPolicy(raw: unknown): { ok: true; value: RefundPolicyAnswers } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Answer the five refund questions' };
  const r = raw as Record<string, unknown>;
  const cancelDays = Number(r.cancelDays);
  if (![7, 14, 30].includes(cancelDays)) return { ok: false, error: 'Choose how quickly you will refund if you cancel' };
  const postponement = r.postponement;
  if (postponement !== 'refund_all' && postponement !== 'refund_on_request' && postponement !== 'no_refund') {
    return { ok: false, error: 'Choose what happens if you postpone' };
  }
  const venueChange = r.venueChange;
  if (venueChange !== 'refund_on_request' && venueChange !== 'no_refund') return { ok: false, error: 'Choose what happens if you change the venue' };
  const guestNoShow = r.guestNoShow;
  if (guestNoShow !== 'refund_on_request' && guestNoShow !== 'no_refund') return { ok: false, error: 'Choose what happens if a guest does not appear' };
  const contactEmail = String(r.contactEmail ?? '').trim().toLowerCase();
  if (!EMAIL.test(contactEmail) || contactEmail.length > 200) return { ok: false, error: 'Enter a working email address for refund questions' };
  return { ok: true, value: { version: 1, cancelDays: cancelDays as CancelDays, postponement, venueChange, guestNoShow, contactEmail } };
}

/** Reads a stored policy; anything malformed is treated as "not set". */
export function readRefundPolicy(raw: unknown): RefundPolicyAnswers | null {
  const p = parseRefundPolicy(raw);
  return p.ok ? p.value : null;
}

export interface PolicySection { title: string; text: string }

/**
 * The published policy, generated from the answers. `organizer` is the
 * display name buyers see. Written as plain statements to the buyer.
 */
export function describeRefundPolicy(p: RefundPolicyAnswers, organizer: string): PolicySection[] {
  const who = organizer || 'The organiser';
  return [
    {
      title: 'If the event is cancelled',
      text: `${who} refunds the full ticket price to everyone who claims within 30 days of Ventry’s cancellation email, and pays within ${p.cancelDays} days of receiving the claim list.`,
    },
    {
      title: 'If it is postponed to a new date',
      text:
        p.postponement === 'refund_all'
          ? 'Every buyer is refunded the full ticket price.'
          : p.postponement === 'refund_on_request'
            ? 'Your ticket stays valid for the new date, or you can ask for a full refund instead.'
            : 'Your ticket stays valid for the new date. There is no refund.',
    },
    {
      title: 'If the venue changes (more than 7 days out)',
      text: p.venueChange === 'refund_on_request'
        ? 'You can ask for a full refund, or keep your ticket for the new venue.'
        : 'Your ticket stays valid at the new venue. There is no refund.',
    },
    {
      title: 'If a guest artist or special guest does not appear',
      text: p.guestNoShow === 'refund_on_request' ? 'You can ask for a full refund.' : 'There is no refund.',
    },
  ];
}

/** Fixed protections that apply on every event, whatever the organiser chose. */
export const MINIMUM_STANDARDS: string[] = [
  'A cancelled event is always refunded at the full ticket price to everyone who claims in time.',
  'A postponement with no confirmed new date, or any venue or date change within 7 days of the event, counts as a cancellation.',
  'If an act billed as Headliner does not appear, you can claim a refund.',
];

/** One-line summary for checkout. */
export function refundPolicySummary(p: RefundPolicyAnswers): string {
  const postponed = p.postponement === 'refund_all'
    ? 'everyone refunded if postponed'
    : p.postponement === 'refund_on_request' ? 'refund on request if postponed' : 'no refund if postponed';
  return `Full refund if cancelled, paid within ${p.cancelDays} days of the claim list; ${postponed}.`;
}
