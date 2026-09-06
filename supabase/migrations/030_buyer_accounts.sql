-- Passwordless buyer account login. Deliberately a separate table from
-- ticket_lookup_otps (the existing /retrieve OTP flow) rather than reused —
-- that table's request-otp route only sends a code when the email already
-- has a ticket, which is the right anti-enumeration gate for "retrieve my
-- tickets" but wrong for "log in" (a buyer must be able to create a session
-- for an email with zero tickets today). Keeping them isolated means this
-- new login flow can't interfere with or regress the shipped retrieve flow.
--
-- Idempotent — safe to run regardless of which prior migrations have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS buyer_login_otps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  otp_hash    TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_login_otps_email ON buyer_login_otps (email);


-- Buyer "Follow organiser" reuses organizer_subscribers (the existing Notify
-- Me / audience table) as a third source value, rather than a new table —
-- its source CHECK constraint only allowed 'notify_me' and 'ticket_consent',
-- so it needs widening here.
ALTER TABLE organizer_subscribers DROP CONSTRAINT IF EXISTS organizer_subscribers_source_check;
ALTER TABLE organizer_subscribers ADD CONSTRAINT organizer_subscribers_source_check
  CHECK (source IN ('notify_me', 'ticket_consent', 'follow'));
