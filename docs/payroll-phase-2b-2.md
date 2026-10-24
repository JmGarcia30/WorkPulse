# Payroll Phase 2B-2 — UI, payslips and statutory setup

Implemented locally on 2026-10-22. No new statutory formulas, schema changes, migrations, production writes, deployment, push, database reset, or edits to `.env`/`.impeccable`. Existing uncommitted work is preserved.

## Components changed

- Added `PayrollDeductionBreakdown` and `PayrollStatutorySetupPanel`.
- Updated `EmployeePayrollEntriesTable`, `PayrollProcessingTab`, `PayrollSetupForms`, `PayslipView` and the existing dashboard payroll page.
- Added the display-only `snapshot-breakdown.ts`, form adapter `setup-form.ts` and authorized setup query `setup-queries.ts`; extended existing payroll actions, dashboard queries and payslip read model.
- Added presentation/access and component browser tests; extended the recovery runner with separate `ui-test`/`ui-build` evidence paths. Phase 2B-1 calculator/integration behavior and prior reports remain intact.

## HR Payroll

The existing entry table is reused on Processing/Review and retains its overview placement, filtering, paging, totals and payslip links. Each entry expands to show recorded SSS, PhilHealth, Pag-IBIG, BIR, late/absence/undertime, union dues, other employee net deductions and taxable compensation. Existing gross, total employee deductions and net remain visible. Employer counterparts and employer-only charges are in a separate section and excluded from employee deductions.

Monthly/FIRST/SECOND allocation labels show the contribution month and whether the entry is reserved or finalized. They display the actual cutoff allocation from the snapshot, never the full monthly liability as a repeated deduction. The BIR internal company-net-deduction line is excluded from the separate other-deduction list, because company deductions are already shown individually.

The HR/Admin setup panel identifies missing period inputs and opening history before generation. It supports separate reviewed agency bases, mandatory/exempt agency coverage and exemption evidence, complete additional classified cash earnings, company deduction treatment, union dues, other net deductions, and all six opening tax/benefit balances. Additional lists are explicit empty lists when reviewed as none. New amounts begin blank; a zero is entered only by the reviewer. Unsupported arrangements/profile flags cannot be silently enabled.

Both new Server Actions derive organization/reviewer identity from authenticated context, check payroll-management permission and call the unchanged Phase 2B-1 persistence contracts. Exemption reviewer identity is assigned on the server. The setup read service independently verifies role and tenant/period scope. Used inputs/history are read-only; finalized periods do not receive new-setup prompts. The compensation form now offers semi-monthly payment and explains that its rate is the full monthly basic salary.

## Employee payslips

HR and ESS share `PayslipView` and the same whitelisted snapshot projection. Finalized amounts are never recalculated. Employee statutory deductions and employer liabilities are itemized separately alongside the original stored gross/deduction/net totals. Raw reviewed input payloads, tax opening history and evidence references are not sent to ESS.

Older finalized snapshots retain their recorded policy deductions and original totals. Missing statutory details display **Not recorded**, with a historical-record explanation, instead of zero. An incomplete new statutory snapshot is identified as unavailable. Existing ESS account/employee ownership, organization, finalized-entry and finalized-period checks are preserved.

The payslip header wraps on narrow screens; responsive grids and an inner horizontal table scroller preserve mobile layouts without redesigning the dashboard.

## Validation and notifications

- Required input validation and server schema validation precede setup saves. Explicit confirmations cover the supported tax profile, contribution history, complete earnings and opening history.
- Generation, review, finalization and setup saves use native confirmation dialogs, matching the existing HR UI pattern. Finalization retains its explicit checkbox and backend safeguards.
- Pending actions disable submission and show processing text/`aria-busy`. Compact existing status/alert messages announce success or errors. `SETUP_REQUIRED` messages identify the blocker and review links lead to statutory setup.
- Reviewed values remain in the setup form after a rejected save; browser tests verify this. Switching employees remounts their forms to prevent values crossing between employees.

## Tests and evidence

Evidence is in `docs/payroll-phase-2b-2/`.

- **149 calculator tests passed:** 93 statutory + 56 BIR, unchanged.
- **55 existing integration/concurrency assertions passed.**
- **28 new presentation/access assertions passed:** monthly and both semi-monthly cutoffs, exact stored amounts, employer separation, identical HR/ESS projections, own-account access, wrong tenant/unauthorized access, missing setup, explicit zeros, authenticated reviewer identity, malformed forms, read-only inputs/history, legacy payslips, and unchanged finalized snapshots.
- **35 browser assertions passed:** actual payroll components at 320/375/768/1280 pixels with no page overflow/runtime errors; monthly/semi-monthly/legacy display, read-only setup, disabled finalization, confirmation cancellation, pending state, notifications, blank mandatory values and value retention after validation errors.
- Browser tests use a local component harness with explicit action test doubles, built CSS and synthetic rollback-fixture data. Real contracts/authorization/persistence are verified separately on the isolated recovery database; the browser harness is not a full authenticated application/session E2E test.
- Full-project TypeScript, targeted ESLint and Prisma validation pass. The final production build passes, including all 42 static pages. Evidence is saved in `build.json`; builds use explicit recovery database URLs and `NODE_ENV=production`, with no environment-file edits.
- Recovery tests and builds compare all **55 tables** before/after. Test fixtures roll back or are removed; finalized test records are rolled back without disabling immutable guards. No production database connection is used.

Commands:

```text
node scripts/payroll-phase2b-recovery.cjs ui-test
node scripts/payroll-phase2b-recovery.cjs ui-build
node scripts/test-payroll-ui-browser.cjs
node node_modules/tsx/dist/cli.mjs scripts/test-payroll-statutory.ts
node node_modules/tsx/dist/cli.mjs scripts/test-payroll-bir.ts
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/prisma/build/index.js validate
```

## Remaining production blockers

Real agency coverage/basis evidence, complete opening history and finance review are still required for each affected employee. Existing Phase 2B-1 blockers remain: unverified Pag-IBIG fractional-centavo rounding, expired verification windows, unsupported special tax/employment arrangements, cumulative/year-end/final-pay methods, and explicit legacy draft/allocation reconciliation or reversals. These remain `SETUP_REQUIRED`; the UI does not bypass them. Remittance submission and any production migration/deployment approval remain separate work.

Stop point: Phase 2B-2 only.
