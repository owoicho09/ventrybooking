-- 055: emailed-code confirmation for every organiser settings change.
--
-- Flow: the organiser asks for a code (emailed to their account address),
-- types it in, and gets a short-lived "change grant" (10 minutes) that every
-- settings endpoint requires. Changing the account email additionally sends
-- a second code to the NEW address to prove they own it.
--
--   purpose       'settings'  code to the current email; verifying it issues a grant.
--                 'email_new' code to target_email; verifying it switches the email.
--   code_hash     sha256 of the code salted with purpose + user id (never stored raw).
--   attempts      wrong guesses on this code; after 5 it is dead.
--   grant_hash    sha256 of the grant token handed back on verification.
--
-- Bank-account changes keep their own password + code flow (bank_change_otp,
-- Organiser Terms 3.8). Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS organizer_change_codes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose           TEXT        NOT NULL CHECK (purpose IN ('settings', 'email_new')),
  code_hash         TEXT        NOT NULL,
  target_email      TEXT,
  attempts          INT         NOT NULL DEFAULT 0,
  expires_at        TIMESTAMPTZ NOT NULL,
  verified_at       TIMESTAMPTZ,
  grant_hash        TEXT,
  grant_expires_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizer_change_codes_user_idx
  ON organizer_change_codes (user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS organizer_change_codes_grant_idx
  ON organizer_change_codes (grant_hash) WHERE grant_hash IS NOT NULL;

ALTER TABLE organizer_change_codes ENABLE ROW LEVEL SECURITY;

COMMIT;
