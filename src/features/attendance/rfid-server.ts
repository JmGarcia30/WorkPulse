import 'server-only';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { resolveRequestTenant } from '@/lib/tenant/server';
import { createRfidService, isRfidAdministrator, RfidError } from './rfid-service';

export const RFID_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-workpulse_rfid_kiosk' : 'workpulse_rfid_kiosk';
export const rfidService = () => createRfidService(prisma, process.env.SESSION_SECRET ?? '');

export async function rfidHRContext() {
  const user = await getSession();
  if (!user || !isRfidAdministrator(user.role)) throw new RfidError('UNAUTHORIZED', 'HR administrator access is required.');
  return { organizationId: user.organizationId, actorUserId: user.userId };
}

export async function rfidKioskContext() {
  const tenant = await resolveRequestTenant();
  const token = (await cookies()).get(RFID_COOKIE)?.value;
  if (!tenant || !token) throw new RfidError('KIOSK_EXPIRED', 'Kiosk session expired. Ask HR to authorize this device.');
  return { organizationId: tenant.organizationId, token };
}

export function rfidFailure(error: unknown) {
  if (error instanceof RfidError) {
    if (['UNAUTHORIZED', 'KIOSK_EXPIRED', 'INVALID_ORIGIN', 'THROTTLED', 'IDEMPOTENCY_CONFLICT'].includes(error.code)) console.warn('RFID request rejected.', { code: error.code });
    return { error: error.message, code: error.code };
  }
  // Never return Prisma messages, connection strings, hashes, or raw scan input.
  const databaseCode = error instanceof Error && 'code' in error && /^P\d{4}$/.test(String(error.code)) ? String(error.code) : undefined;
  console.error('RFID operation failed.', JSON.stringify({ code: 'RFID_UNAVAILABLE', databaseCode }));
  return { error: 'Attendance service is temporarily unavailable. Please try again.', code: 'UNAVAILABLE' };
}
