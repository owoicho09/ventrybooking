import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getServerSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEW_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEW_SUPABASE_SERVICE_ROLE;
    if (!url || !key) {
      throw new Error('Missing Supabase server configuration');
    }
    _client = createClient(
      url,
      key,
      { auth: { persistSession: false } }
    );
  }
  return _client;
}
