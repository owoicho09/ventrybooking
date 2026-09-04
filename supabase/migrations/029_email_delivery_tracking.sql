-- Resend webhook support: every outbound email is now recorded with the
-- message id Resend hands back at send time, so later webhook events
-- (delivered / bounced / complained / delayed) can be matched back to a
-- specific send and its recipient. Closes the blind spot where
-- resend.emails.send() returning no error was being treated as proof of
-- actual delivery — it only proves Resend accepted the request.
--
-- Idempotent — safe to run regardless of which prior migrations have
-- actually been applied to this database.

CREATE TABLE IF NOT EXISTS email_deliveries (
  id           TEXT        PRIMARY KEY,   -- Resend message id
  to_email     TEXT        NOT NULL,
  subject      TEXT        NOT NULL,
  purpose      TEXT,                      -- e.g. 'ticket', 'reminder', 'otp' — free-form, for triage
  status       TEXT        NOT NULL DEFAULT 'sent'
                 CHECK (status IN ('sent', 'delivered', 'delayed', 'bounced', 'complained')),
  last_event_at TIMESTAMPTZ,
  bounce_reason TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_to_email ON email_deliveries (to_email);
CREATE INDEX IF NOT EXISTS idx_email_deliveries_status    ON email_deliveries (status);
