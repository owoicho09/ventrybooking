import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envText.replace(/\r/g, '').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^"(.*)"$/, '$1');
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const emails = [
  'maskedinsightog@gmail.com','reachiyin@icloud.com','blissjames2008@gmail.com',
  'tami.awy12@gmail.com','ibkdaveonas@gmail.com','urumshiloh@gmail.com',
  'maidoeru@gmail.com','campbellanetor@gmail.com','ameerdeenobayemi@gmail.com',
  'rahilamohd02@gmail.com',
];

const { data, error } = await db
  .from('tickets')
  .select('buyer_email, event_id, status, purchased_at')
  .eq('total_paid', 0)
  .in('buyer_email', emails)
  .order('purchased_at', { ascending: true });
if (error) { console.error(error); process.exit(1); }

const byBuyer = new Map();
for (const t of data) {
  const key = t.buyer_email.toLowerCase();
  if (!byBuyer.has(key)) byBuyer.set(key, { valid: 0, refunded: 0 });
  if (t.status === 'valid' || t.status === 'used') byBuyer.get(key).valid++;
  else byBuyer.get(key).refunded++;
}

for (const [email, v] of byBuyer) {
  console.log(`${email}: valid=${v.valid}  revoked=${v.refunded}`);
}
