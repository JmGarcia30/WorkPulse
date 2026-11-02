# WorkPulse Batch 3 follow-up — second-cutoff readiness

Date: **2026-11-02, Asia/Singapore**.

**B3-002 is fixed. GO for the tested fictional September 2026 monthly/semi-monthly HR-to-ESS demonstration. November/current-date statutory compliance remains NO-GO under the unchanged restrictions in [Batch 3](FIX-BATCH-3.md).**

The actual Chrome rehearsal passed **29 checks** against the locally built production application and a verified nonproduction PostgreSQL database. TypeScript, targeted lint, build, **93 statutory + 56 BIR test cases**, and **156 database regression assertions** passed. These are different, overlapping units and are not summed as distinct user journeys.

## Starting revision and preserved scope

Started on a clean `main` at **`b24616ba92294018da82341b2f3e8d3a35c69f32`** (`Fixed bugs`). `git fetch origin main` confirmed the same revision at `origin/main`; no merge or checkout was necessary.

Only two application files changed:

- [readiness.ts](../../src/features/payroll/readiness.ts): invokes the new first-cutoff history preflight before reporting a new second cutoff ready.
- [second-cutoff-readiness.ts](../../src/features/payroll/second-cutoff-readiness.ts): performs the scoped, read-only history checks.

Additional files are limited to this report and [batch-3-followup](batch-3-followup/). No existing test, Batch 1/2 fix, earlier report/evidence, statutory calculator, verification date, generation/review/finalization service, schema, migration, dependency or environment file was edited. HEAD remains unchanged. The preservation manifest compares **2,027 preexisting files** and permits only the authorized edit to `readiness.ts`; all other preexisting bytes match. See [preservation](batch-3-followup/preservation.json).

No production records were changed; no real SAGA payroll was generated/finalized. No migration, push, commit, deployment, payment or government remittance was executed.

## Root cause and correction

Previously `getPayrollReadiness` validated configuration, available schedules, opening history and attendance, but did not check the first-cutoff contribution ledger. A fully configured September 16–30 employee could show **Ready to calculate**, then generation rejected the same employee with `INVALID_ALLOCATION: Second cutoff requires exactly one posted first cutoff.`

The new preflight requires:

1. The contribution-month record for the authenticated tenant and selected employee.
2. Exactly one first-cutoff allocation for each of SSS, PhilHealth and Pag-IBIG, all attached to the same payroll posting and using semi-monthly frequency.
3. A finalized entry and finalized period for that month's canonical 1–15 cutoff, with matching ownership and a valid earlier payment date.
4. Agreement between persisted payroll totals, calculation snapshot, contribution allocations and monthly liabilities, using the existing `statutoryEntryIssue` checks.
5. Valid allocation scope, components, amounts and reconciliation against the reviewed current monthly liabilities, using the existing pure `allocateContribution` validator.

Missing history now displays **“First-cutoff contribution history is missing. Generate and finalize the first cutoff before this second cutoff.”** Invalid history displays **“First-cutoff contribution history is invalid. Review its employee, month, agency allocations and finalized payroll before this second cutoff.”** Draft/review first payroll explicitly requires finalization.

The check writes nothing and does not repair or replace financial records. Generated/locked second-cutoff inputs retain their existing behavior; their own allocation is not misidentified as a missing/duplicate first cutoff. Monthly and first-cutoff payroll do not acquire a first-history requirement. Existing configuration/date errors are preserved.

**Generation remains authoritative:** it still performs its existing validations and reservations under its own transaction/locks. This change does not introduce a new withholding formula, contribution rate, payroll adjustment path, or a promise that readiness covers every generation requirement.

## Verified database isolation

Connected Neon branch and compute metadata were checked again against the recovery profile. Before fixture writes, live PostgreSQL identity was verified through an enforced read-only connection. Both regression and browser harnesses reject the protected original endpoint and require these exact recovery identities:

| Item | Verified value |
| --- | --- |
| Project | `late-block-61364102` |
| Branch | `workpulse-ess-design` / `br-damp-fog-azmmxhga`; nonprimary, nondefault |
| Endpoint | `ep-wild-mud-az8yzifu` |
| Database/schema | `neondb` / `public` |
| Repository/applied migrations | **39**, matching checksums allowing LF/CRLF normalization |
| Migrations executed | **0** |

See [regression target](batch-3-followup/evidence/target.json), [browser live identity](batch-3-followup/evidence/browser/live-target.json), and [verification harness](batch-3-followup/target.cjs).

