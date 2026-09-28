-- 041: let a ticket tier be withdrawn from sale without deleting it.
--
-- A hidden tier is left off every public event listing and refused at
-- checkout. Tickets already sold on it are untouched: they stay valid, still
-- scan, and still settle to the organiser.
--
-- Idempotent: safe to re-run.

ALTER TABLE ticket_tiers ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT false;
