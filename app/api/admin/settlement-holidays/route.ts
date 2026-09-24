import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { getServerSupabase } from '@/lib/supabase/server';

// The public-holiday calendar that working-day settlement eligibility reads.
// Islamic holidays are declared by the FG only days ahead, so this has to be
// editable by admin rather than baked into code.

async function requireAdmin() {
  const user = await getAuthUser();
  return user && user.role === 'admin' ? user : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const db = getServerSupabase();
  const { data, error } = await db
    .from('settlement_holidays')
    .select('holiday_date, name, created_by')
    .order('holiday_date', { ascending: true });
  if (error) return NextResponse.json({ error: 'Failed to load holidays' }, { status: 500 });
  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const date = typeof body.date === 'string' ? body.date.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return NextResponse.json({ error: 'Enter a valid date' }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: 'Enter a name' }, { status: 400 });

  const db = getServerSupabase();
  const { error } = await db
    .from('settlement_holidays')
    .upsert({ holiday_date: date, name, created_by: user.email }, { onConflict: 'holiday_date' });
  if (error) return NextResponse.json({ error: 'Failed to save holiday' }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const date = req.nextUrl.searchParams.get('date') ?? '';
  if (!DATE_RE.test(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  const db = getServerSupabase();
  const { error } = await db.from('settlement_holidays').delete().eq('holiday_date', date);
  if (error) return NextResponse.json({ error: 'Failed to remove holiday' }, { status: 500 });
  return NextResponse.json({ success: true });
}
