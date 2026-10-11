-- 043: event-level Verified badge
--
-- The Verified badge on an event and the verified tick on an organiser are
-- different things (Buyer Terms 3.2, Organiser Terms 4.2):
--   - users.verified  — the organiser's identity has been checked.
--   - events.verified — Ventry has the venue proof for this event AND has
--                       confirmed the booking with the venue for that date.
-- Until now the event badge was derived from users.verified. This adds the
-- event's own flag, set by an admin from the events page.
--
-- Adds the columns only; every event starts unverified. Whether existing
-- events keep the badge they show today is a separate decision — see
-- 043b_backfill_event_verified.sql, which is NOT run automatically.
--
-- Idempotent: safe to run more than once.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS verified     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verified_by  TEXT;

COMMENT ON COLUMN events.verified    IS 'Venue booking confirmed by Ventry for this event — drives the public Verified badge';
COMMENT ON COLUMN events.verified_by IS 'Admin who confirmed the venue';
