import type { Metadata } from 'next';
import Link from 'next/link';
import { RfidKiosk } from '@/components/attendance/RfidKiosk';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { rfidKioskContext, rfidService } from '@/features/attendance/rfid-server';
import { RfidError } from '@/features/attendance/rfid-service';
import { prisma } from '@/lib/db/prisma';
import { requestWorkspacePath, requireRequestTenant } from '@/lib/tenant/server';
import { poppins } from '@/lib/fonts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'RFID Attendance Kiosk | WorkPulse',
  description: 'WorkPulse RFID attendance scanning terminal.',
};

export default async function AttendanceKioskPage() {
  const tenant = await requireRequestTenant();
  const loginPath = await requestWorkspacePath('/login');
  let session;
  try {
    const { organizationId, token } = await rfidKioskContext();
    session = await rfidService().getKiosk(organizationId, token);
  } catch (error) {
    if (!(error instanceof RfidError)) throw error;
    return (
      <TenantTheme branding={tenant} className={`${poppins.variable} ${poppins.className} min-h-screen bg-[#FAF8F6]`}>
        <main
          className="min-h-screen px-5 py-20 font-sans bg-[#FAF8F6] text-[#282934]"
          style={{ fontFamily: 'var(--font-poppins), Poppins, sans-serif', backgroundColor: '#FAF8F6', color: '#282934' }}
        >
          <section className="wp-card !border-0 !border-none mx-auto max-w-xl space-y-5 p-8" style={{ borderWidth: 0, border: 'none' }}>
            <p className="wp-eyebrow font-semibold tracking-wider">Secure attendance</p>
            <h1 className="wp-page-title font-semibold text-[#282934]">Kiosk authorization required</h1>
            <p className="text-[var(--wp-text-muted)] font-normal">{error.message}</p>
            <Link href={loginPath} className="wp-button-primary text-sm font-semibold">
              HR Sign In
            </Link>
          </section>
        </main>
      </TenantTheme>
    );
  }
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: tenant.organizationId },
    select: { name: true, timeZone: true },
  });
  return (
    <TenantTheme branding={tenant} className={`${poppins.variable} ${poppins.className} min-h-screen bg-[#FAF8F6]`}>
      <RfidKiosk
        organizationName={organization.name}
        expiresInMs={session.expiresInMs}
        timeZone={organization.timeZone}
        apiBase={await requestWorkspacePath('/api/attendance/rfid')}
        loginPath={loginPath}
      />
    </TenantTheme>
  );
}

