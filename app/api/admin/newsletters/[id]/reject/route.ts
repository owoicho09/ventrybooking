import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { sendNewsletterRejectedEmail } from '@/lib/server/email';
import { notify } from '@/lib/server/notify';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason: string = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 });
  }

  const db = getServerSupabase();

  const { data: newsletter } = await db
    .from('newsletters')
    .select('id, organizer_id, subject, status')
    .eq('id', id)
    .maybeSingle();

  if (!newsletter) return NextResponse.json({ error: 'Mail not found' }, { status: 404 });
  if (newsletter.status !== 'pending') {
    return NextResponse.json({ error: 'This mail has already been reviewed' }, { status: 400 });
  }

  const { error: updateErr } = await db
    .from('newsletters')
    .update({ status: 'rejected', rejection_reason: reason, reviewed_at: new Date().toISOString() })
    .eq('id', id);

  if (updateErr) {
    console.error('reject newsletter: update error', updateErr);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  const { data: organizer } = await db
    .from('users')
    .select('name, email')
    .eq('id', newsletter.organizer_id)
    .maybeSingle();

  if (organizer?.email) {
    sendNewsletterRejectedEmail({
      to:            organizer.email,
      organizerName: organizer.name || 'there',
      subject:       newsletter.subject,
      reason,
    }).catch(err => console.error('reject newsletter: email error', err));
  }

  notify(
    { type: 'organizer', id: newsletter.organizer_id },
    {
      notifType: 'newsletter',
      title:     `Mail not approved — "${newsletter.subject}"`,
      body:      reason,
      link:      '/organizer/audience',
    },
  ).catch(console.error);

  return NextResponse.json({ success: true });
}
