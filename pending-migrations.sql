-- ============================================================
-- Ventry: combined pending migrations (021-027)
-- Generated for a one-time paste into the Supabase SQL Editor.
-- Every statement is idempotent (IF NOT EXISTS / DO $$...EXCEPTION),
-- safe to run once, and safe to re-run if anything already applied.
-- ============================================================


-- ------------------------------------------------------------
-- 021_flyer_banner.sql
-- ------------------------------------------------------------
-- Phase 1 of newfeature.txt: flyer + banner split.
--
-- events.banner_url is left untouched — it remains the existing flyer used
-- across cards, OG previews, and ticket emails (already a landscape crop in
-- practice; renaming it was considered and rejected to avoid touching those
-- rendering surfaces for no functional gain).
--
-- header_banner_url is new: the wide 2:1 image that becomes the event page's
-- fixed header. NULL means the organiser hasn't uploaded one, in which case
-- the event page falls back to the existing banner_url hero unchanged.
--
-- Idempotent — safe to run regardless of which of migrations #11-20 (see
-- migrations.sql) have actually been applied to this database.

ALTER TABLE events ADD COLUMN IF NOT EXISTS header_banner_url TEXT;


-- ------------------------------------------------------------
-- 022_venue_date_change_refunds.sql
-- ------------------------------------------------------------
-- Phase 4 of newfeature.txt: venue/date change buyer refund window.
--
-- One row per real-world change event (not per changed field) — if venue and
-- date change together in one edit, that's one row with change_type
-- 'venue_and_date' and both old/new values captured. A later, separate edit
-- gets its own row with its own independent 48h-or-until-event window,
-- scoped only to tickets purchased before THAT row's changed_at (buyers who
-- purchase after a change bought the new details, so they're never eligible
-- against it).
--
-- ticket_change_refunds is the audit trail the brief requires: one row per
-- (ticket, change) — the unique constraint is what makes the opt-out claim
-- atomic and guards against double-refunding the same change from a replayed
-- or double-clicked link, the same idempotency pattern the `purchases` table
-- already uses for webhook/callback races.
--
-- Idempotent — safe to run regardless of which of migrations #11-21 have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS event_changes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  change_type               TEXT NOT NULL CHECK (change_type IN ('venue', 'date', 'venue_and_date')),
  old_value                 JSONB NOT NULL,
  new_value                 JSONB NOT NULL,
  changed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  refund_window_closes_at   TIMESTAMPTZ NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_change_refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_change_id   UUID NOT NULL REFERENCES event_changes(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'refunded', 'failed')),
  refund_amount     NUMERIC,
  failure_reason    TEXT,
  opted_out_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded_at       TIMESTAMPTZ,
  UNIQUE (ticket_id, event_change_id)
);

CREATE INDEX IF NOT EXISTS idx_event_changes_event_id ON event_changes(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_change_refunds_ticket_id ON ticket_change_refunds(ticket_id);


-- ------------------------------------------------------------
-- 023_ticket_based_reviews.sql
-- ------------------------------------------------------------
-- Phase 5 of newfeature.txt: post-event reviews tied to a checked-in ticket,
-- replacing the anonymous IP-hash-deduped system.
--
-- event_reviews already exists in this database (two conflicting definitions
-- exist across migrations.sql and supabase/migrations/add_event_reviews.sql
-- — this migration doesn't try to reconcile which one is live, it only adds
-- what's missing via IF NOT EXISTS, so it's safe against either shape).
--
-- ticket_id is nullable so historical anonymous reviews (if any exist in
-- production) aren't orphaned or deleted — they just have no ticket link.
-- Only new, ticket-based submissions populate it, and the unique constraint
-- on it is what actually enforces "one review per ticket."
--
-- Idempotent — safe to run regardless of which of migrations #11-22 have
-- actually been applied to this database.

ALTER TABLE event_reviews ADD COLUMN IF NOT EXISTS ticket_id TEXT REFERENCES tickets(id) ON DELETE CASCADE;
ALTER TABLE event_reviews ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE event_reviews ADD COLUMN IF NOT EXISTS hidden_by TEXT;
ALTER TABLE event_reviews ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE event_reviews ADD CONSTRAINT event_reviews_ticket_id_key UNIQUE (ticket_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tracks whether a checked-in ticket has already been sent its review-request
-- email, so the completion cron doesn't re-email it on every run.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ;


-- ------------------------------------------------------------
-- 024_organizer_profile_cover.sql
-- ------------------------------------------------------------
-- Phase 6 of newfeature.txt: organiser profile 2.0.
--
-- cover_image_url is the organiser's own brand banner shown on their public
-- storefront page — distinct from any per-event image (events.banner_url,
-- events.header_banner_url). Follower count and ratings are computed from
-- existing tables (organizer_subscribers, event_reviews) at read time, no
-- new columns needed for those.
--
-- Idempotent — safe to run regardless of which of migrations #11-23 have
-- actually been applied to this database.

ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url TEXT;


-- ------------------------------------------------------------
-- 025_restricted_audience_events.sql
-- ------------------------------------------------------------
-- Phase 7 of newfeature.txt: restricted-audience events.
--
-- NULL/empty = unrestricted (the default, unaffected). A non-empty array
-- means checkout only accepts buyer emails whose domain is in this list —
-- enforced server-side in /api/checkout and /api/checkout/free, never
-- trusting the client.
--
-- Idempotent — safe to run regardless of which of migrations #11-24 have
-- actually been applied to this database.

ALTER TABLE events ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[];


-- ------------------------------------------------------------
-- 026_admin_notification_emails.sql
-- ------------------------------------------------------------
-- Phase 8 of newfeature.txt: admin notifications by email.
--
-- notifications already exists (defined in supabase/migration.sql) — this
-- only adds what's needed for the email pipeline. emailed_at is set the
-- moment a row has been emailed, whether that happened immediately at
-- insert time (an action-needed item, or one already covered by its own
-- dedicated email elsewhere) or later by the hourly digest cron picking up
-- anything still NULL. Either way, a row only ever gets emailed once.
--
-- CREATE TABLE IF NOT EXISTS is included defensively in case this runs
-- against a database where notifications was never created — safe either
-- way, since IF NOT EXISTS no-ops against the live table already in use.
--
-- Idempotent — safe to run regardless of which of migrations #11-25 have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'organizer')),
  recipient_id   UUID,
  type           TEXT NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  link           TEXT,
  read           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_admin_unemailed
  ON notifications (created_at)
  WHERE recipient_type = 'admin' AND emailed_at IS NULL;


-- ------------------------------------------------------------
-- 027_platform_affiliates.sql
-- ------------------------------------------------------------
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

