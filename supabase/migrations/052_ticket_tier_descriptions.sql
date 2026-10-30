-- Adds buyer-visible descriptions for each ticket tier (e.g. "VIP includes ...").
-- Safe/idempotent to run more than once.

ALTER TABLE ticket_tiers
  ADD COLUMN IF NOT EXISTS description TEXT;

