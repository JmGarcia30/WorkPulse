import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AttendanceDirection, AttendanceSource, Role } from '@prisma/client';
import { prisma } from '../src/lib/db/prisma';
import { attendanceDateForInstant, attendanceDateToDb } from '../src/features/attendance/domain';
import { cardNumberSchema, decideRfidDirection, RFID_COOLDOWN_MS } from '../src/features/attendance/rfid-policy';
import { createRfidService, rfidTokenHash } from '../src/features/attendance/rfid-service';
import { recordAttendanceEvent } from '../src/features/attendance/service';

assert.match(new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? '', /^batch3_test_[a-f0-9]{24}$/, 'RFID writes require a new disposable fixture schema');
let checks = 0;
const ok = (condition: unknown, message: string) => { assert.ok(condition, message); console.log(`RFID PASS ${++checks}: ${message}`); };
const rejects = async (operation: () => Promise<unknown>, code: string) => {
  await assert.rejects(operation, (error: unknown) => error instanceof Error && 'code' in error && error.code === code);
  checks++;
};
const databaseNow = async () => (await prisma.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`)[0].now;

async function fixture() {
  const marker = randomUUID();
  const organization = await prisma.organization.create({ data: { name: 'RFID synthetic workspace', slug: `rfid-${marker}`, timeZone: 'Asia/Manila' } });
  const actor = await prisma.user.create({ data: { organizationId: organization.id, name: 'Synthetic HR', email: `${marker}@fixture.invalid`, role: Role.HR_ADMIN } });
  const job = await prisma.job.create({ data: { organizationId: organization.id, title: 'Synthetic', slug: 'fixture', department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', responsibilities: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture' } });
  const employees = [];
  for (let i = 0; i < 6; i++) {
    const applicant = await prisma.applicant.create({ data: { firstName: 'Synthetic', lastName: `Employee${i}`, email: `${marker}-${i}@fixture.invalid`, phone: '0' } });
    const application = await prisma.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'Synthetic RFID fixture' } });
    const employee = await prisma.employee.create({ data: { organizationId: organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `RFID-${i}`, firstName: applicant.firstName, lastName: applicant.lastName, email: applicant.email, phone: '0', createdById: actor.id } });
    await prisma.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, jobTitle: job.title, department: 'Fixture', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: new Date('2020-01-01Z'), startDate: new Date('2020-01-01Z'), salary: 1, payFrequency: 'MONTHLY', employmentStatus: 'REGULAR', effectiveFrom: new Date('2020-01-01Z'), createdById: actor.id } });
    employees.push(employee);
  }
  const group = await prisma.workScheduleGroup.create({ data: { organizationId: organization.id, scheduleKey: 'rfid-fixture', name: 'Fixture schedule', createdById: actor.id } });
  const version = await prisma.workScheduleVersion.create({ data: { scheduleGroupId: group.id, version: 1, displayName: 'Fixture schedule', createdById: actor.id, days: { create: Array.from({ length: 7 }, (_, i) => ({ isoWeekday: i + 1, isWorkday: true, expectedStartSecond: 28800, expectedEndSecond: 61200 })) } } });
  await prisma.employeeScheduleAssignment.createMany({ data: employees.map(employee => ({ organizationId: organization.id, employeeId: employee.id, scheduleVersionId: version.id, effectiveFrom: new Date('2020-01-01Z'), createdById: actor.id })) });
  return { organization, actor, employees, context: { organizationId: organization.id, actorUserId: actor.id } };
}

async function main() {
  ok(cardNumberSchema.parse('0000000001') === '0000000001', 'card identifiers preserve all leading zeroes');
  for (const input of [1, '000000001', '00000000001', 'abcdefghij', ' 0000000001', '0000000001\n']) ok(!cardNumberSchema.safeParse(input).success, 'invalid scanner input rejected');
  const now = new Date('2026-10-25T05:00:00Z');
  ok(decideRfidDirection([], now, false) === 'TIME_IN', 'first scan chooses Time In');
  const oldIn = { direction: AttendanceDirection.TIME_IN, occurredAt: new Date(now.getTime() - RFID_COOLDOWN_MS) };
  ok(decideRfidDirection([oldIn], now, false) === 'TIME_OUT', 'cooldown boundary permits Time Out');
  ok(decideRfidDirection([{ ...oldIn, occurredAt: now }], now, false) === 'DUPLICATE_SCAN', 'rapid scan cannot switch direction');
  ok(decideRfidDirection([{ ...oldIn, occurredAt: new Date(now.getTime() + 1000) }], now, false) === 'REVIEW_REQUIRED', 'future event requires HR review');
  ok(decideRfidDirection([], now, false, { ...oldIn, occurredAt: new Date(now.getTime() - 1000) }) === 'DUPLICATE_SCAN', 'cooldown also protects the local-midnight boundary');
  ok(decideRfidDirection([oldIn, { direction: AttendanceDirection.TIME_OUT, occurredAt: oldIn.occurredAt }], now, false) === 'DAY_COMPLETE', 'completed day cannot start a third event');
  ok(decideRfidDirection([{ ...oldIn, direction: AttendanceDirection.TIME_OUT }], now, false) === 'REVIEW_REQUIRED', 'out-before-in requires HR review');
  ok(decideRfidDirection([{ ...oldIn, direction: null }], now, false) === 'REVIEW_REQUIRED', 'unclassified events require review');
  ok(decideRfidDirection([], now, true) === 'REVIEW_REQUIRED', 'corrected day requires HR review');
  ok(attendanceDateForInstant(new Date('2026-10-25T16:00:00Z'), 'Asia/Manila') === '2026-10-26', 'organization timezone determines the attendance day');

  const service = createRfidService(prisma, process.env.SESSION_SECRET!);
  const f = await fixture(), other = await fixture();
  const [a, b, c, d, e, g] = f.employees;
  const enrolled = await service.enroll(f.context, { employeeId: a.id, cardNumber: '0000000001', expectedCardId: null });
  const stored = await prisma.rfidCard.findUniqueOrThrow({ where: { id: enrolled.cardId } });
  ok(/^[a-f0-9]{64}$/.test(stored.cardDigest) && !JSON.stringify(stored).includes('0000000001'), 'card stored only as tenant-scoped keyed hash');
  await rejects(() => service.enroll(f.context, { employeeId: b.id, cardNumber: '0000000001', expectedCardId: null }), 'CARD_ASSIGNED');
  await rejects(() => service.enroll(f.context, { employeeId: other.employees[0].id, cardNumber: '0000000002', expectedCardId: null }), 'NOT_FOUND');
  await rejects(() => service.enroll(other.context, { employeeId: a.id, cardNumber: '0000000002', expectedCardId: null }), 'NOT_FOUND');
  await rejects(() => service.deactivate(other.context, enrolled.cardId), 'NOT_FOUND');
  const search = await service.searchEmployees(f.context, 'RFID-');
  ok(search.length === 6 && search.every(employee => f.employees.some(item => item.id === employee.id)), 'employee search is bounded and scoped to current tenant');
  const race = await Promise.allSettled([b, c].map(employee => service.enroll(f.context, { employeeId: employee.id, cardNumber: '0000000002', expectedCardId: null })));
  ok(race.filter(result => result.status === 'fulfilled').length === 1, 'concurrent enrollment commits only one active assignment');
  const replacement = await service.enroll(f.context, { employeeId: a.id, cardNumber: '0000000003', expectedCardId: enrolled.cardId });
  ok(Boolean((await prisma.rfidCard.findUniqueOrThrow({ where: { id: enrolled.cardId } })).deactivatedAt), 'replacement deactivates the old card atomically');
  await rejects(() => service.enroll(f.context, { employeeId: a.id, cardNumber: '0000000004', expectedCardId: enrolled.cardId }), 'STALE_CARD');
  const kiosk = await service.authorizeKiosk(f.context), secondKiosk = await service.authorizeKiosk(f.context);
  const scan = (cardNumber: string, requestId = randomUUID(), token = kiosk.token) => service.scan(f.organization.id, token, { cardNumber, requestId });
  ok((await scan('0000000001')).code === 'INACTIVE_CARD', 'replaced card cannot record attendance');
  ok((await scan('9999999999')).code === 'UNKNOWN_CARD', 'unknown cards produce no employee information');
  await rejects(() => service.scan(other.organization.id, kiosk.token, { cardNumber: '0000000003', requestId: randomUUID() }), 'KIOSK_EXPIRED');
  const requestId = randomUUID();
  const before = (await databaseNow()).getTime();
  const results = await Promise.all(Array.from({ length: 4 }, () => scan('0000000003', requestId)));
  ok(results.every(result => result.code === 'RECORDED' && result.direction === 'TIME_IN' && result.occurredAt === results[0].occurredAt), 'concurrent identical scans return the same committed Time In');
  ok(new Date(results[0].occurredAt!).getTime() >= before && new Date(results[0].occurredAt!).getTime() <= (await databaseNow()).getTime(), 'accepted timestamp comes from the database clock, independent of workstation clock skew');
  ok(results[0].employeeName === 'Synthetic Employee0' && results[0].timeZone === 'Asia/Manila', 'kiosk response exposes only the identified employee and organization-local timestamp context');
  await rejects(() => scan('0000000003', requestId, secondKiosk.token), 'IDEMPOTENCY_CONFLICT');
  await rejects(() => scan('0000000002', requestId), 'IDEMPOTENCY_CONFLICT');
  const repeats = await Promise.all([scan('0000000003'), scan('0000000003', randomUUID(), secondKiosk.token)]);
  ok(repeats.every(result => result.code === 'DUPLICATE_SCAN' && result.direction === 'TIME_IN'), 'different requests and kiosks cannot flip direction during cooldown');
  ok(await prisma.attendanceEvent.count({ where: { organizationId: f.organization.id, employeeId: a.id } }) === 1, 'duplicate/concurrent scans produce one raw event');
  const localDay = attendanceDateToDb(attendanceDateForInstant(new Date(results[0].occurredAt!), f.organization.timeZone));
  const projection = await prisma.dailyAttendanceRecord.findUniqueOrThrow({ where: { organizationId_employeeId_attendanceDate: { organizationId: f.organization.id, employeeId: a.id, attendanceDate: localDay } } });
  ok(projection.timeZoneSnapshot === 'Asia/Manila' && projection.scheduleAssignmentId && projection.firstTimeIn?.toISOString() === results[0].occurredAt, 'RFID immediately materializes the existing schedule-aware HR attendance record');
  const invalid = await service.scan(f.organization.id, kiosk.token, { cardNumber: '0000000003', requestId: randomUUID(), occurredAt: '2000-01-01', direction: 'TIME_OUT' });
  ok(invalid.code === 'INVALID_INPUT', 'client cannot supply attendance timestamps or direction');
  await rejects(() => recordAttendanceEvent({ ...f.context, employeeId: a.id, occurredAt: new Date(), direction: 'TIME_OUT', source: 'RFID', sourceReference: 'unauthorized-adapter' }), 'UNAUTHORIZED');

  await service.enroll(f.context, { employeeId: d.id, cardNumber: '0000000004', expectedCardId: null });
  await recordAttendanceEvent({ ...f.context, employeeId: d.id, occurredAt: new Date((await databaseNow()).getTime() - 120_000), direction: 'TIME_IN', source: 'MANUAL', sourceReference: 'rfid-manual-compatibility' });
  const mixedOut = await scan('0000000004');
  ok(mixedOut.code === 'RECORDED' && mixedOut.direction === 'TIME_OUT', 'RFID respects a pre-existing manual Time In');

  const inactiveCard = await service.enroll(f.context, { employeeId: e.id, cardNumber: '0000000005', expectedCardId: null });
  await service.deactivate(f.context, inactiveCard.cardId);
  ok((await scan('0000000005')).code === 'INACTIVE_CARD', 'explicitly deactivated card is refused');
  await service.enroll(f.context, { employeeId: g.id, cardNumber: '0000000006', expectedCardId: null });
  await prisma.employee.update({ where: { id: g.id }, data: { employeeStatus: 'INACTIVE' } });
  ok((await scan('0000000006')).code === 'INACTIVE_EMPLOYEE', 'inactive employee cannot scan even with an active card');
  await service.enroll(other.context, { employeeId: other.employees[0].id, cardNumber: '0000000007', expectedCardId: null });
  const foreignCard = await scan('0000000007');
  ok(foreignCard.code === 'UNKNOWN_CARD' && !foreignCard.employeeName, 'foreign-tenant card cannot identify an employee');
  const staff = await prisma.user.create({ data: { organizationId: f.organization.id, name: 'Synthetic hiring manager', email: `${randomUUID()}@fixture.invalid`, role: 'HIRING_MANAGER' } });
  await rejects(() => service.enroll({ ...f.context, actorUserId: staff.id }, { employeeId: e.id, cardNumber: '0000000008', expectedCardId: null }), 'UNAUTHORIZED');
  await rejects(() => service.authorizeKiosk({ ...f.context, actorUserId: other.actor.id }), 'UNAUTHORIZED');
  await assert.rejects(() => prisma.rfidCard.create({ data: { organizationId: other.organization.id, employeeId: a.id, cardDigest: 'a'.repeat(64) } }));
  ok(true, 'database composite foreign key rejects cross-tenant assignments');
  ok(replacement.cardId !== enrolled.cardId, 'replacement retains the original card assignment as history');
  const active = await prisma.rfidCard.findFirstOrThrow({ where: { organizationId: f.organization.id, employeeId: a.id, deactivatedAt: null } });
  await assert.rejects(() => prisma.rfidCard.create({ data: { organizationId: f.organization.id, employeeId: e.id, cardDigest: active.cardDigest } }));
  ok(true, 'database partial unique index rejects duplicate active cards');
  const receipt = await prisma.rfidAudit.findUniqueOrThrow({ where: { organizationId_requestKey: { organizationId: f.organization.id, requestKey: requestId } } });
  await assert.rejects(() => prisma.rfidAudit.update({ where: { id: receipt.id }, data: { action: 'TAMPERED' } }));
  ok(true, 'database rejects audit history mutation');
  const rawEvidence = JSON.stringify(await prisma.rfidAudit.findMany({ where: { organizationId: f.organization.id } }));
  ok(!rawEvidence.includes('0000000003') && !rawEvidence.includes(kiosk.token), 'audit receipts contain neither raw card numbers nor kiosk tokens');
  const expiring = await prisma.rfidKioskSession.findUniqueOrThrow({ where: { tokenHash: rfidTokenHash(secondKiosk.token) } });
  await prisma.rfidKioskSession.update({ where: { id: expiring.id }, data: { expiresAt: new Date(expiring.createdAt.getTime() + 1) } });
  await rejects(() => service.getKiosk(f.organization.id, secondKiosk.token), 'KIOSK_EXPIRED');
  ok(true, 'expired kiosk token is refused');
  // A lost/slow confirmation must not roll back a committed scan. Inject only
  // the post-transaction display lookup, leaving all writes on real PostgreSQL.
  await service.enroll(f.context, { employeeId: e.id, cardNumber: '0000000008', expectedCardId: null });
  const lostRequestId = randomUUID();
  let loseConfirmation = true;
  const confirmationDb = new Proxy(prisma, {
    get(target, property) {
      if (property === 'attendanceEvent') return new Proxy(target.attendanceEvent, {
        get(delegate, method) {
          if (method === 'findFirst') return async (args: Parameters<typeof delegate.findFirst>[0]) => {
            if (args?.include?.employee && loseConfirmation) {
              loseConfirmation = false;
              ok(await prisma.rfidAudit.count({ where: { organizationId: f.organization.id, requestKey: lostRequestId } }) === 1, 'receipt is committed before the display lookup starts');
              await new Promise(resolve => setTimeout(resolve, 15_500));
              throw new Error('SIMULATED_LOST_CONFIRMATION');
            }
            return delegate.findFirst(args);
          };
          const value = Reflect.get(delegate, method);
          return typeof value === 'function' ? value.bind(delegate) : value;
        },
      });
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  const confirmationService = createRfidService(confirmationDb, process.env.SESSION_SECRET!);
  const lostInput = { cardNumber: '0000000008', requestId: lostRequestId };
  await assert.rejects(() => confirmationService.scan(f.organization.id, kiosk.token, lostInput), /SIMULATED_LOST_CONFIRMATION/);
  const persisted = await prisma.attendanceEvent.findUniqueOrThrow({ where: { organizationId_source_sourceReference: { organizationId: f.organization.id, source: AttendanceSource.RFID, sourceReference: `rfid:${lostRequestId}` } } });
  const recovered = await confirmationService.scan(f.organization.id, kiosk.token, lostInput);
  ok(recovered.code === 'RECORDED' && recovered.employeeName === 'Synthetic Employee4' && recovered.direction === 'TIME_IN' && recovered.occurredAt === persisted.occurredAt.toISOString(), 'retry recovers original employee, direction and timestamp after a lost confirmation');
  ok(await prisma.attendanceEvent.count({ where: { organizationId: f.organization.id, employeeId: e.id } }) === 1, 'post-commit failure and retry preserve the original scan ID and one event');
  // Exercise real cooldown expiry without modifying immutable attendance evidence.
  const remaining = new Date(results[0].occurredAt!).getTime() + RFID_COOLDOWN_MS + 1000 - (await databaseNow()).getTime();
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining));
  const out = await scan('0000000003');
  ok(out.code === 'RECORDED' && out.direction === 'TIME_OUT', 'real server cooldown expiry records RFID Time Out');
  ok((await scan('0000000003', requestId)).occurredAt === results[0].occurredAt, 'old idempotency key still returns original Time In after Time Out');
  ok(await prisma.attendanceEvent.count({ where: { organizationId: f.organization.id, employeeId: a.id, source: AttendanceSource.RFID } }) === 2, 'only the intended Time In and Time Out exist');
  const completed = await prisma.dailyAttendanceRecord.findUniqueOrThrow({ where: { id: projection.id } });
  ok(completed.firstTimeIn && completed.lastTimeOut && completed.attendanceStatus === 'PRESENT', 'existing HR record shows the completed RFID attendance pair');

  const kioskRow = await prisma.rfidKioskSession.findFirstOrThrow({ where: { organizationId: f.organization.id }, orderBy: { createdAt: 'asc' } });
  const budgetTime = await databaseNow();
  await prisma.rfidRequestBudget.upsert({ where: { key: `scan-kiosk:${kioskRow.id}` }, create: { key: `scan-kiosk:${kioskRow.id}`, organizationId: f.organization.id, attempts: 120, windowStart: budgetTime }, update: { attempts: 120, windowStart: budgetTime } });
  await rejects(() => scan('0000000003'), 'THROTTLED');
  ok(true, 'persisted rate limit rejects excess requests');
  await service.revokeKiosk(f.organization.id, kiosk.token);
  await rejects(() => scan('0000000003'), 'KIOSK_EXPIRED');
  ok(true, 'locked kiosk cannot record attendance');
  const demoted = await service.authorizeKiosk(f.context);
  await prisma.user.update({ where: { id: f.actor.id }, data: { role: 'HIRING_MANAGER' } });
  await rejects(() => service.scan(f.organization.id, demoted.token, { cardNumber: '0000000003', requestId: randomUUID() }), 'UNAUTHORIZED');
  ok(true, 'current persisted HR permissions are rechecked for kiosk scans');
  console.log(`RFID tests passed: ${checks} assertions.`);
}

main().catch(error => { console.error('RFID FAILURE', error instanceof assert.AssertionError ? error.message : { code: error.code || error.name, message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]').replace(/[a-f0-9]{64}/g, '[DIGEST]').replace(/\b\d{10}\b/g, '[CARD]') }); process.exitCode = 1; }).finally(() => prisma.$disconnect());
