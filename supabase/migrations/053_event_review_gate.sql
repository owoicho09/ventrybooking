-- 053: bring back manual review before an event goes public.
--
-- Since f236f48 (2026-09-04) every event was created 'approved' and went
-- live at once. From now on a new event starts 'under_review'; an admin
-- approves it (-> 'approved', public, on sale) or rejects it (-> 'rejected',
-- kept with the reason so the organiser can fix it and resubmit, instead of
-- the old hard delete).
--
--   submitted_at      when the organiser last sent it for review (create or resubmit).
--   reviewed_at/by    the admin decision (by = admin email, like events.verified_by).
--   rejection_reason  shown to the organiser on the event page; cleared on approve.
--
-- Events already live are untouched. Idempotent: safe to re-run. If the
-- constraint step fails, some row holds a status outside this list; nothing
-- is changed in that case (the file runs in one transaction).

BEGIN;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by      TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft', 'under_review', 'approved', 'rejected', 'completed', 'cancelled'));

ALTER TABLE events ALTER COLUMN status SET DEFAULT 'under_review';

CREATE INDEX IF NOT EXISTS events_review_queue_idx
  ON events (submitted_at)
  WHERE status = 'under_review';

COMMIT;
