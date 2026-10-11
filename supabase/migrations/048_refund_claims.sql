-- 048: refund cases and the claim list (Refund Policy v3 §2, §6–§9;
-- Organiser Terms §6.4, §10.9–10.16, §11).
--
-- The organiser pays refunds. Ventry refunds directly only money it still
-- holds (unsettled tickets) on a cancellation. Everyone else claims within a
-- window; at the end the organiser receives one claim list, pays within the
-- days they published, and reports it with proof.
--
--   refund_cases   one per event per kind:
--                    cancellation  – 30-day claim window, emails day 0/15/25/30
--                    postponement  – only when the organiser's policy refunds
--                    venue_change  – only when the organiser's policy refunds
--                    no_show       – billed act didn't appear; claims within
--                                    24h of the event ending, verified by admin
--                    time_change   – same-day start time moved (notice only)
--                  refundable=false: the change carries no refund under the
--                  organiser's policy; the case only drives the notice emails.
--   refund_claims  one per ticket in a case (no_show: created on claim).
--
-- tickets.status gains 'cancelled': the ticket no longer admits anyone and a
-- refund is owed by the organiser. Deliberately not 'refunded' — that status
-- makes the next settlement claw the money back from the organiser, which
-- would charge them twice when they're paying the buyer directly.
--
-- users.settlement_hold lets admin pause an organiser's settlements
-- (Organiser Terms §9, §11) — e.g. while refunds are overdue.
--
-- Idempotent.

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('valid', 'used', 'refunded', 'cancelled'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS settlement_hold        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settlement_hold_reason TEXT;

CREATE TABLE IF NOT EXISTS refund_cases (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id       UUID NOT NULL REFERENCES users(id),
  kind               TEXT NOT NULL CHECK (kind IN ('cancellation', 'postponement', 'venue_change', 'no_show', 'time_change')),
  -- verifying: no_show awaiting admin check · open: taking claims ·
  -- list_sent: organiser has the list · paid_reported: organiser says paid ·
  -- closed: nothing owed (no claims) · rejected: no_show not upheld
  status             TEXT NOT NULL DEFAULT 'open'
                       CHECK (status IN ('verifying', 'open', 'list_sent', 'paid_reported', 'closed', 'rejected')),
  reason             TEXT,
  refundable         BOOLEAN NOT NULL DEFAULT true,
  opened_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  claims_close_at    TIMESTAMPTZ NOT NULL,
  cancel_days        INT NOT NULL DEFAULT 30,
  list_sent_at       TIMESTAMPTZ,
  pay_by             TIMESTAMPTZ,
  paid_reported_at   TIMESTAMPTZ,
  payment_proof_url  TEXT,
  organizer_note     TEXT,
  overdue_flagged_at TIMESTAMPTZ,
  decided_by         UUID,
  decided_at         TIMESTAMPTZ,
  decision_note      TEXT,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One of each per event (an event is postponed or cancelled at most once);
-- time changes can repeat.
CREATE UNIQUE INDEX IF NOT EXISTS refund_cases_event_kind_uq
  ON refund_cases (event_id, kind) WHERE kind <> 'time_change';
CREATE INDEX IF NOT EXISTS refund_cases_status_idx ON refund_cases (status);
CREATE INDEX IF NOT EXISTS refund_cases_organizer_idx ON refund_cases (organizer_id);

CREATE TABLE IF NOT EXISTS refund_claims (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES refund_cases(id) ON DELETE CASCADE,
  ticket_id          TEXT NOT NULL REFERENCES tickets(id),
  refund_code        TEXT NOT NULL UNIQUE,
  buyer_email        TEXT NOT NULL,
  buyer_name         TEXT,
  amount             NUMERIC NOT NULL,
  -- unclaimed → claimed → paid; auto_refunded when Ventry refunded held
  -- money itself; auto_refund_failed for admin to retry.
  status             TEXT NOT NULL DEFAULT 'unclaimed'
                       CHECK (status IN ('unclaimed', 'claimed', 'auto_refunded', 'auto_refund_failed', 'paid')),
  -- How many of the four notices (day 0/15/25/30) this buyer has had.
  notices_sent       INT NOT NULL DEFAULT 0,
  claimed_at         TIMESTAMPTZ,
  bank_name          TEXT,
  bank_code          TEXT,
  account_number     TEXT,
  account_name       TEXT,
  statement          TEXT,
  otp_hash           TEXT,
  otp_expires_at     TIMESTAMPTZ,
  otp_attempts       INT NOT NULL DEFAULT 0,
  auto_refund_error  TEXT,
  ventry_refunded_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, ticket_id)
);
CREATE INDEX IF NOT EXISTS refund_claims_case_idx ON refund_claims (case_id, status);

ALTER TABLE refund_cases  ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_claims ENABLE ROW LEVEL SECURITY;
