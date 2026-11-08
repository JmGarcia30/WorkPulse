import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { runPayrollIntegration } from './test-payroll-integration';
import { runPayrollPresentation } from './test-payroll-presentation';
import { runPayrollWorkflow } from './test-payroll-workflow';
import { runPayrollPhase3 } from './test-payroll-phase3';
assert.match(new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? '', /^batch3_test_[a-f0-9]{24}$/);
const db = new PrismaClient({ log: [] });
async function main() {
  for (const [name, run] of [['payroll integration', runPayrollIntegration],['payroll presentation', runPayrollPresentation],['payroll workflow', runPayrollWorkflow],['payroll phase 3', runPayrollPhase3]] as const) console.log(JSON.stringify({ name, ...await run(db) }));
}
main().catch(error => { console.error('PAYROLL_REGRESSION_FAILURE',error.code ?? error.name,String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi,'[REDACTED]'));process.exitCode=1; }).finally(() => db.$disconnect());
