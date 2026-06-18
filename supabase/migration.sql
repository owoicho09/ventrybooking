-- ============================================================
-- Ventry Production Fixes Migration
-- Run this in the Supabase SQL editor before deploying.
-- ============================================================

-- 1. Atomic payment idempotency sentinel
--    One row per Paystack reference. The PRIMARY KEY constraint means a
--    concurrent duplicate INSERT fails immediately with error code 23505
--    (unique_violation) rather than silently succeeding, eliminating the
--    webhook + callback race condition that created duplicate tickets.
CREATE TABLE IF NOT EXISTS purchases (
  paystack_reference TEXT        PRIMARY KEY,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. In-app notification system
--    recipient_type = 'admin'     → visible to all admins (recipient_id is null)
--    recipient_type = 'organizer' → visible only to that organizer (recipient_id = users.id)
CREATE TABLE IF NOT EXISTS notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT        NOT NULL CHECK (recipient_type IN ('admin', 'organizer')),
  recipient_id   UUID        REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT        NOT NULL,   -- 'kyc' | 'event' | 'complaint' | 'purchase' | 'payout'
  title          TEXT        NOT NULL,
  body           TEXT        NOT NULL,
  link           TEXT,
  read           BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast unread-count lookup for admin bell
CREATE INDEX IF NOT EXISTS idx_notifications_admin
  ON notifications (created_at DESC)
  WHERE recipient_type = 'admin';

-- Fast unread-count + feed lookup for organizer bell
CREATE INDEX IF NOT EXISTS idx_notifications_org
  ON notifications (recipient_id, created_at DESC)
  WHERE recipient_type = 'organizer';

-- 3. Email OTP columns (replaces 5-step KYC document flow)
--    After email verification, kyc_status → 'approved' and verified → true automatically.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_otp_expires_at TIMESTAMPTZ;

-- 4. Add 'cancelled' as a valid event status for bulk-refund-on-cancellation feature.
--    The existing constraint is named events_status_check (auto-named from schema.sql).
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check
  CHECK (status IN ('under_review', 'approved', 'rejected', 'completed', 'cancelled'));

-- 5. Add 'otp_pending' as a valid payout status.
--    The release route sets this when Paystack requires OTP before sending funds.
--    Without this, the UPDATE in the release route silently fails in live mode,
--    leaving the payout stuck in 'processing' with the transfer already initiated.
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_status_check;
ALTER TABLE payouts ADD CONSTRAINT payouts_status_check
  CHECK (status IN ('pending', 'processing', 'completed', 'otp_pending'));

-- 6. Unique payout per event — required for the atomic upsert_payout function below.
--    Safe to add: the application already enforces one payout per event logically.
--    If this fails due to pre-existing duplicate rows, run first:
--      DELETE FROM payouts WHERE id NOT IN (SELECT MIN(id) FROM payouts GROUP BY event_id);
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_event_id_unique;
ALTER TABLE payouts ADD CONSTRAINT payouts_event_id_unique UNIQUE (event_id);

-- 7. Atomic payout accumulator — eliminates the TOCTOU race in the JS-level
--    read-then-write pattern where two concurrent ticket purchases for the same
--    event could both see no existing payout row and both INSERT a duplicate.
--    ON CONFLICT atomically adds to the existing totals instead.
CREATE OR REPLACE FUNCTION upsert_payout(
  p_event_id       UUID,
  p_organizer_id   UUID,
  p_organizer_name TEXT,
  p_event_name     TEXT,
  p_date           DATE,
  p_gross          NUMERIC,
  p_fee            NUMERIC,
  p_net            NUMERIC
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO payouts (event_id, organizer_id, organizer_name, event_name, date, gross, fee, net, status)
  VALUES (p_event_id, p_organizer_id, p_organizer_name, p_event_name, p_date, p_gross, p_fee, p_net, 'pending')
  ON CONFLICT (event_id) DO UPDATE SET
    gross = payouts.gross + EXCLUDED.gross,
    fee   = payouts.fee   + EXCLUDED.fee,
    net   = payouts.net   + EXCLUDED.net;
END;
$$;

-- 8. Clear placeholder references from unreleased payouts.
--    The old upsertPayout JS function set a VTR-PAY-{eventId}-{timestamp} placeholder
--    in the `reference` column for every new payout row. The release route now uses
--    `reference IS NULL` as a distributed lock to prevent concurrent double-releases.
--    Clearing these placeholders from pending/processing rows enables that lock.
--    'otp_pending' and 'completed' rows keep their real Paystack transfer references.
UPDATE payouts SET reference = NULL WHERE status IN ('pending', 'processing');
