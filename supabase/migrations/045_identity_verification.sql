-- 045: identity verification (Organiser Terms 3.3–3.11) and venue contact (4.2)
--
-- Until now users.verified was set by the email one-time code, yet it drove
-- the public "verified organiser" tick. The two are now separate:
--   users.email_verified — the account's email was confirmed (login, listing).
--   users.verified       — identity checked through a licensed provider
--                          (Dojah: NIN for individuals, CAC for businesses).
-- Existing accounts: email_verified is copied from verified; verified itself
-- is left as it is, so nothing visible changes on deploy. See 045b for
-- resetting ticks of organisers who have not passed an identity check.
--
-- Nothing sensitive from the provider is stored: no full NIN, no photo, no
-- date of birth. Only the name on record, the type, and the last 4 digits /
-- RC number for reference.
--
-- Idempotent.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_status         TEXT    NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS identity_type           TEXT,
  ADD COLUMN IF NOT EXISTS identity_name           TEXT,
  ADD COLUMN IF NOT EXISTS identity_ref            TEXT,
  ADD COLUMN IF NOT EXISTS identity_verified_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_attempts       INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS identity_last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_last_error     TEXT,
  ADD COLUMN IF NOT EXISTS bank_name_matched       BOOLEAN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_identity_status_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_identity_status_check
      CHECK (identity_status IN ('unverified', 'verified', 'legacy'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_identity_type_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_identity_type_check
      CHECK (identity_type IS NULL OR identity_type IN ('nin', 'cac'));
  END IF;
END $$;

-- Everyone who confirmed their email so far did so through users.verified.
UPDATE users SET email_verified = true WHERE verified = true AND email_verified = false;

-- Accounts that show the tick today without a provider check are marked
-- 'legacy' so admin can see who still needs to verify.
UPDATE users SET identity_status = 'legacy' WHERE verified = true AND identity_status = 'unverified';

COMMENT ON COLUMN users.email_verified  IS 'Email confirmed with the one-time code (account active)';
COMMENT ON COLUMN users.verified        IS 'Identity verified: drives the public verified tick and lifts the NGN 500,000 settlement cap';
COMMENT ON COLUMN users.identity_status IS 'unverified | verified (provider check passed) | legacy (tick from before provider checks)';
COMMENT ON COLUMN users.identity_name   IS 'Name on the NIN / CAC record returned by the provider';
COMMENT ON COLUMN users.identity_ref    IS 'Last 4 digits of the NIN, or the CAC RC number';
COMMENT ON COLUMN users.bank_name_matched IS 'Settlement account name (resolved via Paystack) matches the verified identity name';

-- Venue contact for the event Verified badge: Ventry calls the venue to
-- confirm the booking for the date (Organiser Terms 4.2).
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS venue_contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS venue_contact_phone TEXT;
