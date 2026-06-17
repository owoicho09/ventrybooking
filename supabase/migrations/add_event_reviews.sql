-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS event_reviews (
  id           text        PRIMARY KEY,
  event_id     uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id uuid        NOT NULL,
  rating       smallint    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         text,
  display_name text        NOT NULL,
  ip_hash      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup for all reviews on a single event
CREATE INDEX IF NOT EXISTS event_reviews_event_id_idx     ON event_reviews(event_id);

-- Fast aggregation of organizer reputation across all their events
CREATE INDEX IF NOT EXISTS event_reviews_organizer_id_idx ON event_reviews(organizer_id);

-- One review per IP address per event
CREATE UNIQUE INDEX IF NOT EXISTS event_reviews_event_ip_uidx ON event_reviews(event_id, ip_hash);
