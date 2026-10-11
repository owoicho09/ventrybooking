-- 046: wallet withdrawal requests
--
-- Next-working-day settlement carries on as before. Alongside it, an
-- organiser can ask for their available balance now: the request notifies
-- the admin, who pays it with the normal Release or "Mark as paid". The
-- request closes itself when a settlement for that organiser succeeds.
--
-- Idempotent.

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id   UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  amount         NUMERIC     NOT NULL CHECK (amount > 0),   -- available net when requested
  status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at    TIMESTAMPTZ,
  resolved_by    TEXT,
  settlement_id  UUID        REFERENCES settlements (id),
  note           TEXT
);

-- At most one open request per organiser.
CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_one_pending
  ON withdrawal_requests (organizer_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS withdrawal_requests_status_idx ON withdrawal_requests (status, requested_at);

ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
