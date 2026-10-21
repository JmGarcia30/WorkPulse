/* eslint-disable @typescript-eslint/no-require-imports -- Actual session module with controlled request/database dependencies. */
const assert = require('node:assert/strict');
const Module = require('node:module');
require('tsx/cjs');
const load = Module._load;
let cookie, user, databaseError, reads = 0;
const values = { userId: 'fixture-user', organizationId: 'fixture-org', role: 'ORGANIZATION_ADMIN', name: 'Old name', email: 'old@fixture.invalid' };
async function main() {
  const { SignJWT } = await import('jose');
  const token = async (changes = {}, expires = '1h') => new SignJWT({ ...values, ...changes }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expires).sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  Module._load = function(request, parent, isMain) {
    if (request === 'next/headers') return { cookies: async () => ({ get: () => cookie ? { value: cookie } : undefined }) };
    if (request === '@/lib/db/prisma') return { prisma: { user: { findUnique: async () => { reads++; if (databaseError) throw databaseError; return user; } } } };
    return load.call(this, request, parent, isMain);
  };
  try {
    const { getSession } = require('../src/lib/auth/session.ts');
    user = { id: values.userId, organizationId: values.organizationId, role: values.role, name: 'Current name', email: 'current@fixture.invalid' };
    cookie = await token();
    assert.deepEqual(await getSession(), { ...values, name: user.name, email: user.email });
    user.role = 'HIRING_MANAGER'; assert.equal(await getSession(), null);
    user.role = values.role; user.organizationId = 'foreign'; assert.equal(await getSession(), null);
    user.organizationId = values.organizationId;
    for (cookie of [await token({}, '-1h'), 'malformed', await token({ userId: 7 }), undefined]) {
      const before = reads; assert.equal(await getSession(), null); assert.equal(reads, before);
    }
    cookie = await token(); user = null; assert.equal(await getSession(), null);
    databaseError = Error('DATABASE_UNAVAILABLE'); await assert.rejects(getSession(), /DATABASE_UNAVAILABLE/);
    console.log('PASS session signature/expiry/claim types, current role/membership, removed user, current identity, and database failure propagation');
  } finally { Module._load = load; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
