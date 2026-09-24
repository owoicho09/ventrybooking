-- One checkout marketing consent, two lists.
--
-- Checkout used to show two optional boxes: organiser updates (Box 1 →
-- organizer_subscribers) and Ventry updates (Box 2 → only a flag on the
-- ticket; Ventry had no list of its own). They are now a single box that
-- consents to both. Each list keeps its own row and its own unsubscribe
-- token, so leaving one never touches the other:
--
--   * organizer_subscribers — per-organiser Audience (unchanged semantics).
--   * ventry_subscribers    — NEW: Ventry's own list, one row per email.
--
-- Both gain event_id: the event the person consented through (first touch;
-- NULL for Notify Me, which is organiser-scoped rather than per-event).
--
-- Backfill: everyone who ticked the old organiser box (and hasn't since
-- unsubscribed from that organiser) is merged onto Ventry's list with source
-- 'checkout_consent_merged', so the list stays truthful about where the
-- consent came from. Anyone who ticked the old Ventry box is added as
-- 'checkout_consent'. No one is added to an organiser's Audience who hadn't
-- consented to that organiser.
--
-- Idempotent — safe to run more than once.

-- ── Ventry's own list ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ventry_subscribers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT        NOT NULL UNIQUE,
  name              TEXT,
  event_id          UUID        REFERENCES events (id) ON DELETE SET NULL,
  source            TEXT        NOT NULL DEFAULT 'checkout_consent'
                      CHECK (source IN ('checkout_consent', 'checkout_consent_merged')),
  unsubscribe_token TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  subscribed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ventry_subscribers_subscribed_at ON ventry_subscribers (subscribed_at DESC);

-- Service-role only: no policies means the anon/authenticated keys can't read emails.
ALTER TABLE ventry_subscribers ENABLE ROW LEVEL SECURITY;

ALTER TABLE organizer_subscribers
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organizer_subscribers_subscribed_at ON organizer_subscribers (subscribed_at DESC);

-- ── Upserts ─────────────────────────────────────────────────────────────────
-- Replaces the 5-argument version (migrations.sql §20) with one taking an
-- optional event. Dropped first so PostgREST never sees two overloads, which
-- would make the existing 5-named-argument calls ambiguous.
DROP FUNCTION IF EXISTS upsert_audience_member(UUID, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION upsert_audience_member(
  p_organizer_id UUID,
  p_email        TEXT,
  p_name         TEXT,
  p_phone        TEXT,
  p_source       TEXT,
  p_event_id     UUID DEFAULT NULL
) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO organizer_subscribers (organizer_id, email, name, phone, source, event_id, unsubscribed_at)
  VALUES (p_organizer_id, p_email, p_name, p_phone, p_source, p_event_id, NULL)
  ON CONFLICT (organizer_id, email) DO UPDATE SET
    name            = COALESCE(organizer_subscribers.name, EXCLUDED.name),
    phone           = COALESCE(organizer_subscribers.phone, EXCLUDED.phone),
    event_id        = COALESCE(organizer_subscribers.event_id, EXCLUDED.event_id),
    unsubscribed_at = NULL;
$$;

-- Same reactivating, first-touch semantics as the Audience upsert: a fresh
-- purchase-time consent supersedes an earlier unsubscribe from Ventry's list.
CREATE OR REPLACE FUNCTION upsert_ventry_subscriber(
  p_email    TEXT,
  p_name     TEXT,
  p_event_id UUID
) RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO ventry_subscribers (email, name, event_id, source, unsubscribed_at)
  VALUES (p_email, p_name, p_event_id, 'checkout_consent', NULL)
  ON CONFLICT (email) DO UPDATE SET
    name            = COALESCE(ventry_subscribers.name, EXCLUDED.name),
    event_id        = COALESCE(ventry_subscribers.event_id, EXCLUDED.event_id),
    unsubscribed_at = NULL;
$$;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Organiser Audience rows that came from checkout get the event of the
-- buyer's earliest consenting ticket for that organiser.
UPDATE organizer_subscribers os
SET event_id = first_ticket.event_id
FROM (
  SELECT DISTINCT ON (t.organizer_id, lower(t.buyer_email))
         t.organizer_id, lower(t.buyer_email) AS email, t.event_id
  FROM tickets t
  WHERE t.marketing_consent = TRUE
  ORDER BY t.organizer_id, lower(t.buyer_email), t.purchased_at
) first_ticket
WHERE os.event_id IS NULL
  AND os.source = 'ticket_consent'
  AND os.organizer_id = first_ticket.organizer_id
  AND os.email = first_ticket.email;

-- Old Ventry box → Ventry list.
INSERT INTO ventry_subscribers (email, name, event_id, source, subscribed_at)
SELECT DISTINCT ON (lower(t.buyer_email))
       lower(t.buyer_email), NULLIF(t.buyer_name, ''), t.event_id, 'checkout_consent', t.purchased_at
FROM tickets t
WHERE t.ventry_marketing_consent = TRUE AND t.buyer_email <> ''
ORDER BY lower(t.buyer_email), t.purchased_at
ON CONFLICT (email) DO NOTHING;

-- Old organiser-only box → merged onto Ventry's list, except where the buyer
-- has since unsubscribed from every organiser they consented to that way.
INSERT INTO ventry_subscribers (email, name, event_id, source, subscribed_at)
SELECT DISTINCT ON (lower(t.buyer_email))
       lower(t.buyer_email), NULLIF(t.buyer_name, ''), t.event_id, 'checkout_consent_merged', t.purchased_at
FROM tickets t
WHERE t.marketing_consent = TRUE AND t.buyer_email <> ''
  AND EXISTS (
    SELECT 1 FROM organizer_subscribers os
    WHERE os.email = lower(t.buyer_email)
      AND os.organizer_id = t.organizer_id
      AND os.unsubscribed_at IS NULL
  )
ORDER BY lower(t.buyer_email), t.purchased_at
ON CONFLICT (email) DO NOTHING;
