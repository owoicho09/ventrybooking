-- 057: new-device sign-in verification for organisers.
--
-- A browser becomes "trusted" for an organiser once they've confirmed an
-- emailed code on it. Signing in from a browser that isn't trusted needs that
-- code before any session is created.
--
--   organizer_trusted_devices   one row per (organiser, browser). token_hash is
--                               sha256 of the secret in the HttpOnly
--                               `ventry_device` cookie; the raw value is never
--                               stored. revoked_at set when the organiser
--                               removes the device in Settings.
--   organizer_login_challenges  a pending sign-in waiting for its emailed code.
--
-- Idempotent: safe to re-run.

BEGIN;

CREATE TABLE IF NOT EXISTS organizer_trusted_devices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT        NOT NULL,
  label         TEXT,
  ip            TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,
  CONSTRAINT organizer_trusted_devices_user_token_key UNIQUE (user_id, token_hash)
);
CREATE INDEX IF NOT EXISTS organizer_trusted_devices_user_idx ON organizer_trusted_devices (user_id, last_used_at DESC);

CREATE TABLE IF NOT EXISTS organizer_login_challenges (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash    TEXT        NOT NULL,
  attempts     INT         NOT NULL DEFAULT 0,
  ip           TEXT,
  label        TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organizer_login_challenges_user_idx ON organizer_login_challenges (user_id, created_at DESC);

ALTER TABLE organizer_trusted_devices  ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizer_login_challenges ENABLE ROW LEVEL SECURITY;

COMMIT;
