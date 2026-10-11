-- 042: manual settlements
--
-- Paystack transfers aren't being used for payouts right now: the admin pays
-- organisers by bank transfer and records it. A manual settlement goes
-- through exactly the same ticket claim as a Paystack one (claim_settlement,
-- so the same tickets can never be paid twice), and is then marked
-- successful with the admin's own bank reference instead of a Paystack
-- transfer. A failed Paystack settlement can also be marked paid by hand.
--
-- Idempotent: safe to run more than once.

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS payment_method   TEXT NOT NULL DEFAULT 'paystack',
  ADD COLUMN IF NOT EXISTS manual_reference TEXT,
  ADD COLUMN IF NOT EXISTS manual_note      TEXT,
  ADD COLUMN IF NOT EXISTS paid_by          TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settlements_payment_method_check'
  ) THEN
    ALTER TABLE settlements
      ADD CONSTRAINT settlements_payment_method_check
      CHECK (payment_method IN ('paystack', 'manual'));
  END IF;
END $$;

-- A manual settlement must say which bank transfer paid it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'settlements_manual_reference_check'
  ) THEN
    ALTER TABLE settlements
      ADD CONSTRAINT settlements_manual_reference_check
      CHECK (payment_method <> 'manual' OR (manual_reference IS NOT NULL AND length(trim(manual_reference)) > 0));
  END IF;
END $$;

COMMENT ON COLUMN settlements.payment_method   IS 'paystack = sent by Paystack transfer; manual = admin paid by bank transfer and recorded it';
COMMENT ON COLUMN settlements.manual_reference IS 'Bank transfer reference/narration the admin used for a manual settlement';
COMMENT ON COLUMN settlements.paid_by          IS 'Admin who recorded a manual payment';
