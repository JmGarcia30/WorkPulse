const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const phase = process.argv[2];
  if (phase !== 'before' && phase !== 'after') throw new Error('RELEASE_GUARD_INVALID_PHASE');
  if (process.env.VERCEL !== '1' || process.env.VERCEL_ENV !== 'production' ||
      process.env.VERCEL_GIT_COMMIT_REF !== 'main') throw new Error('RELEASE_GUARD_PRODUCTION_MAIN_ONLY');
  if (!process.env.DATABASE_URL) throw new Error('RELEASE_GUARD_NO_DATABASE_URL');

  const identity = await prisma.$queryRawUnsafe(
    "SELECT current_database()::text AS database, current_setting('neon.branch_id',true)::text AS branch"
  );
  if (identity.length !== 1 || identity[0].database !== 'neondb' ||
      identity[0].branch !== 'br-hidden-violet-azjl3vam') throw new Error('RELEASE_GUARD_WRONG_DATABASE_IDENTITY');

  const migrations = await prisma.$queryRawUnsafe(
    'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations"'
  );
  if (migrations.some(m => !m.finished_at && !m.rolled_back_at)) throw new Error('RELEASE_GUARD_FAILED_MIGRATION');
  const successful = migrations.filter(m => m.finished_at && !m.rolled_back_at);
  const migrationName = '20261106000100_platform_organization_slug_alias';
  const migrationExists = successful.some(m => m.migration_name === migrationName);
  const existing = await prisma.$queryRawUnsafe(
    "SELECT (SELECT COUNT(*) FROM \"Organization\")::int AS organizations, " +
    "(SELECT COUNT(*) FROM \"Organization\" WHERE \"slug\"='st-aloysius')::int AS saga, " +
    "(SELECT COUNT(*) FROM \"Organization\" WHERE \"slug\"='infant-jesus-academy-pampanga')::int AS ijap_old, " +
    "(SELECT COUNT(*) FROM \"Organization\" WHERE \"slug\"='ijap')::int AS ijap_new, " +
    "(SELECT to_regclass('public.\"OrganizationSlugAlias\"') IS NOT NULL) AS alias_exists"
  );
  const state = existing[0];
  if (!state || state.organizations < 18 || state.saga !== 1 || state.ijap_old !== 1 || state.ijap_new !== 0)
    throw new Error('RELEASE_GUARD_TENANT_BASELINE_CHANGED');
  if (phase === 'before') {
    if (successful.length !== 42 || migrationExists || state.alias_exists) throw new Error('RELEASE_GUARD_UNEXPECTED_BASELINE');
  } else {
    if (successful.length !== 43 || !migrationExists || !state.alias_exists) throw new Error('RELEASE_GUARD_MIGRATION_NOT_APPLIED');
    const aliases = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS total FROM "OrganizationSlugAlias"');
    if (aliases[0]?.total !== 0) throw new Error('RELEASE_GUARD_UNEXPECTED_ALIAS_DATA');
  }
  console.log('WORKPULSE_SLUG_RELEASE_GUARD_OK phase=' + phase + ' migrations=' + successful.length +
    ' organizations=' + state.organizations + ' database=neondb');
}

verify().catch(error => {
  console.error(error instanceof Error ? error.message : 'RELEASE_GUARD_UNKNOWN_ERROR');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
