import { NextRequest, NextResponse } from 'next/server';
import { reconcilePendingOrders } from '@/lib/server/reconcile';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await reconcilePendingOrders();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error('GET /api/cron/reconcile-orders error', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
