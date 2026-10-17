# WORKPULSE P0 RUNTIME RECOVERY

## 1. Exact root cause

The normal local development command was using the original Neon database, which still has only 20 applied migrations. The generated Prisma Client correctly expects H10, including ProbationRecord.closedBySeparationCaseId and EmployeeSeparationCase. Those structures are absent in that database.

The earlier recovery/benchmark runners explicitly loaded .env.recovery.local, but normal npm run dev did not. That filename is not one of Next.js's automatic environment files. An inherited DATABASE_URL also takes priority over dotenv files, so adding another dotenv file alone would not reliably correct this environment.

This gap between the tested recovery runner and normal development startup caused the page failures. The Dashboard error boundary displayed its generic message after the Server Component threw; a streamed HTTP 200 did not mean a successful page.

Evidence was obtained before changing startup: the live Next.js MCP get_errors response contained the three issues below, and existing server logs independently recorded both missing database structures. Read-only probes reproduced P2022/P2021 against the original connection and passed against the approved child branch. The original connection has 20 migrations; workpulse-batch0-recovery has 22, including both H10 migrations. Both probes enforced default_transaction_read_only=on. No production write or migration was performed.

## 2. Classification

The blocking failure was H10 database compatibility combined with incorrect local database selection. It was not a confirmed Batch 1–3 query/calculation regression. The optimized queries and H10 functionality remain in place. The third issue was an independent, pre-existing header breadcrumb key collision; its code was present in HEAD before the optimization changes.

## 3. The three reported issues

| Issue retrieved from live Next.js error state | Exact evidence | Resolution |
|---|---|---|
| Dashboard PrismaClientKnownRequestError | ProbationRecord.closedBySeparationCaseId missing; reproduced P2022. Stack: readDashboardData, src/features/dashboard/read-model.ts:205 → DashboardPage, src/app/(dashboard)/dashboard/page.tsx:14. Employee list/profile relation reads encounter the same missing column. | Select the already migrated, approved recovery branch for local development. |
| Exit Management SeparationError | The separation operation could not be completed. Underlying Prisma logs show public.EmployeeSeparationCase missing; reproduced P2021. Stack: run, src/features/separation/core.ts:53 → ExitPage, src/app/(dashboard)/dashboard/employees/exit/page.tsx:11. | Same database-selection fix; H10 remains intact. |
| React duplicate key warning | Two breadcrumb children had key /dashboard/hiring/pipeline. Stack: src/components/layout/DashboardHeader.tsx:70. Hiring and Pipeline intentionally share a navigation destination, but used that destination as their React identity. | Include breadcrumb position in the key. Link targets, labels, styling and hierarchy are unchanged. This warning did not cause the missing-schema crashes. |

Evidence: confirmed-live-issues.json and database-selection-before.json. A later empty devtools snapshot in live-issues-before.json reflects the browser's changing current error state, not absence of the earlier captured failures.

## 4. Files changed in this recovery

Runtime fix:

- package.json — npm run dev invokes the explicit local recovery launcher; existing H10 scripts preserved.
- scripts/dev-recovery.cjs — verify the approved endpoint/checksum evidence and pass recovery pooled/direct URLs explicitly to the Next dev child process. Preserve existing session/auth settings. Refuse missing/unverified profiles; no fallback to the original database.
- src/components/layout/DashboardHeader.tsx — unique breadcrumb keys.

Validation/evidence:

