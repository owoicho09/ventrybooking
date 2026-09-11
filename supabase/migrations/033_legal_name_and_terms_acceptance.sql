-- Display name vs legal name split, plus versioned terms acceptance across
-- organisers, buyers and affiliates. `name` on `users` stays the public
-- display name unchanged; `legal_name` is new and starts empty for every
-- existing organiser, prompted for on the payout page.
--
-- Idempotent — safe to run regardless of which prior migrations have
-- actually been applied to this database.

ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE buyer_profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

ALTER TABLE platform_affiliates ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE platform_affiliates ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
