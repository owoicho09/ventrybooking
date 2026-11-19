-- 063: admin-chosen events for the homepage hero deck (the three floating
-- cards). Slot 1 is the card on top. An empty table (or a slot whose event
-- is no longer on sale) falls back to the automatic choice.
--
-- Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS homepage_hero (
  slot        SMALLINT    PRIMARY KEY CHECK (slot BETWEEN 1 AND 3),
  event_id    UUID        REFERENCES events(id) ON DELETE CASCADE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT
);

-- Server-only table (service role); no client access.
ALTER TABLE homepage_hero ENABLE ROW LEVEL SECURITY;

COMMIT;
