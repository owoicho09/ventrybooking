-- Phase 6 of newfeature.txt: organiser profile 2.0.
--
-- cover_image_url is the organiser's own brand banner shown on their public
-- storefront page — distinct from any per-event image (events.banner_url,
-- events.header_banner_url). Follower count and ratings are computed from
-- existing tables (organizer_subscribers, event_reviews) at read time, no
-- new columns needed for those.
--
-- Idempotent — safe to run regardless of which of migrations #11-23 have
-- actually been applied to this database.

ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
