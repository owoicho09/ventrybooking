-- 044: per-event refund policy (Refund Policy 5.2, Organiser Terms 4.4)
--
-- Before an event goes live the organiser answers five questions and Ventry
-- generates the published refund policy from the answers (lib/refundPolicy.ts).
-- The answers are stored as JSON:
--   { "version": 1,
--     "cancelDays":   7 | 14 | 30,
--     "postponement": "refund_all" | "refund_on_request" | "no_refund",
--     "venueChange":  "refund_on_request" | "no_refund",
--     "guestNoShow":  "refund_on_request" | "no_refund",
--     "contactEmail": "refunds@example.com" }
-- The minimum standards (full base price on cancellation, 30-day claim
-- window, headliner protection, ...) are fixed and not stored.
--
-- Existing events start with NULL; their page shows the minimum standards
-- until the organiser sets a policy. Idempotent.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS refund_policy        JSONB,
  ADD COLUMN IF NOT EXISTS refund_policy_set_at TIMESTAMPTZ;

COMMENT ON COLUMN events.refund_policy IS 'Organiser answers to the five refund questions; the published policy is generated from these (lib/refundPolicy.ts)';
