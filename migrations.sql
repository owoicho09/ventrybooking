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
