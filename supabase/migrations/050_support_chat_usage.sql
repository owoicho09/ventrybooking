-- 050: spend tracking for the support chat assistant. The Anthropic credit is
-- small, so every model call records its token usage and cost here, for
-- monitoring only; nothing is blocked on it.

create table if not exists support_chat_usage (
  month              text primary key,          -- 'YYYY-MM', Lagos time
  calls              integer not null default 0,
  input_tokens       bigint  not null default 0,
  cache_write_tokens bigint  not null default 0,
  cache_read_tokens  bigint  not null default 0,
  output_tokens      bigint  not null default 0,
  cost_usd           numeric(10, 4) not null default 0,
  updated_at         timestamptz not null default now()
);

alter table support_chat_usage enable row level security;

create or replace function bump_support_chat_usage(
  p_month text, p_input bigint, p_cache_write bigint, p_cache_read bigint, p_output bigint, p_cost numeric
) returns void language sql as $$
  insert into support_chat_usage (month, calls, input_tokens, cache_write_tokens, cache_read_tokens, output_tokens, cost_usd, updated_at)
  values (p_month, 1, p_input, p_cache_write, p_cache_read, p_output, p_cost, now())
  on conflict (month) do update set
    calls              = support_chat_usage.calls + 1,
    input_tokens       = support_chat_usage.input_tokens + excluded.input_tokens,
    cache_write_tokens = support_chat_usage.cache_write_tokens + excluded.cache_write_tokens,
    cache_read_tokens  = support_chat_usage.cache_read_tokens + excluded.cache_read_tokens,
    output_tokens      = support_chat_usage.output_tokens + excluded.output_tokens,
    cost_usd           = support_chat_usage.cost_usd + excluded.cost_usd,
    updated_at         = now();
$$;
