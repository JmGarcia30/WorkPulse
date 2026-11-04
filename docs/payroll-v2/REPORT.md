# WorkPulse Payroll Simplification V2

Local implementation branch: `feature/payroll-simplification-v2`. No push, merge, deployment, production migration, or production payroll generation was performed.

## Final review follow-up — November 5, 2026

The requested targeted review is complete. **Recommendation: conditional GO for a release candidate limited to the existing reviewed ordinary monthly/semimonthly private-employee profile and supported classifications, through November 2026. This is a recommendation for your review, not release approval.** Actual production payroll must still pass HR's employee-specific setup/history/readiness checks. Unsupported arrangements and annualization remain excluded.

- **November rules:** the October 22 boundary was a WorkPulse review date, not a statutory expiry. Official Annex E, RR 11-2018, RR 29-2025, the rendered BIR issuance indexes and current ordinary contribution sources were checked. The code now separates review date `2026-11-05` from payment horizon `2026-11-30`; contribution months are bounded through `2026-11`. No rate, ceiling or monetary algorithm was changed. December and 2027 remain blocked. [Detailed rules, RR29 coverage and sources](review/RULE-REVIEW.md), [source hashes](review/source-manifest.json).
- **PHP 0.14 difference:** official printed thresholds produce 0.15 difference before rounding; independently rounding each 850.575 cutoff withholding to 850.58 reduces that difference to 0.14. Monthly deductions are 4,526.30; two cutoff deductions total 4,526.16. Contributions reconcile exactly. The official BIR calculator source and actual November generated entries confirm the result. [Expected/actual rule tests](review/rule-tests.json), [actual generator/ESS tests](review/november-integration.json). Annual reconciliation is a separate required process; these periodic figures are not asserted to be the final annual tax.
- **Migration:** current SQL was rehearsed on a read-only-exported, verified production copy: 75 application tables / 819 original rows, 40 successful historical migrations and one rolled-back history record. Both new migrations passed failure rollback, repeat-deploy and checksum checks. Six tenant-scoped foreign keys and insert/history/TRUNCATE guards were verified. All original row fingerprints, migration history, constraints, functions, triggers and historical indexes remain unchanged. [Migration review and rollback plan](review/MIGRATION-REVIEW.md), [final preservation](review/final-preservation.json).
- **Schema naming:** a second migration fixes only three new V2 index names. Two inherited historical index-name differences remain documented and were not applied. No V2 schema drift remains.
- **Independent review package:** [complete implementation diff against HEAD](review/implementation.patch), [follow-up-only diff](review/followup.patch), [initial implementation snapshot](review/initial-implementation.patch), [file/checksum manifest](review/implementation-manifest.json), [patch reverse-check](review/diff-verification.json). Environment credentials and production row contents are excluded.
- **Focused validation:** 149 existing BIR/statutory unit cases; 23 rule-review checks; 39 focused payroll/security checks; 14 actual November generation/finalization/ESS checks; 18 logged base-migration checkpoints and 9 index-correction checks passed. TypeScript and targeted lint passed. No additional full build was run. The existing 20 browser checks, screenshots and PDF remain linked below; hashes confirm every UI file is unchanged during this follow-up. Browser evidence corresponds to the earlier production build, not a rebuilt November-rule bundle.

**Remaining exclusions:** daily/partial/special and weekly/biweekly/annual arrangements; monthly unpaid-leave reduction methods; exceptional/cumulative/year-end/final-pay withholding; unsupported RR29 benefit categories; December/future rule windows; optional email; separate tablet validation. The production snapshot contains zero payroll entries/finalized payslips, so real finalized-history migration preservation cannot be demonstrated from that snapshot; controlled finalized/legacy fixtures provide separate evidence. Production role grants and live deployment were not rehearsed. Full accuracy/legal compliance is not certified.

## 1. Existing implementation inspected

Inspected the payroll period, entry, compensation, policy, statutory input, contribution allocation, tax opening, and posting models; payroll actions, generation, readiness, review/finalization, transaction locks, statutory integration, BIR classification and withholding, setup reuse, attendance evidence, approved leave inputs, HR components, ESS account guards, and finalized payslip projection/printing. Read the installed Next.js Server Functions and data-security guidance before implementation.

The existing engine uses `Prisma.Decimal`, verified government schedules, explicit employee coverage, verified agency-specific bases, persisted benefit/tax history, and first/second-cutoff allocation ledgers. These remain the calculation path. Existing finalized-entry and finalized-period database guards remain in place.

