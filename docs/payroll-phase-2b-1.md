# Payroll Phase 2B-1: statutory backend integration

Implemented locally on 2026-10-22. No production writes, deployment, push, production migration, database reset, environment-file changes, UI redesign or performance audit. Hiring, Leave, Probation and existing payroll records are preserved.

## Files

- `src/features/payroll/service.ts`: generation transaction, locks, statutory calculation, atomic posting and versioned snapshots.
- `src/features/payroll/domain.ts`: semi-monthly calendar and monthly basic-salary split.
- `src/features/payroll/review.ts`: period lifecycle locking and statutory reservation verification before finalization.
- `src/features/payroll/transactions.ts`: shared transaction/retry and period/employee locks.
- `src/features/payroll/statutory-inputs.ts`: authorized, reviewed, persisted period inputs and opening tax history.
- `src/features/payroll/statutory-integration.ts`: calculators, benefit history, monthly allocation, persistence and finalization checks.
- `src/features/payroll/statutory/index.ts`: obsolete isolation comment updated; calculator arithmetic unchanged.
- `src/features/hiring/offer-pipeline.ts`: required label for the new shared pay-frequency enum member; existing mappings and Hiring behavior unchanged.
- `prisma/schema.prisma` and `prisma/migrations/20261022000300_payroll_statutory_integration/migration.sql`: additive tables, keys and enum value.
- `scripts/test-payroll-integration.ts`, `scripts/payroll-phase2b-recovery.cjs`: focused regression/concurrency tests and verified recovery-only migration/test/build runner.
- This report and evidence under `docs/payroll-phase-2b-1/`.

## Calculation flow

1. Verify the existing HR/Admin permission and organization scope. Lock the period, reject finalized periods, resolve the unchanged company payroll policy, and process employees in ID order. Existing entries are immutable and skipped on retry.
2. Read compensation/attendance/leave through the existing generation input reader. Preserve late, absence, undertime, daily-pay and leave policy calculations. Unsupported statutory arrangements, including daily-paid/partial-month payroll, return employee-specific `SETUP_REQUIRED` instead of producing incomplete deductions.
3. Require a persisted `PayrollStatutoryInput` verified by an authorized organization HR/Admin. `savePayrollStatutoryInput` is a backend API, with no new UI. Its payload explicitly supplies complete additional classified cash earnings, coverage/exemption evidence for all agencies, the supported BIR profile and exceptional-method flags, union dues, other net deductions, and the tax treatment of each company deduction. Unknown fields/classifications/coverage are rejected. Inputs cannot change after an entry exists.
4. Agency bases are separately reviewed with an evidence reference. SSS uses `monthlySssRemuneration`, Pag-IBIG uses `monthlyPagIbigFundSalary`, and PhilHealth uses `monthlyPhilHealthBasic`, which must equal the fixed monthly compensation **before attendance deductions**. SSS/Pag-IBIG bases are not inferred from BIR taxable pay. The reviewer must establish their correct remuneration inclusions and any month-to-date revision. One employment and unchanged compensation must cover the entire contribution month. The input also explicitly attests there are no untracked contributions for that month; existing legacy payroll in the month blocks generation.
5. Call the unchanged Phase 1 calculators once per agency for the month's reviewed basis, then allocate against the complete persisted month ledger. Only allocation.employee is sent to BIR and deducted from employee pay. Employer regular/MPF counterparts and employer-only EC remain separate liabilities.
6. Require `savePayrollTaxOpening` with complete externally verified opening benefits, taxable compensation and withholding totals, evidence and reviewer. Even a zero opening requires explicit evidence. The opening date means all payments **before** that date are included. Never create openings automatically. Subsequent benefit/tax amounts come from persisted postings. Rice/laundry track payment month; clothing/other-benefits track payment year. Qualifying de minimis is independent of the shared 90,000 pool. Legacy payments after the opening date, out-of-order/same-date payments or earlier unfinalized postings block generation. Openings cannot change after use.
7. Company salary reductions reduce basic earnings before BIR once. Company net-only deductions leave the tax base unchanged. The stored gross is the original company gross including additional cash earnings; company policy amounts remain visible in total deductions. Mandatory employee contributions and withholding are added, with employer liabilities excluded. Company deduction components are rounded cumulatively to reconcile exactly to the existing rounded company-policy total.
8. Persist the entry, immutable reviewed calculation, benefit/tax usage delta, monthly liability and three cutoff allocations in one transaction. A failed write rolls them all back. Existing employee-specific setup-error reporting is retained; a period with missing/invalid entries cannot finalize.

Snapshots use `WORKPULSE-PAYROLL-2B-1`, retain the existing payslip-compatible `calculation` keys, and add `statutory`. They contain gross/taxable compensation, each employee deduction, BIR, existing company-policy amounts/treatments, employer counterparts and employer-only charges, total deductions/net, monthly schedule/source versions, allocation policy, full BIR inputs/rules, input evidence, opening ID, and before/after year-to-date totals. No historical snapshot is backfilled or recalculated.

## Semi-monthly allocation and concurrency

