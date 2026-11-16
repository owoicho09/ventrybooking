import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, cookieOptions } from '@/lib/server/auth';
import { signAuthToken } from '@/lib/server/jwt';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendEmailChangedAlertEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';
import { requireChangeGrant, verifyChangeCode } from '@/lib/server/settingsChange';

/**
 * Change account email, part 2: the code from the NEW inbox switches the
 * address. The old address is told, and this browser's sign-in is reissued
 * for the new email.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getServerSupabase();
  const denied = await requireChangeGrant(db, user.sub, req);
  if (denied) return denied;

  const { code } = await req.json().catch(() => ({})) as { code?: unknown };
  const checked = await verifyChangeCode(db, user.sub, 'email_new', code);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status });
  const newEmail = checked.targetEmail;
  if (!newEmail) return NextResponse.json({ error: 'Start the email change again' }, { status: 400 });

  const { data: me } = await db.from('users').select('name, email').eq('id', user.sub).maybeSingle();
  if (!me) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { error } = await db.from('users').update({ email: newEmail, email_verified: true }).eq('id', user.sub);
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Another Ventry account already uses that email' }, { status: 409 });
    console.error('email change update error', error.message);
    return NextResponse.json({ error: 'Could not change your email' }, { status: 500 });
  }

  sendEmailChangedAlertEmail(me.email, me.name ?? 'there', newEmail).catch(err => console.error('email changed alert error', err));
  notify(
    { type: 'admin' },
    { notifType: 'kyc', title: 'Organiser changed account email', body: `${me.name ?? 'An organiser'} changed their email from ${me.email} to ${newEmail}.`, link: `/admin/organizers/${user.sub}` },
  ).catch(console.error);

  const res = NextResponse.json({ success: true, data: { email: newEmail } });
  res.cookies.set({ ...cookieOptions(30 * 24 * 60 * 60), value: signAuthToken({ sub: user.sub, role: 'organizer', email: newEmail }) });
  return res;
}
