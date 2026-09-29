import { EmployeeAccountStatus, PayrollEntryStatus, PayrollPeriodStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError } from './domain';

type PayrollDb = Prisma.TransactionClient | typeof prisma;

type FinalizedSnapshot = {
  payrollPeriod?: { id?: string; name?: string; start?: string; end?: string; payDate?: string };
  employee?: { id?: string; employeeNumber?: string; name?: string };
  compensation?: { id?: string; type?: string; rate?: string; payFrequency?: string; currency?: string };
  policy?: {
    deductionRules?: {
      late?: { rule?: string; parameter?: string | null; amount?: string };
      absence?: { rule?: string; parameter?: string | null; amount?: string };
      undertime?: { rule?: string; parameter?: string | null; amount?: string };
    };
    leaveTreatmentsApplied?: Array<{ requestId?: string; typeCode?: string; typeName?: string; payrollTreatment?: string }>;
  };
  calculation?: { baseAmount?: string; grossAmount?: string; totalDeductions?: string; netAmount?: string };
  attendanceSummary?: { scheduledWorkdays?: number; presentDays?: number; absentDays?: number; approvedLeaveDays?: number; lateOccurrences?: number };
  leaveSummary?: {
    approvedDays?: number; approvedUnits?: string; paidDays?: number; unpaidDays?: number; noPayrollEffectDays?: number;
    requests?: Array<{ requestId?: string; typeCode?: string; typeName?: string; payrollTreatment?: string }>;
  };
};

const entryInclude = {
  payrollPeriod: true,
  employee: {
    select: {
      id: true, employeeNumber: true, firstName: true, lastName: true,
      employmentRecords: { orderBy: { effectiveFrom: 'desc' as const }, select: { jobTitle: true, department: true, effectiveFrom: true, effectiveTo: true } },
    },
  },
} as const;

type FinalizedEntry = Prisma.PayrollEntryGetPayload<{ include: typeof entryInclude }>;

function parseSnapshot(value: Prisma.JsonValue | null): FinalizedSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PayrollError('INVALID_SNAPSHOT', 'The finalized payslip snapshot is unavailable.');
  const snapshot = value as FinalizedSnapshot;
  if (!snapshot.payrollPeriod?.id || !snapshot.employee?.id || !snapshot.compensation?.type || !snapshot.compensation.rate
    || !snapshot.compensation.payFrequency || !snapshot.compensation.currency || !snapshot.calculation?.baseAmount
    || !snapshot.calculation.grossAmount || snapshot.calculation.totalDeductions === undefined || !snapshot.calculation.netAmount) {
    throw new PayrollError('INVALID_SNAPSHOT', 'The finalized payslip snapshot is incomplete.');
  }
  return snapshot;
}

function employmentForPeriod(entry: FinalizedEntry) {
  return entry.employee.employmentRecords.find(record => record.effectiveFrom <= entry.payrollPeriod.periodStart && (!record.effectiveTo || record.effectiveTo >= entry.payrollPeriod.periodStart)) ?? null;
}

function toPayslip(entry: FinalizedEntry) {
  const snapshot = parseSnapshot(entry.calculationSnapshot);
  if (snapshot.payrollPeriod!.id !== entry.payrollPeriodId || snapshot.employee!.id !== entry.employeeId) {
    throw new PayrollError('INVALID_SNAPSHOT', 'The finalized snapshot does not match this payroll entry.');
  }
  const employment = employmentForPeriod(entry);
  const deductions = snapshot.policy?.deductionRules;
  const leaveTreatments = snapshot.leaveSummary?.requests ?? snapshot.policy?.leaveTreatmentsApplied ?? [];
  return {
    entryId: entry.id,
    employee: {
      name: snapshot.employee?.name ?? `${entry.employee.firstName} ${entry.employee.lastName}`.trim(),
      employeeNumber: snapshot.employee?.employeeNumber ?? entry.employee.employeeNumber,
      department: employment?.department ?? null,
      position: employment?.jobTitle ?? null,
    },
    payroll: {
      periodId: entry.payrollPeriodId,
      periodReference: snapshot.payrollPeriod?.name ?? entry.payrollPeriod.name,
      periodStart: snapshot.payrollPeriod?.start ?? entry.payrollPeriod.periodStart.toISOString().slice(0, 10),
      periodEnd: snapshot.payrollPeriod?.end ?? entry.payrollPeriod.periodEnd.toISOString().slice(0, 10),
      payDate: snapshot.payrollPeriod?.payDate ?? entry.payrollPeriod.payDate.toISOString().slice(0, 10),
      compensationType: snapshot.compensation!.type!, compensationRate: snapshot.compensation!.rate!,
      payFrequency: snapshot.compensation!.payFrequency!, currency: snapshot.compensation!.currency!,
      finalizedAt: entry.payrollPeriod.finalizedAt!.toISOString(),
    },
    calculation: {
      basePay: snapshot.calculation!.baseAmount!, grossPay: snapshot.calculation!.grossAmount!,
      totalDeductions: snapshot.calculation!.totalDeductions!, netPay: snapshot.calculation!.netAmount!,
      deductions: {
        late: deductions?.late?.amount ?? null,
        absence: deductions?.absence?.amount ?? null,
        undertime: deductions?.undertime?.amount ?? null,
      },
    },
    attendance: {
      scheduledWorkdays: snapshot.attendanceSummary?.scheduledWorkdays ?? null,
      presentDays: snapshot.attendanceSummary?.presentDays ?? null,
      absentDays: snapshot.attendanceSummary?.absentDays ?? null,
      lateOccurrences: snapshot.attendanceSummary?.lateOccurrences ?? null,
      approvedLeaveDays: snapshot.attendanceSummary?.approvedLeaveDays ?? snapshot.leaveSummary?.approvedDays ?? null,
    },
    leaveTreatments: leaveTreatments.map(item => ({ typeName: item.typeName ?? item.typeCode ?? 'Approved leave', treatment: item.payrollTreatment ?? 'NO_PAYROLL_EFFECT' })),
  };
}

