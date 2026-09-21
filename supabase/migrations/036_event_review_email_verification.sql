-- Rate-and-review from a past event's page. A visitor types the email they
-- bought with, receives a code, and only after entering it can post a review
-- — otherwise anyone could type a buyer's email and review as them.
--
-- Its own table (not checkout_email_otps / ticket_lookup_otps / buyer_login_otps)
-- so the flows can't interfere: a code is scoped to one (email, event) pair,
-- and a review request must not clobber a checkout code for the same email.
-- attempts is enforced in the database because the in-memory rate limiter
-- doesn't hold across serverless instances.
--
-- Idempotent — safe to run regardless of which prior migrations have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS event_review_otps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  event_id    UUID        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  otp_hash    TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_review_otps_email_event ON event_review_otps (email, event_id);
