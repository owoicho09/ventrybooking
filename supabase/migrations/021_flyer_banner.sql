-- Phase 1 of newfeature.txt: flyer + banner split.
--
-- events.banner_url is left untouched — it remains the existing flyer used
-- across cards, OG previews, and ticket emails (already a landscape crop in
-- practice; renaming it was considered and rejected to avoid touching those
-- rendering surfaces for no functional gain).
--
-- header_banner_url is new: the wide 2:1 image that becomes the event page's
-- fixed header. NULL means the organiser hasn't uploaded one, in which case
-- the event page falls back to the existing banner_url hero unchanged.
--
-- Idempotent — safe to run regardless of which of migrations #11-20 (see
-- migrations.sql) have actually been applied to this database.

ALTER TABLE events ADD COLUMN IF NOT EXISTS header_banner_url TEXT;
