import Link from 'next/link';
import { RfidKiosk } from '@/components/attendance/RfidKiosk';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { rfidKioskContext, rfidService } from '@/features/attendance/rfid-server';
import { RfidError } from '@/features/attendance/rfid-service';
import { prisma } from '@/lib/db/prisma';
import { requestWorkspacePath, requireRequestTenant } from '@/lib/tenant/server';

export const dynamic = 'force-dynamic';
export default async function AttendanceKioskPage() {
  const tenant = await requireRequestTenant();
  const loginPath = await requestWorkspacePath('/login');
  let session;
  try {
    const { organizationId, token } = await rfidKioskContext();
    session = await rfidService().getKiosk(organizationId, token);
  } catch (error) {
    if (!(error instanceof RfidError)) throw error;
    return <main className="mx-auto max-w-xl space-y-5 px-5 py-20"><h1 className="wp-page-title">Kiosk authorization required</h1><p>{error.message}</p><Link href={loginPath} className="wp-button-primary">HR Sign In</Link></main>;
  }
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: tenant.organizationId }, select: { name: true, timeZone: true } });
  return <TenantTheme branding={tenant}><RfidKiosk organizationName={organization.name} expiresInMs={session.expiresInMs} timeZone={organization.timeZone} apiBase={await requestWorkspacePath('/api/attendance/rfid')} loginPath={loginPath} /></TenantTheme>;
}
