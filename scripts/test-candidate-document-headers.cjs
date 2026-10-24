/* eslint-disable @typescript-eslint/no-require-imports -- Actual handlers/private adapter without hosted side effects. */
const assert = require('node:assert/strict'), Module = require('node:module');
require('tsx/cjs');
const original = Module._load;
let contentType = 'text/html', unavailable = false;
const bytes = Buffer.from('ISOLATED-PRIVATE-ACTIVE-CONTENT');
const user = { userId: 'fixture-user', organizationId: 'fixture-org', role: 'ORGANIZATION_ADMIN' };
let tenant = { organizationId: user.organizationId, slug: 'fixture' }, host = 'fixture.localhost';
const document = { id: 'fixture-document', applicationId: 'fixture-application', storageKey: 'fixture-key', fileName: 'synthetic.pdf', application: { job: { organizationId: user.organizationId } }, onboardingProcess: { applicationId: 'fixture-application', application: { job: { organizationId: user.organizationId } } } };
async function main() {
  Module._load = function(request, parent, isMain) {
    if (request === 'server-only') return {};
    if (request === '@/lib/auth/guards') return { requireBackOfficeContext: async () => user };
    if (request === '@/lib/auth/session') return { COOKIE_NAME: '__Host-workpulse_session', getSession: async () => user };
    if (request === 'next/headers') return { headers: async () => new Headers({ host }) };
    if (request === '@/lib/tenant/server') return { resolveRequestTenant: async () => tenant };
    if (request === '@/lib/db/prisma') return { prisma: Object.fromEntries(['document', 'recruitmentDocument', 'onboardingTask'].map(key => [key, { findUnique: async () => document }])) };
    if (request === '@/lib/storage') return { localStorageProvider: { get: async () => { if (unavailable) throw Error('DO_NOT_LEAK_PRIVATE_PATH_OR_TOKEN'); return { buffer: bytes, contentType }; } } };
    return original.call(this, request, parent, isMain);
  };
  try {
    const { NextRequest } = require('next/server');
    for (const kind of ['resumes', 'recruitment-documents', 'onboarding-documents']) {
      const { GET } = require('../src/app/api/' + kind + '/[id]/route.ts');
      const call = () => GET(new NextRequest('http://fixture.localhost/api/' + kind + '/fixture-document', { headers: { cookie: '__Host-workpulse_session=synthetic' } }), { params: Promise.resolve({ id: document.id }) });
      for (contentType of ['text/html', 'image/svg+xml', 'application/pdf']) {
        const response = await call(); assert.equal(response.status, 200);
        assert.equal(response.headers.get('content-type'), contentType === 'application/pdf' ? contentType : 'application/octet-stream');
        assert(response.headers.get('content-disposition').startsWith(contentType === 'application/pdf' ? 'inline;' : 'attachment;'));
        assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert(response.headers.get('cache-control').includes('no-store')); assert.equal(await response.text(), bytes.toString());
      }
      unavailable = true; const failed = await call(); assert.equal(failed.status, 404); assert(!((await failed.text()).includes('DO_NOT_LEAK'))); unavailable = false;
    }
    const access = require('../src/features/hiring/document-access.ts');
    tenant = null; host = 'unknown.localhost';
    assert.equal(await access.candidatePortalMatchesRequestTenant('fixture'), false); assert.equal(await access.candidateDocumentMatchesRequestTenant(user.organizationId), false);
    host = process.env.PLATFORM_ROOT_DOMAIN || 'localhost'; assert.equal(await access.candidatePortalMatchesRequestTenant('fixture'), true); assert.equal(await access.candidateDocumentMatchesRequestTenant(user.organizationId), true);
    console.log('PASS all three actual handlers: HTML/SVG attachment, PDF preview, no-store/nosniff, safe errors; unknown tenant rejection and public careers compatibility');
  } finally { Module._load = original; }
  const calls = [];
  Module._load = function(request, parent, isMain) {
    if (request === '@vercel/blob') return { put: async (name, buffer, options) => { calls.push({ operation: 'put', options }); return { pathname: name }; }, get: async (_key, options) => { calls.push({ operation: 'get', options }); return { statusCode: 200, stream: new Response(bytes).body, blob: { contentType: 'application/pdf' } }; }, del: async () => {} };
    return original.call(this, request, parent, isMain);
  };
  const previous = process.env.BLOB_READ_WRITE_TOKEN; process.env.BLOB_READ_WRITE_TOKEN = 'synthetic-not-a-live-token';
  try {
    const { vercelBlobStorageProvider: provider } = require('../src/lib/storage/vercelBlob.ts');
    const uploaded = await provider.upload(bytes, 'synthetic.pdf', 'application/pdf');
    assert(!uploaded.storageKey.includes('://')); assert.equal((await provider.get(uploaded.storageKey)).buffer.toString(), bytes.toString());
    assert.equal(calls.find(call => call.operation === 'put').options.access, 'private'); assert.equal(calls.find(call => call.operation === 'get').options.access, 'private');
    console.log('PASS private Blob SDK contract: private upload/read and keys instead of public URLs; no hosted call');
  } finally { Module._load = original; if (previous === undefined) delete process.env.BLOB_READ_WRITE_TOKEN; else process.env.BLOB_READ_WRITE_TOKEN = previous; }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
