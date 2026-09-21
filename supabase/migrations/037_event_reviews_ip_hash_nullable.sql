-- Reviews have been unable to save since ticket-based reviews replaced the
-- anonymous IP-hash system (migration 023): the live event_reviews table still
-- carries the old `ip_hash TEXT NOT NULL` column, but ticket-based inserts
-- (/api/review/[token] and /api/events/[id]/reviews) have no IP to record, so
-- every submission failed with a NOT NULL violation (HTTP 500).
--
-- ip_hash is now optional. The old UNIQUE (event_id, ip_hash) index is left in
-- place and is harmless: Postgres treats NULLs as distinct, so any number of
-- ticket-based reviews can coexist, while historical hashed rows (if any)
-- keep their one-per-IP guarantee. One-review-per-ticket is enforced by the
-- unique constraint on ticket_id, and one-per-person in application code.
--
-- Idempotent — DROP NOT NULL on an already-nullable column is a no-op.

ALTER TABLE event_reviews ALTER COLUMN ip_hash DROP NOT NULL;
