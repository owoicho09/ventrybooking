-- Checkout email verification. A buyer must prove they can read the inbox
-- they typed before an order is created, so a typo'd address (e.g. gmil.com)
-- is caught up front instead of after payment when the ticket email goes to
-- a stranger. Deliberately its own table — not ticket_lookup_otps or
-- buyer_login_otps — because those flows have different gating rules
-- (retrieve only sends for emails that already own tickets; login has no
-- expiry-coupling to a purchase) and must not be able to regress each other.
--
-- attempts is enforced in the database rather than only by the in-memory
-- rate limiter, which doesn't hold across serverless instances: the verify
-- route burns the code after too many wrong guesses.
--
-- Idempotent — safe to run regardless of which prior migrations have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS checkout_email_otps (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT        NOT NULL,
  otp_hash    TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  attempts    INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkout_email_otps_email ON checkout_email_otps (email);
