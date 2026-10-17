// Read-only catalog inspection. Does not deploy migrations or alter records.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

if (existsSync('.env')) process.loadEnvFile('.env');

async function main() {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required.');
  const url = new URL(process.env.DATABASE_URL);
  const schema = url.searchParams.get('schema') || 'public';
  console.log(`Read-only H10 inspection: database=${url.pathname.slice(1)}, schema=${schema}, host=${url.hostname}`);
  const db = new PrismaClient();
  try {
    const migrations = await db.$queryRaw<{ migration_name: string; applied: boolean }[]>`
      SELECT migration_name, (finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied
      FROM "_prisma_migrations" WHERE migration_name LIKE '%h10_%' ORDER BY migration_name`;
    const tables = await db.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = ${schema}
      AND tablename IN ('EmployeeSeparationCase', 'EmployeeClearanceItem', 'EmployeeSeparationReview', 'EmployeeSeparationAudit') ORDER BY tablename`;
    const constraints = await db.$queryRaw<{ conname: string; convalidated: boolean }[]>`
      SELECT c.conname, c.convalidated FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace
      WHERE n.nspname=${schema} AND (c.conname LIKE 'SeparationCase_%' OR c.conname LIKE 'ClearanceItem_%' OR c.conname LIKE 'SeparationReview_%') ORDER BY c.conname`;
    const indexes = await db.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes WHERE schemaname=${schema} AND indexname='EmployeeSeparationCase_one_active_employee'`;
    const triggers = await db.$queryRaw<{ tgname: string; enabled: boolean }[]>`
      SELECT t.tgname, (t.tgenabled <> 'D') AS enabled FROM pg_trigger t
      JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=${schema} AND NOT t.tgisinternal
      AND (t.tgname LIKE 'Separation%' OR t.tgname LIKE '%post_separation' OR t.tgname='ProbationRecord_separation_scope') ORDER BY t.tgname`;
    console.log(JSON.stringify({ migrations, tables, constraints, indexes, triggers }, null, 2));
    console.log(tables.length === 4 ? 'H10 tables are present; inspect the listed constraints and enabled triggers.' : 'H10 is not ready in this schema. No database changes were made.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Catalog inspection failed'); process.exitCode = 1; });
