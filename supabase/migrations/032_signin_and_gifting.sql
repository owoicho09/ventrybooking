-- Unified /signin entry + "buying for someone else" tracking.
--
-- buyer_profiles: buyers have no `users` row today (that table is
-- organiser/admin/affiliate-shaped). This is the minimum needed to greet a
-- first-time buyer by name after the one-time first-name prompt, and to
-- have the support chat greet a returning buyer by name.
--
-- Idempotent — safe to run regardless of which prior migrations have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS buyer_profiles (
  email       TEXT        PRIMARY KEY,
  first_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Set only when a signed-in buyer completes checkout for a *different*
-- email than their own — buyer_email (who the ticket belongs to / where
-- it's emailed) is never touched by this. Lets /api/buyer/tickets also
-- surface orders bought *for* someone else, marked "purchased by you".
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS purchased_by_email TEXT;
CREATE INDEX IF NOT EXISTS idx_tickets_purchased_by_email ON tickets (purchased_by_email);
