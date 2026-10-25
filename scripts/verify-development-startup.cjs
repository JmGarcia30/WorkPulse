/* eslint-disable @typescript-eslint/no-require-imports -- Read-only development smoke check with normal login. */
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const { compare } = require('bcryptjs');
const helper = require('./batch0-recovery-environment.cjs');
const browser = require('./batch0-recovery-browser.cjs');
const config = helper.configuration();
const proof = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json', 'utf8'));
if (!proof.startupVerified || proof.identity.branchId !== config.identity.branchId || proof.identity.endpointSha256 !== config.identity.endpointSha256) helper.fail('UNVERIFIED_DEVELOPMENT_TARGET');
const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, code) {
  for (let attempt = 0; attempt < 600; attempt++) {
    try { if (await check()) return; }
    catch (error) { if (error.code !== 'BROWSER_EVALUATION_FAILED') throw error; }
    await pause(100);
  }
  helper.fail(code);
}
async function main() {
  let session;
  try {
    const organization = await db.organization.findUnique({ where: { slug: 'st-aloysius' }, select: { id: true } });
    if (!organization) helper.fail('SAGA_WORKSPACE_NOT_FOUND');
    // Use an existing seeded account only if its current hash verifies the repository seed password.
    // Never execute the seed, change credentials, create users, or save credentials/cookies.
    const seed = fs.readFileSync('prisma/seed.ts', 'utf8');
    const password = seed.match(/const adminPassword = await hash\('([^']+)'/)?.[1];
    if (!password) helper.fail('NORMAL_LOGIN_CREDENTIAL_UNAVAILABLE');
    const users = await db.user.findMany({ where: { organizationId: organization.id, role: 'ORGANIZATION_ADMIN' }, select: { email: true, passwordHash: true } });
    let account;
    for (const user of users) if (user.passwordHash && await compare(password, user.passwordHash)) { account = user; break; }
    if (!account) helper.fail('EXISTING_LOGIN_CREDENTIAL_UNAVAILABLE');
    session = await browser({ port: 3000, production: false, email: account.email, password });
    console.log(JSON.stringify({ normalPasswordLogin: 'PASS', dashboard: 'PASS', existingAccount: true, databaseWritesPerformed: false }));
    await session.send('Page.navigate', { url: 'http://app.localhost:3000' });
    await until(() => session.evaluate('document.readyState === "complete" && !!document.querySelector("#workspace")'), 'WORKSPACE_DISCOVERY_FORM_UNAVAILABLE');
    await pause(1200);
    await session.evaluate('(()=>{const input=document.querySelector("#workspace");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"saga");input.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
    await pause(200);
    await session.evaluate('document.querySelector("#workspace").form.requestSubmit(); true');
    // A signed-in tenant visit intentionally redirects from the public landing page to its dashboard.
    await until(() => session.evaluate('location.host === "saga.localhost:3000" && location.pathname === "/dashboard" && document.readyState === "complete" && !!document.querySelector("aside") && /Welcome Back,/.test(document.querySelector("main")?.innerText || "")'), 'SAGA_WORKSPACE_DISCOVERY_FAILED');
    console.log(JSON.stringify({ sagaWorkspaceDiscovery: 'PASS', authenticatedTenantRedirect: 'PASS' }));
    await session.send('Page.navigate', { url: 'http://saga.localhost:3000/dashboard' });
    await until(() => session.evaluate('location.pathname === "/dashboard" && !!document.querySelector("aside") && /Welcome Back,/.test(document.querySelector("main")?.innerText || "")'), 'SAGA_SESSION_RETURN_FAILED');
    const result = { capturedAt: new Date().toISOString(), identity: config.identity, startup: 'PASS', port: 3000, organizationLookup: true, actualWorkspaceDiscoveryFormSubmitted: true, authenticatedTenantRedirect: true, normalPasswordLogin: true, existingAccountUsed: true, dashboardRendered: true, sessionRetainedAfterDiscovery: true, databaseWritesPerformed: false, originalEnvUnchanged: true };
    helper.assertOriginalUnchanged(config);
    helper.save('development-startup-verification', result);
    console.log(JSON.stringify({ startup: 'PASS', sagaWorkspaceDiscovery: 'PASS', normalPasswordLogin: 'PASS', dashboard: 'PASS' }));
  } finally { await session?.close(); await db.$disconnect(); helper.assertOriginalUnchanged(config); }
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined })); process.exitCode = 1; });
