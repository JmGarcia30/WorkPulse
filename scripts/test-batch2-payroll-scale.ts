import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { assessPayrollPeriod } from '../src/features/payroll/review';
import { assessPayrollPeriod as legacyReview } from './reference/batch2-payroll-review';
import { getPayrollFoundation } from '../src/features/payroll/queries';
import { getPayrollFoundation as legacyFoundation } from './reference/batch2-payroll-queries';
import { readOrganizationBranding } from '../src/features/organization-branding/data';
import { getOrganizationBranding as legacyBranding } from './reference/batch2-branding';

const url = new URL(process.env.DATABASE_URL!);
assert.match(url.searchParams.get('schema') ?? '', /^batch2_test_[a-f0-9]{24}$/);
const db = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
let queryCount = 0, checks = 0;
db.$on('query', () => queryCount++);
const day = (s: string) => new Date(s + 'T00:00:00Z');
const payrollSamples: unknown[] = [], bootstrapSamples: unknown[] = [];
const foundationSamples: unknown[] = [];
const foundationOnly = process.env.WORKPULSE_BATCH2_FOUNDATION_ONLY === '1';
function ok(value: unknown, message: string) { assert.ok(value, message); console.log(`PASS ${++checks}: ${message}`); }
async function timed<T>(operation: () => Promise<T>) {
  const count = queryCount, start = performance.now();
  const value = await operation();
  return { value, ms: performance.now() - start, sql: queryCount - count };
}
async function compare(organizationId: string, periodId: string, label: string) {
  const old = await legacyReview(organizationId, periodId, db), current = await assessPayrollPeriod(organizationId, periodId, db);
  ok(JSON.stringify(old) === JSON.stringify(current), `Payroll complete review parity: ${label}`);
}
async function main() {
  for (const size of (foundationOnly ? [5] : [5, 50, 100])) {
    const organization = await db.organization.create({ data: { name: 'Synthetic Payroll', slug: 'batch2-' + randomUUID(), timeZone: 'Asia/Manila' } });
    const actor = await db.user.create({ data: { organizationId: organization.id, name: 'Synthetic HR', email: randomUUID() + '@fixture.invalid', role: 'HR_ADMIN' } });
    const job = await db.job.create({ data: { organizationId: organization.id, title: 'Synthetic', slug: 'synthetic', department: 'Synthetic', employmentType: 'Full-time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test' } });
    const rows = Array.from({ length: size }, (_, i) => ({ id: randomUUID(), applicant: randomUUID(), application: randomUUID(), compensation: randomUUID(), entry: randomUUID(), number: 'SYN-' + String(i).padStart(4, '0') }));
    await db.applicant.createMany({ data: rows.map(r => ({ id: r.applicant, firstName: r.number, lastName: 'Fixture', email: r.applicant + '@fixture.invalid', phone: '0' })) });
    await db.application.createMany({ data: rows.map(r => ({ id: r.application, jobId: job.id, applicantId: r.applicant, status: 'HIRED', coverLetter: 'Synthetic' })) });
    await db.employee.createMany({ data: rows.map(r => ({ id: r.id, organizationId: organization.id, applicantId: r.applicant, sourceApplicationId: r.application, employeeNumber: r.number, firstName: r.number, lastName: 'Fixture', email: r.id + '@fixture.invalid', phone: '0', createdById: actor.id })) });
    await db.employeeCompensation.createMany({ data: rows.map(r => ({ id: r.compensation, organizationId: organization.id, employeeId: r.id, compensationType: 'MONTHLY', baseRate: '1000.00', payFrequency: 'MONTHLY', effectiveFrom: day('2026-01-01') })) });
    const period = await db.payrollPeriod.create({ data: { organizationId: organization.id, name: 'Synthetic October', periodStart: day('2026-10-01'), periodEnd: day('2026-10-31'), payDate: day('2026-10-31'), status: 'REVIEW' } });
    await db.payrollEntry.createMany({ data: rows.map(r => ({ id: r.entry, organizationId: organization.id, payrollPeriodId: period.id, employeeId: r.id, employeeCompensationId: r.compensation, status: 'REVIEW', baseAmount: '1000.00', grossAmount: '1000.00', totalDeductions: '100.00', netAmount: '900.00', calculationSnapshot: { compensation: { id: r.compensation }, policy: { id: 'DEFAULT', version: 0 }, calculation: { baseAmount: '1000.00', grossAmount: '1000.00', totalDeductions: '100.00', netAmount: '900.00' } } })) });
    for (let iteration = 0; iteration < (foundationOnly ? 0 : 6); iteration++) {
      const pair = iteration % 2 === 0 ? ['before', 'after'] : ['after', 'before'];
      const values = new Map<string, unknown>();
      for (const mode of pair) {
        const sample = await timed(() => mode === 'before' ? legacyReview(organization.id, period.id, db) : assessPayrollPeriod(organization.id, period.id, db));
        values.set(mode, sample.value);payrollSamples.push({ size, iteration, mode, ms: sample.ms, sql: sample.sql });
      }
      ok(JSON.stringify(values.get('before')) === JSON.stringify(values.get('after')), `Payroll parity at ${size} employees, sample ${iteration}`);
      writeFileSync('docs/performance-audit/batch-2/payroll-scale.json', JSON.stringify(payrollSamples, null, 2));
    }
    for (let iteration = 0; iteration < (foundationOnly ? 6 : 1); iteration++) {
      const values = new Map<string, unknown>();
      for (const mode of (iteration % 2 ? ['after', 'before'] : ['before', 'after'])) {
        const sample = await timed(() => mode === 'before' ? legacyFoundation(organization.id, period.id, db) : getPayrollFoundation(organization.id, period.id, db));
        values.set(mode, sample.value);foundationSamples.push({ size, iteration, mode, ms: sample.ms, sql: sample.sql });
      }
      ok(JSON.stringify(values.get('before')) === JSON.stringify(values.get('after')), `Payroll foundation payload parity at ${size} employees, sample ${iteration}`);
    }
    writeFileSync('docs/performance-audit/batch-2/payroll-foundation.json', JSON.stringify(foundationSamples, null, 2));
    if (size === 5) {
      await db.employeeCompensation.update({ where: { id: rows[0].compensation }, data: { effectiveTo: day('2026-10-30') } });
      await compare(organization.id, period.id, 'partial compensation period');
      await db.employeeCompensation.update({ where: { id: rows[0].compensation }, data: { effectiveTo: day('2026-10-31') } });
      await compare(organization.id, period.id, 'inclusive effective end boundary');
      await db.employee.update({ where: { id: rows[1].id }, data: { employeeStatus: 'INACTIVE' } });
      await compare(organization.id, period.id, 'ineligible employee with existing entry');
      await db.payrollEntry.update({ where: { id: rows[2].entry }, data: { calculationSnapshot: {} } });
      await compare(organization.id, period.id, 'incomplete snapshot');
      await db.payrollEntry.update({ where: { id: rows[3].entry }, data: { netAmount: '999.00', status: 'DRAFT' } });
      await compare(organization.id, period.id, 'mismatched amounts and status');
      await db.payrollEntry.delete({ where: { id: rows[4].entry } });
      await compare(organization.id, period.id, 'missing eligible entry');
    }
  }
  for (const branded of (foundationOnly ? [] : [false, true])) {
    const org = await db.organization.create({ data: { name: branded ? 'Other tenant' : 'SAGA fixture', slug: 'brand-' + randomUUID(), timeZone: branded ? 'America/New_York' : 'Asia/Manila', logoUrl: branded ? 'https://example.invalid/logo' : '/legacy-logo.png' } });
    if (branded) await db.organizationBranding.create({ data: { organizationId: org.id, displayName: 'Distinct brand', primaryColor: '#742A2A', accentColor: '#B68B2C', contactEmail: 'fixture@example.invalid' } });
    for (let iteration = 0; iteration < 6; iteration++) for (const mode of (iteration % 2 ? ['after', 'before'] : ['before', 'after'])) {
      const sample = await timed(async () => {
        if (mode === 'after') return readOrganizationBranding(db, { slug: org.slug });
        const first = await db.organization.findUnique({ where: { slug: org.slug }, select: { id: true } });
        return first ? legacyBranding(first.id, db) : null;
      });
      bootstrapSamples.push({ branded, iteration, mode, ms: sample.ms, sql: sample.sql });
      const expected = await legacyBranding(org.id, db);
      ok(JSON.stringify(expected) === JSON.stringify(sample.value), `Branding complete parity, branded=${branded}, mode=${mode}, sample=${iteration}`);
    }
    ok((await readOrganizationBranding(db, { id: org.id }))?.organizationId === org.id, 'Brand identity remains scoped to the requested tenant');
  }
  if (!foundationOnly) {
    ok(await readOrganizationBranding(db, { slug: 'missing-' + randomUUID() }) === null, 'Unknown tenant remains unavailable');
    writeFileSync('docs/performance-audit/batch-2/bootstrap.json', JSON.stringify(bootstrapSamples, null, 2));
  }
  console.log(`PASS ${checks}: Batch 2 synthetic scalability and result parity complete`);
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: /^[A-Za-z0-9 :,.=-]+$/.test(error.message) ? error.message.slice(0, 180) : undefined }));process.exitCode = 1; }).finally(() => db.$disconnect());