## 2. HR Payroll — implemented and tested

`/dashboard/payroll` now presents four steps: select/create a period; inspect employee readiness and manage earnings; generate, review and finalize; then notify employees. It shows period start/end and scheduled pay date. The existing employee table now includes actual basic pay and separate additional earning lines alongside gross, deductions, net, status, attendance/leave and deduction details. Compensation, policies, coverage, tax history and technical configuration are retained under Advanced Settings. Existing Poppins fonts, tenant buttons and workspace shell are reused, with white cards, `#282934` text and `#FAF8F6` page background.

Generation continues to identify missing setup per employee. Finalization continues to run fresh readiness, snapshot, statutory posting, allocation and reconciliation checks. New checks reconcile basic pay plus additional earnings to gross, compare current reviewed inputs against the calculation, and invalidate unfinished calculations when approved leave changes.

## 3. Custom earnings — implemented and tested

Uses the existing `PayrollStatutoryInput.payload.additionalEarnings` array and BIR engine. No second monetary calculation engine or earnings table was introduced. HR can add multiple entries, edit or remove them, and supply descriptions, approved classifications, unique supporting payment references, qualification evidence and change reasons. Supported UI categories are overtime, bonus/incentive, commission, fixed allowance, 13th month and Other.

The engine now accepts an explicitly reviewed `TAXABLE_BONUS` supplementary classification. Qualifying other benefits retain the existing history-dependent shared annual benefit pool; qualified allowances retain their existing caps and evidence requirements. Other requires a supported matching classification. Reimbursement is unsupported and fails validation. No generic tax-free switch was added. SSS and Pag-IBIG monthly bases must be reviewed again when earnings change; PhilHealth retains the existing fixed monthly basic salary rule.

Creator/updater IDs come from the authenticated HR actor. Optimistic input versions reject stale/repeated submissions. Supporting references reject duplicate payments within and across the employee's payroll periods, including the advanced setup path. The setup-reuse shortcut is restricted to basic-only inputs so it cannot copy period-specific earnings or deductions into a later payment.

Changing a generated unfinished entry requires explicit recalculation confirmation. Only that entry's provisional posting, contribution allocations and draft/review entry are released; its previous snapshot and input changes are retained in append-only `PayrollInputRevision`. HR must generate again before finalizing. Finalized payroll and historical entries without a verified ledger cannot be replaced through this path. Later dependent payments block recalculation.

## 4. ESS Payroll — implemented and tested

`/employee/payroll` keeps the existing read-only history and net-pay overview, now displays persistent payslip notifications, and uses scheduled/finalized terminology rather than suggesting disbursement. The shared finalized payslip view shows custom earning descriptions and amounts separately, existing itemized employee deductions, employer contributions separately, attendance, approved leave, and print controls.

ESS reads finalized calculation snapshots. It does not recalculate historical pay. Missing historical additional-earning or deduction details remain unavailable rather than fabricated zeros. Own-employee, active-account, role and organization checks remain enforced for list and detail access.

## 5. Notifications — implemented and tested

After finalization, HR reviews eligible active ESS recipients and explicitly confirms Notify Employees. The action persists an immutable `PayrollNotification` per finalized entry, with HR actor, recipient, message and creation time. The related entry identifies the period. Creation status and timestamps are shown to HR; recipients without active ESS access are counted as skipped. Recipient-list changes invalidate the confirmation token. A unique entry constraint, period transaction lock and duplicate-safe inserts prevent repeated creation. Database validation also checks recipient ownership and finalized status.

Notifications link to the employee's protected finalized payslip. Finalization itself makes the payslip available; notification does not change payroll or mark it paid. Optional email delivery was not implemented; in-app delivery works independently.

## 6. Independent expected-versus-actual calculations

All amounts below are PHP. Expected values were written as constants from manual arithmetic, not calculated by calling another production calculator. Fixtures use September 2026, inside the existing verified rule window, ordinary monthly compensation of 35,000 and reviewed mandatory coverage/bases.

