import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireEmailAdministrator, requirePublicEmailHost } from '@/features/email-integration/authorization';
import { authorizeConnection, bridgeConnection, completeConnection, receiveGoogleCallback } from '@/features/email-integration/service';
import { EmailIntegrationError } from '@/features/email-integration/google';
import { emailMessage } from '@/features/email-integration/messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const production = process.env.NODE_ENV === 'production';
const tenantCookie = production ? '__Host-workpulse_email_tenant' : 'workpulse_email_tenant';
const publicCookie = production ? '__Host-workpulse_email_public' : 'workpulse_email_public';
export async function GET(request: NextRequest, { params }: { params: Promise<{ step: string }> }) {
  const { step } = await params, state = request.nextUrl.searchParams.get('state') || '';
  const jar = await cookies();
  try {
    if (step === 'start') {
      await requirePublicEmailHost();
      const proof = randomBytes(32).toString('base64url');
      const url = await bridgeConnection(prisma, state, proof);
      jar.set(publicCookie, proof, { httpOnly: true, secure: production, sameSite: 'lax', path: '/', maxAge: 600 });
      return NextResponse.redirect(url);
    }
    if (step === 'authorize') {
      const url = await authorizeConnection(prisma, await requireEmailAdministrator(), state, jar.get(tenantCookie)?.value || '');
      return NextResponse.redirect(url);
    }
    if (step === 'callback') {
      await requirePublicEmailHost();
      if (request.nextUrl.searchParams.has('error')) throw new EmailIntegrationError('CONSENT_REQUIRED');
      const url = await receiveGoogleCallback(prisma, state, jar.get(publicCookie)?.value || '', request.nextUrl.searchParams.get('code') || '');
      jar.delete(publicCookie);
      return NextResponse.redirect(url);
    }
    if (step === 'complete') {
      const url = await completeConnection(prisma, await requireEmailAdministrator(), state, jar.get(tenantCookie)?.value || '');
      jar.delete(tenantCookie);
      return NextResponse.redirect(url);
    }
    return new NextResponse('Not found.', { status: 404 });
  } catch (error) {
    const code = error instanceof EmailIntegrationError ? error.code : 'INVALID_OAUTH_STATE';
    return new NextResponse(emailMessage(code) + ' Return to your organization’s Email Integration settings and start Connect again.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  }
}
