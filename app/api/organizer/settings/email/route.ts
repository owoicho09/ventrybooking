import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendSettingsChangeCodeEmail } from '@/lib/server/email';
import { maskEmail, requestChangeCode, requireChangeGrant } from '@/lib/server/settingsChange';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Change account email, part 1 (needs a settings grant, i.e. the current
 * inbox already confirmed): send a code to the NEW address to prove it's theirs.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServerSupabase();
  const denied = await requireChangeGrant(db, user.sub, req);
  if (denied) return denied;

  const { newEmail } = await req.json().catch(() => ({})) as { newEmail?: unknown };
  const email = String(newEmail ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });

  const { data: me } = await db.from('users').select('name, email').eq('id', user.sub).maybeSingle();
  if (!me) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  if (me.email.toLowerCase() === email) return NextResponse.json({ error: 'That’s already your email' }, { status: 400 });

  // Case-insensitive match; % and _ escaped so they aren't wildcards.
  const { data: taken } = await db.from('users').select('id').ilike('email', email.replace(/[%_\\]/g, '\\$&')).limit(1).maybeSingle();
  if (taken) return NextResponse.json({ error: 'Another Ventry account already uses that email' }, { status: 409 });

  const issued = await requestChangeCode(db, user.sub, 'email_new', email);
  if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: issued.status });
  try {
    await sendSettingsChangeCodeEmail(email, me.name ?? 'there', issued.code, 'new_email');
  } catch (err) {
    console.error('new email code send failed', err);
    return NextResponse.json({ error: 'We couldn’t send a code to that address. Check it and try again.' }, { status: 502 });
  }
  return NextResponse.json({ success: true, data: { sentTo: maskEmail(email) } });
}
