import { NextResponse } from 'next/server';

// Retired with the move from escrow to daily settlements. Per-event release
// would pay out tickets that daily settlement also pays — a double payment —
// so it must not exist alongside it. Release money from /admin/payouts, which
// uses /api/admin/settlements/*.
export async function POST() {
  return NextResponse.json(
    { error: 'Per-event payouts have been replaced by daily settlements. Release from the Payouts page.' },
    { status: 410 },
  );
}
