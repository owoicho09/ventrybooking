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


-- 11. Processing-fee breakdown — buyer-borne gross-up for the payment
--     processor's own fee. Persisted per ticket so refunds use the exact
--     amount charged instead of reverse-engineering it from total_paid,
--     which becomes ambiguous once total_paid includes a third fee
--     component. NULL on pre-migration tickets marks "use the old
--     basePriceFromTotalPaid reversal" at refund time.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS subtotal        NUMERIC,
  ADD COLUMN IF NOT EXISTS service_fee     NUMERIC,
  ADD COLUMN IF NOT EXISTS processing_fee  NUMERIC;

ALTER TABLE pending_orders
  ADD COLUMN IF NOT EXISTS processing_fee  NUMERIC NOT NULL DEFAULT 0;


-- 12. Live-computed "events hosted" count. users.events_hosted is set to 0
--     at registration and never incremented anywhere — nothing in the app
--     transitions an event to status='completed', so there's no hook to
--     increment it from. Rather than build that machinery, compute the
--     count on read, batched across organizers to avoid N+1 queries.
CREATE OR REPLACE FUNCTION get_events_hosted_counts(organizer_ids UUID[])
RETURNS TABLE(organizer_id UUID, hosted_count BIGINT)
LANGUAGE sql AS $$
  SELECT organizer_id, COUNT(*) FROM events
  WHERE organizer_id = ANY(organizer_ids) AND status = 'completed'
  GROUP BY organizer_id;
$$;


-- 13. Vanity slugs, accent color, lineup, and update tracking for the
--     redesigned event page (Goal 2). Slugs are generated server-side at
--     creation (kebab-case from event_name, -2/-3 suffix on collision) and
--     are immutable afterward. accent_color is a hex value from a fixed
--     app-side preset list, never a free hex picker. lineup is a simple
--     [{name, role}] array — no images, per the plan's own scope.
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS slug          TEXT,
  ADD COLUMN IF NOT EXISTS accent_color  TEXT,
  ADD COLUMN IF NOT EXISTS lineup        JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events (slug) WHERE slug IS NOT NULL;

-- Auto-touch updated_at on every row change, so the OG-image cache-busting
-- key (Goal 2 share cards) never depends on the app remembering to set it.
CREATE OR REPLACE FUNCTION touch_events_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION touch_events_updated_at();


-- 14. Organiser storefront profile fields (Goal 3). Handle is stored
--     without the leading "@" — that's added only at link/render time.
--     socials is JSONB rather than fixed columns since the plan doesn't
--     enumerate a fixed platform list.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS handle      TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url  TEXT,
  ADD COLUMN IF NOT EXISTS socials     JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users (handle) WHERE handle IS NOT NULL;


-- 15. Notify Me — organiser-scoped subscribers, not tied to any single
--     event. unsubscribe_token has no expiry (unlike the OTP tables) since
--     unsubscribe links should keep working indefinitely.
CREATE TABLE IF NOT EXISTS organizer_subscribers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email             TEXT        NOT NULL,
  phone             TEXT,
  unsubscribe_token TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  subscribed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at   TIMESTAMPTZ,
  UNIQUE (organizer_id, email)
);

CREATE INDEX IF NOT EXISTS idx_organizer_subscribers_organizer_id ON organizer_subscribers (organizer_id);
CREATE INDEX IF NOT EXISTS idx_organizer_subscribers_token        ON organizer_subscribers (unsubscribe_token);


-- 16. Fix get_events_hosted_counts (entry 12): nothing in the codebase ever
--     sets events.status = 'completed', so the original status-only filter
--     always returned 0. An event that's approved and whose date has passed
--     has, in effect, happened — count on that instead of the unreachable
--     status. Also the definition the organiser storefront (Goal 3) needs
--     for "N events hosted" and its upcoming/past event split.
CREATE OR REPLACE FUNCTION get_events_hosted_counts(organizer_ids UUID[])
RETURNS TABLE(organizer_id UUID, hosted_count BIGINT)
LANGUAGE sql AS $$
  SELECT organizer_id, COUNT(*) FROM events
  WHERE organizer_id = ANY(organizer_ids)
    AND (status = 'completed' OR (status = 'approved' AND date < CURRENT_DATE))
  GROUP BY organizer_id;
$$;

-- One-time backfill: every existing event (including the 3 already live)
-- needs a slug before the app starts linking to /{slug} instead of
-- /events/{id}. Same kebab-case + collision-suffix scheme the app uses at
-- creation time, applied here once for pre-existing rows.
DO $$
DECLARE
  ev RECORD;
  base_slug TEXT;
  candidate TEXT;
  suffix INT;
BEGIN
  FOR ev IN SELECT id, event_name FROM events WHERE slug IS NULL ORDER BY created_at LOOP
    base_slug := trim(both '-' from regexp_replace(lower(ev.event_name), '[^a-z0-9]+', '-', 'g'));
    IF base_slug = '' THEN
      base_slug := 'event';
    END IF;
    candidate := base_slug;
    suffix := 2;
    WHILE EXISTS (SELECT 1 FROM events WHERE slug = candidate) LOOP
      candidate := base_slug || '-' || suffix;
      suffix := suffix + 1;
    END LOOP;
    UPDATE events SET slug = candidate WHERE id = ev.id;
  END LOOP;
END $$;


-- 17. Per-organiser platform fee rate. The 3% platform fee used to be a
--     single hardcoded constant applied to every organiser. New organisers
--     are onboarded at 3% (the column default), but every organiser account
--     that existed before this migration is grandfathered at the 2.5% rate
--     they originally signed up under.
ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_fee_rate NUMERIC NOT NULL DEFAULT 0.03;

UPDATE users SET platform_fee_rate = 0.025 WHERE created_at < '2026-08-17';


-- 18. Multi-tier checkout. A single order can now contain more than one
--     ticket tier (e.g. 2 Regular + 1 VIP together) instead of being
--     restricted to one tier per purchase. `items` carries the full list of
--     {tier_id, quantity} lines for the pending_orders reconciliation safety
--     net (see lib/server/reconcile.ts); tier_id/quantity are still populated
--     with the order's first line for any older code path that reads them
--     directly.
ALTER TABLE pending_orders ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]';
