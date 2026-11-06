import { cookies } from 'next/headers';
import { ScrollText, ShieldCheck } from 'lucide-react';
import { prisma } from '@/lib/db/prisma';
import { PLATFORM_COOKIE, requirePlatformAdministrator } from '@/features/platform-admin/session';
import { listSafePlatformAudits } from '@/features/account-security/audit-view';
import { PlatformAuditLogTable } from '@/features/platform-admin/audit-log-table';
export default async function PlatformAuditLogsPage() {
  await requirePlatformAdministrator();
  const rows = await listSafePlatformAudits(prisma, (await cookies()).get(PLATFORM_COOKIE)?.value);
  return <div className="platform-section-gap">
    <div><p className="platform-eyebrow">Security and accountability</p><h1 className="platform-title">Audit Logs</h1>
      <p className="platform-description">Review recent security and administrative events. Use filters to find important changes without loading every record at once.</p>
    </div>
    <div className="platform-card">
      <div className="platform-card-header"><div><h2 className="platform-card-title">Recent activity</h2><p className="platform-card-description">The latest 100 available metadata events, filtered in this view</p></div><ScrollText size={20} color="#7a0000"/></div>
      <div className="px-5 pb-5"><PlatformAuditLogTable rows={rows}/></div>
    </div>
    <div className="platform-muted-box flex items-start gap-3"><ShieldCheck size={19} className="shrink-0 text-[#7a0000]"/>
      <p>Audit history remains in the underlying records. This screen only displays recent metadata. Private employee information, payroll amounts and document contents are excluded.</p>
    </div>
  </div>;
}
