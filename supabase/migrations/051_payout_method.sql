-- 051: organisers choose how they're paid.
--   bank   (default) each day's sales are settled to their bank account the
--          next working day, as before.
--   wallet sales build up in their Ventry wallet and are only paid out when
--          they press Withdraw; the daily release skips them until then.

alter table users add column if not exists payout_method text not null default 'bank';

do $$ begin
  alter table users add constraint users_payout_method_check check (payout_method in ('bank', 'wallet'));
exception when duplicate_object then null; end $$;
