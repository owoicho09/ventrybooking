-- Daily settlements — replaces the hold-until-the-event escrow model.
--
-- Money from each sales day (Africa/Lagos calendar day of tickets.purchased_at)
-- becomes releasable on the next working day, and an admin releases it by hand.
-- The ledger is built from tickets, not from the event-level `payouts` rows:
--
--   * tickets.settlement_id — the settlement that paid this ticket's money out.
--     A ticket is claimed at most once (claim_settlement only takes rows where
--     it is NULL, under a per-organiser advisory lock), which is what makes a
--     repeated release for the same period a no-op instead of a double payment.
--   * tickets.refund_recovered_settlement_id — for a ticket refunded AFTER its
--     money was already sent, the later settlement that deducted it back.
--   * settlements — one row per money movement (or per legacy escrow payout),
--     with gross, fee, net, period, who released it, and the transfer outcome.
--   * settlement_attempts — every Paystack transfer attempt, including retries,
--     so the audit trail survives a failure-then-retry.
--   * settlement_holidays — Nigerian public holidays as editable data.
--
-- Legacy: every event payout already released under the escrow model
-- (payouts.status completed / otp_pending, or processing with a transfer
-- reference already written) is copied in as ONE settlement row of kind
-- 'legacy_escrow', and that event's tickets are attached to it so they can
-- never be settled again. No daily rows are reconstructed for them.
--
-- Idempotent — safe to run more than once.

