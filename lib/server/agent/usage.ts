import { getServerSupabase } from '@/lib/supabase/server';

// The support chat runs on a small prepaid Anthropic credit (~$10 meant to
// last 3+ months), so every model call is costed and recorded in
// support_chat_usage to keep an eye on spend. Nothing is ever blocked on it:
// cost is managed by the model choice, prompt caching and the per-chat limits
// in runLoop.ts and the support-chat route.

// Claude Haiku 4.5, USD per million tokens.
const PRICE = { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 };

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

function monthKey(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }).slice(0, 7);
}

export function costUsd(u: Usage): number {
  return (
    u.input_tokens * PRICE.input +
    (u.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite +
    (u.cache_read_input_tokens ?? 0) * PRICE.cacheRead +
    u.output_tokens * PRICE.output
  ) / 1_000_000;
}

export async function recordUsage(u: Usage): Promise<void> {
  const { error } = await getServerSupabase().rpc('bump_support_chat_usage', {
    p_month: monthKey(),
    p_input: u.input_tokens,
    p_cache_write: u.cache_creation_input_tokens ?? 0,
    p_cache_read: u.cache_read_input_tokens ?? 0,
    p_output: u.output_tokens,
    p_cost: Math.round(costUsd(u) * 10000) / 10000,
  });
  if (error) console.error('support chat usage record error', error.message);
}
