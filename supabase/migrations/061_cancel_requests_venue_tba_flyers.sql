-- 061: organiser cancellation requests, paused sales, venue-to-be-announced
-- events, and up to 3 flyers per event.
--
-- sales_paused_reason   Non-null stops checkout while the event page stays
--                       visible (ticket holders still need it):
--                         'cancel_requested'  organiser asked to cancel
--                         'venue_missing'     venue not added by the deadline
-- cancel_requested_at / cancel_request_reason
--                       An organiser's pending request to cancel an event
--                       that has sold tickets. An admin confirms (normal
--                       refund process) or declines.
-- venue_tba             Listed with city + LGA only; the venue must be added
--                       no later than 7 days before the event. Reminder and
--                       deadline stamps make each email go out once.
-- flyer_urls            Up to 3 flyers in display order. banner_url always
--                       mirrors flyer_urls[1] so cards, emails and share
--                       images keep using one picture.
--
-- Idempotent: safe to re-run.

BEGIN;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS sales_paused_reason       TEXT,
  ADD COLUMN IF NOT EXISTS cancel_requested_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_request_reason     TEXT,
  ADD COLUMN IF NOT EXISTS venue_tba                 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venue_reminder_10_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_reminder_8_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_deadline_alerted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_deadline_extended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS venue_announced_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flyer_urls                TEXT[];

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_sales_paused_reason_check
    CHECK (sales_paused_reason IS NULL OR sales_paused_reason IN ('cancel_requested', 'venue_missing'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_flyer_urls_max3
    CHECK (flyer_urls IS NULL OR cardinality(flyer_urls) <= 3);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing single flyers become the first (only) entry.
UPDATE events SET flyer_urls = ARRAY[banner_url]
WHERE flyer_urls IS NULL AND banner_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_venue_tba_idx ON events (date) WHERE venue_tba;
CREATE INDEX IF NOT EXISTS events_cancel_requested_idx ON events (cancel_requested_at) WHERE cancel_requested_at IS NOT NULL;

COMMIT;
