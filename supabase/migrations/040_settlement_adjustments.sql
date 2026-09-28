-- 040: one-off deductions from an organiser's next settlement.
--
-- For money an organiser owes back that isn't tied to a refunded ticket — e.g.
-- a hand transfer made at the wrong fee rate. An adjustment is a NET amount
-- (naira, after fee) taken off the next release. claim_settlement attaches
-- every unapplied adjustment to the settlement it creates, under the same
-- per-organiser advisory lock as the ticket claim, so an adjustment is
-- deducted at most once.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS settlement_adjustments (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id           UUID        NOT NULL REFERENCES users (id),
  amount                 NUMERIC     NOT NULL CHECK (amount > 0),
  reason                 TEXT        NOT NULL,
  created_by             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_settlement_id  UUID        REFERENCES settlements (id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_adjustments_unapplied
  ON settlement_adjustments (organizer_id) WHERE applied_settlement_id IS NULL;

ALTER TABLE settlement_adjustments ENABLE ROW LEVEL SECURITY;

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS adjustments_deducted NUMERIC NOT NULL DEFAULT 0;

-- ── Claim: as 038, plus unapplied adjustments come off the net ──────────────
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
  v_adj     NUMERIC;
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
  v_fee   := ROUND(GREATEST(v_gross, 0) * p_fee_rate);

  SELECT COALESCE(SUM(amount), 0) INTO v_adj
  FROM settlement_adjustments
  WHERE organizer_id = p_organizer_id AND applied_settlement_id IS NULL;

  IF v_gross <= 0 OR v_gross - v_fee - v_adj <= 0 THEN
    -- Refunds / adjustments owed back exceed this batch of sales: release
    -- nothing, keep it all unsettled so it nets off against later sales.
    UPDATE tickets SET settlement_id = NULL WHERE settlement_id = v_id;
    UPDATE tickets SET refund_recovered_settlement_id = NULL WHERE refund_recovered_settlement_id = v_id;
    DELETE FROM settlements WHERE id = v_id;
    RETURN;
  END IF;

  UPDATE settlement_adjustments
  SET applied_settlement_id = v_id
  WHERE organizer_id = p_organizer_id AND applied_settlement_id IS NULL;

  UPDATE settlements
  SET period_start = v_start, period_end = v_end,
      gross = v_gross, refunds_deducted = v_refunds, adjustments_deducted = v_adj,
      fee = v_fee, net = v_gross - v_fee - v_adj, ticket_count = v_count
  WHERE id = v_id;

  INSERT INTO settlement_attempts (settlement_id, attempt_no, transfer_reference, amount, initiated_by)
  VALUES (v_id, 1, p_reference, v_gross - v_fee - v_adj, p_released_by);

  RETURN QUERY SELECT * FROM settlements WHERE id = v_id;
END;
$$;

-- ── Retry: as 038, keeping the settlement's adjustments deducted ────────────
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
  v_fee   := ROUND(GREATEST(v_gross, 0) * v.fee_rate);

  IF v_gross <= 0 OR v_gross - v_fee - v.adjustments_deducted <= 0 THEN
    -- Nothing left to send. Void it and hand any remaining tickets, recovered
    -- refunds and adjustments back so they apply to a later release.
    UPDATE tickets SET settlement_id = NULL WHERE settlement_id = v.id;
    UPDATE tickets SET refund_recovered_settlement_id = NULL WHERE refund_recovered_settlement_id = v.id;
    UPDATE settlement_adjustments SET applied_settlement_id = NULL WHERE applied_settlement_id = v.id;
    UPDATE settlements
    SET status = 'void', failure_reason = 'Voided on retry — refunds and adjustments left nothing to send',
        adjustments_deducted = 0, updated_at = now()
    WHERE id = v.id;
    RETURN QUERY SELECT * FROM settlements WHERE id = v.id;
    RETURN;
  END IF;

  UPDATE settlements
  SET status = 'processing', failure_reason = NULL,
      transfer_reference = p_reference, transfer_code = NULL,
      attempts = v.attempts + 1,
      gross = v_gross, refunds_deducted = v_refund, fee = v_fee,
      net = v_gross - v_fee - v.adjustments_deducted,
      ticket_count = v_count, updated_at = now()
  WHERE id = v.id;

  INSERT INTO settlement_attempts (settlement_id, attempt_no, transfer_reference, amount, initiated_by)
  VALUES (v.id, v.attempts + 1, p_reference, v_gross - v_fee - v.adjustments_deducted, p_initiated_by);

  RETURN QUERY SELECT * FROM settlements WHERE id = v.id;
END;
$$;

CREATE OR REPLACE FUNCTION settlement_adjustments_owed(p_organizer_id UUID DEFAULT NULL)
RETURNS TABLE (organizer_id UUID, amount NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT a.organizer_id, SUM(a.amount)
  FROM settlement_adjustments a
  WHERE a.applied_settlement_id IS NULL
    AND (p_organizer_id IS NULL OR a.organizer_id = p_organizer_id)
  GROUP BY 1;
$$;
