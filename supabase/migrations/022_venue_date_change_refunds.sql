-- Phase 4 of newfeature.txt: venue/date change buyer refund window.
--
-- One row per real-world change event (not per changed field) — if venue and
-- date change together in one edit, that's one row with change_type
-- 'venue_and_date' and both old/new values captured. A later, separate edit
-- gets its own row with its own independent 48h-or-until-event window,
-- scoped only to tickets purchased before THAT row's changed_at (buyers who
-- purchase after a change bought the new details, so they're never eligible
-- against it).
--
-- ticket_change_refunds is the audit trail the brief requires: one row per
-- (ticket, change) — the unique constraint is what makes the opt-out claim
-- atomic and guards against double-refunding the same change from a replayed
-- or double-clicked link, the same idempotency pattern the `purchases` table
-- already uses for webhook/callback races.
--
-- Idempotent — safe to run regardless of which of migrations #11-21 have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS event_changes (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                  UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  change_type               TEXT NOT NULL CHECK (change_type IN ('venue', 'date', 'venue_and_date')),
  old_value                 JSONB NOT NULL,
  new_value                 JSONB NOT NULL,
  changed_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  refund_window_closes_at   TIMESTAMPTZ NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_change_refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         TEXT NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  event_change_id   UUID NOT NULL REFERENCES event_changes(id) ON DELETE CASCADE,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'refunded', 'failed')),
  refund_amount     NUMERIC,
  failure_reason    TEXT,
  opted_out_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  refunded_at       TIMESTAMPTZ,
  UNIQUE (ticket_id, event_change_id)
);

CREATE INDEX IF NOT EXISTS idx_event_changes_event_id ON event_changes(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_change_refunds_ticket_id ON ticket_change_refunds(ticket_id);
