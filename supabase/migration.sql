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
