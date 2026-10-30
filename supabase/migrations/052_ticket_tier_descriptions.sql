-- Add optional organiser-provided descriptions for each ticket tier.
ALTER TABLE ticket_tiers
  ADD COLUMN IF NOT EXISTS description TEXT;