| Controlled fixture | Expected gross | Actual gross | Expected deductions | Actual deductions | Expected net | Actual net |
|---|---:|---:|---:|---:|---:|---:|
| Basic monthly | 35,000.00 | 35,000.00 | 4,526.30 | 4,526.30 | 30,473.70 | 30,473.70 |
| Taxable bonus 2,000 | 37,000.00 | 37,000.00 | 4,826.30 | 4,826.30 | 32,173.70 | 32,173.70 |
| Bonus 2,000 + taxable allowance 500 + overtime 300 | 37,800.00 | 37,800.00 | 4,946.30 | 4,946.30 | 32,853.70 | 32,853.70 |
| Regenerated after bonus changed to 1,000 | 36,800.00 | 36,800.00 | 4,796.30 | 4,796.30 | 32,003.70 | 32,003.70 |
| Regenerated after overtime removal | 36,500.00 | 36,500.00 | 4,751.30 | 4,751.30 | 31,748.70 | 31,748.70 |
| Two absences + late attendance + undertime | 35,000.00 | 35,000.00 | 4,724.80 | 4,724.80 | 30,275.20 | 30,275.20 |

Manual basis: monthly employee SSS 1,750 + PhilHealth 875 + Pag-IBIG 200 = 2,825. Basic-only taxable compensation is 32,175; withholding is `(32,175 - 20,833) × 15% = 1,701.30`. In the tested ordinary supplementary cases the **regular compensation bracket** remains 15%; taxable supplementary payments are assessed using that bracket, following the existing verified ordinary withholding method. For the attendance fixture, two configured 100-peso absences and ten minutes at 1 peso reduce salary by 210; two undertime minutes at 10 pesos are net-only deductions. Taxable compensation is 31,965; withholding is 1,669.80; total employee deductions are 2,825 + 210 + 20 + 1,669.80 = 4,724.80.

Existing regression fixtures also verify each standard semi-monthly 35,000-salary cutoff at 17,500 gross, 2,263.08 deductions and 15,236.92 net, odd-cent settlement in the second cutoff, and second-cutoff reconciliation after a changed reviewed contribution basis. Employer contributions and EC do not reduce employee net pay.

