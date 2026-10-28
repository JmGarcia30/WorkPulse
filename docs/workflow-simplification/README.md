# WorkPulse workflow and presentation improvements

## Payroll: what actually changed

The two primary HR areas are **Employee Pay Setup** and **Run Payroll**. The existing financial overview remains available.

- Pay setup accepts the full monthly salary or daily rate, supported pay frequency and effective date. It displays the employee's verified coverage/classification when available and clearly identifies missing verification.
- A standard basic-only employee shortcut replaces the technical statutory form with explicit review statements and an evidence reference. It derives SSS remuneration and Pag-IBIG Fund Salary from the fixed monthly salary **only after HR verifies basic salary is the entire relevant remuneration**. Mandatory coverage, the supported tax classification, no extra earnings/union dues/voluntary deductions, and no untracked monthly contributions require explicit confirmations. Attendance deduction tax treatment remains an explicit choice. Salary identity and amount are checked again on save.
- PhilHealth's full monthly basic salary is prefilled for fixed monthly compensation. Other arrangements are not given guessed bases.
- Subsequent periods offer a concise review-and-reuse card based on a **finalized** prior period with the same compensation record and payment year. HR reconfirms all current-period amounts, classification, coverage and contribution history. The server independently rechecks source identity and salary applicability. The saved period input retains its source evidence and current reviewer. This is an actual reduction in repeated data entry; it does not depend on collapsing a form.
- Advanced Payroll Setup is a directly accessible area for exceptions, initial verified tax/benefit history, individual agency bases, coverage evidence, classified earnings and deduction treatments. Compatible prior verified inputs also prefill this form for changes. No historical zero is invented. Opening history is reused through the existing tax opening and persisted ledger.
- Run Payroll follows Select Period → Check Employee Readiness → Generate Payroll → Review Deductions → Finalize → Publish Payslips. The readiness table gives salary, government setup, opening-history, attendance and specific required actions for each employee. "Ready to calculate" is explicitly provisional: the actual engine still verifies earnings, allocations and ledger history.
- An empty DRAFT is blocked from Review inside the locked transaction, and its Review button is disabled. Existing safe deletion restrictions and finalized-record immutability remain.
- Valid finalization publishes the existing immutable payslip to the employee's ESS. There is no additional publication permission or alternate employee-access path.

The SSS, PhilHealth, Pag-IBIG, BIR and attendance calculation engines and tables were not replaced or relaxed. Unsupported daily/special statutory arrangements, exceptional tax methods, missing history, and unverified rule dates still block processing/finalization. This release does **not** establish complete Philippine payroll production readiness.

## Application form

The earlier form mixed light cards, dark input backgrounds, low-contrast text and hardcoded gold/indigo accents. The replacement uses a consistent responsive layout, light fields with dark text, explicit labels, a cohesive dark appearance, tenant-derived button/focus colors, and separated personal-information, cover-letter and resume sections. Both the form and success response receive the organization's public branding, including path-based public portals.

The resume picker is keyboard accessible, supports drag-and-drop, reports invalid/empty/oversized files, previews the selected filename/size, and removes the actual attachment when cleared. Invalid dropped files cannot remain in the submitted native input. The existing submission action, applicant identity/ownership, email verification, private storage and recruitment lifecycle remain in place.

## Platform login

The public `/platform/login` page uses the existing WorkPulse logo, a warm off-white surface, a balanced login card, WorkPulse red (`#A51A21`), maroon emphasis and a clear Platform Administration identity. It retains the existing email/password action, show/hide password button and accessible validation. Tenant host guards, session logic, password handling and permissions were not modified.

## Administrator investigation

See [admin-recovery.md](admin-recovery.md) for the credential-free findings, read-only target inspection command and existing operator-only provisioning procedure. The inspected Neon branch named production has zero administrators. Its identity has **not** been confirmed against Vercel's concealed production DATABASE_URL. No production provisioning/reset is authorized or performed by this change.

## Verification

Tests use `br-damp-fog-azmmxhga` / endpoint `ep-wild-mud-az8yzifu`, verified through read-only database settings and confirmed distinct from the protected original connection. Test employees/tenants are synthetic. Production receives read-only metadata/count queries only. Outbound email and blob credentials are disabled in test processes; email verification uses an in-memory transport sink. No environment file is rewritten.