async function finalizedEntry(organizationId: string, entryId: string, db: PayrollDb) {
  const entry = await db.payrollEntry.findFirst({
    where: {
      id: entryId, organizationId, status: PayrollEntryStatus.FINALIZED,
      payrollPeriod: { organizationId, status: PayrollPeriodStatus.FINALIZED, finalizedAt: { not: null } },
    }, include: entryInclude,
  });
  if (!entry) throw new PayrollError('NOT_FOUND', 'Finalized payslip not found or access denied.');
  return entry;
}

export async function getFinalizedPayslipForAdmin(input: { organizationId: string; actorUserId: string; entryId: string }, db: PayrollDb = prisma) {
  const actor = await db.user.findFirst({
    where: { id: input.actorUserId, organizationId: input.organizationId, role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] } }, select: { id: true },
  });
  if (!actor) throw new PayrollError('FORBIDDEN', 'Unauthorized to view payroll payslips.');
  return toPayslip(await finalizedEntry(input.organizationId, input.entryId, db));
}

async function activeEmployeeForUser(organizationId: string, userId: string, db: PayrollDb) {
  const account = await db.employeeAccount.findFirst({
    where: { organizationId, userId, status: EmployeeAccountStatus.ACTIVE, user: { role: Role.EMPLOYEE, organizationId }, employee: { organizationId } },
    select: { employeeId: true },
  });
  if (!account) throw new PayrollError('FORBIDDEN', 'Employee payroll access is unavailable.');
  return account.employeeId;
}

export async function getFinalizedPayslipForEmployee(input: { organizationId: string; userId: string; entryId: string }, db: PayrollDb = prisma) {
  const employeeId = await activeEmployeeForUser(input.organizationId, input.userId, db);
  const entry = await finalizedEntry(input.organizationId, input.entryId, db);
  if (entry.employeeId !== employeeId) throw new PayrollError('NOT_FOUND', 'Finalized payslip not found or access denied.');
  return toPayslip(entry);
}

export async function listFinalizedPayslipsForEmployee(input: { organizationId: string; userId: string }, db: PayrollDb = prisma) {
  const employeeId = await activeEmployeeForUser(input.organizationId, input.userId, db);
  const entries = await db.payrollEntry.findMany({
    where: {
      organizationId: input.organizationId, employeeId, status: PayrollEntryStatus.FINALIZED,
      payrollPeriod: { organizationId: input.organizationId, status: PayrollPeriodStatus.FINALIZED, finalizedAt: { not: null } },
    }, include: entryInclude, orderBy: [{ payrollPeriod: { payDate: 'desc' } }, { createdAt: 'desc' }],
  });
  return entries.map(entry => {
    const payslip = toPayslip(entry);
    return { entryId: payslip.entryId, periodStart: payslip.payroll.periodStart, periodEnd: payslip.payroll.periodEnd, payDate: payslip.payroll.payDate, currency: payslip.payroll.currency, netPay: payslip.calculation.netPay };
  });
}

export type PayslipViewModel = Awaited<ReturnType<typeof getFinalizedPayslipForAdmin>>;
