import { NextResponse } from 'next/server';

export function POST() {
  return NextResponse.json({ error: 'Complaints feature has been removed' }, { status: 410 });
}
