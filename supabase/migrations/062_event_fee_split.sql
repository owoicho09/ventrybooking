-- 062: per-event fee split.
--
-- Ventry's fee is 5% of the ticket price. The organiser picks who pays it
-- when creating an event:
--
--   fee_split        buyer   host
--   buyer_5           5%      0%
--   host_5            0%      5%
--   even              2.5%    2.5%
--   host3_buyer2      2%      3%    (the long-standing default)
--   host2_buyer3      3%      2%
--
-- An organiser with a custom (discounted) rate keeps the discount, taken off
-- the host share first. The effective rates are stored on the event when it
-- is created or its split changes (locked once a ticket sells):
--
--   events.buyer_fee_rate  service fee added for the buyer (NULL = 2%)
--   events.host_fee_rate   deducted from the organiser's payout
--                          (NULL = the organiser's platform_fee_rate, i.e.
--                          exactly the pre-062 behaviour)
--
-- Every new ticket stamps the host rate it was sold under
-- (tickets.host_fee_rate). Settlements now charge each ticket its own rate,
-- falling back to the organiser's rate for tickets sold before this (NULL),
-- so every existing payout is unchanged to the naira.
--
-- Idempotent: safe to re-run.

BEGIN;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS fee_split      TEXT,
  ADD COLUMN IF NOT EXISTS buyer_fee_rate NUMERIC(6,5),
  ADD COLUMN IF NOT EXISTS host_fee_rate  NUMERIC(6,5);

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_fee_split_check
    CHECK (fee_split IS NULL OR fee_split IN ('buyer_5', 'host_5', 'even', 'host3_buyer2', 'host2_buyer3'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE events ADD CONSTRAINT events_fee_rates_range
    CHECK ((buyer_fee_rate IS NULL OR (buyer_fee_rate >= 0 AND buyer_fee_rate <= 0.1))
       AND (host_fee_rate  IS NULL OR (host_fee_rate  >= 0 AND host_fee_rate  <= 0.1)));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS host_fee_rate NUMERIC(6,5);

-- ── Unsettled sales by day, now with the host fee they carry ──────────────
-- fee_raw is unrounded; callers round once per batch, as claim_settlement does.
DROP FUNCTION IF EXISTS settlement_unsettled_by_day(UUID);
CREATE FUNCTION settlement_unsettled_by_day(p_organizer_id UUID DEFAULT NULL)
RETURNS TABLE (organizer_id UUID, sale_date DATE, gross NUMERIC, ticket_count BIGINT, fee_raw NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT t.organizer_id,
         (t.purchased_at AT TIME ZONE 'Africa/Lagos')::date,
         SUM(COALESCE(t.subtotal, tt.price)),
         SUM(COALESCE(t.quantity, 1)),
         SUM(COALESCE(t.subtotal, tt.price) * COALESCE(t.host_fee_rate, u.platform_fee_rate, 0.03))
  FROM tickets t
  JOIN ticket_tiers tt ON tt.id = t.tier_id
  JOIN users u         ON u.id = t.organizer_id
  WHERE t.settlement_id IS NULL
    AND t.status IN ('valid', 'used')
    AND COALESCE(t.subtotal, tt.price) > 0
    AND (p_organizer_id IS NULL OR t.organizer_id = p_organizer_id)
  GROUP BY 1, 2;
$$;

DROP FUNCTION IF EXISTS settlement_refunds_owed(UUID);
CREATE FUNCTION settlement_refunds_owed(p_organizer_id UUID DEFAULT NULL)
RETURNS TABLE (organizer_id UUID, gross NUMERIC, ticket_count BIGINT, fee_raw NUMERIC)
LANGUAGE sql STABLE AS $$
  SELECT t.organizer_id,
         SUM(COALESCE(t.subtotal, tt.price)),
         COUNT(*),
         SUM(COALESCE(t.subtotal, tt.price) * COALESCE(t.host_fee_rate, u.platform_fee_rate, 0.03))
  FROM tickets t
  JOIN settlements s   ON s.id = t.settlement_id
  JOIN ticket_tiers tt ON tt.id = t.tier_id
  JOIN users u         ON u.id = t.organizer_id
  WHERE s.kind = 'daily' AND s.status = 'successful'
    AND t.status = 'refunded'
    AND t.refund_recovered_settlement_id IS NULL
    AND (p_organizer_id IS NULL OR t.organizer_id = p_organizer_id)
  GROUP BY 1;
$$;

-- ── claim_settlement: same as 040, but each ticket pays its own host rate ──
-- p_fee_rate is the organiser's rate: the fallback for tickets sold before
-- 062. With no stamped rates the fee is ROUND(gross * p_fee_rate), exactly as
-- before.
CREATE OR REPLACE FUNCTION claim_settlement(
  p_organizer_id UUID,
  p_cutoff       DATE,
  p_fee_rate     NUMERIC,
  p_released_by  TEXT,
  p_reference    TEXT
) RETURNS SETOF settlements LANGUAGE plpgsql AS $$
DECLARE
  v_id         UUID;
  v_sales      NUMERIC;
  v_sales_fee  NUMERIC;
  v_count      INT;
  v_start      DATE;
  v_end        DATE;
  v_refunds    NUMERIC;
  v_refund_fee NUMERIC;
  v_gross      NUMERIC;
  v_fee        NUMERIC;
  v_adj        NUMERIC;
  v_mixed      BOOLEAN;
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
              COALESCE(t.subtotal, tt.price) * COALESCE(t.host_fee_rate, p_fee_rate) AS fee_amt,
              (t.host_fee_rate IS NOT NULL AND t.host_fee_rate <> p_fee_rate) AS custom_rate,
              COALESCE(t.quantity, 1)        AS qty,
              (t.purchased_at AT TIME ZONE 'Africa/Lagos')::date AS sale_date
  )
  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(fee_amt), 0), COALESCE(SUM(qty), 0),
         MIN(sale_date), MAX(sale_date), COALESCE(BOOL_OR(custom_rate), false)
  INTO v_sales, v_sales_fee, v_count, v_start, v_end, v_mixed
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
    RETURNING COALESCE(t.subtotal, tt.price) AS amount,
              COALESCE(t.subtotal, tt.price) * COALESCE(t.host_fee_rate, p_fee_rate) AS fee_amt
  )
  SELECT COALESCE(SUM(amount), 0), COALESCE(SUM(fee_amt), 0) INTO v_refunds, v_refund_fee FROM recovered;

  v_gross := v_sales - v_refunds;
  v_fee   := ROUND(GREATEST(v_sales_fee - v_refund_fee, 0));

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
      fee = v_fee, net = v_gross - v_fee - v_adj, ticket_count = v_count,
      -- A batch mixing fee splits records its effective rate.
      fee_rate = CASE WHEN v_mixed THEN ROUND(v_fee / v_gross, 5) ELSE p_fee_rate END
  WHERE id = v_id;

  INSERT INTO settlement_attempts (settlement_id, attempt_no, transfer_reference, amount, initiated_by)
  VALUES (v_id, 1, p_reference, v_gross - v_fee - v_adj, p_released_by);

  RETURN QUERY SELECT * FROM settlements WHERE id = v_id;
END;
$$;

COMMIT;