Official sources checked for the new taxable-bonus classification and contribution context: [BIR withholding calculator](https://web-services.bir.gov.ph/tax_calculator/wt_calculator.html), [SSS contribution table](https://www.sss.gov.ph/wp-content/uploads/2024/12/2025-SSS-Contribution-Table-rev.pdf). Existing BIR Annex E, benefit, PhilHealth and Pag-IBIG schedule definitions were preserved. This work does not certify all Philippine payroll arrangements or legal compliance.

## 7. Statutory and attendance verification

- 150 Node test cases passed across statutory, BIR and attendance-rule scripts; the attendance script contains 20 additional assertions.
- Existing integration: 56 assertions; presentation: 28; workflow: 24; phase-3 statutory/leave regressions: 15. All passed.
- New focused V2 tests: 32 checks, including five independent amount fixtures, stale submissions, duplicate references, regeneration, ledger counts, finalized snapshot retention and immutable audit records.
- New edge tests: 10 checks, including a sixth independent amount fixture, missing evidence, attendance corrections, newly approved leave, monthly unpaid-leave blocking and unsupported daily arrangement blocking.
- Paid leave, missing coverage/history, unverified dates, fractional-centavo Pag-IBIG cases, first/second cutoff allocation and unresolved finalization are covered by the existing regressions.

Evidence: [focused results](focused.json), [regression results](results.json), [attendance/edge results](edges.json), [validation/build record](verification.json).

Authenticated browser verification passed against the single completed production build: actual period creation, custom-earning submission, generation, review, finalization and notification Server Actions; concurrent notification retries; ESS notification and custom-description display; exact finalized net; printable PDF generation; desktop workflow and mobile viewport checks; and denied access to a real foreign-tenant payslip and another employee's same-tenant payslip. Finalized snapshots remained unchanged. Evidence: [browser results](browser.json), [browser log](browser.log), [HR mobile screenshot](hr-mobile.png), [ESS mobile screenshot](ess-mobile.png), [synthetic printed payslip](payslip-print.pdf). The mobile screenshots were also visually inspected. A separate tablet browser pass was not run.

Initial browser harness attempts needed fixture branding setup and corrections for an uppercase text marker and the intentionally disabled notification button after delivery. The final browser run passed without those harness failures; no additional production build was needed. Synthetic browser fixtures, including earlier harness attempts, remain only on the isolated branch for review.

## 8. Security and tenant isolation

Existing H4/H7 ESS account, role, activation and tenant-isolation tests passed. New tests confirm employees cannot mutate earnings; HR cannot target another tenant's period; notification access requires the owning active ESS account; unauthorized recipients are rejected by the database; and finalized snapshots cannot be regenerated or edited. Database probes confirm notification and input-revision audit updates are rejected. Existing multi-connection generation tests verify one entry, one posting and one allocation per agency under concurrent generation.

## 9. Files and migration

Application changes:

- HR route: `src/app/(dashboard)/dashboard/payroll/page.tsx`.
- ESS route: `src/app/(employee)/employee/payroll/page.tsx`.
- Components: `EmployeePayrollEntriesTable.tsx`, `PayslipView.tsx`, new `PayrollEarningsForm.tsx` and `PayrollNotifyForm.tsx` in `src/components/payroll/`.
- Payroll services: `actions.ts`, `statutory-inputs.ts`, `statutory-integration.ts`, `service.ts`, `review.ts`, `reuse.ts`, `queries.ts`, `payslip.ts`, `bir/earnings.ts`, and new `earnings.ts`, `earnings-breakdown.ts`, `leave-evidence.ts`, `notifications.ts` in `src/features/payroll/`.
- `src/lib/db/prisma.ts` includes the new delegates in its development-client cache compatibility check.
- `prisma/schema.prisma`; additive migration `prisma/migrations/20261104000100_payroll_simplification_v2/migration.sql` creates `PayrollNotification`, `PayrollInputRevision`, indexes and insert/immutability guards. No existing records are rewritten.
- Follow-up migration `prisma/migrations/20261105000100_payroll_v2_index_names/migration.sql` normalizes only three new V2 index names. The first, unshipped migration now includes explicit transaction boundaries, composite ownership foreign keys, data checks and TRUNCATE guards.
- Test tooling: `scripts/payroll-v2-environment.cjs`, `scripts/payroll-v2-browser.cjs`, `scripts/test-payroll-v2.ts`, `scripts/test-payroll-v2-edges.ts`; evidence in `docs/payroll-v2/`.

The initial draft migration was applied to synthetic branch `br-green-king-azcpyvmo`. The final review used new isolated branch `br-lingering-dawn-azrdk13o` in project `purple-tree-62095489`, restored from a read-only production snapshot after the main project's branch limit blocked a direct child branch. Both current migrations were applied and checksummed only on the isolated copy; original production history/records were preserved. This branch contains a production copy despite the test project's historical “Synthetic Only” display name. Credentials and the raw dump are ignored/private; review artifacts contain no production row contents. Original `.env`, `.env.recovery.local` and `.env.payroll-v2.local` remain byte-identical. The new ignored `.env.payroll-v2-rehearsal.local` pins rehearsal access. Production has not applied either migration.

Unrelated pre-existing QA edits were preserved. Legacy tests' unrelated generated evidence was restored after testing. No production SAGA employee records were altered.

## 10. Limits and release status

**Implemented and tested:** the four-step HR workflow; classified multiple custom earnings; edit/removal with explicit draft recalculation and audit; exact-decimal reconciliation; finalized ESS snapshot transparency; persistent in-app notifications; access-control and idempotency checks; TypeScript; targeted lint; one production-style build.

**Implemented but not separately verified:** tablet-specific visual behavior. Responsive styles are present; the authenticated desktop and mobile workflows passed.

**Not implemented:** optional email notifications; a new statutory method for daily/partial/special arrangements or additional weekly/biweekly/annual payment frequencies; a reviewed monthly unpaid-leave salary-reduction method. The supported statutory path remains fixed monthly basic salary paid monthly or semi-monthly. Existing fail-closed behavior is retained for other arrangements. They cannot be treated as completed salary calculations.

**Rule-window limitation after final review:** supported ordinary BIR payments are bounded through **2026-11-30**, reviewed on **2026-11-05**, and contribution coverage through **2026-11**. Official evidence and independent November tests support the extension. December and later dates remain blocked. No rate, tax exemption or unresolved rounding assumption was changed to make tests pass. Reassess any intervening applicable issuance before a payment.

**Release work not performed:** production migration, production-environment browser validation, push, merge and deployment. A verified production-copy rehearsal is now complete; historical coverage limits are stated above. Your explicit approval is still required before release. Passing these fixtures is evidence for the tested cases, not a claim of 100% payroll accuracy or legal compliance.
