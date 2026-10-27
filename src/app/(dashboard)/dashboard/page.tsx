import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { getBackOfficeReadContext } from '@/lib/auth/guards';
import { readDashboardData } from '@/features/dashboard/read-model';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardSummaryCards } from '@/components/dashboard/DashboardSummaryCards';
import { AttendanceTrackerDonut } from '@/components/dashboard/AttendanceTrackerDonut';
import { WeeklyAttendanceTrend } from '@/components/dashboard/WeeklyAttendanceTrend';
import { HrSchedulePanel } from '@/components/dashboard/HrSchedulePanel';
import { HiringPipelineWidget } from '@/components/dashboard/HiringPipelineWidget';
import { RequiresAttentionWidget } from '@/components/dashboard/RequiresAttentionWidget';

export default async function DashboardPage() {
  const user = await getBackOfficeReadContext();

  // Only newly registered workspaces need first-time setup. SAGA retains its
  // established institutional branding and existing HR dashboard flow.
  if (user.role === Role.HR_ADMIN || user.role === Role.ORGANIZATION_ADMIN) {
    const [organization, branding] = await Promise.all([
      prisma.organization.findUnique({ where: { id: user.organizationId }, select: { slug: true } }),
      prisma.organizationBranding.findUnique({
        where: { organizationId: user.organizationId },
        select: { displayName: true, primaryColor: true, accentColor: true },
      }),
    ]);
    if (organization && organization.slug !== 'st-aloysius' &&
        (!branding?.displayName || !branding?.primaryColor || !branding?.accentColor)) {
      redirect(await requestWorkspacePath('/dashboard/organization/setup'));
    }
  }

  const data = await readDashboardData(user);

  if (!data) {
    redirect('/login');
  }

  return (
    <div className="space-y-6">
      {/* Top Header: Welcome on Left, 3 Compact Stats on Right */}
      <DashboardHeader
        userName={data.user.firstName}
        newHires={data.headerStats.newHires}
        attendanceRate={data.headerStats.attendanceRate}
        pendingActionsCount={data.headerStats.pendingActionsCount}
        asOfFormatted={data.asOfFormatted}
      />

      {/* Main & Middle Area: CSS Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left Side: First Row (3 Metric Cards) + Middle Row (Donut & Trend) */}
        <div className="xl:col-span-8 flex flex-col gap-5">
          {/* First Row — Three Summary Cards */}
          <DashboardSummaryCards
            totalEmployees={data.summaryCards.totalEmployees}
            presentToday={data.summaryCards.presentToday}
            openPositions={data.summaryCards.openPositions}
            hasHrAccess={data.permissions.hasHrAccess}
            totalCandidates={data.pipeline.totalActiveCandidates}
            scheduledInterviews={
              data.schedule.events.filter((e) => e.type === 'INTERVIEW').length
            }
          />

          {/* Middle Row — Attendance Tracker & Weekly Attendance Trend */}
          {data.permissions.hasHrAccess ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 items-stretch">
              <div className="md:col-span-5 h-full">
                <AttendanceTrackerDonut
                  present={data.attendanceDonut.present}
                  absent={data.attendanceDonut.absent}
                  incomplete={data.attendanceDonut.incomplete}
                  approvedLeave={data.attendanceDonut.approvedLeave}
                  totalRecorded={data.attendanceDonut.totalRecorded}
                  rate={data.attendanceDonut.rate}
                />
              </div>
              <div className="md:col-span-7 h-full">
                <WeeklyAttendanceTrend
                  weekRangeLabel={data.weeklyTrend.weekRangeLabel}
                  days={data.weeklyTrend.days}
                  totalPresentThisWeek={data.weeklyTrend.totalPresentThisWeek}
                  avgDailyPresent={data.weeklyTrend.avgDailyPresent}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1">
              <HiringPipelineWidget
                totalActiveCandidates={data.pipeline.totalActiveCandidates}
                stages={data.pipeline.stages}
              />
            </div>
          )}
        </div>

        {/* Right Side — HR Schedule Panel (Calendar & Timeline) */}
        <div className="xl:col-span-4 h-full">
          <HrSchedulePanel
            currentDateStr={data.schedule.currentDateStr}
            days={data.schedule.days}
            events={data.schedule.events}
            timeZone={data.branding.timeZone}
          />
        </div>
      </div>

      {/* Bottom Area: Recruitment Pipeline on Left, HR Action Queue on Right */}
      {data.permissions.hasHrAccess ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-4 h-full">
            <HiringPipelineWidget
              totalActiveCandidates={data.pipeline.totalActiveCandidates}
              stages={data.pipeline.stages}
            />
          </div>
          <div className="lg:col-span-8 h-full">
            <RequiresAttentionWidget items={data.attentionQueue} />
          </div>
        </div>
      ) : (
        <div className="w-full">
          <RequiresAttentionWidget items={data.attentionQueue} />
        </div>
      )}
    </div>
  );
}
