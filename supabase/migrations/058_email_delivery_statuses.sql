-- 058: record every Resend outcome, not just four of them.
--
-- Resend reports 'email.suppressed' when it refuses to send to an address on
-- its suppression list (after an earlier hard bounce or spam complaint) and
-- 'email.failed' when a send fails outright. Both were ignored before, which
-- is how the admin inbox could be silently suppressed while every row here
-- still read 'sent'. Idempotent: safe to re-run.

BEGIN;

ALTER TABLE email_deliveries DROP CONSTRAINT IF EXISTS email_deliveries_status_check;
ALTER TABLE email_deliveries ADD CONSTRAINT email_deliveries_status_check
  CHECK (status IN ('sent', 'delivered', 'delayed', 'bounced', 'complained', 'suppressed', 'failed'));

CREATE INDEX IF NOT EXISTS email_deliveries_created_idx ON email_deliveries (created_at DESC);
CREATE INDEX IF NOT EXISTS email_deliveries_purpose_idx ON email_deliveries (purpose) WHERE purpose IS NOT NULL;

COMMIT;
