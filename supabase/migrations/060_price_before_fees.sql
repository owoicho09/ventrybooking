-- 060: per-event "show ticket prices before fees".
--
-- By default every buyer-facing price includes the 2% service fee. Some
-- organisers price on purpose (e.g. 4,444 / 40,444 as a brand motif), so an
-- admin can switch an event to show the exact tier prices on the event page,
-- cards and listings, with the service and processing fees itemised at
-- checkout instead. What the buyer pays and the organiser's payout are the
-- same either way; only where the fees are shown changes.
--
-- Idempotent: safe to re-run.

BEGIN;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS price_before_fees BOOLEAN NOT NULL DEFAULT false;

COMMIT;
