import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { canManageSchedules } from '@/lib/permissions/rbac';
import { getScheduleAssignmentOptions, getScheduleGroups } from '@/features/attendance/queries';
import { ScheduleManager } from '@/components/attendance/ScheduleManager';

export default async function AttendanceSchedulesPage() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (!canManageSchedules(user)) redirect('/dashboard');
  const [groups, employees] = await Promise.all([getScheduleGroups(user.organizationId), getScheduleAssignmentOptions(user.organizationId)]);
  return <div className="space-y-6"><div><h1 className="text-xl font-bold">Work schedules</h1><p className="text-xs text-slate-500">Immutable versions and effective-dated employee assignments</p></div><ScheduleManager groups={groups.map((group) => ({ scheduleKey: group.scheduleKey, name: group.name, versions: group.versions.map((version) => ({ id: version.id, version: version.version, displayName: version.displayName })) }))} employees={employees.map(({ id, employeeNumber, firstName, lastName }) => ({ id, employeeNumber, firstName, lastName }))} /><div className="space-y-3">{groups.map((group) => <section key={group.id} className="rounded-2xl border bg-white p-4"><h2 className="text-sm font-bold">{group.name}</h2><p className="text-xs text-slate-500">{group.scheduleKey}</p><div className="mt-2 flex flex-wrap gap-2">{group.versions.map((version) => <span key={version.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs">v{version.version} · grace {version.lateGraceSeconds}s · {version._count.assignments} assignments</span>)}</div></section>)}</div></div>;
}
