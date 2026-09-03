-- Phase 7 of newfeature.txt: restricted-audience events.
--
-- NULL/empty = unrestricted (the default, unaffected). A non-empty array
-- means checkout only accepts buyer emails whose domain is in this list —
-- enforced server-side in /api/checkout and /api/checkout/free, never
-- trusting the client.
--
-- Idempotent — safe to run regardless of which of migrations #11-24 have
-- actually been applied to this database.

ALTER TABLE events ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[];
