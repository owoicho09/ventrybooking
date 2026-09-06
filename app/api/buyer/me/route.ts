import { NextResponse } from 'next/server';
import { getBuyerAuth } from '@/lib/server/buyerAuth';

export async function GET() {
  const buyer = await getBuyerAuth();
  if (!buyer) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  return NextResponse.json({ success: true, data: { email: buyer.email } });
}
