import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: 'ventry_buyer_token',
    value: '',
    httpOnly: true,
    maxAge: 0,
    path: '/',
  });
  return res;
}
