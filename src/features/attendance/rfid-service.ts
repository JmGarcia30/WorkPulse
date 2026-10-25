import { createHash, createHmac, randomBytes } from 'node:crypto';
import { AttendanceDirection, AttendanceSource, EmployeeStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import { attendanceDateForInstant, attendanceDateToDb, instantForLocalSecond } from './domain';
import { lockAttendanceEmployee, writeAttendanceEvent } from './service';
import { decideRfidDirection, enrollmentSchema, RFID_KIOSK_SECONDS, rfidMessages, RfidScanResult, scanRequestSchema } from './rfid-policy';

type Tx = Prisma.TransactionClient;
export type RfidContext = { organizationId: string; actorUserId: string };
export class RfidError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export const rfidTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export const isRfidAdministrator = (role: Role) => role === Role.HR_ADMIN || role === Role.ORGANIZATION_ADMIN;

// A factory permits integration tests against an explicitly verified development connection.
// No browser caller can supply a tenant, actor, timestamp, direction, or hashing key.
export function createRfidService(db: PrismaClient, secret: string) {
  if (secret.length < 32) throw new Error('RFID requires the configured SESSION_SECRET (at least 32 characters).');
  const digest = (organizationId: string, value: string) => createHmac('sha256', secret).update(JSON.stringify(['workpulse-rfid-v1', organizationId, value])).digest('hex');
  const transaction = <T>(operation: (tx: Tx) => Promise<T>, timeout = 15_000) => db.$transaction(operation, { timeout });
  async function serverNow(tx: Tx) {
    const [row] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    return row.now;
  }
  async function assertHR(tx: Tx, context: RfidContext) {
    const actor = await tx.user.findFirst({ where: { id: context.actorUserId, organizationId: context.organizationId }, select: { role: true } });
    if (!actor || !isRfidAdministrator(actor.role)) throw new RfidError('UNAUTHORIZED', 'HR administrator access is required.');
  }
  async function audit(tx: Tx, context: RfidContext, action: string, details: Prisma.InputJsonObject, employeeId?: string) {
    await tx.rfidAudit.create({ data: { organizationId: context.organizationId, actorUserId: context.actorUserId, employeeId, action, details, createdAt: await serverNow(tx) } });
  }
  // Separate committed budget transaction: failed scans cannot roll back their rate limit.
  async function budget(organizationId: string, key: string, limit: number) {
    const [row] = await db.$queryRaw<Array<{ attempts: number }>>`
      INSERT INTO "RfidRequestBudget" (key, "organizationId", "windowStart", attempts)
      VALUES (${key}, ${organizationId}, clock_timestamp(), 1)
      ON CONFLICT (key) DO UPDATE SET
        attempts = CASE WHEN "RfidRequestBudget"."windowStart" <= clock_timestamp() - interval '1 minute' THEN 1 ELSE LEAST("RfidRequestBudget".attempts + 1, ${limit + 1}) END,
        "windowStart" = CASE WHEN "RfidRequestBudget"."windowStart" <= clock_timestamp() - interval '1 minute' THEN clock_timestamp() ELSE "RfidRequestBudget"."windowStart" END
      RETURNING attempts`;
    if (row.attempts > limit) throw new RfidError('THROTTLED', 'Too many requests. Please wait a minute.');
  }
  async function hrBudget(context: RfidContext) {
    await transaction(tx => assertHR(tx, context));
    await budget(context.organizationId, `hr:${context.organizationId}:${context.actorUserId}`, 60);
  }
  async function kiosk(tx: Tx, organizationId: string, token: string, lock = false) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new RfidError('KIOSK_EXPIRED', 'Kiosk session expired. Ask HR to authorize this device.');
    const hash = rfidTokenHash(token);
    if (lock) await tx.$queryRaw`SELECT id FROM "RfidKioskSession" WHERE "organizationId" = ${organizationId} AND "tokenHash" = ${hash} FOR UPDATE`;
    const session = await tx.rfidKioskSession.findFirst({ where: { organizationId, tokenHash: hash } });
    if (!session || session.revokedAt || session.expiresAt <= await serverNow(tx)) throw new RfidError('KIOSK_EXPIRED', 'Kiosk session expired. Ask HR to authorize this device.');
    await assertHR(tx, { organizationId, actorUserId: session.authorizedById });
    return session;
  }
  async function responseFor(tx: Tx, organizationId: string, code: string, details: Prisma.JsonValue, employeeId: string | null): Promise<RfidScanResult> {
    const result: RfidScanResult = { code, message: rfidMessages[code] ?? 'Attendance could not be recorded. Contact HR.' };
    const data = details as { eventId?: string; timeZone?: string };
    if (data.eventId && employeeId) {
      const event = await tx.attendanceEvent.findFirst({ where: { id: data.eventId, employeeId, organizationId }, include: { employee: { select: { firstName: true, lastName: true } } } });
      if (event?.direction) Object.assign(result, { employeeName: `${event.employee.firstName} ${event.employee.lastName}`, direction: event.direction, occurredAt: event.occurredAt.toISOString(), timeZone: data.timeZone });
    }
    return result;
  }
  return {
    async searchEmployees(context: RfidContext, query: string) {
      await hrBudget(context);
      const search = query.trim();
      if (search.length < 2 || search.length > 80) return [];
      return db.employee.findMany({
        where: { organizationId: context.organizationId, AND: search.split(/\s+/).map(part => ({ OR: ['firstName', 'lastName', 'employeeNumber'].map(field => ({ [field]: { contains: part, mode: 'insensitive' } })) })) },
        select: { id: true, firstName: true, lastName: true, employeeNumber: true, employeeStatus: true, rfidCards: { where: { deactivatedAt: null }, select: { id: true, createdAt: true } } },
        take: 20, orderBy: [{ lastName: 'asc' }, { id: 'asc' }],
      });
    },
    async enroll(context: RfidContext, input: unknown) {
      await hrBudget(context);
      const parsed = enrollmentSchema.safeParse(input);
      if (!parsed.success) throw new RfidError('INVALID_INPUT', 'Select an employee and scan a 10-digit numeric card.');
      const { employeeId, cardNumber, expectedCardId } = parsed.data;
      const cardDigest = digest(context.organizationId, cardNumber);
      try {
        return await transaction(async tx => {
          await assertHR(tx, context);
          // Organization lock serializes enrollment/replacement; scans use this lock too.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rfid-cards:${context.organizationId}`}, 0))::text`;
          const employee = await tx.employee.findFirst({ where: { id: employeeId, organizationId: context.organizationId, employeeStatus: EmployeeStatus.ACTIVE } });
          if (!employee) throw new RfidError('NOT_FOUND', 'Active employee not found in this workspace.');
          const current = await tx.rfidCard.findFirst({ where: { employeeId, organizationId: context.organizationId, deactivatedAt: null } });
          if ((current?.id ?? null) !== expectedCardId) throw new RfidError('STALE_CARD', 'Card assignment changed. Search for the employee again.');
          if (await tx.rfidCard.findFirst({ where: { organizationId: context.organizationId, cardDigest, deactivatedAt: null } })) throw new RfidError('CARD_ASSIGNED', 'This card already has an active assignment.');
          if (current) await tx.rfidCard.update({ where: { id: current.id }, data: { deactivatedAt: await serverNow(tx) } });
          const card = await tx.rfidCard.create({ data: { organizationId: context.organizationId, employeeId, cardDigest, createdAt: await serverNow(tx) } });
          await audit(tx, context, current ? 'CARD_REPLACED' : 'CARD_ENROLLED', { cardId: card.id, previousCardId: current?.id ?? null }, employeeId);
          return { cardId: card.id };
        });
      } catch (error) {
        if (error instanceof RfidError || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          await transaction(tx => audit(tx, context, 'ENROLLMENT_REJECTED', { code: error instanceof RfidError ? error.code : 'CARD_ASSIGNED' }));
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new RfidError('CARD_ASSIGNED', 'This card already has an active assignment.');
        throw error;
      }
    },
    async deactivate(context: RfidContext, cardId: string) {
      await hrBudget(context);
      if (!cardId || cardId.length > 100) throw new RfidError('INVALID_INPUT', 'Select an assigned card.');
      await transaction(async tx => {
        await assertHR(tx, context);
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rfid-cards:${context.organizationId}`}, 0))::text`;
        const card = await tx.rfidCard.findFirst({ where: { id: cardId, organizationId: context.organizationId, deactivatedAt: null } });
        if (!card) throw new RfidError('NOT_FOUND', 'Active card not found in this workspace.');
        await tx.rfidCard.update({ where: { id: card.id }, data: { deactivatedAt: await serverNow(tx) } });
        await audit(tx, context, 'CARD_DEACTIVATED', { cardId: card.id }, card.employeeId);
      });
    },
    async authorizeKiosk(context: RfidContext) {
      await hrBudget(context);
      return transaction(async tx => {
        await assertHR(tx, context);
        const now = await serverNow(tx), token = randomBytes(32).toString('hex');
        const expiresAt = new Date(now.getTime() + RFID_KIOSK_SECONDS * 1000);
        const session = await tx.rfidKioskSession.create({ data: { organizationId: context.organizationId, authorizedById: context.actorUserId, tokenHash: rfidTokenHash(token), expiresAt, createdAt: now } });
        await audit(tx, context, 'KIOSK_AUTHORIZED', { kioskId: session.id, expiresAt: expiresAt.toISOString() });
        return { token, expiresAt };
      });
    },
    async getKiosk(organizationId: string, token: string) {
      return transaction(async tx => {
        const session = await kiosk(tx, organizationId, token);
        return { expiresAt: session.expiresAt, expiresInMs: session.expiresAt.getTime() - (await serverNow(tx)).getTime() };
      });
    },
    async revokeKiosk(organizationId: string, token: string) {
      await transaction(async tx => {
        const session = await kiosk(tx, organizationId, token, true);
        await tx.rfidKioskSession.update({ where: { id: session.id }, data: { revokedAt: await serverNow(tx) } });
        await audit(tx, { organizationId, actorUserId: session.authorizedById }, 'KIOSK_LOCKED', { kioskId: session.id });
      });
    },
    async scan(organizationId: string, token: string, input: unknown): Promise<RfidScanResult> {
      const session = await transaction(tx => kiosk(tx, organizationId, token));
      await budget(organizationId, `scan-org:${organizationId}`, 600);
      await budget(organizationId, `scan-kiosk:${session.id}`, 120);
      const outcome = await transaction(async tx => {
        const authorized = await kiosk(tx, organizationId, token, true);
        const context = { organizationId, actorUserId: authorized.authorizedById };
        const parsed = scanRequestSchema.safeParse(input);
        if (!parsed.success) {
          await audit(tx, context, 'SCAN_INVALID', { kioskId: authorized.id });
          return { code: 'INVALID_INPUT', details: {}, employeeId: null };
        }
        const { cardNumber, requestId } = parsed.data;
        const fingerprint = digest(organizationId, `${authorized.id}:${cardNumber}`);
        // A shared request lock prevents concurrent reuse from different kiosks/cards.
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`rfid-request:${organizationId}:${requestId}`}, 0))::text`;
        const receipt = await tx.rfidAudit.findUnique({ where: { organizationId_requestKey: { organizationId, requestKey: requestId } } });
        if (receipt) {
          if (receipt.requestFingerprint !== fingerprint) throw new RfidError('IDEMPOTENCY_CONFLICT', 'Scan reference already used. Start a new scan.');
          return { code: receipt.action, details: receipt.details, employeeId: receipt.employeeId };
        }
        await tx.$queryRaw`SELECT pg_advisory_xact_lock_shared(hashtextextended(${`rfid-cards:${organizationId}`}, 0))::text`;
        const cards = await tx.rfidCard.findMany({ where: { organizationId, cardDigest: digest(organizationId, cardNumber) }, orderBy: { createdAt: 'desc' } });
        const card = cards.find(item => !item.deactivatedAt);
        let code = cards.length ? 'INACTIVE_CARD' : 'UNKNOWN_CARD';
        let details: Prisma.InputJsonObject = { kioskId: authorized.id };
        let employeeId: string | undefined;
        if (card) {
          employeeId = card.employeeId;
          await lockAttendanceEmployee(tx, organizationId, employeeId);
          const [employee] = await tx.$queryRaw<Array<{ employeeStatus: EmployeeStatus }>>`SELECT "employeeStatus" FROM "Employee" WHERE id = ${employeeId} AND "organizationId" = ${organizationId} FOR SHARE`;
          const now = await serverNow(tx);
          const employed = await tx.employmentRecord.findFirst({ where: { employeeId, employee: { organizationId }, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] }, select: { id: true } });
          if (employee?.employeeStatus !== EmployeeStatus.ACTIVE || !employed) code = 'INACTIVE_EMPLOYEE';
          else {
            const organization = await tx.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { timeZone: true } });
            const date = attendanceDateForInstant(now, organization.timeZone);
            const events = await tx.attendanceEvent.findMany({ where: { organizationId, employeeId, occurredAt: { gte: instantForLocalSecond(date, 0, organization.timeZone), lt: instantForLocalSecond(date, 86400, organization.timeZone) } }, orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }] });
            const projection = await tx.dailyAttendanceRecord.findUnique({ where: { organizationId_employeeId_attendanceDate: { organizationId, employeeId, attendanceDate: attendanceDateToDb(date) } }, select: { correctionVersion: true } });
            const latest = events.at(-1) ?? await tx.attendanceEvent.findFirst({ where: { organizationId, employeeId }, orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }] }) ?? undefined;
            const decision = decideRfidDirection(events, now, Boolean(projection?.correctionVersion), latest);
            if (decision === AttendanceDirection.TIME_IN || decision === AttendanceDirection.TIME_OUT) {
              const result = await writeAttendanceEvent(tx, { organizationId, actorUserId: authorized.authorizedById, employeeId, occurredAt: now, direction: decision, source: AttendanceSource.RFID, sourceReference: `rfid:${requestId}`, metadata: { kioskId: authorized.id, cardAssignmentId: card.id } });
              code = 'RECORDED';
              details = { ...details, eventId: result.eventId, timeZone: organization.timeZone };
            } else {
              code = decision;
              if (code === 'DUPLICATE_SCAN' || code === 'DAY_COMPLETE') details = { ...details, eventId: latest?.id ?? null, timeZone: organization.timeZone };
            }
          }
        }
        const saved = await tx.rfidAudit.create({ data: { organizationId, actorUserId: authorized.authorizedById, employeeId, action: code, requestKey: requestId, requestFingerprint: fingerprint, details, createdAt: await serverNow(tx) } });
        return { code, details: saved.details, employeeId: employeeId ?? null };
      }, 30_000);
      // Commit the event, daily record and idempotency receipt before loading display
      // data. A slow confirmation query must not roll back accepted attendance.
      return responseFor(db, organizationId, outcome.code, outcome.details, outcome.employeeId);
    },
  };
}
