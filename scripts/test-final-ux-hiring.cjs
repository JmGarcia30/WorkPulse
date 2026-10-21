/* eslint-disable @typescript-eslint/no-require-imports -- Exercise the real page with gated tenant-scoped reads. */
const assert = require('node:assert/strict');
const Module = require('node:module');
require('tsx/cjs');
const originalLoad = Module._load;
let db;
async function main() {
  try {
    Module._load = function(request, parent, isMain) {
      if (request === '@/lib/auth/session') return { getSession: async () => ({ role: 'ORGANIZATION_ADMIN', organizationId: 'owned-tenant' }) };
      if (request === '@/lib/db/prisma') return { prisma: { job: { findMany: args => db.jobs(args) }, application: { findMany: args => db.applications(args) } } };
      return originalLoad.call(this, request, parent, isMain);
    };
    const Page = require('../src/app/(dashboard)/dashboard/hiring/pipeline/page.tsx').default;
    for (const raw of [undefined, 'owned-job', 'foreign-job', '   ']) {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const calls = [];
      db = {
        jobs: args => { assert.equal(args.where.organizationId, 'owned-tenant'); return gate; },
        applications: args => { calls.push(args); return Promise.resolve([]); },
      };
      const result = Page({ searchParams: Promise.resolve({ jobId: raw }) });
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(calls.length, raw?.trim() ? 0 : 1, 'Only filtered requests depend on job ownership validation');
      release([{ id: 'owned-job', title: 'Fixture job', department: 'Fixture department' }]);
      await result;
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].where.job, { organizationId: 'owned-tenant', id: raw === 'owned-job' ? raw : undefined });
    }
    console.log('UX Hiring: parallel default reads, valid filters, foreign-ID fallback, blank filters and tenant scope pass.');
  } finally { Module._load = originalLoad; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
