import 'server-only';

import {
  ApplicationStatus,
  AssessmentStatus,
  AttendanceStatus,
  JobStatus,
  LeaveRequestStatus,
  OfferStatus,
  OnboardingTaskStatus,
  ProbationStatus,
  Prisma,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { UserSessionPayload } from '@/lib/auth/session';
import {
  canViewEmployees,
  canViewHiringData,
  canViewPayroll,
} from '@/lib/permissions/rbac';
import { getRequestOrganizationBranding } from '@/lib/tenant/server';
import type { OrganizationBrandingView } from '@/features/organization-branding/read-model';
import {
  attendanceDateForInstant,
  attendanceDateToDb,
  instantForLocalSecond,
  parseAttendanceDate,
} from '@/features/attendance/domain';
import { resolveAnalyticsRange } from '@/features/analytics/date-range';
import { readDashboardEmployeeAlerts } from './employee-alerts';

export interface ScheduleItem {
  id: string;
  type: 'INTERVIEW' | 'PROBATION' | 'PAYROLL' | 'LEAVE';
  typeLabel: string;
  title: string;
  subtitle: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string | null; // e.g. "10:00 AM" if known, or null for date-based items
  href: string;
  departmentOrInfo?: string;
}

export interface AttentionItemDetail {
  id: string;
  employeeOrCandidate: string;
  departmentOrRole?: string;
  actionRequired: string;
  category: 'Leave' | 'Probation' | 'Assessment' | 'Offer' | 'Onboarding' | 'Payroll' | 'Setup';
  dueDate: string;
  status: string;
  statusVariant: 'warning' | 'pending' | 'info' | 'danger' | 'neutral';
  href: string;
}

export interface DayAttendanceTrend {
  dateStr: string;
  dayLabel: string;
  dayShort: string;
  dayNumber: number;
  presentCount: number;
  lateCount: number;
  isToday: boolean;
}

export interface PipelineStageCount {
  stage: string;
  label: string;
  count: number;
  percentage: number;
  href: string;
}

export interface DashboardViewModel {
  user: {
    id: string;
    name: string;
    firstName: string;
    role: string;
  };
  branding: {
    displayName: string;
    slug: string;
    timeZone: string;
    primary: string;
    accent: string;
  };
  asOfDateStr: string;
  asOfFormatted: string;
  permissions: {
    hasHrAccess: boolean;
    hasPayrollAccess: boolean;
    hasHiringAccess: boolean;
  };
  headerStats: {
    newHires: number;
    attendanceRate: number | null; // Reliable H3 attendance rate, percentage
    pendingActionsCount: number;
  };
  summaryCards: {
    totalEmployees: number;
    presentToday: number;
    openPositions: number;
  };
  attendanceDonut: {
    present: number;
    absent: number;
    incomplete: number;
    approvedLeave: number;
    totalRecorded: number;
    rate: number | null;
  };
  weeklyTrend: {
    weekRangeLabel: string;
    days: DayAttendanceTrend[];
    totalPresentThisWeek: number;
    avgDailyPresent: number;
  };
  schedule: {
    currentDateStr: string;
    days: { dateStr: string; dayName: string; dayNumber: number; isToday: boolean; eventCount: number }[];
    events: ScheduleItem[];
  };
  pipeline: {
    totalActiveCandidates: number;
    stages: PipelineStageCount[];
  };
  attentionQueue: AttentionItemDetail[];
}

export async function readDashboardData(session: UserSessionPayload, asOf = new Date(), db: Prisma.TransactionClient = prisma, suppliedBranding?: OrganizationBrandingView): Promise<DashboardViewModel | null> {
  const organizationId = session.organizationId;
  const branding = suppliedBranding ?? await getRequestOrganizationBranding(organizationId);
  if (!branding || branding.organizationId !== organizationId) return null;

  const hasHrAccess = canViewEmployees(session);
  const hasPayrollAccess = canViewPayroll(session);
  const hasHiringAccess = canViewHiringData(session);

  const timeZone = branding.timeZone;
  const todayStr = attendanceDateForInstant(asOf, timeZone);


  // Month range using H8 definition
  const monthRange = resolveAnalyticsRange({ preset: 'this-month' }, timeZone, asOf);

  // Calculate current week bounds (Monday to Sunday)
  const todayPlain = parseAttendanceDate(todayStr);
  const mondayPlain = todayPlain.subtract({ days: todayPlain.dayOfWeek - 1 });
  const sundayPlain = mondayPlain.add({ days: 6 });

  const weekStartStr = mondayPlain.toString();
  const weekEndStr = sundayPlain.toString();
  const weekStartDb = attendanceDateToDb(weekStartStr);
  const weekEndDb = attendanceDateToDb(weekEndStr);

  // Expanded schedule window: current week + next week (14 days)
  const scheduleEndPlain = mondayPlain.add({ days: 13 });
  const scheduleEndStr = scheduleEndPlain.toString();
  const scheduleEndDb = attendanceDateToDb(scheduleEndStr);
  const scheduleStartInstant = instantForLocalSecond(weekStartStr, 0, timeZone);
  const scheduleEndInstant = instantForLocalSecond(scheduleEndStr, 86_400, timeZone);


  // One bounded grouped read replaces today/month/week fan-out. Keep each card's
  // original predicates: Present Today includes leave; donut/trend exclude it.
  type AttendanceGroup = { attendanceDate: Date; attendanceStatus: AttendanceStatus; disposition: string; count: bigint; finalized: bigint; late: bigint };
  const attendancePromise = hasHrAccess ? Promise.resolve(db.$queryRaw<AttendanceGroup[]>(Prisma.sql`
    SELECT "attendanceDate", "attendanceStatus", "disposition", COUNT(*) AS "count",
      COUNT(*) FILTER (WHERE "finalizedAt" IS NOT NULL AND "disposition" = 'NORMAL'
        AND "attendanceStatus" IN ('PRESENT','ABSENT','INCOMPLETE')) AS "finalized",
      COUNT(*) FILTER (WHERE "lateSeconds" > 0) AS "late"
    FROM "DailyAttendanceRecord" WHERE "organizationId" = ${organizationId}
      AND (("attendanceDate" BETWEEN ${monthRange.from}::date AND ${monthRange.to}::date)
        OR ("attendanceDate" BETWEEN ${weekStartStr}::date AND ${weekEndStr}::date))
    GROUP BY "attendanceDate", "attendanceStatus", "disposition"
  `)) : Promise.resolve([] as AttendanceGroup[]);
  const workforcePromise = hasHrAccess ? Promise.resolve(db.$queryRaw<Array<{ active: bigint; hires: bigint }>>(Prisma.sql`
    SELECT COUNT(*) FILTER (WHERE "employeeStatus" = 'ACTIVE') AS "active",
      COUNT(*) FILTER (WHERE "createdAt" >= ${monthRange.fromInstant} AND "createdAt" < ${monthRange.throughInstant}) AS "hires"
    FROM "Employee" WHERE "organizationId" = ${organizationId}
  `)) : Promise.resolve([]);

  const employeeAlertsPromise = readDashboardEmployeeAlerts(db, organizationId, hasPayrollAccess, hasHrAccess);

  // Run all primary queries in parallel
  const [
    activeEmployeesCount,
    presentTodayCount,
    openJobsCount,
    newHiresCount,
    finalizedAttendanceGroups,
    todayAttendanceGroups,
    weeklyAttendanceRecords,
    interviews,
    probationDue,
    payrollPeriods,
    approvedLeaveDays,
    applicationStages,
    onboardingCount,
    pendingLeaveRequests,
    submittedAssessments,
    pendingOffers,
    pendingOnboardingTasks,
    missingCompensationEmployees,
    incompleteSetupEmployees,
  ] = await Promise.all([
    workforcePromise.then(rows => Number(rows[0]?.active ?? 0)),
    attendancePromise.then(rows => rows.filter(row => row.attendanceDate.toISOString().slice(0, 10) === todayStr && row.attendanceStatus === 'PRESENT').reduce((sum, row) => sum + Number(row.count), 0)),
    db.job.count({ where: { organizationId, status: JobStatus.PUBLISHED } }),
    workforcePromise.then(rows => Number(rows[0]?.hires ?? 0)),
    attendancePromise.then(rows => [AttendanceStatus.PRESENT, AttendanceStatus.ABSENT, AttendanceStatus.INCOMPLETE].map(status => ({ attendanceStatus: status, _count: { _all: rows.filter(row => row.attendanceStatus === status && row.attendanceDate >= monthRange.fromDate && row.attendanceDate <= monthRange.toDate).reduce((sum, row) => sum + Number(row.finalized), 0) } }))),
    attendancePromise.then(rows => rows.filter(row => row.attendanceDate.toISOString().slice(0, 10) === todayStr).map(row => ({ ...row, _count: { _all: Number(row.count) } }))),
    attendancePromise.then(rows => rows.filter(row => row.attendanceDate >= weekStartDb && row.attendanceDate <= weekEndDb)),
    // 8. Scheduled candidate interviews
    hasHiringAccess
      ? db.interview.findMany({
          where: {
            application: { job: { organizationId } },
            status: 'SCHEDULED',
            scheduledAt: { gte: scheduleStartInstant, lte: scheduleEndInstant },
          },
          include: {
            application: {
              select: {
                id: true,
                applicant: { select: { firstName: true, lastName: true } },
                job: { select: { title: true, department: true } },
              },
            },
          },
          orderBy: { scheduledAt: 'asc' },
          take: 25,
        })
      : Promise.resolve([]),

    // 9. Probation reviews approaching their due date
    hasHrAccess
      ? db.probationRecord.findMany({
          where: {
            employee: { organizationId },
            probationStatus: ProbationStatus.ACTIVE,
            decision: 'PENDING',
            expectedEndAt: { gte: weekStartDb, lte: scheduleEndDb },
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                employmentRecords: {
                  orderBy: { effectiveFrom: 'desc' },
                  take: 1,
                  select: { department: true },
                },
              },
            },
          },
          orderBy: { expectedEndAt: 'asc' },
          take: 20,
        })
      : Promise.resolve([]),

    // 10. Payroll pay dates
    hasPayrollAccess
      ? db.payrollPeriod.findMany({
          where: {
            organizationId,
            payDate: { gte: weekStartDb, lte: scheduleEndDb },
          },
          select: { id: true, name: true, payDate: true, status: true },
          orderBy: { payDate: 'asc' },
          take: 10,
        })
      : Promise.resolve([]),

    // 11. Approved employee leave dates
    hasHrAccess
      ? db.leaveRequestDay.findMany({
          where: {
            organizationId,
            attendanceDate: { gte: weekStartDb, lte: scheduleEndDb },
            leaveRequest: { status: LeaveRequestStatus.APPROVED },
          },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employmentRecords: {
                  orderBy: { effectiveFrom: 'desc' },
                  take: 1,
                  select: { department: true },
                },
              },
            },
            leaveRequest: {
              select: {
                id: true,
                leaveType: { select: { name: true } },
              },
            },
          },
          orderBy: { attendanceDate: 'asc' },
          take: 30,
        })
      : Promise.resolve([]),

    // 12. Application stage counts
    db.application.groupBy({
      by: ['status'],
      where: { job: { organizationId } },
      _count: { _all: true },
    }),

    // 13. Onboarding count
    db.onboardingProcess.count({
      where: {
        application: { job: { organizationId } },
        status: 'IN_PROGRESS',
      },
    }),

    // 14. Pending leave requests (for Action Queue)
    hasHrAccess
      ? db.leaveRequest.findMany({
          where: { organizationId, status: LeaveRequestStatus.PENDING },
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeNumber: true,
                employmentRecords: {
                  orderBy: { effectiveFrom: 'desc' },
                  take: 1,
                  select: { department: true },
                },
              },
            },
            leaveType: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        })
      : Promise.resolve([]),

    // 15. Submitted assessments
    hasHiringAccess
      ? db.assessment.findMany({
          where: {
            application: { job: { organizationId } },
            status: AssessmentStatus.SUBMITTED,
          },
          include: {
            application: {
              select: {
                id: true,
                applicant: { select: { firstName: true, lastName: true } },
                job: { select: { title: true, department: true } },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        })
      : Promise.resolve([]),

    // 16. Pending offers awaiting approval
    hasHiringAccess
      ? db.offer.findMany({
          where: {
            application: { job: { organizationId } },
            status: OfferStatus.PENDING_APPROVAL,
          },
          include: {
            application: {
              select: {
                id: true,
                applicant: { select: { firstName: true, lastName: true } },
                job: { select: { title: true, department: true } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
        })
      : Promise.resolve([]),

    // 17. Pending onboarding task submissions
    hasHiringAccess
      ? db.onboardingTask.findMany({
          where: {
            onboardingProcess: { application: { job: { organizationId } } },
            status: OnboardingTaskStatus.SUBMITTED,
          },
          include: {
            onboardingProcess: {
              select: {
                application: {
                  select: {
                    id: true,
                    applicant: { select: { firstName: true, lastName: true } },
                    job: { select: { title: true, department: true } },
                  },
                },
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 15,
        })
      : Promise.resolve([]),

    // 18. Employees missing active compensation
    employeeAlertsPromise.then(rows => rows.filter(row => row.kind === 'compensation')),

    // 19. Incomplete employee records
    employeeAlertsPromise.then(rows => rows.filter(row => row.kind === 'setup')),
  ]);

  // Attendance Rate calculation (Reliable H8 definition)
  const finalizedWorkdays = finalizedAttendanceGroups.reduce((sum, g) => sum + g._count._all, 0);
  const finalizedPresent = finalizedAttendanceGroups.find((g) => g.attendanceStatus === 'PRESENT')?._count._all ?? 0;
  const attendanceRate = finalizedWorkdays > 0 ? Number(((100 * finalizedPresent) / finalizedWorkdays).toFixed(1)) : null;

  // Donut Breakdown (Today)
  const presentDonut = todayAttendanceGroups
    .filter((g) => g.attendanceStatus === 'PRESENT' && g.disposition !== 'APPROVED_LEAVE')
    .reduce((sum, g) => sum + g._count._all, 0);
  const absentDonut = todayAttendanceGroups
    .filter((g) => g.attendanceStatus === 'ABSENT' && g.disposition !== 'APPROVED_LEAVE')
    .reduce((sum, g) => sum + g._count._all, 0);
  const incompleteDonut = todayAttendanceGroups
    .filter((g) => g.attendanceStatus === 'INCOMPLETE' && g.disposition !== 'APPROVED_LEAVE')
    .reduce((sum, g) => sum + g._count._all, 0);
  const approvedLeaveDonut = todayAttendanceGroups
    .filter((g) => g.disposition === 'APPROVED_LEAVE')
    .reduce((sum, g) => sum + g._count._all, 0);
  const totalRecordedToday = presentDonut + absentDonut + incompleteDonut + approvedLeaveDonut;
  const todayRate = totalRecordedToday > 0 ? Math.round((presentDonut / totalRecordedToday) * 100) : null;

  // Weekly Attendance Trend Data (7 days of Monday -> Sunday)
  const dayNamesShort = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayNamesFull = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyDays: DayAttendanceTrend[] = [];
  let totalPresentThisWeek = 0;

  for (let i = 0; i < 7; i++) {
    const curPlain = mondayPlain.add({ days: i });
    const curDateStr = curPlain.toString();
    const curDb = attendanceDateToDb(curDateStr);

    const dayRecords = weeklyAttendanceRecords.filter(
      (r) => r.attendanceDate.toISOString().slice(0, 10) === curDb.toISOString().slice(0, 10)
    );

    const presentCount = dayRecords.filter(
      (r) => r.attendanceStatus === 'PRESENT' && r.disposition !== 'APPROVED_LEAVE'
    ).reduce((sum, row) => sum + Number(row.count), 0);
    const lateCount = dayRecords.filter(
      (r) => r.disposition !== 'APPROVED_LEAVE'
    ).reduce((sum, row) => sum + Number(row.late), 0);

    totalPresentThisWeek += presentCount;

    weeklyDays.push({
      dateStr: curDateStr,
      dayLabel: dayNamesFull[i],
      dayShort: dayNamesShort[i],
      dayNumber: curPlain.day,
      presentCount,
      lateCount,
      isToday: curDateStr === todayStr,
    });
  }

  const workdaysElapsed = weeklyDays.filter((d) => d.presentCount > 0).length || 1;
  const avgDailyPresent = Math.round(totalPresentThisWeek / workdaysElapsed);

  // Format month and week label
  const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone });
  const weekRangeLabel = `${monthFormatter.format(new Date(`${weekStartStr}T00:00:00Z`))} - ${monthFormatter.format(new Date(`${weekEndStr}T00:00:00Z`))}`;

  // Schedule Normalized Events
  const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone });
  const scheduleEvents: ScheduleItem[] = [];

  // Interviews
  for (const item of interviews) {
    const dateStr = attendanceDateForInstant(item.scheduledAt, timeZone);
    scheduleEvents.push({
      id: `interview-${item.id}`,
      type: 'INTERVIEW',
      typeLabel: 'Interview',
      title: `${item.application.applicant.firstName} ${item.application.applicant.lastName}`,
      subtitle: `${item.application.job.title}`,
      dateStr,
      timeStr: timeFormatter.format(item.scheduledAt),
      href: '/dashboard/hiring/interviews',
      departmentOrInfo: item.application.job.department,
    });
  }

  // Probation Reviews
  for (const item of probationDue) {
    const dateStr = item.expectedEndAt.toISOString().slice(0, 10);
    scheduleEvents.push({
      id: `probation-${item.id}`,
      type: 'PROBATION',
      typeLabel: 'Probation Review',
      title: `${item.employee.firstName} ${item.employee.lastName}`,
      subtitle: `Due date review • ${item.employee.employeeNumber}`,
      dateStr,
      timeStr: null, // Date-based item, no invented time
      href: `/dashboard/employees/${item.employee.id}`,
      departmentOrInfo: item.employee.employmentRecords[0]?.department,
    });
  }

  // Payroll Pay Dates
  for (const item of payrollPeriods) {
    const dateStr = item.payDate.toISOString().slice(0, 10);
    scheduleEvents.push({
      id: `payroll-${item.id}`,
      type: 'PAYROLL',
      typeLabel: 'Payroll Pay Date',
      title: `${item.name}`,
      subtitle: 'Finalized pay date distribution',
      dateStr,
      timeStr: null, // Date-based item
      href: '/dashboard/payroll',
      departmentOrInfo: 'Finance / Payroll',
    });
  }

  // Approved Leave Days
  for (const item of approvedLeaveDays) {
    const dateStr = item.attendanceDate.toISOString().slice(0, 10);
    scheduleEvents.push({
      id: `leave-${item.id}`,
      type: 'LEAVE',
      typeLabel: 'Approved Leave',
      title: `${item.employee.firstName} ${item.employee.lastName}`,
      subtitle: `${item.leaveRequest.leaveType.name}`,
      dateStr,
      timeStr: null, // Date-based item
      href: '/dashboard/leave',
      departmentOrInfo: item.employee.employmentRecords[0]?.department,
    });
  }

  // Sort schedule events chronologically
  scheduleEvents.sort((a, b) => {
    const comp = a.dateStr.localeCompare(b.dateStr);
    if (comp !== 0) return comp;
    if (a.timeStr && b.timeStr) return a.timeStr.localeCompare(b.timeStr);
    if (a.timeStr) return -1;
    if (b.timeStr) return 1;
    return a.title.localeCompare(b.title);
  });

  // Generate 7-day schedule strip for active week
  const scheduleDays = [];
  for (let i = 0; i < 7; i++) {
    const dPlain = mondayPlain.add({ days: i });
    const dStr = dPlain.toString();
    const count = scheduleEvents.filter((e) => e.dateStr === dStr).length;
    scheduleDays.push({
      dateStr: dStr,
      dayName: dayNamesFull[i],
      dayNumber: dPlain.day,
      isToday: dStr === todayStr,
      eventCount: count,
    });
  }

  // Hiring Pipeline Stages
  const getStageCount = (status: ApplicationStatus) =>
    applicationStages.find((s) => s.status === status)?._count._all ?? 0;

  const appliedCount = getStageCount(ApplicationStatus.APPLIED);
  const screeningCount = getStageCount(ApplicationStatus.SCREENING) + getStageCount(ApplicationStatus.SHORTLISTED);
  const assessmentCount = getStageCount(ApplicationStatus.ASSESSMENT);
  const interviewCount = getStageCount(ApplicationStatus.INTERVIEW);
  const offerCount = getStageCount(ApplicationStatus.OFFER);
  const hiredCount = getStageCount(ApplicationStatus.HIRED);

  const totalActiveCandidates = appliedCount + screeningCount + assessmentCount + interviewCount + offerCount + onboardingCount + hiredCount;
  const maxStageCount = Math.max(appliedCount, screeningCount, assessmentCount, interviewCount, offerCount, onboardingCount, hiredCount, 1);

  const pipelineStages: PipelineStageCount[] = [
    {
      stage: 'APPLIED',
      label: 'Applied',
      count: appliedCount,
      percentage: totalActiveCandidates > 0 ? Math.round((appliedCount / maxStageCount) * 100) : 0,
      href: '/dashboard/hiring/applicants?status=APPLIED',
    },
    {
      stage: 'SCREENING',
      label: 'Document Review',
      count: screeningCount,
      percentage: totalActiveCandidates > 0 ? Math.round((screeningCount / maxStageCount) * 100) : 0,
      href: '/dashboard/hiring/applicants?status=SCREENING',
    },
    {
      stage: 'ASSESSMENT',
      label: 'Assessment',
      count: assessmentCount,
      percentage: totalActiveCandidates > 0 ? Math.round((assessmentCount / maxStageCount) * 100) : 0,
      href: '/dashboard/hiring/assessments',
    },
    {
      stage: 'INTERVIEW',
      label: 'Interview',
      count: interviewCount,
      percentage: totalActiveCandidates > 0 ? Math.round((interviewCount / maxStageCount) * 100) : 0,
      href: '/dashboard/hiring/interviews',
    },
    {
      stage: 'OFFER',
      label: 'Offer',
      count: offerCount,
      percentage: totalActiveCandidates > 0 ? Math.round((offerCount / maxStageCount) * 100) : 0,
      href: '/dashboard/hiring/offers',
    },
    {
      stage: 'ONBOARDING',
      label: 'Onboarding',
      count: onboardingCount,
      percentage: totalActiveCandidates > 0 ? Math.round((onboardingCount / maxStageCount) * 100) : 0,
      href: '/dashboard/hiring/onboarding',
    },
    {
      stage: 'HIRED',
      label: 'Hired',
      count: hiredCount,
      percentage: totalActiveCandidates > 0 ? Math.round((hiredCount / maxStageCount) * 100) : 0,
      href: '/dashboard/hiring/applicants?status=HIRED',
    },
  ];

  // Action Queue / Requires Attention Items
  const attentionQueue: AttentionItemDetail[] = [];

  // 1. Pending leave requests
  for (const item of pendingLeaveRequests) {
    const fromStr = item.requestedStartDate.toISOString().slice(0, 10);
    const toStr = item.requestedEndDate.toISOString().slice(0, 10);
    attentionQueue.push({
      id: `leave-${item.id}`,
      employeeOrCandidate: `${item.employee.firstName} ${item.employee.lastName}`,
      departmentOrRole: item.employee.employmentRecords[0]?.department ?? 'Staff',
      actionRequired: `Approve ${item.leaveType.name} request (${fromStr} to ${toStr})`,
      category: 'Leave',
      dueDate: fromStr,
      status: 'Pending Approval',
      statusVariant: 'warning',
      href: '/dashboard/leave',
    });
  }

  // 2. Upcoming probation reviews
  for (const item of probationDue) {
    const endStr = item.expectedEndAt.toISOString().slice(0, 10);
    attentionQueue.push({
      id: `probation-${item.id}`,
      employeeOrCandidate: `${item.employee.firstName} ${item.employee.lastName}`,
      departmentOrRole: item.employee.employmentRecords[0]?.department ?? 'Probationary Staff',
      actionRequired: 'Probation performance review and decision due',
      category: 'Probation',
      dueDate: endStr,
      status: 'Review Due',
      statusVariant: 'danger',
      href: `/dashboard/employees/${item.employee.id}`,
    });
  }

  // 3. Submitted candidate assessments
  for (const item of submittedAssessments) {
    attentionQueue.push({
      id: `assessment-${item.id}`,
      employeeOrCandidate: `${item.application.applicant.firstName} ${item.application.applicant.lastName}`,
      departmentOrRole: item.application.job.title,
      actionRequired: `Grade submitted candidate assessment for ${item.application.job.title}`,
      category: 'Assessment',
      dueDate: item.updatedAt.toISOString().slice(0, 10),
      status: 'Submitted',
      statusVariant: 'info',
      href: '/dashboard/hiring/assessments',
    });
  }

  // 4. Pending offers awaiting approval
  for (const item of pendingOffers) {
    attentionQueue.push({
      id: `offer-${item.id}`,
      employeeOrCandidate: `${item.application.applicant.firstName} ${item.application.applicant.lastName}`,
      departmentOrRole: item.application.job.title,
      actionRequired: `Formal job offer approval required for ${item.application.job.title}`,
      category: 'Offer',
      dueDate: item.createdAt.toISOString().slice(0, 10),
      status: 'Awaiting Approval',
      statusVariant: 'warning',
      href: '/dashboard/hiring/offers',
    });
  }

  // 5. Onboarding task verifications
  for (const item of pendingOnboardingTasks) {
    const app = item.onboardingProcess.application;
    attentionQueue.push({
      id: `onboarding-${item.id}`,
      employeeOrCandidate: `${app.applicant.firstName} ${app.applicant.lastName}`,
      departmentOrRole: app.job.title,
      actionRequired: `Verify onboarding document: ${item.title}`,
      category: 'Onboarding',
      dueDate: item.updatedAt.toISOString().slice(0, 10),
      status: 'Verification Needed',
      statusVariant: 'info',
      href: '/dashboard/hiring/onboarding',
    });
  }

  // 6. Missing employee compensation
  for (const item of missingCompensationEmployees) {
    attentionQueue.push({
      id: `compensation-${item.id}`,
      employeeOrCandidate: `${item.firstName} ${item.lastName}`,
      departmentOrRole: item.department ?? 'Staff',
      actionRequired: 'Missing active salary compensation structure',
      category: 'Payroll',
      dueDate: 'Setup Required',
      status: 'Setup Required',
      statusVariant: 'danger',
      href: '/dashboard/payroll',
    });
  }

  // 7. Incomplete employee records
  for (const item of incompleteSetupEmployees) {
    attentionQueue.push({
      id: `setup-${item.id}`,
      employeeOrCandidate: `${item.firstName} ${item.lastName}`,
      departmentOrRole: item.department ?? 'Staff',
      actionRequired: 'Incomplete employment history or portal user account',
      category: 'Setup',
      dueDate: 'Action Required',
      status: 'Incomplete',
      statusVariant: 'neutral',
      href: `/dashboard/employees/${item.id}`,
    });
  }

  // Total Pending Actions count across all categories
  const pendingActionsCount = attentionQueue.length;

  return {
    user: {
      id: session.userId,
      name: session.name,
      firstName: session.name.split(' ')[0],
      role: session.role,
    },
    branding: {
      displayName: branding.displayName,
      slug: branding.slug,
      timeZone: branding.timeZone,
      primary: branding.primary,
      accent: branding.accent,
    },
    asOfDateStr: todayStr,
    asOfFormatted: new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone,
    }).format(asOf),
    permissions: {
      hasHrAccess,
      hasPayrollAccess,
      hasHiringAccess,
    },
    headerStats: {
      newHires: newHiresCount,
      attendanceRate,
      pendingActionsCount,
    },
    summaryCards: {
      totalEmployees: activeEmployeesCount,
      presentToday: presentTodayCount,
      openPositions: openJobsCount,
    },
    attendanceDonut: {
      present: presentDonut,
      absent: absentDonut,
      incomplete: incompleteDonut,
      approvedLeave: approvedLeaveDonut,
      totalRecorded: totalRecordedToday,
      rate: todayRate,
    },
    weeklyTrend: {
      weekRangeLabel,
      days: weeklyDays,
      totalPresentThisWeek,
      avgDailyPresent,
    },
    schedule: {
      currentDateStr: todayStr,
      days: scheduleDays,
      events: scheduleEvents,
    },
    pipeline: {
      totalActiveCandidates,
      stages: pipelineStages,
    },
    attentionQueue,
  };
}
