-- 043b (OPTIONAL, run only if the client agrees): keep today's badges.
--
-- Before 043, every event of a verified organiser showed "Verified". This
-- keeps exactly that visible state for live and past events, so nothing
-- disappears on deploy; admins can then un-verify any event from the events
-- page once its venue has (or hasn't) been confirmed.
--
-- Note (checked 2026-10-11): only 1 of the 7 published events has venue
-- proof on file. A stricter backfill that also required venue proof
-- (add `AND e.venue_proof_url IS NOT NULL`) would remove the badge from
-- every other event, including the only live one.
--
-- Skip this file entirely to start every event unverified until an admin
-- confirms its venue.

UPDATE events e
SET verified = true,
    verified_at = COALESCE(e.verified_at, now()),
    verified_by = COALESCE(e.verified_by, 'backfill:043b')
FROM users u
WHERE u.id = e.organizer_id
  AND u.verified = true
  AND e.status IN ('approved', 'completed')
  AND e.verified = false;
