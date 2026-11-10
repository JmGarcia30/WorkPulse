import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { closeExpiredJobs } from '@/features/hiring/job-auto-close';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authenticated(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 20) return false;
  const actual = request.headers.get('authorization') || '';
  const expected = 'Bearer ' + secret;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Job automation is not configured.' }, { status: 503 });
  }
  if (!authenticated(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const result = await closeExpiredJobs(prisma);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Scheduled job closeout failed', error instanceof Error ? error.name : 'Unknown error');
    return NextResponse.json({ error: 'Unable to process closing deadlines.' }, { status: 503 });
  }
}
