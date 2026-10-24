/* eslint-disable @typescript-eslint/no-require-imports -- One known synthetic recovery fixture only; historical rows never selected for deletion. */
const fs = require('node:fs'), { PrismaClient } = require('@prisma/client'), { createHash } = require('node:crypto');
const helper = require('./batch0-recovery-environment.cjs');
const prefix = 'routing-browser-d321d1f0826f';
async function main() {
  const config = helper.configuration();
  const verified = JSON.parse(fs.readFileSync(helper.directory + '/schema-and-history-verification.json'));
  if (!config.identity.consoleMappingComplete || config.identity.branchId !== verified.identity.branchId || config.identity.endpointSha256 !== verified.identity.endpointSha256) throw Error('UNVERIFIED_RECOVERY');
  const db = new PrismaClient({ datasources: { db: { url: config.direct.href } }, log: [] });
  const digest = value => createHash('sha256').update(value).digest('hex');
  try {
    const orgs = await db.organization.findMany({ where: { slug: { in: [prefix, prefix + '-revoked'] } }, select: { id: true, slug: true } });
    if (orgs.length !== 2) throw Error('EXPECTED_EXACT_SYNTHETIC_TENANTS');
    const ids = orgs.map(org => org.id);
    const admins = await db.platformAdministrator.findMany({ where: { email: prefix + '@example.invalid' }, select: { id: true } });
    if (admins.length !== 1) throw Error('EXPECTED_SYNTHETIC_PLATFORM_ACTOR');
    const users = await db.user.findMany({ where: { OR: [{ organizationId: { in: ids } }, { email: prefix + '-saga@fixture.invalid' }] }, select: { id: true, email: true } });
    if (users.length !== 3 || users.some(user => !user.email.startsWith(prefix))) throw Error('SYNTHETIC_USER_SCOPE_MISMATCH');
    const keys = ['platform-login-global', 'login:' + prefix + '@example.invalid'].map(digest);
    // Build a baseline excluding only identified fixtures, without emitting row contents.
    const filters = {
      Organization: ['id', ids], User: ['id', users.map(user => user.id)],
      OrganizationBranding: ['organizationId', ids], OrganizationBrandingAudit: ['organizationId', ids],
      PlatformOrganizationAudit: ['organizationId', ids], OrganizationAdministratorInvitation: ['organizationId', ids],
      PlatformAdministrator: ['id', admins.map(admin => admin.id)], PlatformAdministratorSession: ['administratorId', admins.map(admin => admin.id)],
      PlatformAuthenticationAttempt: ['key', keys],
    };
    const before = await helper.fingerprints(db);
    const quote = value => '"' + value.replaceAll('"', '""') + '"';
    for (const row of before.tables) {
      if (!filters[row.table]) continue;
      const [column, values] = filters[row.table];
      const selection = before.columns.filter(c => c.table_name === row.table).map(c => quote(c.column_name)).join(',');
      const [baseline] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(row_to_json(x)::text),'' ORDER BY md5(row_to_json(x)::text)),'')) AS fingerprint FROM (SELECT ${selection} FROM public.${quote(row.table)} WHERE ${quote(column)} NOT IN (${values.map((_, index) => '$' + (index + 1)).join(',')})) x`, ...values);
      Object.assign(row, baseline);
    }
    await db.$transaction(async tx => {
      // Exclusive table lock prevents other sessions from writing while this
      // one test-only trigger exception is active. DDL rolls back on any error.
      await tx.$executeRawUnsafe('LOCK TABLE "OrganizationBrandingAudit" IN ACCESS EXCLUSIVE MODE');
      const rows = await tx.organizationBrandingAudit.findMany({ where: { organizationId: { in: ids } }, select: { id: true, actorUserId: true, action: true } });
      if (rows.length !== 1 || rows[0].action !== 'BRANDING_UPDATED' || !users.some(user => user.id === rows[0].actorUserId)) throw Error('EXPECTED_ONE_OWNED_TEST_AUDIT');
      await tx.$executeRawUnsafe('ALTER TABLE "OrganizationBrandingAudit" DISABLE TRIGGER "OrganizationBrandingAudit_immutable"');
      await tx.organizationBrandingAudit.deleteMany({ where: { id: rows[0].id, organizationId: { in: ids } } });
      await tx.$executeRawUnsafe('ALTER TABLE "OrganizationBrandingAudit" ENABLE TRIGGER "OrganizationBrandingAudit_immutable"');
      await tx.organizationBranding.deleteMany({ where: { organizationId: { in: ids } } });
      await tx.platformOrganizationAudit.deleteMany({ where: { organizationId: { in: ids } } });
      await tx.organizationAdministratorInvitation.deleteMany({ where: { organizationId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: users.map(user => user.id) } } });
      await tx.organization.deleteMany({ where: { id: { in: ids } } });
      await tx.platformAdministrator.delete({ where: { id: admins[0].id } });
      await tx.platformAuthenticationAttempt.deleteMany({ where: { key: { in: keys } } });
    }, { timeout: 30000 });
    const after = await helper.fingerprints(db, before.columns);
    const [trigger] = await db.$queryRaw`SELECT tgenabled FROM pg_trigger WHERE tgname = 'OrganizationBrandingAudit_immutable' AND tgrelid = '"OrganizationBrandingAudit"'::regclass`;
    const unchanged = JSON.stringify(before.tables) === JSON.stringify(after.tables);
    if (!unchanged || trigger.tgenabled !== 'O') throw Error('PRESERVATION_OR_TRIGGER_MISMATCH');
    helper.assertOriginalUnchanged(config);
    const result = { verifiedRecovery: true, onlyKnownSyntheticFixturesRemoved: true, historicalDataUnchanged: unchanged, tablesCompared: after.tables.length, immutableTriggerEnabled: true, existingAuditRowsUnchanged: true };
    fs.writeFileSync('docs/platform-phase-3/fixture-cleanup.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.code || error.name, /^[A-Z_]+$/.test(error.message) ? error.message : 'FIXTURE_CLEANUP_FAILED'); process.exitCode = 1; });
