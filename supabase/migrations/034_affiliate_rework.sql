-- Affiliate programme rework: 3 qualifying events (not 2), a 'void' status
-- for commission rows whose event never happened, and bank details on the
-- affiliate side so account-name matching is possible.
--
-- Idempotent — safe to run regardless of which prior migrations have
-- actually been applied to this database.

ALTER TABLE platform_affiliate_commissions
  DROP CONSTRAINT IF EXISTS platform_affiliate_commissions_event_sequence_number_check;
ALTER TABLE platform_affiliate_commissions
  ADD CONSTRAINT platform_affiliate_commissions_event_sequence_number_check
  CHECK (event_sequence_number IN (1, 2, 3));

ALTER TABLE platform_affiliate_commissions
  DROP CONSTRAINT IF EXISTS platform_affiliate_commissions_status_check;
ALTER TABLE platform_affiliate_commissions
  ADD CONSTRAINT platform_affiliate_commissions_status_check
  CHECK (status IN ('pending', 'paid', 'void'));

-- One-time cleanup: void any pending commission row left over from before
-- event cancellation voided the ledger — these events never happened, so
-- nothing on them should ever become payable.
UPDATE platform_affiliate_commissions
SET status = 'void'
WHERE status = 'pending'
  AND event_id IN (SELECT id FROM events WHERE status = 'cancelled');

ALTER TABLE platform_affiliates ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE platform_affiliates ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE platform_affiliates ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE platform_affiliates ADD COLUMN IF NOT EXISTS account_name TEXT;

ALTER TABLE platform_affiliate_referrals
  ADD COLUMN IF NOT EXISTS self_referral_blocked BOOLEAN NOT NULL DEFAULT false;
