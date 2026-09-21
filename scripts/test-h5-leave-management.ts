import {
  ApplicationStatus, AttendanceDirection, AttendanceDisposition, AttendanceSource, AttendanceStatus,
  EmployeeStatus, EmploymentCategory, EmploymentStatus, JobStatus, LeaveLedgerEntryType,
  PayFrequency, Prisma, Role,
} from '@prisma/client';
import { prisma } from '../src/lib/db/prisma';
import { summarizeAttendanceIndicators } from '../src/features/attendance/domain';
import { materializeAttendanceDay } from '../src/features/attendance/service';
import { applicableDocumentRules, parseLeavePolicy } from '../src/features/leave/policy';
import { SAGA_LEAVE_TYPES } from '../src/features/leave/saga-policy';
import { cancelApprovedLeave, removePendingLeaveDocument, reviewLeaveRequest, submitLeaveRequest, withdrawLeaveRequest } from '../src/features/leave/service';
import { notifyLeaveEmployee } from '../src/features/leave/notifications';
import { LeaveError } from '../src/features/leave/domain';
import { canReviewLeaveRequests } from '../src/lib/permissions/rbac';
import { getEmployeeLeaveOverviewData } from '../src/features/leave/read-model';

const rollback = Symbol('h5-rollback');
let assertions = 0;
function ok(value: unknown, message: string): asserts value { if (!value) throw new Error(`ASSERTION FAILED: ${message}`); assertions += 1; }
async function rejected(operation: () => Promise<unknown>, code?: string) { try { await operation(); return false; } catch (error) { return !code || (error instanceof LeaveError && error.code === code); } }
async function dbRejected(tx: Prisma.TransactionClient, savepoint: string, operation: () => Promise<unknown>) { await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`); try { await operation(); return false; } catch { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`); return true; } }
async function serviceRejected(tx: Prisma.TransactionClient, savepoint: string, operation: () => Promise<unknown>, code: string) { await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`); try { await operation(); return false; } catch (error) { await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`); return error instanceof LeaveError && error.code === code; } }
const date = (value: string) => new Date(`${value}T00:00:00Z`);
const json = (value: unknown) => value as Prisma.InputJsonValue;

