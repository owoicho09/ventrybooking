import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendSettingsChangeCodeEmail } from '@/lib/server/email';
import { maskEmail, requestChangeCode } from '@/lib/server/settingsChange';

/** Step 1 of any settings change: email a 6-digit code to the account address. */
export async function POST() {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServerSupabase();
  const { data: me } = await db.from('users').select('name, email').eq('id', user.sub).maybeSingle();
  if (!me?.email) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const issued = await requestChangeCode(db, user.sub, 'settings');
  if (!issued.ok) return NextResponse.json({ error: issued.error }, { status: issued.status });

  try {
    await sendSettingsChangeCodeEmail(me.email, me.name ?? 'there', issued.code, 'settings');
  } catch (err) {
    console.error('settings code email failed', err);
    return NextResponse.json({ error: 'We couldn’t send the code. Try again in a moment.' }, { status: 502 });
  }
  return NextResponse.json({ success: true, data: { sentTo: maskEmail(me.email) } });
}
