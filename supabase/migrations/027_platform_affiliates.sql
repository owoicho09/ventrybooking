-- Phase 9 of newfeature.txt: the Ventry-wide affiliate program.
--
-- Named platform_affiliate_* deliberately, to avoid colliding with the
-- existing `affiliates` table — that one is a different, already-shipped
-- feature (an organiser's own per-event marketer tracking links, created
-- from their dashboard). This is a separate, Ventry-level program: a
-- marketer signs up once, refers organisers, and earns a cut of Ventry's
-- platform fee on that organiser's first two events.
--
-- platform_affiliate_referrals.organizer_id is UNIQUE — an organiser can be
-- credited to at most one affiliate, ever (first-touch wins, resolved once
-- at registration time, not re-attributable later).
--
-- platform_affiliate_commissions is a ledger: one row per qualifying sale
-- (not one mutable row per event), so the audit trail is a straightforward
-- append-only history rather than a running total that could be corrupted
-- by a bug re-computing it.
--
-- Idempotent — safe to run regardless of which of migrations #11-26 have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS platform_affiliates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_affiliate_referrals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES platform_affiliates(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  referred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_affiliate_commissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id          UUID NOT NULL REFERENCES platform_affiliates(id) ON DELETE CASCADE,
  organizer_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id              UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_name            TEXT NOT NULL,
  gross_amount          NUMERIC NOT NULL,
  commission_amount     NUMERIC NOT NULL,
  -- Which of the organiser's first two qualifying events this sale belongs
  -- to (1 or 2) — a 3rd+ event never gets a row at all.
  event_sequence_number INT NOT NULL CHECK (event_sequence_number IN (1, 2)),
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at               TIMESTAMPTZ,
  paid_by               TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_affiliate_referrals_affiliate_id ON platform_affiliate_referrals (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_platform_affiliate_commissions_affiliate_id ON platform_affiliate_commissions (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_platform_affiliate_commissions_organizer_id ON platform_affiliate_commissions (organizer_id);
