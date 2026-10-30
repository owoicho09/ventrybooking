const fs = require('fs');
const { spawnSync } = require('child_process');

function parseDotenv(raw) {
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith(' ) && value.endsWith( ')) || (value.startsWith( ) && value.endsWith( ))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function pickDbUrl(envLike) {
  const preferredKeys = [
    'NEW_SUPABASE_TRANSACTION_POOLER',
    'SUPABASE_TRANSACTION_POOLER',
    'NEW_SUPABASE_POOLER',
    'SUPABASE_DB_URL',
    'POSTGRES_URL',
    'DATABASE_URL',
    'DIRECT_URL',
  ];

  for (const k of preferredKeys) {
    const v = envLike[k];
    if (typeof v === 'string' && /^postgres(ql)?:\/\//i.test(v)) return v;
  }

  for (const entry of Object.entries(envLike)) {
    const k = entry[0];
    const v = entry[1];
    if (!/POOLER|POSTGRES|DATABASE/i.test(k)) continue;
    if (typeof v === 'string' && /^postgres(ql)?:\/\//i.test(v)) return v;
  }

  return null;
}

function main() {
  const dotenvPath = '.env.local';
  if (!fs.existsSync(dotenvPath)) {
    console.error('[migrate] Missing ' + dotenvPath + '.');
    process.exit(1);
  }

  const envLike = parseDotenv(fs.readFileSync(dotenvPath, 'utf8'));
  const dbUrl = pickDbUrl(envLike);
  if (!dbUrl) {
    console.error('[migrate] Could not find a postgres:// URL in .env.local (looked for pooler/db url keys).');
    process.exit(1);
  }

  const args = ['supabase', 'db', 'query', '--db-url', dbUrl, '--file', 'supabase/migrations/052_ticket_tier_descriptions.sql', '--yes'];
  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const r = spawnSync(cmd, args, { stdio: 'inherit' });
  process.exit(r.status == null ? 1 : r.status);
}

main();
