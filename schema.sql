-- ============================================================
-- VENTRY — COMPLETE SUPABASE SCHEMA
-- Audited from codebase on 2026-05-29
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. USERS  (organizers only)
--    Admin auth is env-var only (ADMIN_EMAIL / ADMIN_PASSWORD)
--    and never touches this table.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT        NOT NULL,
  email                 TEXT        NOT NULL UNIQUE,
  phone                 TEXT        NOT NULL,
  password_hash         TEXT        NOT NULL,

  -- Organizer tier label shown in dashboard
  tier                  TEXT        NOT NULL DEFAULT 'Standard',

  -- Set to TRUE by admin after KYC approval; gates event creation
  verified              BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Profile
  member_since          DATE,
  events_hosted         INTEGER     NOT NULL DEFAULT 0,
  bio                   TEXT,

  -- KYC flow (5-step; kyc_step tracks progress)
  kyc_status            TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  kyc_step              INTEGER,
  kyc_submitted_at      TIMESTAMPTZ,
  kyc_gov_id_path       TEXT,           -- storage path in kyc-documents bucket
  kyc_selfie_path       TEXT,           -- storage path in kyc-documents bucket
  kyc_phone_verified    BOOLEAN,
  kyc_social_twitter    TEXT,
  kyc_social_instagram  TEXT,
  kyc_social_facebook   TEXT,
  kyc_venue_proof_path  TEXT,           -- storage path in kyc-documents bucket
  kyc_rejection_reason  TEXT,

  -- Bank / payout details
  bank_name             TEXT,
  account_number        TEXT,           -- validated as 10 digits in app
  account_name          TEXT,

  -- Notification preferences
  email_notifications   BOOLEAN     NOT NULL DEFAULT TRUE,
  sms_alerts            BOOLEAN     NOT NULL DEFAULT FALSE,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email      ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_kyc_status ON users (kyc_status);