The existing recovery branch contains inherited data. Tests used newly created fictional tenants/employees only. Browser fixtures, normal login sessions and application writes ran inside an outer transaction that was rolled back. The independent concurrency regression used its existing synthetic-tenant cleanup. All **73 public business-table row counts and content fingerprints** matched afterward, and **zero browser-fixture organizations remain**. See [regression preservation](batch-3-followup/evidence/database-preservation.json) and [browser preservation](batch-3-followup/evidence/browser/e2e-preservation.json).

The fictional opening balances describe the deliberately controlled fixture history. They are not evidence of any real employee's contributions or tax history. Credentials were read in memory; production secrets/configuration were not changed or printed.

## Actual browser HR-to-ESS rehearsal

The test used headless **Google Chrome**, the real optimized **Next.js production build**, normal email/password login, the real tenant/session/role checks, rendered payroll forms, real Server Action POSTs and actual PostgreSQL queries. There were no payroll-action or authentication mocks.

For cleanup safety, the application's Prisma singleton was bound to the fictional outer transaction; nested application transactions used serialized savepoints. This is the only transaction-boundary adapter. Independent connection concurrency and ordinary service transaction behavior were exercised separately by the integration suite. This was a local production-build rehearsal, not a deployed production test.

The browser:

- Logged in as fictional HR, configured full monthly salary **35,000**, created September payroll periods, and submitted reviewed agency bases and explicit opening history through the UI.
- Generated monthly payroll, repeated generation, moved it to Review, confirmed Finalization, opened the HR payslip, then logged in normally as the employee and opened the matching ESS payslip.
- Created/configured the semi-monthly **second cutoff before the first**. The readiness table showed **Action required** and the missing-history message before generation. Attempting generation produced the existing setup error and **zero entries**.
- Created/generated/reviewed/finalized the first cutoff through the browser. The second cutoff then became ready.
- Injected an incorrect first-cutoff SSS allocation amount into the fictional transaction. The browser showed the invalid-history readiness message before generation; generation created **zero second-cutoff entries**. The fault injection was rolled back to restore the original valid fixture ledger.
- Generated the second cutoff, repeated generation without duplication, reviewed/finalized it, and opened both semi-monthly ESS payslips.
- Verified that finalized monthly/first-cutoff payroll had no Finalize control, and PostgreSQL rejected attempts to change finalized pay. Payslip reads preserved the finalized snapshot.
- Verified that an employee/hiring manager could not use the HR payroll workspace and that a wrong-tenant payslip URL exposed no foreign payroll amounts.

**Result: 29/29 browser checks passed.** Evidence: [checks](batch-3-followup/evidence/browser/browser-checks.json), [detailed payroll snapshots](batch-3-followup/evidence/browser/authenticated-e2e.json), [browser run result](batch-3-followup/evidence/browser-run.json), [server log](batch-3-followup/evidence/browser.log), [sanitized POST evidence](batch-3-followup/evidence/browser/server-action-requests.json), and [harness](batch-3-followup/browser.cjs). POST evidence is an accumulated observation list and can contain repeated observations; it is not a unique-request counter.

Screenshots: [monthly ESS](batch-3-followup/evidence/browser/monthly-ess-payslip.png), [first-cutoff ESS](batch-3-followup/evidence/browser/semi-first-ess-payslip.png), [second-cutoff ESS](batch-3-followup/evidence/browser/semi-second-ess-payslip.png), [missing-history page](batch-3-followup/evidence/browser/second-missing-first-readiness.png), [invalid-history page](batch-3-followup/evidence/browser/second-invalid-first-readiness.png).

### Independent expected amounts versus actual

These are fictional **September 2026** calculations, not proof of November compliance. Full independent formulas/source references remain in [Batch 3](FIX-BATCH-3.md).

| Amount | Monthly expected / actual | First cutoff expected / actual | Second cutoff expected / actual |
| --- | --- | --- | --- |
| Gross pay | 35,000.00 / 35,000.00 | 17,500.00 / 17,500.00 | 17,500.00 / 17,500.00 |
| Employee SSS | 1,750.00 / 1,750.00 | 875.00 / 875.00 | 875.00 / 875.00 |
| Employee PhilHealth | 875.00 / 875.00 | 437.50 / 437.50 | 437.50 / 437.50 |
| Employee Pag-IBIG | 200.00 / 200.00 | 100.00 / 100.00 | 100.00 / 100.00 |
| BIR withholding | 1,701.30 / 1,701.30 | 850.58 / 850.58 | 850.58 / 850.58 |
| Net pay | **30,473.70 / 30,473.70** | **15,236.92 / 15,236.92** | **15,236.92 / 15,236.92** |

Each generation retry retained one payroll entry and three agency allocations. The semi-monthly snapshots use FIRST then SECOND; monthly employee contributions are charged once across the two cutoffs. Employer counterparts/EC remain separate from employee deductions. The separately printed BIR frequency tables explain why two semi-monthly taxes do not exactly equal the monthly tax.

