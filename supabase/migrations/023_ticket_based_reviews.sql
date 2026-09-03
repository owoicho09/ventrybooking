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
