/* eslint-disable @typescript-eslint/no-require-imports -- Actual read helper with controlled database dependency. */
const assert = require('node:assert/strict'), Module = require('node:module');
require('tsx/cjs');
const original = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === 'server-only') return {};
  if (name === '@/lib/db/prisma') return { prisma: {} };
  return original.call(this, name, parent, isMain);
};
async function main() {
  const { getJobList, JOB_PAGE_SIZE } = require('../src/features/hiring/job-list.ts');
  let total = 61, countArgs, readArgs;
  const db = { job: { count: async args => { countArgs = args; return total; }, findMany: async args => { readArgs = args; return []; } } };
  for (const raw of [undefined, '', '0', '-1', '1.5', '2oops', 'Infinity', '999999999999999999999', ['2']]) {
    const data = await getJobList('trusted-organization', { page: raw, status: 'INVALID' }, db);
    assert.equal(data.page, 1); assert.equal(data.status, undefined); assert.equal(readArgs.skip, 0);
  }
  const second = await getJobList('trusted-organization', { page: '2', status: 'PUBLISHED', search: '  UI Department  ' }, db);
  assert.equal(second.totalCount, 61); assert.equal(second.totalPages, 4); assert.equal(readArgs.take, JOB_PAGE_SIZE); assert.equal(readArgs.skip, 20);
  assert.deepEqual(readArgs.where, countArgs.where); assert.equal(readArgs.where.organizationId, 'trusted-organization'); assert.equal(readArgs.where.status, 'PUBLISHED');
  assert(readArgs.where.OR.every(clause => Object.values(clause)[0].contains === 'UI Department'));
  assert.deepEqual(readArgs.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
  assert(!('description' in readArgs.select) && !('requirements' in readArgs.select)); assert.deepEqual(readArgs.select._count, { select: { applications: true } });
  const clamped = await getJobList('trusted-organization', { page: '999999999' }, db); assert.equal(clamped.page, 4); assert.equal(readArgs.skip, 60);
  total = 0; const empty = await getJobList('trusted-organization', { page: '8' }, db); assert.equal(empty.page, 1); assert.equal(empty.totalPages, 1); assert.equal(readArgs.skip, 0);
  db.job.count = async () => { throw Error('DATABASE_FAILED'); }; await assert.rejects(getJobList('trusted-organization', {}, db), /DATABASE_FAILED/);
  const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
  const { PageSkeleton } = require('../src/components/ui/PageSkeleton.tsx');
  for (const kind of ['dashboard', 'employees', 'jobs', 'attendance', 'leave', 'payroll', 'analytics', 'profile', 'pipeline', 'interviews']) {
    const html = renderToStaticMarkup(React.createElement(PageSkeleton, { kind, label: kind }));
    assert(html.includes('role="status"') && html.includes('aria-busy="true"')); assert(!/dark:|slate-900|animate-|use client/.test(html));
    assert(html.includes('--wp-surface') && html.includes('--wp-border'));
  }
  console.log('PASS bounded job queries, safe/clamped pages, matching tenant filters/counts, stable ties, narrow fields, error propagation and all ten static accessible light skeleton variants');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Module._load = original; });
