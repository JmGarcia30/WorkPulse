# Payroll Phase 3 — final workflow verification

Completed 2026-10-23. This was verification plus two confirmed corrections, not an optimization or new implementation batch. No migration, production connection/write, real salary modification, reset, deployment or push was performed. `.env`, `.impeccable`, Hiring, Leave, Probation, candidate security and existing uncommitted work were preserved.

## 1. End-to-end results

**PASS for the tested supported scope.** A real local production build, normal password logins and actual Server Actions completed:

**Compensation → Period → Statutory setup/opening history → Generate → Retry → Review → Finalize → HR payslip → ESS payslip.**

This ran for one monthly period and both conventional semi-monthly cutoffs with verified synthetic full-month, fixed-basic-salary, private rank-and-file, single-employer, resident, non-MWE fixtures. The browser did not use mocked actions. Application writes were inside one disposable outer rollback transaction with nested savepoints. True independent-connection generation/finalization concurrency was tested separately by the existing integration suite.

Evidence: `docs/payroll-phase-3/authenticated-e2e.json`, `browser-checks.json`, `e2e-preservation.json`.

## 2. Monthly and semi-monthly calculations

| Recorded amount | Monthly | First cutoff | Second cutoff |
| --- | ---: | ---: | ---: |
| Gross compensation | 35,000.00 | 17,500.00 | 17,500.00 |
| SSS employee | 1,750.00 | 875.00 | 875.00 |
| PhilHealth employee | 875.00 | 437.50 | 437.50 |
| Pag-IBIG employee | 200.00 | 100.00 | 100.00 |
| BIR withholding | 1,701.30 | 850.58 | 850.58 |
| Total employee deductions | 4,526.30 | 2,263.08 | 2,263.08 |
| Net pay | **30,473.70** | **15,236.92** | **15,236.92** |

Monthly taxable compensation is 32,175.00; each equal cutoff's taxable compensation is 16,087.50. Monthly and semi-monthly BIR use separate tables, so the two cutoff taxes are not forced to equal one monthly tax.

Employer monthly amounts are SSS counterpart 3,500.00, EC 30.00, PhilHealth 875.00 and Pag-IBIG 200.00. They are recorded separately and excluded from employee deductions. Equal cutoffs allocate half of each monthly employer component; they do not charge it to the employee.

**Upward reconciliation PASS:** with a 30,000.00 fixed monthly basic and verified 2,000.00 overtime at SECOND, final SSS remuneration becomes 32,000.00. FIRST posts 750.00 employee SSS; SECOND posts 850.00; total is the revised 1,600.00 monthly liability exactly once. SECOND gross is 17,000.00, BIR 788.70 and net 14,886.30. PhilHealth remains based on unreduced monthly basic.

**Attendance/policy PASS:** the existing custom-policy regression retains late 10.00, absence 100.00 and undertime 20.00 deductions. Reviewed salary reductions affect BIR once, net-only deductions do not reduce taxable earnings, and PhilHealth basic is not reduced by attendance. The verified result is BIR 1,684.80 and net 30,360.20. Supported paid leave retains correct pay and its leave summary. Unresolved monthly unpaid leave is blocked after the correction below.

### SAGA and rounding

The ordinary synthetic SAGA-type full-month scenario is not blocked by Pag-IBIG rounding: a Fund Salary of 35,000.01 is capped by the existing calculator and gives exactly 200.00 employee contribution. The 1,500.01 fractional-centavo case remains `SETUP_REQUIRED: ROUNDING_UNVERIFIED`. No rounding rule was invented.

Read-only SAGA metadata in this recovery snapshot contains no active compensation records or custom payroll policy records. No real salary amounts were read or changed. The synthetic result cannot establish actual SAGA employee eligibility, coverage or historical balance readiness. Unpaid Study Leave and other unsupported arrangements remain blocked rather than silently producing pay.

## 3. Concurrency, retries and database protections

- Three concurrent independent-connection generation attempts create exactly one entry, one tax posting and three agency allocations.
- Generation/finalization locking and rollback are verified. A failed transaction leaves no entry or statutory/tax reservation; finalization serializes against generation.
- Browser duplicate submissions return the existing immutable entry and keep exactly three allocations per period.
- SECOND requires the finalized FIRST ledger and reconciles against its posted components; no repeated full monthly contribution is deducted.
- An actual duplicate allocation insert is rejected with `P2002`. An actual mismatched monthly/semi-monthly frequency insert is rejected with `P2003`. An actual cross-tenant statutory-input ownership insert is rejected with `P2003`.
- PostgreSQL unique-index and composite-FK definitions are captured in `tests.json` alongside those runtime checks.

