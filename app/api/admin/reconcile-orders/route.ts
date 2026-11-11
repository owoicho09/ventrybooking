import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/server/auth';
import { reconcilePendingOrders } from '@/lib/server/reconcile';

export async function POST() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await reconcilePendingOrders();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('POST /api/admin/reconcile-orders error', err);
    return NextResponse.json({ error: 'Failed to reconcile orders' }, { status: 500 });
  }
}

// Ticket creation can render IJGB visa tickets and send the ticket email
// (with retries) inside this request.
export const maxDuration = 60;
