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