No finalized-record triggers were disabled in Phase 3. The authenticated browser fixtures, including finalized entries, were rolled back. Independent concurrency fixtures were removed using their existing non-finalized cleanup path.

## 4. HR/ESS, permissions and historical records

**PASS:** HR and ESS return the same whitelisted finalized monetary projection. The real browser verifies both roles' payslips, itemized employee deductions, separate employer EC, correct net amounts and SECOND allocation labeling.

Wrong-tenant payslip access, employee access to HR Payroll, Hiring Manager access to Payroll and unauthorized setup reads are denied by the existing scoped contracts. Client fields cannot override authenticated tenant/reviewer identity. An employee's active linked account is required for ESS. The existing HR permission boundary rejects unauthorized dashboard access; no shared auth/security policy was changed.

Legacy H6.2.5 finalized fixtures retain their original amounts and recorded attendance deductions; missing statutory amounts display **Not recorded**, not zero. Existing finalized snapshots are not recalculated. Backend, browser-component and authenticated workflow checks cover snapshot preservation. All **55 recovery tables** have identical before/after fingerprints for the final regression/build/E2E runs, and the authenticated run leaves **zero fixture organizations**.

## 5. Confirmed defects and corrections

1. **Monthly unpaid leave silently received full monthly pay.** The initial rollback probe recorded one UNPAID day, gross 35,000.00 and unchanged net 30,473.70 with no setup error. Generation now returns actionable `SETUP_REQUIRED` for unresolved monthly unpaid leave. Finalization also blocks an existing unfinalized monthly snapshot containing unpaid days. No unpaid-leave deduction formula was added, and no historical entry was modified. Evidence: `unpaid-leave-before-fix.json`, corrected `unpaid-leave-probe.json` and the new focused regressions.
2. **Compensation Configuration crashed after saving compensation.** The real browser captured `TypeError: e.baseRate.toFixed is not a function`: Prisma Decimal methods did not survive the server/client boundary. The page now passes formatted base-rate strings and only the Configuration/Review fields those clients consume; the Configuration component displays the string. The complete authenticated monthly/semi-monthly flow passes after the correction. Evidence: `compensation-before-fix.json` and final `authenticated-e2e.json`.

Production code corrections are limited to `service.ts`, `review.ts`, the payroll dashboard page and `PayrollConfigurationTab.tsx`. Remaining changes are verification harnesses/evidence/documentation. Existing calculator formulas and schedules are unchanged.

No further critical defect was confirmed in the tested supported scope. Unsupported cases are not certified by these results.

### Final checks

| Check | Result |
| --- | --- |
| Statutory calculators | 93 tests PASS |
| BIR calculator | 56 tests PASS |
| Existing integration/concurrency regression | 55 assertions PASS |
| Existing presentation/access regression | 28 assertions PASS |
| New Phase 3 leave/rounding/reconciliation/DB guards | 15 assertions PASS |
| Existing actual-component browser regression | 35 assertions PASS; 320/375/768/1280px |
| New authenticated production-build workflow | 23 assertions PASS |
| Full TypeScript / targeted ESLint / Prisma validation | PASS |
| Production build | PASS; 42 static pages |
| Final recovery data preservation | PASS; all 55 tables unchanged |

That is **149 calculation tests plus 156 regression/browser assertions, 305 checks total**. Initial probe failures and harness diagnostics are retained as historical evidence; the authoritative final status is `verification-status.json`. The pre-integration H6 foundation script still expects zero statutory deductions and unsupported future/daily generation; it is preserved as historical work, while the current replacement integration/presentation suites above were run.

## 6. Release verdict

**NO-GO for a live controlled Payroll release today. GO for controlled UAT of the tested supported cases.**

Reasons:

- Today is **2026-10-23**. BIR payment-date verification ends **2026-10-22**. Current/future payments intentionally fail until official rules are reverified and the verification window is explicitly updated. This verification did not bypass that safeguard.
- Production migration history and schema have not been contacted or verified. The precise payroll migration, checksum, baseline dependencies and ordering gates are in [production prerequisites](payroll-phase-3-production-prerequisites.md). No migration was applied here.
- Real employee agency coverage/bases and complete opening histories still require evidenced HR/finance review. Recovery SAGA configuration does not establish production readiness.
- Unresolved unpaid leave, fractional-centavo Pag-IBIG cases, daily/partial months, salary changes, special profiles/benefits, cumulative/annualized/final pay and legacy allocation reconciliation remain excluded or blocked. A broader payroll release needs those workflows separately resolved.

Stop point: Phase 3 verification complete. No optimization/deployment batch started.
