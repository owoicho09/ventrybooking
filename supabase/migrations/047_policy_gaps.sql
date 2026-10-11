-- 047: policy gaps (Refund Policy v3 §8/§10, Organiser Terms 3.8, 4.9, 10)
--
-- Address reveal (Organiser Terms 4.9 / Refund Policy 10):
--   events.lga                 local government area — always shown, even when
--                              the street address is hidden.
--   events.address_reveal_at   when a hidden address is released (no later
--                              than 24h before doors).
--   events.address_revealed_at when the reveal email went to ticket holders.
--
-- Postponement (Organiser Terms 10 / Refund Policy 8): once tickets are sold
-- an event can be postponed once; the first date is kept for the 30-day
-- limit on a new date.
--   events.postponement_count, events.original_date, events.postponed_at
--
-- Settlement account changes (Organiser Terms 3.8): password + one-time code.
--   users.bank_change_otp, users.bank_change_otp_expires_at
--
-- Idempotent.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS lga                 TEXT,
  ADD COLUMN IF NOT EXISTS address_reveal_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address_revealed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS postponement_count  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_date       DATE,
  ADD COLUMN IF NOT EXISTS postponed_at        TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS events_address_reveal_due_idx
  ON events (address_reveal_at)
  WHERE location_hidden = true AND address_revealed_at IS NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_change_otp            TEXT,
  ADD COLUMN IF NOT EXISTS bank_change_otp_expires_at TIMESTAMPTZ;
