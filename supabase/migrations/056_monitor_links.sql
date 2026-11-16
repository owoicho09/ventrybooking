-- 056: sponsor / partner monitor links.
--
-- An organiser can share a read-only live view of one event's performance
-- (sales, net revenue, tiers, buyers, check-ins) without sharing their login.
-- Like staff IDs: create as many as they like, label them ("MTN sponsorship"),
-- switch any off or back on at any time.
--
--   token        the secret in the link (/monitor/<token>). 32 random bytes,
--                hex. Kept so the organiser can copy the link again later;
--                it only ever grants this read-only view of this one event.
--   view_count / last_viewed_at   so the organiser can see the link is used.
--
-- The view never shows buyer names, emails or phone numbers.
-- Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS monitor_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label           TEXT,
  token           TEXT        NOT NULL UNIQUE CHECK (token ~ '^[a-f0-9]{64}$'),
  active          BOOLEAN     NOT NULL DEFAULT true,
  view_count      INT         NOT NULL DEFAULT 0,
  last_viewed_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS monitor_links_event_idx ON monitor_links (event_id, created_at DESC);

ALTER TABLE monitor_links ENABLE ROW LEVEL SECURITY;

COMMIT;
