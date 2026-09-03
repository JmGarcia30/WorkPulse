import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { logoutAction } from '@/lib/auth/actions';
import { prisma } from '@/lib/db/prisma';
import { LogOut } from 'lucide-react';
import { DashboardSidebarNav } from '@/components/layout/DashboardSidebarNav';
import { DashboardHeader } from '@/components/layout/DashboardHeader';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }

  // Fetch organization details
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true, slug: true },
  });

  const orgName = org?.name || 'Workspace';

  // Compute initials for avatar
  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'WP';

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#181A1C] flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-[#E8EAED] bg-white flex flex-col justify-between shrink-0 sticky top-0 h-screen z-30 shadow-2xs">
        <div className="flex-1 overflow-y-auto">
          {/* Logo & Org Context */}
          <div className="p-5 border-b border-[#E8EAED]">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#181A1C] text-white font-black text-sm shadow-sm">
                WP
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#22C55E] border-2 border-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold tracking-tight text-[#181A1C] truncate">
                  WorkPulse
                </h2>
                <p className="text-[11px] font-medium text-[#6B7280] truncate">
                  {orgName}
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Navigation */}
          <DashboardSidebarNav orgSlug={org?.slug} />
        </div>

        {/* User Account Footer */}
        <div className="p-3 border-t border-[#E8EAED] bg-[#F8F9FA]/60">
          <div className="flex items-center justify-between p-2 rounded-2xl border border-[#E8EAED] bg-white shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#181A1C] text-white font-bold text-xs shadow-2xs">
                {initials}
                <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[#22C55E] ring-1 ring-white" />
              </div>
              <div className="min-w-0 truncate">
                <p className="text-xs font-bold truncate text-[#181A1C]">
                  {user.name}
                </p>
                <span className="inline-block rounded-md bg-[#F4F5F7] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#6B7280]">
                  {user.role}
                </span>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="p-1.5 rounded-lg text-[#6B7280] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <DashboardHeader orgName={orgName} />
        <main className="p-6 sm:p-8 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