-- ────────────────────────────────────────────────────────────
-- 2. EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id      UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  event_name        TEXT        NOT NULL,
  category          TEXT        NOT NULL,
  description       TEXT        NOT NULL,
  date              DATE        NOT NULL,
  time              TEXT        NOT NULL,   -- e.g. "14:00"
  venue             TEXT        NOT NULL,
  address           TEXT        NOT NULL,
  city              TEXT        NOT NULL DEFAULT '',

  -- Lifecycle: under_review → approved | rejected → completed
  status            TEXT        NOT NULL DEFAULT 'under_review'
                      CHECK (status IN ('under_review', 'approved', 'rejected', 'completed')),
  rejection_reason  TEXT,

  banner_url        TEXT,                   -- public URL in event-assets bucket
  banner_color      TEXT        NOT NULL DEFAULT 'from-purple-900 to-indigo-900',
  venue_proof_url   TEXT,

  total_sold        INTEGER     NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events (organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status        ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_date          ON events (date DESC);


-- ────────────────────────────────────────────────────────────
-- 3. TICKET TIERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ticket_tiers (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID    NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  price       NUMERIC NOT NULL,
  available   INTEGER NOT NULL,
  sold        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event_id ON ticket_tiers (event_id);


-- ────────────────────────────────────────────────────────────
-- 4. TICKETS
--    id is application-generated: TKT-XXXX-XXXX
--    (see lib/server/ids.ts → generateTicketId)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tickets (
  id                  TEXT        PRIMARY KEY,   -- TKT-XXXX-XXXX
  event_id            UUID        NOT NULL REFERENCES events (id),
  tier_id             UUID        NOT NULL REFERENCES ticket_tiers (id),
  organizer_id        UUID        NOT NULL REFERENCES users (id),

  buyer_name          TEXT        NOT NULL,
  buyer_email         TEXT        NOT NULL,
  quantity            INTEGER     NOT NULL,
  total_paid          NUMERIC     NOT NULL,

  -- Lifecycle: valid → used (scan) | refunded (complaint approved)
  status              TEXT        NOT NULL DEFAULT 'valid'
                        CHECK (status IN ('valid', 'used', 'refunded')),

  purchased_at        TIMESTAMPTZ NOT NULL,
  refund_code         TEXT        NOT NULL,      -- RF-XXXX-XX
  qr_token            TEXT        NOT NULL,      -- ticket ID (used as QR payload)
  -- Multiple rows per Paystack transaction (one row per individual ticket).
  -- NOT UNIQUE — a single payment creates quantity separate ticket records.
  paystack_reference  TEXT        NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_event_id           ON tickets (event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_buyer_email        ON tickets (buyer_email);
CREATE INDEX IF NOT EXISTS idx_tickets_paystack_reference ON tickets (paystack_reference);


-- ────────────────────────────────────────────────────────────
-- 5. PENDING ORDERS  (ephemeral checkout records)
--    Webhook is the source of truth; these are non-critical.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_orders (
  reference     TEXT        PRIMARY KEY,   -- VTR-XXXXXXXXXXXX
  event_id      UUID        REFERENCES events (id),
  tier_id       UUID        REFERENCES ticket_tiers (id),
  organizer_id  UUID        REFERENCES users (id),

  quantity      INTEGER     NOT NULL,
  buyer_email   TEXT        NOT NULL,
  buyer_name    TEXT        NOT NULL DEFAULT '',
  subtotal      NUMERIC     NOT NULL,
  service_fee   NUMERIC     NOT NULL,
  total         NUMERIC     NOT NULL,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ────────────────────────────────────────────────────────────
-- 6. PAYOUTS
--    One row per event, updated as tickets are sold.
--    Lifecycle: pending → processing (event confirmed by admin)
--               → completed (funds released via Paystack transfer)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payouts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES events (id),
  organizer_id    UUID        NOT NULL REFERENCES users (id),

  -- Denormalised at write time so they survive event edits
  organizer_name  TEXT        NOT NULL DEFAULT '',
  event_name      TEXT        NOT NULL DEFAULT '',
  date            DATE,

  gross           NUMERIC     NOT NULL DEFAULT 0,
  fee             NUMERIC     NOT NULL DEFAULT 0,
  net             NUMERIC     NOT NULL DEFAULT 0,

  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed')),

  reference       TEXT,        -- VTR-PAY-YYYY-XXXXXX
  released_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payouts_organizer_id ON payouts (organizer_id);
CREATE INDEX IF NOT EXISTS idx_payouts_event_id     ON payouts (event_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status       ON payouts (status);


-- ────────────────────────────────────────────────────────────
-- 7. COMPLAINTS  (refund claims submitted by buyers)
--    id is application-generated: CMP-XXXXXXXX
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaints (
  id            TEXT        PRIMARY KEY,   -- CMP-XXXXXXXX
  ticket_id     TEXT        NOT NULL REFERENCES tickets (id),
  event_id      UUID        REFERENCES events (id),

  event_name    TEXT        NOT NULL DEFAULT '',
  buyer_email   TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'Event Cancelled',

  -- Lifecycle: open → investigating → resolved | rejected
  status        TEXT        NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'investigating', 'resolved', 'rejected')),
  priority      TEXT        NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('medium', 'high')),  -- 'high' when type = 'Fraud'
  notes         TEXT,

  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_ticket_id ON complaints (ticket_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status    ON complaints (status);


-- ────────────────────────────────────────────────────────────
-- 8. SCAN LOGS  (audit trail for QR ticket scanning)
--    ticket_id is TEXT (not FK) so invalid scan attempts
--    can still be recorded.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES events (id),
  ticket_id      TEXT        NOT NULL,
  scanned_by     UUID        NOT NULL REFERENCES users (id),

  attendee_name  TEXT        NOT NULL,
  ticket_type    TEXT        NOT NULL,
  result         TEXT        NOT NULL
                   CHECK (result IN ('success', 'already_used', 'invalid')),

  scanned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_logs_event_id ON scan_logs (event_id);


-- ────────────────────────────────────────────────────────────
-- 9. RESET TOKENS  (one-time password reset links)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  token       TEXT        NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL   -- 1 hour from creation
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens (token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_email ON reset_tokens (email);


-- ────────────────────────────────────────────────────────────
-- 10. PLATFORM CONFIG  (admin-controlled key/value settings)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_config (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

INSERT INTO platform_config (key, value)
VALUES ('payout_percentage', '100')
ON CONFLICT (key) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 11. RPC FUNCTION
--     Called by webhook after every successful ticket purchase.
--     Atomically increments both ticket_tiers.sold and the
--     denormalised events.total_sold counter in one statement
--     using a CTE so both updates are part of the same
--     transaction and no race condition is possible.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_tier_sold(tier_id UUID, amount INTEGER)
RETURNS VOID
LANGUAGE sql
AS $$
  WITH updated_tier AS (
    UPDATE ticket_tiers
    SET    sold = sold + amount
    WHERE  id   = tier_id
    RETURNING event_id
  )
  UPDATE events
  SET    total_sold = total_sold + amount
  WHERE  id = (SELECT event_id FROM updated_tier);
$$;


-- ────────────────────────────────────────────────────────────
-- 12. STORAGE BUCKETS
--     event-assets  — public  (banner images)
--     kyc-documents — private (gov ID, selfie, venue proof)
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('event-assets',  'event-assets',  TRUE),
  ('kyc-documents', 'kyc-documents', FALSE)
ON CONFLICT (id) DO NOTHING;
