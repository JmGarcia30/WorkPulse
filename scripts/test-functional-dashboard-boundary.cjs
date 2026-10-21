/* eslint-disable @typescript-eslint/no-require-imports -- Adversarial rollback-only preview regression. */
require('tsx/cjs');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const { readDashboardData } = require('../src/features/dashboard/read-model');
const { readDashboardData: originalDashboard } = require('./reference/final-ux-dashboard');
const { readOrganizationBranding } = require('../src/features/organization-branding/data');
const marker = 'fr-boundary-' + randomBytes(8).toString('hex');
const db = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
let observedLegacyIdOrder = false;
db.$on('query', event => { if (event.query.includes('"Employee"') && /ORDER BY[^;]*"id" ASC/.test(event.query)) observedLegacyIdOrder = true; });
const rollback = Error('ROLLBACK');
async function main() {
  try {
    await db.$transaction(async tx => {
      const org = await tx.organization.create({ data: { name: 'Preview boundary fixture', slug: marker } });
      const hr = await tx.user.create({ data: { organizationId: org.id, role: 'HR_ADMIN', name: 'Fixture HR', email: marker + '@fixture.invalid' } });
      const job = await tx.job.create({ data: { organizationId: org.id, title: 'Fixture', slug: 'fixture', department: 'Fixture', employmentType: 'Full-time', location: 'Fixture', description: 'Fixture', qualifications: 'Fixture', requirements: 'Fixture', responsibilities: 'Fixture' } });
      // Reverse physical insertion order versus identifier order, with >10 rows.
      const rows = Array.from({ length: 14 }, (_, i) => marker + '-' + String(14 - i).padStart(2, '0'));
      await tx.applicant.createMany({ data: rows.map(id => ({ id: id + '-applicant', firstName: 'Boundary', lastName: id, email: id + '@fixture.invalid', phone: '0' })) });
      await tx.application.createMany({ data: rows.map(id => ({ id: id + '-application', jobId: job.id, applicantId: id + '-applicant', status: 'HIRED', coverLetter: 'Fixture' })) });
      await tx.employee.createMany({ data: rows.map(id => ({ id, organizationId: org.id, sourceApplicationId: id + '-application', applicantId: id + '-applicant', employeeNumber: id, firstName: 'Boundary', lastName: id, email: id + '@fixture.invalid', phone: '0', createdById: hr.id })) });
      await tx.employmentRecord.createMany({ data: rows.map(id => ({ employeeId: id, jobId: job.id, jobTitle: 'Fixture', department: 'Fixture', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: new Date('2025-01-01Z'), startDate: new Date('2025-01-01Z'), effectiveFrom: new Date('2025-01-01Z'), salary: 1, payFrequency: 'MONTHLY', createdById: hr.id })) });
      const branding = await readOrganizationBranding(tx, { id: org.id });
      const outcomes = [];
      for (const role of ['HR_ADMIN', 'ORGANIZATION_ADMIN', 'HIRING_MANAGER']) {
        const session = { userId: hr.id, organizationId: org.id, role, name: 'Fixture HR', email: hr.email };
        const original = await originalDashboard(session, new Date('2026-10-20T04:00:00Z'), tx, branding);
        const current = await readDashboardData(session, new Date('2026-10-20T04:00:00Z'), tx, branding);
        const beforeIds = original.attentionQueue.map(row => row.id), afterIds = current.attentionQueue.map(row => row.id);
        outcomes.push({ role, fullModelEqual: JSON.stringify(original) === JSON.stringify(current), sameCounts: JSON.stringify(original.headerStats) === JSON.stringify(current.headerStats), samePreviewMembers: JSON.stringify([...beforeIds].sort()) === JSON.stringify([...afterIds].sort()), sameOrder: JSON.stringify(beforeIds) === JSON.stringify(afterIds), previewLengths: [beforeIds.length, afterIds.length] });
      }
      fs.writeFileSync('docs/functional-regression/dashboard-boundary.json', JSON.stringify({ observedLegacyIdOrder, outcomes }, null, 2));
      console.log('FR DASHBOARD_BOUNDARY ' + JSON.stringify({ observedLegacyIdOrder, outcomes }));
      assert.ok(outcomes.every(row => row.fullModelEqual), 'Dashboard bounded employee alerts must preserve legacy selection and ordering beyond ten employees');
      throw rollback;
    }, { timeout: 120000 });
  } catch (error) { if (error !== rollback) throw error; }
  assert.equal(await db.organization.count({ where: { slug: marker } }), 0);
  console.log('FR Dashboard: adversarial >10 employee preview membership/order and role parity pass; fixtures rolled back.');
}
main().catch(error => { console.error(error.name, String(error.message).split(/\r?\n/).slice(-3).join(' ')); process.exitCode = 1; }).finally(() => db.$disconnect());
