-- Ventry Support Agent (buyer-facing v1): lets the AI agent file a complaint
-- with no matched ticket (the "couldn't find it" case), tag it with a
-- category, and attach the chat transcript.
--
-- Idempotent — safe to run regardless of which prior migrations have
-- actually been applied to this database.

ALTER TABLE complaints ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS transcript JSONB;
-- buyer_name today only ever comes from a tickets join (SELECT only, never
-- inserted) — a ticketless complaint has no ticket to join, so this is the
-- fallback the admin queue reads when there's no matched ticket.
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS buyer_name TEXT;

-- Audit trail for every agent tool call that actually changes something
-- (ticket regeneration, resends, complaint filing) — "every use logged" per
-- the support agent spec.
CREATE TABLE IF NOT EXISTS agent_actions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tool_name   TEXT        NOT NULL,
  buyer_email TEXT        NOT NULL,
  ticket_id   TEXT        REFERENCES tickets(id) ON DELETE SET NULL,
  detail      TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_buyer_email ON agent_actions (buyer_email);