Evidence is recorded alongside this document:

| Check | Evidence |
| --- | --- |
| 149 statutory and BIR unit tests | Existing `test-payroll-statutory.ts` and `test-payroll-bir.ts` suites |
| 56 payroll integration assertions | `tests.json` |
| 28 payslip/presentation/access assertions | `tests.json` |
| 24 standard-profile/reuse/readiness assertions | `workflow-tests.json` |
| 17 real platform/application/verification boundary checks | `boundary-tests.json` |
| 55 responsive/component browser checks | `browser-tests.json` |
| Production-build HR → finalized payroll → ESS browser flow | `authenticated-e2e.json` |
| OTP company-registration regression | `registration-tests.json` |
| Production build | `build.json` |
| Existing row-count/content preservation | `preservation.json`, `e2e-preservation.json` |
| Repository lint baseline | `repository-lint.json` |

Changed-file ESLint and TypeScript are checked separately. Repository-wide lint currently reports 100 errors and 61 warnings in existing unrelated files; changed files have no lint errors. The old standalone platform-admin suite requires completely empty platform authentication tables and refuses the test branch's existing attempt records. Those records are preserved; rollback-only boundary tests verify the unchanged live authentication implementation instead.

Some verification attempts initially failed because old tests allowed empty Review, synthetic periods overlapped, a success message disappeared on revalidation, a test tenant lacked onboarding branding, or a browser locked the build directory. Those cases were corrected or explicitly retained as test-environment limitations; completed result files describe the final runs.

Reproduce sequentially (do not rebuild while a browser server is using `.next`):

```text
node node_modules/tsx/dist/cli.mjs --test scripts/test-payroll-statutory.ts scripts/test-payroll-bir.ts
node scripts/workflow-verification.cjs test
node scripts/workflow-verification.cjs workflow
node scripts/workflow-verification.cjs boundaries
node scripts/workflow-verification.cjs registration
node scripts/workflow-verification.cjs build
node scripts/workflow-ui-browser.cjs
node scripts/workflow-e2e.cjs
node node_modules/typescript/bin/tsc --noEmit
```

## Production prerequisites

No Prisma schema change or new migration is introduced. No production migration, database reset, account mutation or credential recovery is performed. Existing required payroll/platform tables were found on the inspected Neon production branch (38 applied migrations; the isolated test branch has 39). This is not authorization to deploy pending migrations; the actual deployment target must be confirmed independently.

The current BIR verification window ends **2026-10-22**. Later pay dates remain explicitly blocked until an authorized statutory review supplies verified coverage. Daily/partial/special compensation and exceptional tax methods retain the engine's existing blockers. These limitations must be resolved before claiming broader production payroll readiness.

## Code files

- Payroll page: `src/app/(dashboard)/dashboard/payroll/page.tsx`.
- Payroll UI: `PayrollConfigurationTab.tsx`, `PayrollDashboardHeader.tsx`, `PayrollProcessingTab.tsx`, `PayrollSetupForms.tsx`, `PayrollStatutorySetupPanel.tsx`, and new `PayrollReadinessTable.tsx`, `PayrollReuseSetup.tsx`, `StandardPayrollProfile.tsx` under `src/components/payroll`.
- Payroll services/read models: `actions.ts`, `review.ts`, `setup-queries.ts`, and new `readiness.ts`, `reuse.ts`, `standard-profile.ts` under `src/features/payroll`.
- Public application: `src/components/careers/ApplicationForm.tsx`, `ApplicationForm.module.css`, and `src/app/careers/[organizationSlug]/[jobSlug]/apply/page.tsx`.
- Platform presentation: `src/app/platform/login/page.tsx`, `page.module.css`, `src/features/platform-admin/forms.tsx`.
- Operator inspection: `scripts/inspect-platform-admin-target.cjs` (read-only).
- Verification: `scripts/test-payroll-integration.ts`, `test-payroll-workflow.ts`, `test-workflow-boundaries.cjs`, `workflow-verification.cjs`, `workflow-ui-fixture.tsx`, `workflow-ui-browser.cjs`, `workflow-e2e.cjs`.

Repository branch remains `main`. Commit/deployment information is reported after the final checks and push.
