-- ============================================================
-- VENTRY LAUNCH MIGRATIONS
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================


-- 1. Marketing consent on tickets
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;


-- 2. Marketing consent on pending_orders
ALTER TABLE pending_orders
  ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;


-- 3. Reminder logs — track which reminders have been sent per ticket
CREATE TABLE IF NOT EXISTS reminder_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     TEXT        NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  event_id      UUID        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  reminder_type TEXT        NOT NULL CHECK (reminder_type IN ('1_week', '1_day', '3_hours')),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ticket_id, reminder_type)
);

CREATE INDEX IF NOT EXISTS idx_reminder_logs_event_id ON reminder_logs (event_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_ticket_id ON reminder_logs (ticket_id);


-- 4. Purchases table (idempotency guard for Paystack webhook)
--    If it already exists this is a no-op.
CREATE TABLE IF NOT EXISTS purchases (
  paystack_reference TEXT        PRIMARY KEY,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 5. Event reviews — one anonymous review per IP per event
CREATE TABLE IF NOT EXISTS event_reviews (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  event_id      UUID        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  organizer_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating        INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body          TEXT,
  display_name  TEXT        NOT NULL,
  ip_hash       TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_event_reviews_event_id ON event_reviews (event_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_organizer_id ON event_reviews (organizer_id);


-- 6. Allow 'cancelled' in events.status CHECK constraint
--    (needed by the bulk-cancel-and-refund feature already in place)
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_status_check;

ALTER TABLE events
  ADD CONSTRAINT events_status_check
  CHECK (status IN ('under_review', 'approved', 'rejected', 'completed', 'cancelled'));


-- 7. Event location visibility controls
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS landmark TEXT,
  ADD COLUMN IF NOT EXISTS location_hidden BOOLEAN NOT NULL DEFAULT FALSE;


-- 8. Online events (Zoom-style meeting link instead of a physical venue)
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_mode TEXT NOT NULL DEFAULT 'physical'
    CHECK (event_mode IN ('physical', 'online')),
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS meeting_passcode TEXT;


-- 9. Affiliate tracking — per-event referral links with click/purchase counters.
--    No buyer identifiers are ever stored here, by design.
CREATE TABLE IF NOT EXISTS affiliates (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT        NOT NULL UNIQUE,   -- AFF-XXXXXXXX, used as the ?ref= value
  name          TEXT        NOT NULL,          -- organizer-chosen label, e.g. "Tunde"
  event_id      UUID        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  organizer_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  clicks        INTEGER     NOT NULL DEFAULT 0,
  buys          INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliates_event_id     ON affiliates (event_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_organizer_id ON affiliates (organizer_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code         ON affiliates (code);

CREATE OR REPLACE FUNCTION increment_affiliate_clicks(p_code TEXT)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE affiliates SET clicks = clicks + 1 WHERE code = p_code;
$$;

CREATE OR REPLACE FUNCTION increment_affiliate_buys(p_code TEXT, p_amount INTEGER)
RETURNS VOID LANGUAGE sql AS $$
  UPDATE affiliates SET buys = buys + p_amount WHERE code = p_code;
$$;


-- 10. Ticket lookup OTP gate — "Find My Tickets" requires proving control of
--     the email before ticket IDs/QR codes are revealed. One active code per
--     email; verifying (or requesting a new one) clears prior rows.
CREATE TABLE IF NOT EXISTS ticket_lookup_otps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  otp_hash    TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_lookup_otps_email ON ticket_lookup_otps (email);