- scripts/check-runtime-recovery.cjs — read-only database comparison and live Next.js error inspection.
- scripts/test-runtime-startup.cjs — five startup/environment safety regressions without a database.
- scripts/runtime-recovery-validation.cjs — recovery-only regression/build/check runner.
- scripts/verify-runtime-recovery.cjs — normal-login Chrome page/content, console and server-error verification.
- docs/runtime-recovery/* — sanitized evidence and this report.

The original .env, Vercel settings, historical migrations, H1–H10 business logic and Batch 1–3 optimizations were not edited. Credentials stay in the existing ignored .env.recovery.local; none were printed or committed. Diagnostic process logs are under ignored storage/runtime-recovery-logs, outside Next's generated-output cleanup directories.

## 5. What was fixed

Normal npm run dev now explicitly overrides inherited database URLs with the verified recovery profile before Next starts. Both pooled and direct URLs refer to the approved disposable endpoint and differ from the protected original endpoint. It does not use the audit helper's ephemeral session secret: existing authentication/session behavior is preserved.

The app may still list .env in Next's startup output because it loads other settings from that file. The child-process database environment takes precedence. The launcher prints only the non-secret recovery branch name. The ordinary production build/start commands and Vercel configuration are unchanged.

Live-target confirmation is performed through normal password login using a temporary admin account created only in the recovery branch, with database authorization/tenant checks active. That account is removed after browser verification. No existing employee, finalized payroll, leave or attendance record is changed by verification.

## 6. Pages verified in Chrome

| Page | Rendered-content result |
|---|---|
| Dashboard | PASS — Welcome Back, New Hires; initial normal login and return navigation |
| Hiring | PASS — Hiring Pipeline |
| Employees | PASS — Employee Records |
| Employee Profile | PASS — selected employee identifier, Back to Employee Records, Employment History |
| Attendance | PASS — Monthly Attendance |
| Leave | PASS — Leave Management |
| Payroll | PASS — Payroll |
| Analytics | PASS — Workforce Overview |
| Exit Management | PASS — Create exit case, Separation cases |

Chrome used a normal password login on the actual corrected development server at http://saga.localhost:3000. The account existed only on the recovery branch, confirming the running server's database target; it was deleted afterward. All nine modules and the return to Dashboard passed, with zero browser console errors/warnings, zero uncaught runtime exceptions, zero failed HTTP responses and zero document reloads during module transitions. Current Next.js devtools state has zero config/session errors, and the restarted server logs contain no detected database-schema/runtime failures. Evidence: browser-pages.json, browser-validation.json and live-issues-after.json. No page bodies, employee details, passwords or cookies were saved.

## 7. Tests and build

- PASS: five startup regressions, including inherited-original URL override, session preservation, command arguments and refusal of missing/unverified recovery profiles.
- PASS: isolated npm regression scripts for H10.1, H1, H2, H4 ESS, H5 Leave, H6 Payroll and S1 tenant isolation.
- PASS: Prisma schema validation and TypeScript.
- PASS: local production Next.js webpack build, 81,224 ms.
- PASS: final changed-file ESLint and git diff --check.
- PASS: 23 H10 interface/alternating-tenant rendered-page checks.
- PASS: final read-only preservation check — 22 applied recovery migrations, matching H10 checksums, no missing expected columns/enums, 16 enabled H10 triggers and unchanged fingerprints for all 46 protected public tables. Temporary fixtures/account were removed. Original .env SHA-256 matches the pre-recovery baseline. Saved evidence contains no detected connection-URL/JWT patterns.

The protected fingerprints compare the original column projections used by the existing recovery baseline; the newly introduced H10 column is not part of that historical projection. Expected constraint-rejection assertions can emit P0001 in successful regression logs; these are not unhandled application errors. Evidence: isolated-regressions.json, h10-interface.json, startup-regression.json, typescript.json, production-build.json, eslint.json, diff-check.json and data-preservation.json.

The first build attempt hit EBUSY because temporary diagnostic log files were open under .next. A second temporary log placement also interfered with dev cleanup. These Windows file locks were corrected by placing logs in ignored storage outside both cleanup paths; the final build passes. Browser harness checks were also corrected for CSS-uppercase rendered text and the tenant host header used by Node's readiness request. These were verification-harness failures, not changes to application authorization or business rules.

## 8. Remaining problems and stopping point

The local application is working again and remains running on port 3000 using workpulse-batch0-recovery. Refresh existing tabs once to discard any previously streamed error state. The verified workspace URL is http://saga.localhost:3000/dashboard; npm run dev uses the corrected startup path on future restarts.

Production H10 migrations are still pending and remain a separate, explicitly approved deployment task. This recovery makes no claim about Vercel or production page functionality. Local development now requires the approved recovery profile and its verified endpoint record; it refuses an unsafe fallback. No remaining local runtime issue was found in the requested page checks.

No broad optimization, UI redesign, production migration, reset, push or deployment was performed. Batch 4 remains paused. Leave the restored local server running for usability review; do not resume optimization without the user's confirmation.