async function main() {
  const sickDefinition = SAGA_LEAVE_TYPES.find((item) => item.code === 'SICK_PERSONAL')!;
  const sickPolicy = parseLeavePolicy(sickDefinition);
  ok(sickDefinition.defaultGrantUnits.equals(5), 'one combined Sick/Personal pool is five units');
  ok(sickPolicy.categories.map((item) => item.code).join(',') === 'SICK,PERSONAL', 'SICK and PERSONAL are the only configured categories');
  ok(applicableDocumentRules(sickPolicy.documents, 'SICK', 2).some((rule) => rule.kindCode === 'MEDICAL_CERTIFICATE'), 'SICK >= 2 requires a medical certificate');
  ok(applicableDocumentRules(sickPolicy.documents, 'PERSONAL', 2).length === 0, 'PERSONAL >= 2 has no automatic medical-certificate rule');
  const maternityDefinition = SAGA_LEAVE_TYPES.find((item) => item.code === 'MATERNITY')!;
  ok(maternityDefinition.countingMode === 'CALENDAR_DAYS' && maternityDefinition.maximumRequestUnits.equals(105) && maternityDefinition.minimumServiceMonths === 6, 'maternity is calendar-day, 105-unit, six-month');
  const paternityDefinition = SAGA_LEAVE_TYPES.find((item) => item.code === 'PATERNITY')!;
  ok(paternityDefinition.maximumApprovedOccurrences === 4 && paternityDefinition.attestationRules.find((rule) => rule.code === 'DELIVERY_SEQUENCE')?.options?.join('') === '1234', 'paternity sequence is bounded to 1-4 with four lifetime approvals');
  const bereavementDefinition = SAGA_LEAVE_TYPES.find((item) => item.code === 'BEREAVEMENT')!;
  ok(bereavementDefinition.requestCategoryOptions.map((item) => item.code).join(',') === 'SPOUSE,CHILD,PARENT,BROTHER,SISTER', 'bereavement relationships are bounded');
  ok(SAGA_LEAVE_TYPES.find((item) => item.code === 'SOLO_PARENT')?.minimumServiceMonths === 12, 'Solo Parent requires twelve months service');
  ok(SAGA_LEAVE_TYPES.find((item) => item.code === 'STUDY')?.minimumServiceMonths === 120, 'Study Leave requires ten years service');
  ok(!canReviewLeaveRequests({ userId: 'x', organizationId: 'x', email: 'x', name: 'x', role: Role.HIRING_MANAGER }), 'Hiring Manager cannot review leave');
  const indicatorDays = [1, 2, 3, 4, 5].map((day) => ({ attendanceDate: `2027-01-0${day}`, status: AttendanceStatus.ABSENT, lateSeconds: null, disposition: day === 3 ? AttendanceDisposition.APPROVED_LEAVE : AttendanceDisposition.NORMAL }));
  const indicators = summarizeAttendanceIndicators(indicatorDays);
  ok(indicators.absenceDays === 4, 'approved leave is excluded from monthly absence count');
  ok(indicators.longestConsecutiveAbsenceDays === 2 && !indicators.possibleAwolPatternReview, 'approved leave breaks a five-day possible-AWOL streak');
  const threshold = summarizeAttendanceIndicators([{ attendanceDate: '2027-02-01', status: AttendanceStatus.ABSENT, lateSeconds: null }, { attendanceDate: '2027-02-02', status: AttendanceStatus.ABSENT, disposition: AttendanceDisposition.APPROVED_LEAVE, lateSeconds: null }, { attendanceDate: '2027-02-03', status: AttendanceStatus.ABSENT, lateSeconds: null }]);
  ok(threshold.absenceDays === 2 && !threshold.absenceFrequencyReview, 'approved leave is excluded from three-day absence-frequency threshold');

  const marker = `h5-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name: 'H5 Integration', slug: marker, timeZone: 'Asia/Manila' } });
      const otherOrg = await tx.organization.create({ data: { name: 'H5 Other', slug: `${marker}-other`, timeZone: 'Asia/Manila' } });
      const hr = await tx.user.create({ data: { organizationId: org.id, name: 'H5 HR', email: `${marker}-hr@test.invalid`, passwordHash: 'test', role: Role.HR_ADMIN } });
      const otherHr = await tx.user.create({ data: { organizationId: otherOrg.id, name: 'Other HR', email: `${marker}-otherhr@test.invalid`, passwordHash: 'test', role: Role.HR_ADMIN } });
      const manager = await tx.user.create({ data: { organizationId: org.id, name: 'Manager', email: `${marker}-manager@test.invalid`, passwordHash: 'test', role: Role.HIRING_MANAGER } });
      const job = await tx.job.create({ data: { organizationId: org.id, title: 'H5 Job', slug: marker, department: 'Test', employmentType: 'Full-Time', location: 'Campus', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', status: JobStatus.CLOSED, category: EmploymentCategory.NON_TEACHING } });
      const otherJob = await tx.job.create({ data: { organizationId: otherOrg.id, title: 'Other', slug: `${marker}-other`, department: 'Test', employmentType: 'Full-Time', location: 'Campus', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', status: JobStatus.CLOSED, category: EmploymentCategory.NON_TEACHING } });
      async function makeEmployee(suffix: string, organizationId = org.id, employeeJob = job, employmentFrom = '2015-01-01') {
        const applicant = await tx.applicant.create({ data: { firstName: suffix, lastName: 'Employee', email: `${marker}-${suffix}@test.invalid`, phone: '0' } });
        const application = await tx.application.create({ data: { jobId: employeeJob.id, applicantId: applicant.id, status: ApplicationStatus.HIRED, coverLetter: 'H5' } });
        const record = await tx.employee.create({ data: { organizationId, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `${marker}-${suffix}`, firstName: suffix, lastName: 'Employee', email: applicant.email, phone: '0', employeeStatus: EmployeeStatus.ACTIVE, createdById: organizationId === org.id ? hr.id : otherHr.id } });
        await tx.employmentRecord.create({ data: { employeeId: record.id, jobId: employeeJob.id, jobTitle: employeeJob.title, department: 'Test', employmentCategory: EmploymentCategory.NON_TEACHING, employmentType: 'Untrusted free text', hireDate: date(employmentFrom), startDate: date(employmentFrom), salary: 1, payFrequency: PayFrequency.MONTHLY, employmentStatus: EmploymentStatus.REGULAR, effectiveFrom: date(employmentFrom), createdById: organizationId === org.id ? hr.id : otherHr.id } });
        return record;
      }
      const employeeA = await makeEmployee('A'); const employeeB = await makeEmployee('B'); const employeeC = await makeEmployee('C', org.id, job, '2027-09-01'); const employeeD = await makeEmployee('D'); const employeeE = await makeEmployee('E'); const employeeF = await makeEmployee('F'); const otherEmployee = await makeEmployee('Other', otherOrg.id, otherJob);
      await tx.employmentRecord.updateMany({ where: { employeeId: employeeE.id }, data: { employmentStatus: EmploymentStatus.PROBATIONARY } });
      const employeeAUser = await tx.user.create({ data: { organizationId: org.id, name: 'Employee A', email: `${marker}-a-login@test.invalid`, passwordHash: 'test', role: Role.EMPLOYEE } });
      await tx.employeeAccount.create({ data: { organizationId: org.id, userId: employeeAUser.id, employeeId: employeeA.id, status: 'ACTIVE', activatedAt: new Date(), createdById: hr.id } });
      const employeeDUser = await tx.user.create({ data: { organizationId: org.id, name: 'Employee D', email: `${marker}-d-login@test.invalid`, passwordHash: 'test', role: Role.EMPLOYEE } });
      await tx.employeeAccount.create({ data: { organizationId: org.id, userId: employeeDUser.id, employeeId: employeeD.id, status: 'ACTIVE', activatedAt: new Date(), createdById: hr.id } });
      const scheduleGroup = await tx.workScheduleGroup.create({ data: { organizationId: org.id, scheduleKey: marker, name: 'Daily', createdById: hr.id } });
      const version = await tx.workScheduleVersion.create({ data: { scheduleGroupId: scheduleGroup.id, version: 1, displayName: 'Daily', createdById: hr.id, days: { create: [1,2,3,4,5,6,7].map((isoWeekday) => ({ isoWeekday, isWorkday: true, expectedStartSecond: 28800, expectedEndSecond: 61200 })) } } });
      for (const target of [employeeA, employeeB, employeeC, employeeE, employeeF]) await tx.employeeScheduleAssignment.create({ data: { organizationId: org.id, employeeId: target.id, scheduleVersionId: version.id, effectiveFrom: date('2027-01-01'), createdById: hr.id } });
      const types = new Map<string, { id: string }>();
      for (const definition of SAGA_LEAVE_TYPES) {
        const created = await tx.leaveType.create({ data: { organizationId: org.id, ...definition, requestCategoryOptions: json(definition.requestCategoryOptions), attestationRules: json(definition.attestationRules), documentRules: json(definition.documentRules) } });
        types.set(definition.code, created);
      }
      const sickType = types.get('SICK_PERSONAL')!;
      const sickCycle = await tx.leaveCycle.create({ data: { organizationId: org.id, leaveTypeId: sickType.id, code: '2027', name: '2027', startDate: date('2027-01-01'), endDate: date('2027-12-31') } });
      await tx.leaveCycle.create({ data: { organizationId: org.id, leaveTypeId: sickType.id, code: '2028', name: '2028', startDate: date('2028-01-01'), endDate: date('2028-12-31') } });
      const soloType = types.get('SOLO_PARENT')!;
      await tx.leaveCycle.create({ data: { organizationId: org.id, leaveTypeId: soloType.id, code: '2027', name: '2027', startDate: date('2027-01-01'), endDate: date('2027-12-31') } });
      const soloCycle2028 = await tx.leaveCycle.create({ data: { organizationId: org.id, leaveTypeId: soloType.id, code: '2028', name: '2028', startDate: date('2028-01-01'), endDate: date('2028-12-31') } });
      ok(Boolean(sickCycle), 'different leave-type cycles may overlap');
      ok(await dbRejected(tx, 'same_type_cycle', () => tx.leaveCycle.create({ data: { organizationId: org.id, leaveTypeId: sickType.id, code: 'OVERLAP', name: 'Overlap', startDate: date('2027-06-01'), endDate: date('2028-05-31') } })), 'same-type overlapping cycle is rejected');
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeB.id } }) === 0, 'Employee B receives no automatic grant');

      const noSchedule = await submitLeaveRequest({ organizationId: org.id, employeeId: employeeD.id, actorUserId: employeeDUser.id, leaveTypeId: sickType.id, from: '2027-07-05', to: '2027-07-06', categoryCode: 'PERSONAL', reason: 'No schedule yet' }, tx);
      const uncalculated = await tx.leaveRequest.findUniqueOrThrow({ where: { id: noSchedule.id } });
      ok(uncalculated.status === 'PENDING' && uncalculated.requestedUnits === null, 'employee without a schedule can file a pending request');
      ok(await tx.leaveRequestDay.count({ where: { leaveRequestId: noSchedule.id } }) === 0, 'submission without schedule creates no provisional leave days');
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeD.id } }) === 0, 'submission without schedule creates no grant or debit');
      ok(await tx.attendanceEvent.count({ where: { employeeId: employeeD.id } }) === 0 && await tx.dailyAttendanceRecord.count({ where: { employeeId: employeeD.id } }) === 0, 'submission performs no attendance mutation');
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: noSchedule.id, decision: 'APPROVE', remarks: 'Not yet' }, tx), 'NO_SCHEDULE'), 'approval without schedule returns NO_SCHEDULE');
      ok((await tx.leaveRequest.findUniqueOrThrow({ where: { id: noSchedule.id } })).status === 'PENDING', 'failed approval leaves request pending');
      await tx.employeeScheduleAssignment.create({ data: { organizationId: org.id, employeeId: employeeD.id, scheduleVersionId: version.id, effectiveFrom: date('2027-07-01'), createdById: hr.id } });
      await reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: noSchedule.id, decision: 'APPROVE', remarks: 'Schedule assigned' }, tx);
      const finalized = await tx.leaveRequest.findUniqueOrThrow({ where: { id: noSchedule.id }, include: { days: true } });
      ok(finalized.status === 'APPROVED' && finalized.requestedUnits?.equals(2) === true && finalized.days.length === 2, 'approval after assignment finalizes units and day snapshots');
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeD.id, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' } }) === 1 && await tx.leaveLedgerEntry.count({ where: { leaveRequestId: noSchedule.id, entryType: 'APPROVED_LEAVE' } }) === 1, 'approval creates one entitlement and one debit');

      const base = { organizationId: org.id, employeeId: employeeA.id, actorUserId: employeeAUser.id, leaveTypeId: sickType.id, reason: 'Test request' };
      const beforePageRead = await tx.leaveLedgerEntry.count({ where: { employeeId: employeeA.id } });
      const projectedOverview = await getEmployeeLeaveOverviewData(tx, org.id, employeeA.id);
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeA.id } }) === beforePageRead, 'employee leave page read never creates an entitlement grant');
      ok(projectedOverview.balances.find((item) => item.leaveTypeCode === 'SICK_PERSONAL' && item.cycleId === sickCycle.id)?.annualEntitlement === 5, 'eligible employee sees projected five-day entitlement without a ledger write');
      ok(await rejected(() => submitLeaveRequest({ ...base, from: '2027-01-03', to: '2027-01-03', categoryCode: 'VACATION' }, tx), 'INVALID_CATEGORY'), 'unsupported category is rejected through service');
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeA.id } }) === 0, 'failed submission leaves no entitlement grant');
      ok(await rejected(() => submitLeaveRequest({ ...base, employeeId: employeeE.id, actorUserId: hr.id, from: '2027-03-01', to: '2027-03-01', categoryCode: 'PERSONAL' }, tx), 'INELIGIBLE_EMPLOYMENT'), 'non-Regular employee cannot submit against the regular entitlement');
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeE.id, leaveTypeId: sickType.id } }) === 0, 'non-Regular employee receives no entitlement');
      await Promise.all([
        submitLeaveRequest({ ...base, employeeId: employeeF.id, actorUserId: hr.id, from: '2027-03-10', to: '2027-03-10', categoryCode: 'SICK' }, tx),
        submitLeaveRequest({ ...base, employeeId: employeeF.id, actorUserId: hr.id, from: '2027-03-11', to: '2027-03-11', categoryCode: 'PERSONAL' }, tx),
      ]);
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeF.id, leaveTypeId: sickType.id, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' } }) === 0, 'pending submissions do not initialize entitlement grants');
      const failureBlocker = await submitLeaveRequest({ organizationId: org.id, employeeId: employeeB.id, actorUserId: hr.id, leaveTypeId: types.get('BEREAVEMENT')!.id, from: '2027-04-01', to: '2027-04-01', categoryCode: 'PARENT', reason: 'Overlap fixture', attestations: { FULL_TIME_STATUS: true } }, tx);
      ok(await serviceRejected(tx, 'orphan_grant', () => submitLeaveRequest({ organizationId: org.id, employeeId: employeeB.id, actorUserId: hr.id, leaveTypeId: sickType.id, from: '2027-04-01', to: '2027-04-01', categoryCode: 'PERSONAL', reason: 'Must roll back' }, tx), 'OVERLAP'), 'overlapping submission is rejected without entitlement mutation');
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeB.id, leaveTypeId: sickType.id } }) === 0 && Boolean(failureBlocker.id), 'failed submission leaves no orphan entitlement');
      ok(await rejected(() => submitLeaveRequest({ ...base, from: '2027-12-31', to: '2028-01-01', categoryCode: 'PERSONAL' }, tx), 'INVALID_CYCLE'), 'cross-cycle request is rejected after server cycle derivation');
      const pending = await submitLeaveRequest({ ...base, from: '2027-01-04', to: '2027-01-05', categoryCode: 'PERSONAL' }, tx);
      ok(Boolean(pending.id), 'PERSONAL request is accepted through service');
      const submittedSnapshot = await tx.leaveRequest.findUniqueOrThrow({ where: { id: pending.id } });
      ok(submittedSnapshot.leaveCycleId === sickCycle.id, 'server derives the applicable cycle');
      ok(submittedSnapshot.requestedUnits === null && submittedSnapshot.expectedReturnDateSnapshot === null, 'scheduled request remains pending calculation at submission');
      ok(submittedSnapshot.employeeNameSnapshot === 'A Employee' && submittedSnapshot.organizationTimeZoneSnapshot === 'Asia/Manila', 'leave form context is snapshotted at submission');
      const reserved = await tx.leaveRequest.aggregate({ where: { employeeId: employeeA.id, status: 'PENDING' }, _sum: { requestedUnits: true } });
      ok(reserved._sum.requestedUnits === null, 'uncalculated pending request creates no false reservation');
      const projectedPending = await submitLeaveRequest({ ...base, from: '2027-01-10', to: '2027-01-13', categoryCode: 'SICK' }, tx);
      ok(Boolean(projectedPending.id), 'pending filing is not rejected on a provisional balance calculation');
      await withdrawLeaveRequest({ organizationId: org.id, employeeId: employeeA.id, actorUserId: employeeAUser.id, requestId: projectedPending.id }, tx);
      await withdrawLeaveRequest({ organizationId: org.id, employeeId: employeeA.id, actorUserId: employeeAUser.id, requestId: pending.id }, tx);
      ok(await tx.leaveLedgerEntry.count({ where: { leaveRequestId: pending.id } }) === 0, 'withdrawal releases reservation without ledger debit');
      const personal = await submitLeaveRequest({ ...base, from: '2027-01-04', to: '2027-01-05', categoryCode: 'PERSONAL' }, tx);
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeA.id, leaveTypeId: sickType.id, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' } }) === 0, 'replacement pending request still creates no entitlement');
      await reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: personal.id, decision: 'APPROVE', remarks: 'Approved' }, tx);
      const grant = await tx.leaveLedgerEntry.findFirstOrThrow({ where: { employeeId: employeeA.id, leaveTypeId: sickType.id, leaveCycleId: sickCycle.id, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' } });
      ok(grant.amountUnits.equals(5), 'approval initializes the five-unit entitlement');
      ok(await dbRejected(tx, 'duplicate_grant', () => tx.leaveLedgerEntry.create({ data: { organizationId: org.id, employeeId: employeeA.id, leaveTypeId: sickType.id, leaveCycleId: sickCycle.id, entryType: LeaveLedgerEntryType.GRANT, amountUnits: 5, reason: 'Duplicate', actorUserId: hr.id, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' } })), 'duplicate default grant is blocked');
      ok(await dbRejected(tx, 'ledger_update', () => tx.leaveLedgerEntry.update({ where: { id: grant.id }, data: { reason: 'Mutated' } })), 'ledger update is rejected');
      ok(await dbRejected(tx, 'ledger_delete', () => tx.leaveLedgerEntry.delete({ where: { id: grant.id } })), 'ledger delete is rejected');
      ok(await tx.leaveLedgerEntry.count({ where: { leaveRequestId: personal.id, entryType: 'APPROVED_LEAVE' } }) === 1, 'PERSONAL approval creates exactly one debit');
      await tx.employee.update({ where: { id: employeeA.id }, data: { firstName: 'Changed' } }); await tx.user.update({ where: { id: hr.id }, data: { name: 'Changed Reviewer' } });
      const stableForm = await tx.leaveRequest.findUniqueOrThrow({ where: { id: personal.id } });
      ok(stableForm.employeeNameSnapshot === 'A Employee' && stableForm.reviewerNameSnapshot === 'H5 HR', 'approved form context remains stable after profile changes');
      await tx.employee.update({ where: { id: employeeA.id }, data: { firstName: 'A' } }); await tx.user.update({ where: { id: hr.id }, data: { name: 'H5 HR' } });
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: personal.id, decision: 'APPROVE', remarks: 'Again' }, tx), 'ALREADY_REVIEWED'), 'double approval is rejected');
      ok(await dbRejected(tx, 'duplicate_debit', () => tx.leaveLedgerEntry.create({ data: { organizationId: org.id, employeeId: employeeA.id, leaveTypeId: sickType.id, leaveCycleId: sickCycle.id, leaveRequestId: personal.id, entryType: 'APPROVED_LEAVE', amountUnits: -2, reason: 'Duplicate debit', actorUserId: hr.id } })), 'database permits one approved debit per request');
      const sick = await submitLeaveRequest({ ...base, from: '2027-01-06', to: '2027-01-07', categoryCode: 'SICK' }, tx);
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: sick.id, decision: 'APPROVE', remarks: 'Missing certificate' }, tx), 'DOCUMENT_REQUIRED'), 'SICK >= 2 cannot be approved without certificate');
      await tx.leaveDocument.create({ data: { organizationId: org.id, leaveRequestId: sick.id, employeeId: employeeA.id, kindCode: 'MEDICAL_CERTIFICATE', fileName: 'certificate.pdf', fileType: 'application/pdf', fileSize: 1, storageKey: `leave/${marker}.pdf`, uploadedById: employeeAUser.id } });
      await reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: sick.id, decision: 'APPROVE', remarks: 'Certificate verified' }, tx);
      const sharedBalance = await tx.leaveLedgerEntry.aggregate({ where: { employeeId: employeeA.id, leaveTypeId: sickType.id, leaveCycleId: sickCycle.id }, _sum: { amountUnits: true } });
      ok(sharedBalance._sum.amountUnits?.equals(1), 'SICK and PERSONAL debit same shared balance');
      await cancelApprovedLeave({ organizationId: org.id, actorUserId: hr.id, requestId: sick.id, reason: 'Cancelled' }, tx);
      const debit = await tx.leaveLedgerEntry.findFirstOrThrow({ where: { leaveRequestId: sick.id, entryType: 'APPROVED_LEAVE' } });
      const reversal = await tx.leaveLedgerEntry.findFirstOrThrow({ where: { reversesEntryId: debit.id } });
      ok(reversal.amountUnits.equals(debit.amountUnits.negated()), 'cancellation creates exact opposite reversal');
      ok(await rejected(() => cancelApprovedLeave({ organizationId: org.id, actorUserId: hr.id, requestId: sick.id, reason: 'Again' }, tx), 'NOT_APPROVED'), 'second application reversal is blocked');
      ok(await dbRejected(tx, 'duplicate_reversal', () => tx.leaveLedgerEntry.create({ data: { organizationId: org.id, employeeId: employeeA.id, leaveTypeId: sickType.id, leaveCycleId: sickCycle.id, leaveRequestId: sick.id, entryType: 'REVERSAL', amountUnits: 2, reason: 'Again', actorUserId: hr.id, reversesEntryId: debit.id } })), 'database blocks second reversal');
      ok(Number((await tx.leaveLedgerEntry.aggregate({ where: { employeeId: employeeA.id, leaveTypeId: sickType.id }, _sum: { amountUnits: true } }))._sum.amountUnits) >= 0, 'normal application flows keep balance non-negative');

      const bRecord = await tx.employmentRecord.findFirstOrThrow({ where: { employeeId: employeeB.id } });
      await tx.employmentRecord.update({ where: { id: bRecord.id }, data: { effectiveTo: date('2027-06-01') } });
      await tx.employmentRecord.create({ data: { employeeId: employeeB.id, jobId: job.id, jobTitle: job.title, department: 'Test', employmentCategory: EmploymentCategory.NON_TEACHING, employmentType: 'Untrusted', hireDate: date('2015-01-01'), startDate: date('2027-06-01'), salary: 1, payFrequency: PayFrequency.MONTHLY, employmentStatus: EmploymentStatus.REGULAR, effectiveFrom: date('2027-06-01'), createdById: hr.id } });
      await tx.leaveLedgerEntry.create({ data: { organizationId: org.id, employeeId: employeeB.id, leaveTypeId: sickType.id, leaveCycleId: sickCycle.id, entryType: 'GRANT', amountUnits: 5, reason: 'B explicit grant', actorUserId: hr.id, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' } });
      ok(await rejected(() => submitLeaveRequest({ ...base, employeeId: employeeB.id, from: '2027-05-28', to: '2027-05-28', categoryCode: 'PERSONAL' }, tx), 'FORBIDDEN'), 'Employee A cannot forge Employee B identity through service');
      const bBase = { ...base, employeeId: employeeB.id, actorUserId: hr.id };
      ok(Boolean((await submitLeaveRequest({ ...bBase, from: '2027-05-31', to: '2027-06-01', categoryCode: 'PERSONAL' }, tx)).id), 'request across contiguous EmploymentRecords succeeds');
      await tx.leaveRequest.updateMany({ where: { employeeId: employeeB.id }, data: { status: 'WITHDRAWN' } });
      const bSecond = await tx.employmentRecord.findFirstOrThrow({ where: { employeeId: employeeB.id, effectiveFrom: date('2027-06-01') } });
      await tx.employmentRecord.update({ where: { id: bSecond.id }, data: { effectiveFrom: date('2027-06-02') } });
      ok(await rejected(() => submitLeaveRequest({ ...bBase, from: '2027-06-01', to: '2027-06-02', categoryCode: 'PERSONAL' }, tx), 'EMPLOYMENT_GAP'), 'charged-date employment gap is rejected');

      const maternityType = types.get('MATERNITY')!;
      const maternityInput = { ...base, leaveTypeId: maternityType.id, leaveCycleId: null, categoryCode: null, attestations: { FEMALE_ELIGIBILITY: true, FULL_TIME_STATUS: true, EXPECTED_DELIVERY_DATE: '2028-01-01' } };
      const shortServiceMaternity = await submitLeaveRequest({ ...maternityInput, employeeId: employeeC.id, actorUserId: hr.id, from: '2028-01-01', to: '2028-01-01' }, tx);
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: shortServiceMaternity.id, decision: 'APPROVE', remarks: 'Verify service', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true, SSS_SUPPORT_CONFIRMED: true, DOCUMENT_SSS_SUPPORT_VERIFIED: true } }, tx), 'INSUFFICIENT_SERVICE'), 'maternity may be submitted without a grant but six-month service is enforced at approval');
      const dRecord = await tx.employmentRecord.findFirstOrThrow({ where: { employeeId: employeeD.id } });
      await tx.employmentRecord.update({ where: { id: dRecord.id }, data: { effectiveTo: date('2027-07-01') } });
      await tx.employmentRecord.create({ data: { employeeId: employeeD.id, jobId: job.id, jobTitle: job.title, department: 'Test', employmentCategory: EmploymentCategory.NON_TEACHING, employmentType: 'Untrusted', hireDate: date('2015-01-01'), startDate: date('2027-07-02'), salary: 1, payFrequency: PayFrequency.MONTHLY, employmentStatus: EmploymentStatus.REGULAR, effectiveFrom: date('2027-07-02'), createdById: hr.id } });
      const gapMaternity = await submitLeaveRequest({ ...maternityInput, employeeId: employeeD.id, actorUserId: hr.id, from: '2028-01-01', to: '2028-01-01' }, tx);
      ok((await tx.leaveRequest.findUniqueOrThrow({ where: { id: gapMaternity.id } })).expectedReturnDateSnapshot === null, 'expected return falls back when no authoritative schedule exists');
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: gapMaternity.id, decision: 'APPROVE', remarks: 'Verify gap', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true, SSS_SUPPORT_CONFIRMED: true, DOCUMENT_SSS_SUPPORT_VERIFIED: true } }, tx), 'INSUFFICIENT_SERVICE'), 'minimum-service approval rejects history separated by an employment gap');
      ok(await rejected(() => submitLeaveRequest({ ...maternityInput, from: '2028-01-01', to: '2028-04-15' }, tx), 'POLICY_LIMIT'), 'maternity above 105 calendar days is rejected');
      const maternity = await submitLeaveRequest({ ...maternityInput, from: '2028-01-01', to: '2028-04-14' }, tx);
      ok((await tx.leaveRequest.findUniqueOrThrow({ where: { id: maternity.id } })).requestedUnits?.equals(105) === true, 'maternity charges 105 calendar days');
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: maternity.id, decision: 'APPROVE', remarks: 'Generic', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx), 'SSS_REQUIRED'), 'generic approval cannot bypass SSS verification');
      await reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: maternity.id, decision: 'APPROVE', remarks: 'SSS verified', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true, SSS_SUPPORT_CONFIRMED: true, DOCUMENT_SSS_SUPPORT_VERIFIED: true } }, tx);
      ok((await tx.leaveRequest.findUniqueOrThrow({ where: { id: maternity.id } })).status === 'APPROVED', 'separate SSS verification permits approval');

      const shortSolo = await submitLeaveRequest({ ...base, employeeId: employeeC.id, actorUserId: hr.id, leaveTypeId: soloType.id, from: '2028-02-01', to: '2028-02-01', categoryCode: null, attestations: { FULL_TIME_STATUS: true, SOLO_PARENT_STATUS: true } }, tx);
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeC.id, leaveTypeId: soloType.id } }) === 0, 'Solo Parent submission never initializes entitlement');
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: shortSolo.id, decision: 'APPROVE', remarks: 'Verified', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx), 'INSUFFICIENT_SERVICE'), 'Solo Parent twelve-month service minimum is enforced at approval');
      const solo = await submitLeaveRequest({ ...base, leaveTypeId: soloType.id, leaveCycleId: soloCycle2028.id, from: '2028-05-01', to: '2028-05-01', categoryCode: null, attestations: { FULL_TIME_STATUS: true, SOLO_PARENT_STATUS: true } }, tx);
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeA.id, leaveTypeId: soloType.id } }) === 0, 'eligible Solo Parent remains ungranted before HR verification');
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: solo.id, decision: 'APPROVE', remarks: 'Generic only' }, tx), 'ELIGIBILITY_REQUIRED'), 'Solo Parent requires explicit HR eligibility verification');
      await reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: solo.id, decision: 'APPROVE', remarks: 'Solo Parent verified', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx);
      ok(await tx.leaveLedgerEntry.count({ where: { employeeId: employeeA.id, leaveTypeId: soloType.id, leaveCycleId: soloCycle2028.id, grantSource: 'DEFAULT_CYCLE_ENTITLEMENT' } }) === 1, 'verified Solo Parent approval initializes one entitlement');

      const paternityType = types.get('PATERNITY')!;
      for (let sequence = 1; sequence <= 4; sequence++) {
        const day = String(sequence * 2).padStart(2, '0');
        const request = await submitLeaveRequest({ ...base, leaveTypeId: paternityType.id, leaveCycleId: null, from: `2029-01-${day}`, to: `2029-01-${day}`, categoryCode: null, attestations: { FULL_TIME_STATUS: true, LEGAL_SPOUSE_DELIVERY: true, DELIVERY_SEQUENCE: String(sequence) } }, tx);
        await reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: request.id, decision: 'APPROVE', remarks: 'Verified', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx);
        ok(true, `paternity delivery sequence ${sequence} is accepted`);
        if (sequence === 1) {
          await cancelApprovedLeave({ organizationId: org.id, actorUserId: hr.id, requestId: request.id, reason: 'Historical occurrence remains consumed' }, tx);
          const duplicate = await submitLeaveRequest({ ...base, leaveTypeId: paternityType.id, leaveCycleId: null, from: '2029-01-03', to: '2029-01-03', categoryCode: null, attestations: { FULL_TIME_STATUS: true, LEGAL_SPOUSE_DELIVERY: true, DELIVERY_SEQUENCE: '1' } }, tx);
          ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: duplicate.id, decision: 'APPROVE', remarks: 'Duplicate', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx), 'DUPLICATE_OCCURRENCE'), 'duplicate delivery sequence is rejected even after cancellation');
          await tx.leaveRequest.update({ where: { id: duplicate.id }, data: { status: 'REJECTED' } });
        }
      }
      const fifth = await submitLeaveRequest({ ...base, leaveTypeId: paternityType.id, leaveCycleId: null, from: '2029-01-12', to: '2029-01-12', categoryCode: null, attestations: { FULL_TIME_STATUS: true, LEGAL_SPOUSE_DELIVERY: true, DELIVERY_SEQUENCE: '1' } }, tx);
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: fifth.id, decision: 'APPROVE', remarks: 'Fifth', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx), 'OCCURRENCE_LIMIT'), 'cancelled approval remains consumed and fifth historical approval is rejected');

      const bereavementType = types.get('BEREAVEMENT')!;
      ok(Boolean((await submitLeaveRequest({ ...base, leaveTypeId: bereavementType.id, leaveCycleId: null, from: '2029-02-01', to: '2029-02-01', categoryCode: 'SPOUSE', attestations: { FULL_TIME_STATUS: true } }, tx)).id), 'valid bereavement relationship is accepted');
      ok(await rejected(() => submitLeaveRequest({ ...base, leaveTypeId: bereavementType.id, leaveCycleId: null, from: '2029-02-03', to: '2029-02-03', categoryCode: 'COUSIN', attestations: { FULL_TIME_STATUS: true } }, tx), 'INVALID_CATEGORY'), 'unsupported bereavement relationship is rejected');
      const studyType = types.get('STUDY')!;
      const shortStudy = await submitLeaveRequest({ ...base, employeeId: employeeC.id, actorUserId: hr.id, leaveTypeId: studyType.id, leaveCycleId: null, from: '2030-01-03', to: '2030-01-03', categoryCode: null, attestations: { TENURED_STATUS: true } }, tx);
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: shortStudy.id, decision: 'APPROVE', remarks: 'Tenure check', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx), 'INSUFFICIENT_SERVICE'), 'Study Leave submits without a grant and enforces ten-year service at approval');
      const study = await submitLeaveRequest({ ...base, leaveTypeId: studyType.id, leaveCycleId: null, from: '2030-01-01', to: '2030-01-01', categoryCode: null, attestations: { TENURED_STATUS: true } }, tx);
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: study.id, decision: 'APPROVE', remarks: 'Regular only' }, tx), 'ELIGIBILITY_REQUIRED'), 'REGULAR alone is insufficient for Study Leave');
      await reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: study.id, decision: 'APPROVE', remarks: 'Tenure verified', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx);
      ok(true, 'explicit tenure verification permits Study Leave after ten years');

      const reviewTarget = await submitLeaveRequest({ ...base, leaveTypeId: bereavementType.id, leaveCycleId: null, from: '2030-02-01', to: '2030-02-01', categoryCode: 'PARENT', attestations: { FULL_TIME_STATUS: true } }, tx);
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: otherHr.id, requestId: reviewTarget.id, decision: 'APPROVE', remarks: 'Cross tenant', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx), 'FORBIDDEN'), 'cross-tenant HR review fails');
      ok(await rejected(() => reviewLeaveRequest({ organizationId: org.id, actorUserId: manager.id, requestId: reviewTarget.id, decision: 'APPROVE', remarks: 'Manager', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx), 'FORBIDDEN'), 'Hiring Manager review fails');
      ok((await tx.leaveRequest.findFirst({ where: { id: reviewTarget.id, employeeId: employeeB.id } })) === null, 'Employee B ownership lookup cannot access Employee A request');
      ok((await tx.leaveRequest.findFirst({ where: { id: reviewTarget.id, organizationId: otherOrg.id } })) === null, 'cross-tenant request lookup is isolated');

      const attendanceRequest = await submitLeaveRequest({ ...base, leaveTypeId: bereavementType.id, leaveCycleId: null, from: '2030-03-01', to: '2030-03-01', categoryCode: 'SISTER', attestations: { FULL_TIME_STATUS: true } }, tx);
      const event = await tx.attendanceEvent.create({ data: { organizationId: org.id, employeeId: employeeA.id, occurredAt: new Date('2030-03-01T00:00:00Z'), direction: AttendanceDirection.TIME_IN, source: AttendanceSource.MANUAL, sourceReference: `${marker}-e`, createdById: hr.id } });
      await materializeAttendanceDay(tx, { organizationId: org.id, employeeId: employeeA.id, attendanceDate: '2030-03-01' });
      const initialDtr = await tx.dailyAttendanceRecord.findFirstOrThrow({ where: { organizationId: org.id, employeeId: employeeA.id, attendanceDate: date('2030-03-01') } });
      await tx.attendanceCorrection.create({ data: { organizationId: org.id, dailyAttendanceRecordId: initialDtr.id, revision: 1, correctedStatus: AttendanceStatus.INCOMPLETE, reason: 'Existing correction', previousState: {}, correctedState: {}, createdById: hr.id } });
      await reviewLeaveRequest({ organizationId: org.id, actorUserId: hr.id, requestId: attendanceRequest.id, decision: 'APPROVE', remarks: 'Verified', eligibilityChecks: { ELIGIBILITY_CONFIRMED: true } }, tx);
      await materializeAttendanceDay(tx, { organizationId: org.id, employeeId: employeeA.id, attendanceDate: '2030-03-01' });
      const leaveDtr = await tx.dailyAttendanceRecord.findUniqueOrThrow({ where: { id: initialDtr.id } });
      ok(leaveDtr.disposition === AttendanceDisposition.APPROVED_LEAVE, 'approval rematerialization applies APPROVED_LEAVE');
      ok(leaveDtr.hasLeaveAttendanceConflict, 'actual attendance plus approved leave sets conflict');
      ok(await tx.attendanceEvent.count({ where: { organizationId: org.id, employeeId: employeeA.id } }) === 1 && (await tx.attendanceEvent.findUniqueOrThrow({ where: { id: event.id } })).sourceReference === `${marker}-e`, 'approval creates no fake event and preserves raw event');
      ok(await tx.attendanceCorrection.count({ where: { dailyAttendanceRecordId: initialDtr.id } }) === 1, 'approval leaves AttendanceCorrection untouched');
      await cancelApprovedLeave({ organizationId: org.id, actorUserId: hr.id, requestId: attendanceRequest.id, reason: 'Reverse context' }, tx);
      await materializeAttendanceDay(tx, { organizationId: org.id, employeeId: employeeA.id, attendanceDate: '2030-03-01' });
      const restored = await tx.dailyAttendanceRecord.findUniqueOrThrow({ where: { id: initialDtr.id } });
      ok(restored.disposition === AttendanceDisposition.NORMAL && restored.approvedLeaveRequestDayId === null, 'cancellation rematerializes DTR from evidence/schedule');

      const document = await tx.leaveDocument.create({ data: { organizationId: org.id, leaveRequestId: reviewTarget.id, employeeId: employeeA.id, kindCode: 'SUPPORTING_DOCUMENT', fileName: 'support.pdf', fileType: 'application/pdf', fileSize: 1, storageKey: 'leave/test', uploadedById: employeeAUser.id } });
      ok(Boolean(document.id), 'own pending document metadata upload succeeds');
      ok((await tx.leaveDocument.findFirst({ where: { id: document.id, employeeId: employeeB.id } })) === null, 'other employee document lookup fails');
      ok((await tx.leaveDocument.findFirst({ where: { id: document.id, organizationId: otherOrg.id } })) === null, 'cross-tenant document lookup fails');
      ok(await rejected(() => removePendingLeaveDocument({ organizationId: org.id, employeeId: employeeB.id, actorUserId: employeeAUser.id, requestId: reviewTarget.id, documentId: document.id }, tx), 'DOCUMENT_UNAVAILABLE'), 'other employee cannot remove pending document');
      await removePendingLeaveDocument({ organizationId: org.id, employeeId: employeeA.id, actorUserId: employeeAUser.id, requestId: reviewTarget.id, documentId: document.id }, tx);
      ok((await tx.leaveDocument.findFirst({ where: { id: document.id, removedAt: null } })) === null && await tx.leaveRequestAudit.count({ where: { leaveRequestId: reviewTarget.id, action: 'DOCUMENT_REMOVED' } }) === 1, 'own pending removal is soft-deleted, audited, and no longer downloadable');
      await tx.leaveRequest.update({ where: { id: reviewTarget.id }, data: { status: 'APPROVED' } });
      ok(await rejected(() => removePendingLeaveDocument({ organizationId: org.id, employeeId: employeeA.id, actorUserId: employeeAUser.id, requestId: reviewTarget.id, documentId: document.id }, tx), 'DOCUMENT_UNAVAILABLE'), 'employee cannot remove document after approval');

      let observedCommittedState = false;
      await notifyLeaveEmployee(reviewTarget.id, employeeAUser.id, 'SUBMITTED', async () => ({ success: true, mode: 'preview_log', id: 'test-submitted' }), tx);
      await notifyLeaveEmployee(reviewTarget.id, hr.id, 'REJECTED', async () => ({ success: true, mode: 'preview_log', id: 'test-rejected' }), tx);
      await notifyLeaveEmployee(personal.id, hr.id, 'APPROVED', async () => { observedCommittedState = (await tx.leaveRequest.findUniqueOrThrow({ where: { id: personal.id } })).status === 'APPROVED'; return { success: true, mode: 'preview_log', id: 'test-success' }; }, tx);
      ok(observedCommittedState && await tx.leaveRequestAudit.count({ where: { leaveRequestId: personal.id, action: 'NOTIFICATION_SENT' } }) === 1, 'notification observes authoritative state and audits success');
      await notifyLeaveEmployee(sick.id, hr.id, 'CANCELLED', async () => { throw new Error('simulated delivery failure'); }, tx);
      ok((await tx.leaveRequest.findUniqueOrThrow({ where: { id: sick.id } })).status === 'CANCELLED' && await tx.leaveRequestAudit.count({ where: { leaveRequestId: sick.id, action: 'NOTIFICATION_FAILED' } }) === 1, 'email failure is audited without rolling back leave state');
      ok(await tx.leaveRequestAudit.count({ where: { leaveRequestId: reviewTarget.id, action: 'NOTIFICATION_SENT' } }) === 2, 'submitted and rejected notification events are independently audited');
      ok(otherEmployee.organizationId === otherOrg.id, 'second-tenant fixture is distinct');
      throw rollback;
    }, { timeout: 120_000 });
  } catch (error) { if (error !== rollback) throw error; }
  ok(await prisma.organization.count({ where: { slug: { startsWith: marker } } }) === 0, 'all H5 fixtures roll back');
  console.log(`H5 Leave Management integration tests passed: ${assertions} assertions.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
