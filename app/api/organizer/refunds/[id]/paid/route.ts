import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';
import { reportListPaid } from '@/lib/server/refundCases';

export const maxDuration = 60;

const ALLOWED = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/;

/** The organiser reports the claim list paid, with proof of payment (Refund Policy §6.7). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user || user.role !== 'organizer') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = getServerSupabase();

  const form = await req.formData();
  const file = form.get('proof') as File | null;
  const note = String(form.get('note') ?? '').trim().slice(0, 1000) || null;
  if (!file || file.size === 0) return NextResponse.json({ error: 'Upload proof of payment (bank statement or transfer receipts)' }, { status: 400 });
  if (file.size > 15 * 1024 * 1024) return NextResponse.json({ error: 'The file must be under 15MB' }, { status: 400 });
  if (file.type && !ALLOWED.test(file.type)) return NextResponse.json({ error: 'Upload a PDF or an image' }, { status: 400 });

  const { data: c } = await db.from('refund_cases').select('id, organizer_id, status').eq('id', id).maybeSingle();
  if (!c || c.organizer_id !== user.sub) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (c.status !== 'list_sent') return NextResponse.json({ error: 'There is no claim list waiting to be paid here' }, { status: 400 });

  try {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `refund-proofs/${user.sub}/${id}/${uuidv4()}.${ext}`;
    const { error: upErr } = await db.storage.from('event-assets').upload(path, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream' });
    if (upErr) throw upErr;
    const url = db.storage.from('event-assets').getPublicUrl(path).data.publicUrl;
    const count = await reportListPaid(db, id, user.sub, url, note);
    return NextResponse.json({ success: true, data: { count } });
  } catch (err) {
    console.error('report refunds paid error', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }
}
