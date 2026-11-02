import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { PLATFORM_COOKIE, requirePlatformAdministrator } from '@/features/platform-admin/session';
import { listSafePlatformAudits } from '@/features/account-security/audit-view';
export default async function PlatformAuditLogsPage() {
  await requirePlatformAdministrator();
  const rows = await listSafePlatformAudits(prisma, (await cookies()).get(PLATFORM_COOKIE)?.value);
  return <section className="space-y-4"><h1 className="text-2xl font-bold">Audit Logs</h1>
    <p className="text-sm">Latest 100 recorded events across modules. Actor references are pseudonymous. Tenant people, financial amounts, documents and raw audit payloads are excluded. Historical events are shown only where recorded.</p>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[1000px] text-left text-xs"><caption className="sr-only">Safe system administration audit metadata</caption>
      <thead><tr>{['Timestamp','Organization','Actor','Module','Action','Affected record type','Outcome','Safe description'].map(h => <th key={h} scope="col" className="p-3">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r,i) => <tr key={r.reference + r.module + i} className="border-t align-top"><td className="p-3"><time dateTime={r.timestamp}>{r.timestamp}</time></td><td className="p-3">{r.organization}</td><td className="p-3 font-mono">{r.actor}</td><td className="p-3">{r.module}</td><td className="p-3">{r.action}</td><td className="p-3">{r.recordType}</td><td className="p-3">{r.outcome}</td><td className="p-3">{r.description}</td></tr>)}</tbody>
    </table></div>{rows.length === 0 && <p>No recorded audit events.</p>}
  </section>;
}
