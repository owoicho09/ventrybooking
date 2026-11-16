-- 054: gated ticket tiers.
--
-- Two independent gates an organiser can put on a single tier (both may be
-- on at once). The event-wide gate, events.allowed_email_domains (025),
-- stays exactly as it is and still applies on top of these.
--
--   ticket_tiers.requires_code          the buyer must enter an active promo
--                                       code for this tier to buy it.
--   ticket_tiers.allowed_email_domains  NULL/empty = any email. Otherwise the
--                                       ticket holder's (checkout-verified)
--                                       email must be at one of these domains.
--
--   tier_access_codes   the codes. Stored normalised (upper-case A-Z0-9, 4-8
--                       chars); matching is case-insensitive by normalising
--                       the buyer's input the same way. Unique per event so a
--                       code can never unlock the wrong tier. Codes are never
--                       sent to buyers' browsers; only the server compares.
--                       No per-code usage cap: the tier's quantity is the cap.
--
--   tickets.access_code_id  which code a ticket was bought with (reporting).
--
--   tier_code_attempts  failed code entries, for brute-force limiting across
--                       server instances (the in-memory limiter is per-instance).
--                       Rows older than a day are useless and can be purged.
--
-- Idempotent: safe to re-run.

BEGIN;

ALTER TABLE ticket_tiers
  ADD COLUMN IF NOT EXISTS requires_code         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_email_domains TEXT[];

CREATE TABLE IF NOT EXISTS tier_access_codes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tier_id         UUID        NOT NULL REFERENCES ticket_tiers(id) ON DELETE CASCADE,
  code            TEXT        NOT NULL CHECK (code ~ '^[A-Z0-9]{4,8}$'),
  active          BOOLEAN     NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deactivated_at  TIMESTAMPTZ,
  CONSTRAINT tier_access_codes_event_code_key UNIQUE (event_id, code)
);
CREATE INDEX IF NOT EXISTS tier_access_codes_tier_idx ON tier_access_codes (tier_id);

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS access_code_id UUID REFERENCES tier_access_codes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS tickets_access_code_idx ON tickets (access_code_id) WHERE access_code_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tier_code_attempts (
  id          BIGSERIAL   PRIMARY KEY,
  key         TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tier_code_attempts_key_idx ON tier_code_attempts (key, created_at);

-- Server-only tables: the service role bypasses RLS; nobody else may read codes.
ALTER TABLE tier_access_codes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tier_code_attempts ENABLE ROW LEVEL SECURITY;

COMMIT;
