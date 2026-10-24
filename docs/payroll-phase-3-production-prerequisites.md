# Payroll production prerequisites — verification only

As of 2026-10-23. No production database was contacted, and no migration was applied during Phase 3. Production's current migration head therefore remains unverified; the list below is the exact required schema/code contract, not a claim that every named migration is pending in production.

## Required payroll migration

`prisma/migrations/20261022000300_payroll_statutory_integration/migration.sql`

SHA-256: `9a7457a7e641f650b13271cd5d9fe8f06ad59afefc2d776cfbc600bf2ad4f733`.

This checksum matches the verified recovery migration history. The migration adds:

- `PayFrequency.SEMI_MONTHLY`.
- `PayrollStatutoryInput`, `PayrollTaxOpening`, `PayrollContributionMonth`, `PayrollStatutoryPosting`, `PayrollContributionAllocation`.
- Unique employee/month frequency guards, unique month/agency/cutoff and posting/agency allocation keys, unique payroll-entry posting, and composite frequency/ownership foreign keys.
- `PayrollPeriod(id, organizationId)` and `PayrollEntry(id, organizationId, employeeId)` unique keys.

There is no historical backfill or payroll amount update. Phase 2B-2 and the Phase 3 corrections need no further schema migration.

## Existing schema dependencies to verify against production history

- H1 employee/user/organization models and all earlier baseline migrations.
- `20260908180503_h3_attendance_foundation` and H5 leave migrations: generation reads these tables even where the selected policy has no attendance deduction.
- `20260911120000_h4_employee_self_service`: employee-account ownership/activation and ESS access.
- `20260924190000_h6_1_payroll_foundation`: compensation, periods and entries.
- `20260928120000_h6_2_simple_payroll_calculation`: calculation snapshots.
- `20260928180000_h6_2_5_payroll_policy`: effective-dated company policy and leave treatment.
- `20260928210000_h6_3_payroll_finalization`: immutable finalized entry/period triggers.
- `20261017090000_h10_1_exit_clearance`: in particular `Employee(id, organizationId)` uniqueness required by the new ownership foreign keys.
- `20261017120000_h10_2_final_separation`: the current backend preserves its employee eligibility and post-separation guards.

The entire local schema also includes Hiring/Probation/security changes. The verified recovery database has 25 applied migrations; **`20261021000100_candidate_access` is present locally but absent from its applied history**. Do not infer production's pending list from recovery, and do not use an unreviewed blanket deploy that would apply unrelated pending migrations. The Hiring/Probation/security owners must approve those changes separately if the complete working tree is released. The exact local/recovery names and checksums are recorded in `docs/payroll-phase-3/tests.json`.

## Required release ordering and operational gates

1. In an explicitly approved production session, first perform a read-only comparison of migration names/checksums, schema objects, enum values and immutable triggers. Verify the target identity and a recoverable backup/checkpoint. This was not performed in Phase 3.
2. Review an exact migration bundle based on that verified head. Confirm DDL privileges and a maintenance plan for indexes/foreign keys and enum addition. Rehearse against a disposable production-like copy without resets or modifying source employee salaries.
3. Apply only the separately approved schema plan before enabling code that queries the new tables. Verify unique/FK constraints and immutable triggers, and compare historical snapshot/amount fingerprints before and after. The current code must not serve integrated generation against the old schema.
4. Deploy only the reviewed code matching the migration and shared pay-frequency enum mapping, including the Phase 3 unpaid-leave safety guard and serializable Configuration props. Phase 3 performed no deployment or push.
5. Reverify BIR rules for the intended payment date. The existing module accepts payment dates only through **2026-10-22**; a payment dated **2026-10-23 or later is blocked**, even when the statutory rates have not changed. Contribution schedules are verified through October 2026. No verification window was extended here.
6. Finance/HR must supply genuine agency bases/coverage, classifications, deduction treatments and complete evidenced opening histories. Existing legacy drafts/months without allocation ledgers require a reviewed reconciliation/replacement process; no zero history may be inferred.
7. Restrict any initial supported pilot to verified full-month, fixed-basic-salary, resident, private rank-and-file, single-employer, non-MWE cases, with ordinary monthly or conventional semi-monthly periods. Exclude unresolved unpaid leave, daily/partial-month or salary-change cases, cumulative/annualized/final pay, special benefits, multiple employers and negative adjustments.

Unverified Pag-IBIG fractional-centavo rounding does **not** block the tested ordinary monthly Fund Salary above the 10,000 ceiling: the employee contribution is exactly 200.00 (100.00 + 100.00 in the tested equal cutoffs). The 1,500.01 Fund Salary case remains blocked. No rounding rule or protection was bypassed.

The recovery SAGA organization has no active compensation records or custom payroll policy records in this snapshot. Only policy metadata/aggregate kinds were read, with no real salary amounts. Synthetic ordinary scenarios establish technical support; they cannot establish actual SAGA employee eligibility or production history readiness.