-- ── Holiday calendar ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlement_holidays (
  holiday_date DATE        PRIMARY KEY,
  name         TEXT        NOT NULL,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fixed-date holidays are certain. Islamic holidays (Eid-el-Fitr, Eid-el-Kabir,
-- Eid-el-Maulud) move with the moon and the Federal Government declares the
-- exact days shortly before — the ones below are estimates, marked "(est.)",
-- and should be corrected from the admin Holidays page once declared. The same
-- goes for any Monday the FG declares in lieu of a weekend holiday.
INSERT INTO settlement_holidays (holiday_date, name, created_by) VALUES
  ('2026-01-01', 'New Year''s Day',              'migration-038'),
  ('2026-03-20', 'Eid-el-Fitr (est.)',           'migration-038'),
  ('2026-03-23', 'Eid-el-Fitr holiday (est.)',   'migration-038'),
  ('2026-04-03', 'Good Friday',                  'migration-038'),
  ('2026-04-06', 'Easter Monday',                'migration-038'),
  ('2026-05-01', 'Workers'' Day',                'migration-038'),
  ('2026-05-27', 'Eid-el-Kabir (est.)',          'migration-038'),
  ('2026-05-28', 'Eid-el-Kabir holiday (est.)',  'migration-038'),
  ('2026-06-12', 'Democracy Day',                'migration-038'),
  ('2026-08-26', 'Eid-el-Maulud (est.)',         'migration-038'),
  ('2026-10-01', 'Independence Day',             'migration-038'),
  ('2026-12-25', 'Christmas Day',                'migration-038'),
  ('2026-12-26', 'Boxing Day',                   'migration-038'),
  ('2027-01-01', 'New Year''s Day',              'migration-038'),
  ('2027-03-10', 'Eid-el-Fitr (est.)',           'migration-038'),
  ('2027-03-11', 'Eid-el-Fitr holiday (est.)',   'migration-038'),
  ('2027-03-26', 'Good Friday',                  'migration-038'),
  ('2027-03-29', 'Easter Monday',                'migration-038'),
  ('2027-05-01', 'Workers'' Day',                'migration-038'),
  ('2027-05-17', 'Eid-el-Kabir (est.)',          'migration-038'),
  ('2027-05-18', 'Eid-el-Kabir holiday (est.)',  'migration-038'),
  ('2027-06-12', 'Democracy Day',                'migration-038'),
  ('2027-08-16', 'Eid-el-Maulud (est.)',         'migration-038'),
  ('2027-10-01', 'Independence Day',             'migration-038'),
  ('2027-12-25', 'Christmas Day',                'migration-038'),
  ('2027-12-26', 'Boxing Day',                   'migration-038')
ON CONFLICT (holiday_date) DO NOTHING;

-- ── Settlements ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settlements (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id        UUID        NOT NULL REFERENCES users (id),
  kind                TEXT        NOT NULL DEFAULT 'daily'
                        CHECK (kind IN ('daily', 'legacy_escrow')),
  -- Sales period covered, as Africa/Lagos calendar dates (inclusive).
  period_start        DATE        NOT NULL,
  period_end          DATE        NOT NULL,
  -- gross = ticket sales in the period minus earlier-settled tickets refunded
  -- since (refunds_deducted); fee = round(gross * fee_rate); net = gross - fee.
  gross               NUMERIC     NOT NULL,
  refunds_deducted    NUMERIC     NOT NULL DEFAULT 0,
  fee                 NUMERIC     NOT NULL,
  net                 NUMERIC     NOT NULL,
  fee_rate            NUMERIC     NOT NULL,
  ticket_count        INT         NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'processing'
                        CHECK (status IN ('processing', 'otp_pending', 'successful', 'failed', 'void')),
  failure_reason      TEXT,
  -- The CURRENT attempt's Paystack reference; every attempt is in settlement_attempts.
  transfer_reference  TEXT        UNIQUE,
  transfer_code       TEXT,
  attempts            INT         NOT NULL DEFAULT 1,
  released_by         TEXT,
  released_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at          TIMESTAMPTZ,
  -- legacy_escrow rows only
  legacy_payout_id    UUID        UNIQUE REFERENCES payouts (id) ON DELETE SET NULL,
  event_id            UUID        REFERENCES events (id) ON DELETE SET NULL,
  event_name          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlements_organizer ON settlements (organizer_id, released_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_status    ON settlements (status);

CREATE TABLE IF NOT EXISTS settlement_attempts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id       UUID        NOT NULL REFERENCES settlements (id) ON DELETE CASCADE,
  attempt_no          INT         NOT NULL,
  transfer_reference  TEXT        NOT NULL UNIQUE,
  amount              NUMERIC     NOT NULL,
  initiated_by        TEXT,
  initiated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  status              TEXT        NOT NULL DEFAULT 'processing'
                        CHECK (status IN ('processing', 'otp_pending', 'successful', 'failed')),
  paystack_status     TEXT,
  transfer_code       TEXT,
  failure_reason      TEXT,
  finished_at         TIMESTAMPTZ,
  UNIQUE (settlement_id, attempt_no)
);

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES settlements (id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS refund_recovered_settlement_id UUID REFERENCES settlements (id);
CREATE INDEX IF NOT EXISTS idx_tickets_unsettled
  ON tickets (organizer_id, purchased_at) WHERE settlement_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_settlement ON tickets (settlement_id);

-- Service-role only. No policies = anon/authenticated keys can't read money data.
ALTER TABLE settlements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_holidays ENABLE ROW LEVEL SECURITY;

-- ── Legacy escrow payouts → one final settlement each ──────────────────────
INSERT INTO settlements (
  organizer_id, kind, period_start, period_end, gross, fee, net, fee_rate,
  ticket_count, status, transfer_reference, released_by, released_at, settled_at,
  legacy_payout_id, event_id, event_name
)
SELECT
  p.organizer_id, 'legacy_escrow',
  COALESCE(p.date, e.date, CURRENT_DATE), COALESCE(p.date, e.date, CURRENT_DATE),
  p.gross, p.fee, p.net,
  CASE WHEN p.gross > 0 THEN ROUND(p.fee / p.gross, 4) ELSE 0 END,
  (SELECT COUNT(*) FROM tickets t WHERE t.event_id = p.event_id AND t.status IN ('valid', 'used')),
  CASE p.status WHEN 'completed' THEN 'successful'
                WHEN 'otp_pending' THEN 'otp_pending'
                ELSE 'processing' END,
  p.reference, 'escrow-model',
  COALESCE(p.released_at, now()),
  CASE WHEN p.status = 'completed' THEN COALESCE(p.released_at, now()) END,
  p.id, p.event_id, p.event_name
FROM payouts p
LEFT JOIN events e ON e.id = p.event_id
WHERE (p.status IN ('completed', 'otp_pending')
       OR (p.status = 'processing' AND p.reference IS NOT NULL))
  AND NOT EXISTS (SELECT 1 FROM settlements s WHERE s.legacy_payout_id = p.id);

UPDATE tickets t
SET settlement_id = s.id
FROM settlements s
WHERE s.kind = 'legacy_escrow'
  AND s.status <> 'failed'
  AND t.event_id = s.event_id
  AND t.settlement_id IS NULL;

-- ── Claim: create a settlement for everything releasable, atomically ───────
-- Takes every unsettled paid ticket for the organiser sold before p_cutoff
-- (Lagos date), plus refunds on tickets whose earlier settlement was actually
-- sent, and writes the settlement + first attempt in one transaction. Returns
-- NULL — changing nothing — when there is nothing to release, which is what a
-- replayed release sees.
CREATE OR REPLACE FUNCTION claim_settlement(
  p_organizer_id UUID,
  p_cutoff       DATE,
  p_fee_rate     NUMERIC,
  p_released_by  TEXT,
  p_reference    TEXT
) RETURNS SETOF settlements LANGUAGE plpgsql AS $$
DECLARE
  v_id      UUID;
  v_sales   NUMERIC;
  v_count   INT;
  v_start   DATE;
  v_end     DATE;
  v_refunds NUMERIC;
  v_gross   NUMERIC;
  v_fee     NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('settlement:' || p_organizer_id::text));

  INSERT INTO settlements (organizer_id, kind, period_start, period_end, gross, fee, net,
                           fee_rate, status, transfer_reference, released_by)
  VALUES (p_organizer_id, 'daily', p_cutoff, p_cutoff, 0, 0, 0,
          p_fee_rate, 'processing', p_reference, p_released_by)
  RETURNING id INTO v_id;

  WITH claimed AS (
    UPDATE tickets t
    SET settlement_id = v_id
    FROM ticket_tiers tt
    WHERE tt.id = t.tier_id
      AND t.organizer_id = p_organizer_id
      AND t.settlement_id IS NULL
      AND t.status IN ('valid', 'used')
      AND COALESCE(t.subtotal, tt.price) > 0
      AND (t.purchased_at AT TIME ZONE 'Africa/Lagos')::date < p_cutoff
    RETURNING COALESCE(t.subtotal, tt.price) AS amount,
              COALESCE(t.quantity, 1)        AS qty,
              (t.purchased_at AT TIME ZONE 'Africa/Lagos')::date AS sale_date
  )
  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(qty), 0), MIN(sale_date), MAX(sale_date)
  INTO v_sales, v_count, v_start, v_end
  FROM claimed;

  IF v_count = 0 THEN
    DELETE FROM settlements WHERE id = v_id;
    RETURN;
  END IF;

  WITH recovered AS (
    UPDATE tickets t
    SET refund_recovered_settlement_id = v_id
    FROM settlements s, ticket_tiers tt
    WHERE s.id = t.settlement_id
      AND tt.id = t.tier_id
      AND s.kind = 'daily'
      AND s.status = 'successful'
      AND t.organizer_id = p_organizer_id
      AND t.status = 'refunded'
      AND t.refund_recovered_settlement_id IS NULL
    RETURNING COALESCE(t.subtotal, tt.price) AS amount
  )
  SELECT COALESCE(SUM(amount), 0) INTO v_refunds FROM recovered;

  v_gross := v_sales - v_refunds;
  IF v_gross <= 0 THEN
    -- Refunds owed back exceed this batch of sales: release nothing, keep it
    -- all unsettled so it nets off against later sales.
    UPDATE tickets SET settlement_id = NULL WHERE settlement_id = v_id;
    UPDATE tickets SET refund_recovered_settlement_id = NULL WHERE refund_recovered_settlement_id = v_id;
    DELETE FROM settlements WHERE id = v_id;
    RETURN;
  END IF;

  v_fee := ROUND(v_gross * p_fee_rate);

  UPDATE settlements
  SET period_start = v_start, period_end = v_end,
      gross = v_gross, refunds_deducted = v_refunds,
      fee = v_fee, net = v_gross - v_fee, ticket_count = v_count
  WHERE id = v_id;

  INSERT INTO settlement_attempts (settlement_id, attempt_no, transfer_reference, amount, initiated_by)
  VALUES (v_id, 1, p_reference, v_gross - v_fee, p_released_by);

  RETURN QUERY SELECT * FROM settlements WHERE id = v_id;
END;
$$;

-- ── Retry: move a failed settlement back to processing under a new reference ─
-- Only a 'failed' daily settlement can be retried, and only one caller wins
-- (row lock + status check). Tickets refunded while it sat failed are
-- detached (their money never left, so there is nothing to recover later)
-- and the amounts are recomputed from what is still attached.
CREATE OR REPLACE FUNCTION begin_settlement_retry(
  p_settlement_id UUID,
  p_reference     TEXT,
  p_initiated_by  TEXT
) RETURNS SETOF settlements LANGUAGE plpgsql AS $$
DECLARE
  v        settlements;
  v_sales  NUMERIC;
  v_count  INT;
  v_refund NUMERIC;
  v_gross  NUMERIC;
  v_fee    NUMERIC;
BEGIN
  SELECT * INTO v FROM settlements WHERE id = p_settlement_id FOR UPDATE;
  IF NOT FOUND OR v.kind <> 'daily' OR v.status <> 'failed' THEN
    RETURN;
  END IF;

  UPDATE tickets SET settlement_id = NULL
  WHERE settlement_id = v.id AND status = 'refunded' AND refund_recovered_settlement_id IS NULL;

  SELECT COALESCE(SUM(COALESCE(t.subtotal, tt.price)), 0), COALESCE(SUM(COALESCE(t.quantity, 1)), 0)
  INTO v_sales, v_count
  FROM tickets t JOIN ticket_tiers tt ON tt.id = t.tier_id
  WHERE t.settlement_id = v.id;

  SELECT COALESCE(SUM(COALESCE(t.subtotal, tt.price)), 0)
  INTO v_refund
  FROM tickets t JOIN ticket_tiers tt ON tt.id = t.tier_id
  WHERE t.refund_recovered_settlement_id = v.id;

  v_gross := v_sales - v_refund;
  IF v_gross <= 0 THEN
    -- Everything in it was refunded: nothing to send. Void it and hand any
    -- remaining tickets / recovered refunds back to the unsettled pool.
    UPDATE tickets SET settlement_id = NULL WHERE settlement_id = v.id;
    UPDATE tickets SET refund_recovered_settlement_id = NULL WHERE refund_recovered_settlement_id = v.id;
    UPDATE settlements
    SET status = 'void', failure_reason = 'Voided on retry — every ticket in it was refunded', updated_at = now()
    WHERE id = v.id;
    RETURN QUERY SELECT * FROM settlements WHERE id = v.id;
    RETURN;
  END IF;

  v_fee := ROUND(v_gross * v.fee_rate);

  UPDATE settlements
  SET status = 'processing', failure_reason = NULL,
      transfer_reference = p_reference, transfer_code = NULL,
      attempts = v.attempts + 1,
      gross = v_gross, refunds_deducted = v_refund, fee = v_fee, net = v_gross - v_fee,
      ticket_count = v_count, updated_at = now()
  WHERE id = v.id;

  INSERT INTO settlement_attempts (settlement_id, attempt_no, transfer_reference, amount, initiated_by)
  VALUES (v.id, v.attempts + 1, p_reference, v_gross - v_fee, p_initiated_by);

  RETURN QUERY SELECT * FROM settlements WHERE id = v.id;
END;
$$;

-- ── Read helpers (aggregate in SQL — avoids PostgREST's 1000-row cap) ──────
CREATE OR REPLACE FUNCTION settlement_unsettled_by_day(p_organizer_id UUID DEFAULT NULL)
RETURNS TABLE (organizer_id UUID, sale_date DATE, gross NUMERIC, ticket_count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT t.organizer_id,
         (t.purchased_at AT TIME ZONE 'Africa/Lagos')::date,
         SUM(COALESCE(t.subtotal, tt.price)),
         SUM(COALESCE(t.quantity, 1))
  FROM tickets t JOIN ticket_tiers tt ON tt.id = t.tier_id
  WHERE t.settlement_id IS NULL
    AND t.status IN ('valid', 'used')
    AND COALESCE(t.subtotal, tt.price) > 0
    AND (p_organizer_id IS NULL OR t.organizer_id = p_organizer_id)
  GROUP BY 1, 2;
$$;

CREATE OR REPLACE FUNCTION settlement_refunds_owed(p_organizer_id UUID DEFAULT NULL)
RETURNS TABLE (organizer_id UUID, gross NUMERIC, ticket_count BIGINT)
LANGUAGE sql STABLE AS $$
  SELECT t.organizer_id, SUM(COALESCE(t.subtotal, tt.price)), COUNT(*)
  FROM tickets t
  JOIN settlements s   ON s.id = t.settlement_id
  JOIN ticket_tiers tt ON tt.id = t.tier_id
  WHERE s.kind = 'daily' AND s.status = 'successful'
    AND t.status = 'refunded'
    AND t.refund_recovered_settlement_id IS NULL
    AND (p_organizer_id IS NULL OR t.organizer_id = p_organizer_id)
  GROUP BY 1;
$$;
