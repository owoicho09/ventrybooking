import { NextResponse } from 'next/server';
import { cookieOptions } from '@/lib/server/auth';

// Clears the sign-in cookie using the same attributes it was set with
// (name, path, secure, sameSite), so every browser drops it.
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({ ...cookieOptions(0), value: '' });
  return res;
}
