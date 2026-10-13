-- 049: scheduled go-live. An organiser can list an event now and have it go
-- on sale at a date and time they choose (e.g. list on Monday, tickets live
-- Friday 12:00). Until then the event is hidden from the public and checkout
-- refuses it. The organiser can move the time as often as they like until it
-- goes live.
--
--   goes_live_at      null = live as soon as it's listed (every event before 049).
--   live_notified_at  when the "your event is live" email went out. The
--                     go-live cron picks up events whose goes_live_at has
--                     passed and that haven't been notified yet.

alter table events add column if not exists goes_live_at timestamptz;
alter table events add column if not exists live_notified_at timestamptz;

create index if not exists events_go_live_pending_idx
  on events (goes_live_at)
  where goes_live_at is not null and live_notified_at is null;
