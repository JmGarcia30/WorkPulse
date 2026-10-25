import { cookies } from 'next/headers';
import { destroySession } from '@/lib/auth/session';
import { RFID_COOKIE, rfidFailure, rfidHRContext, rfidKioskContext, rfidService } from '@/features/attendance/rfid-server';
import { RFID_KIOSK_SECONDS } from '@/features/attendance/rfid-policy';
import { assertRfidOrigin, rfidJson } from '../transport';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    await assertRfidOrigin(request);
    const context = await rfidHRContext();
    const service = rfidService();
    const store = await cookies();
    const previous = store.get(RFID_COOKIE)?.value;
    if (previous) {
      // An expired or foreign-tenant token cannot prevent fresh HR authorization.
      try { await service.revokeKiosk(context.organizationId, previous); } catch (error) {
        if (!(error instanceof Error && 'code' in error && (error.code === 'KIOSK_EXPIRED' || error.code === 'UNAUTHORIZED'))) throw error;
      }
    }
    const { token, expiresAt } = await service.authorizeKiosk(context);
    store.set(RFID_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: RFID_KIOSK_SECONDS });
    // A kiosk should not leave an HR dashboard session accessible on a shared device.
    await destroySession();
    return rfidJson({ expiresAt: expiresAt.toISOString() });
  } catch (error) {
    const failure = rfidFailure(error);
    return rfidJson(failure, failure.code === 'THROTTLED' ? 429 : failure.code === 'UNAVAILABLE' ? 503 : 403);
  }
}

export async function DELETE(request: Request) {
  try {
    await assertRfidOrigin(request);
    const { organizationId, token } = await rfidKioskContext();
    await rfidService().revokeKiosk(organizationId, token);
    (await cookies()).set(RFID_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
    return rfidJson({ success: true });
  } catch (error) {
    const failure = rfidFailure(error);
    return rfidJson(failure, failure.code === 'UNAVAILABLE' ? 503 : 401);
  }
}