## Regression and required checks

| Check | Result | Evidence |
| --- | --- | --- |
| Full TypeScript | **PASS** — `tsc --noEmit --incremental false` | [Result](batch-3-followup/evidence/typescript.json), [log](batch-3-followup/evidence/typescript.log) |
| Targeted ESLint | **PASS** — both changed application modules | [Result](batch-3-followup/evidence/lint.json), [log](batch-3-followup/evidence/lint.log) |
| Production build | **PASS** — `next build --webpack`, offline test configuration | [Result](batch-3-followup/evidence/build.json), [log](batch-3-followup/evidence/build.log) |
| Statutory pure tests | **PASS — 93 cases** | [Log](batch-3-followup/evidence/statutory.log) |
| BIR pure tests | **PASS — 56 cases** | [Log](batch-3-followup/evidence/bir.log) |
| Payroll integration | **PASS — 56 assertions**: calculations, tenant/role protection, allocation uniqueness, idempotency, concurrent generation/finalization, rollback | [Result](batch-3-followup/evidence/integration.json) |
| Payroll workflow | **PASS — 24 assertions**: setup/history requirements, reuse, effective dates, unverified current dates | [Result](batch-3-followup/evidence/workflow.json) |
| Presentation/ESS services | **PASS — 28 assertions**: finalized visibility, HR/ESS agreement, authorization, legacy snapshots | [Result](batch-3-followup/evidence/presentation.json) |
| Leave/reconciliation/integrity | **PASS — 15 assertions**: unpaid-leave guard, paid leave, upward second-cutoff remuneration, rounding restriction, database ownership/frequency constraints | [Result](batch-3-followup/evidence/phase3.json) |
| New B3-002 regressions | **PASS — 33 assertions** | [Result](batch-3-followup/evidence/readiness.json), [test source](batch-3-followup/readiness-tests.cjs) |
| Actual Chrome flow | **PASS — 29 checks** | [Result](batch-3-followup/evidence/browser-run.json) |
| Diff/preservation | **PASS** — `git diff --check`; only authorized preexisting file changed | [Preservation](batch-3-followup/preservation.json) |

The new regression covers absent first history; draft/review first payroll; a valid finalized first cutoff; missing agency allocation; wrong slot; malformed JSON; inconsistent amount; foreign employee/tenant identifiers; wrong contribution month/agency; mismatched monthly liability; first allocations exceeding a revised liability; read-only preflight behavior; tenant denial; unchanged finalized snapshots; idempotent valid second generation; and unchanged monthly/generated/finalized behavior. November readiness remains blocked.

### Failed attempts, blocked cases and exclusions

Two initial browser harness attempts stopped before the complete flow: the first fictional organization lacked branding and correctly reached mandatory workspace setup; the older harness then looked for statutory forms on Run Payroll, whereas current main links to them under Employee Pay Setup. Only the new harness/fixture was corrected. Both attempts rolled back and preserved all existing database contents. Evidence is retained in [initial attempt](batch-3-followup/evidence/browser-initial-run.json), [workspace diagnosis](batch-3-followup/evidence/browser-initial/diagnostic.json), and [routing attempt](batch-3-followup/evidence/browser-ui-routing-run.json). The final run passed; these attempt failures are not omitted from the evidence.

Server output includes `FORBIDDEN` for deliberately unauthorized HR-route requests and nonfatal navigation stream-close messages. The successful checks/snapshots and final rollback establish the tested outcomes; no claim of entirely empty browser/server logs is made.

**Blocked by unchanged safeguards:** November statutory/BIR coverage, unsupported fractional-centavo Pag-IBIG cases, monthly unpaid leave, and exceptional cumulative/annualized/final-pay tax methods. These were not bypassed. **Not executed:** actual production payroll, production migrations, deployment, bank disbursement, agency filing/remittance, or real employee-history reconciliation.

## Assessment and stop point

**B3-002: resolved.** Missing/invalid first-cutoff contribution history now produces an actionable pre-generation readiness blocker. The browser and database evidence show that supported historical monthly and semi-monthly payroll still proceeds through HR review/finalization to employee ESS with the expected amounts.

**Historical isolated demonstration: GO for the tested scope. Current-date/statutory production approval: unchanged NO-GO.** This follow-up changes no legal verification window and resolves no other Batch 3 limitation. No further application fix or release action was performed.

Final evidence and report checks: [consolidated results](batch-3-followup/evidence/final-summary.json), [link/secret validation](batch-3-followup/validation.json). Stop after testing and reporting.
