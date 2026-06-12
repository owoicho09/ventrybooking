import { NextResponse } from 'next/server';

// KYC document upload is no longer used — organizers verify via email OTP.
export async function POST() {
  return NextResponse.json({ error: 'KYC document upload is no longer required. Verify your email instead.' }, { status: 410 });
}
