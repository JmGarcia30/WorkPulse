import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { PLATFORM_COOKIE, requirePlatformAdministrator } from '@/features/platform-admin/session';
import { listSafePlatformAudits } from '@/features/account-security/audit-view';
import { PlatformAuditLogTable } from '@/features/platform-admin/audit-log-table';
export default async function PlatformAuditLogsPage() {
  await requirePlatformAdministrator();
  const rows = await listSafePlatformAudits(prisma, (await cookies()).get(PLATFORM_COOKIE)?.value);
  return <section className="space-y-4"><h1 className="text-2xl font-bold">Audit Logs</h1>
    <p className="text-sm">Latest 100 recorded events across modules, with filters and 20 results per page. Older events remain in their source records; this is a recent-event view, not an archive. Actor references are pseudonymous. Tenant people, financial amounts, documents and raw audit payloads are excluded.</p>
    <PlatformAuditLogTable rows={rows} />
  </section>;
}
