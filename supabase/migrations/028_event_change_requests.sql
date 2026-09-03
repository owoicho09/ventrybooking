-- Correction to Phase 4: cap organiser-initiated venue/date changes at 2
-- applied changes per event. Once that cap is hit, every further change goes
-- through this table for admin approval before it touches `events` or
-- notifies a single buyer — the existing event_changes/refund-window
-- mechanics only ever fire once a request here is approved (by the
-- organiser directly, for the first 2, or by admin afterward).
--
-- Idempotent — safe to run regardless of which prior migrations have been applied.

CREATE TABLE IF NOT EXISTS event_change_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change_type       TEXT NOT NULL CHECK (change_type IN ('venue', 'date', 'venue_and_date')),
  old_value         JSONB NOT NULL,
  new_value         JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at       TIMESTAMPTZ,
  reviewed_by       TEXT,
  rejection_reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_change_requests_event_id ON event_change_requests (event_id);
CREATE INDEX IF NOT EXISTS idx_event_change_requests_status ON event_change_requests (status) WHERE status = 'pending';
