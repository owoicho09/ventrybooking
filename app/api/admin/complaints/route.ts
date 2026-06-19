import { NextResponse } from 'next/server';

const gone = () =>
  NextResponse.json({ error: 'Complaints feature has been removed' }, { status: 410 });

export const GET  = gone;
export const POST = gone;