- `SEMI_MONTHLY` means 1–15 and 16–month-end, not biweekly. For this frequency the compensation rate is the **full monthly basic salary**. The first basic-pay half rounds down to centavos and the second receives the remainder.
- Phase 1's existing allocation policy halves each employee/employer/EC component at FIRST and reconciles SECOND to the reviewed monthly liability minus the actual FIRST posting. Negative adjustments and unsupported component/coverage changes block. FIRST must be finalized before SECOND; later payments require earlier postings to be finalized. New monthly remuneration at SECOND can reconcile upward through the existing calculator; salary changes within the month remain blocked.
- Every generation/review/finalization operation locks the period row. Generation and setup also take a transaction-scoped PostgreSQL advisory lock for organization + employee, spanning months and tax years. Employees are locked in stable ID order. Locks remain held until entry and all ledger writes commit or roll back. Hash collisions can only serialize unrelated work.
- Read-committed transactions read the ledger **after** acquiring locks, so a waiting retry sees the winner's committed entry and skips it. The complete transaction retries up to twice on Prisma `P2034` conflicts. Callers supplying their own transaction retain responsibility for their transaction's isolation/retry policy.
- Unique organization/employee/month guards prevent frequency switches. The allocation's composite foreign key includes frequency; unique month/agency/cutoff and posting/agency keys prevent duplicate allocations. Unique entry posting and composite organization/employee foreign keys retain tenant ownership.
- Before finalization, the fresh review checks the persisted statutory calculation against the snapshot and stored payroll totals, and checks all three reserved allocations/monthly schedule records against that calculation. Legacy unfinalized entries without statutory ledgers are `SETUP_REQUIRED`. Existing finalized-entry/period immutable database triggers remain enabled.

## Migration and recovery safety

Required migration: `20261022000300_payroll_statutory_integration`.

It adds `SEMI_MONTHLY`, five tables (`PayrollStatutoryInput`, `PayrollTaxOpening`, `PayrollContributionMonth`, `PayrollStatutoryPosting`, `PayrollContributionAllocation`), composite ownership keys, allocation uniqueness and foreign keys. There is no historical data update/backfill.

The runner checks the recovery branch/endpoint against the prior verified identity, confirms pooled/direct connections identify the same isolated database, verifies migration history checksums, excludes unrelated pending migrations, and compares existing-table fingerprints. Migration applied only to `workpulse-batch0-recovery` (`br-broad-forest-az55xwfe`); all 50 existing tables were preserved. Production migration has not run.

An initial concurrency test committed its own finalized fixture; the pre-existing immutable guards correctly refused cleanup. A one-time recovery-only cleanup verified the single fixture, held exclusive table locks, suspended only the two finalized-delete guards, deleted only that fixture, and re-enabled the guards in the same transaction. `fixture-cleanup.json` records restoration. The regression test now deliberately rolls finalization back and does not suspend guards. No pre-existing finalized record was altered.

## Validation

Passed: **55 focused integration/concurrency assertions**, **93 unchanged statutory tests**, and **56 unchanged BIR tests** (149 existing calculator tests; 204 checks total). Full-project TypeScript, targeted ESLint and Prisma validation passed. The recovery test run compared all 55 tables before/after and found no data changes. The production build passed, including all 42 static pages; build-time fingerprints also preserved all 55 tables. Results are recorded in `build.json` and `build-preservation.json`. The runner explicitly sets `NODE_ENV=production` for the build child process, correcting an inherited nonstandard environment value without editing environment files.

Validation results are recorded in `docs/payroll-phase-2b-1/`. Commands:

```text
node scripts/payroll-phase2b-recovery.cjs migrate
node scripts/payroll-phase2b-recovery.cjs test
node node_modules/tsx/dist/cli.mjs scripts/test-payroll-statutory.ts
node node_modules/tsx/dist/cli.mjs scripts/test-payroll-bir.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/prisma/build/index.js validate
node scripts/payroll-phase2b-recovery.cjs build
```

The former H6 foundation script contains pre-integration expectations (zero statutory deductions and unverified future/daily payroll generation). It was preserved as historical test work; the focused Phase 2B suite tests the replacement backend behavior, historical finalized snapshots, attendance deductions, permissions, lifecycle, organization isolation and retries.

## Before live payroll use

- Provide genuine reviewed agency bases/coverage, complete classified earnings, company deduction treatment and reconciled opening histories through the backend setup APIs. No synthetic defaults or automatic historical inference are enabled. There is no setup UI yet.
- Resolve Pag-IBIG fractional-centavo rules with agency guidance before enabling affected bases. They currently block with `SETUP_REQUIRED: ROUNDING_UNVERIFIED`. Retain the Phase 1 pre-live agency/remittance confirmations and reverify schedules beyond their current verification windows (contributions through October 2026; BIR payment dates through 2026-10-22).
- Implement separate reviewed methods before enabling MWE/special profiles, daily/partial months, midmonth salary changes, multiple employers, final/year-end annualization, cumulative averaging, noncash benefits, unsupported classifications, off-cycle/same-date payments, or negative contribution corrections. These cases remain blocked.
- Legacy unfinalized entries and months with historical payroll lacking contribution ledgers need an explicit reviewed replacement/reconciliation workflow. Reversals/cancellation of reserved postings are not silently performed. Existing entries remain immutable.
- The current payslip UI continues to show its existing summary. Statutory itemization/remittance output and UI work are later phases; this backend integration does not certify remittance submission readiness.

Stop point: Phase 2B-1 only.
