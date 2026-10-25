# Local presentation test — 2026-10-26 (Asia/Manila)

Application running at http://saga.localhost:3000 on `employee-ui-design`.
Verified existing development branch: `br-damp-fog-azmmxhga`, 37 applied
migrations, no migration failures. Browser tests used installed headless Chrome.

| Workflow | Result | Observed behavior |
| --- | --- | --- |
| HR authentication and organization access | PASS | Normal password login, tenant dashboard and HR pages |
| Job posting and public applicant submission | PASS | Published synthetic job; public form accepted a synthetic PDF resume |
| Applicant review, evaluation and hiring | PASS | Stage transitions, HOD/president evaluations, written examination, offer approval/acceptance, readiness-gated hire conversion |
| Onboarding and employee account creation | PASS | 11 recruitment documents verified; required onboarding completed; account invited and activated through its normal one-time link |
| ESS login and profile | PASS | Activated employee signed in and viewed their profile |
| RFID and attendance | PASS | Browser enrollment, kiosk authorization, keyboard scan, duplicate rejection and visible attendance record; database confirms exactly one RFID event |
| Leave filing and HR approval | PASS | Synthetic bereavement request filed, existing schedule assigned to fixture, configured-policy HR review approved |
| Payroll calculation and preview | BLOCKED | Dashboard/configuration pages load, but there are zero payroll periods, active compensation records and payroll policies; no calculation or payslip could be validated |
| Resignation, clearance and exit | PASS | New employee submitted ESS notice; separate historical fixture completed notice reviews, five clearances, readiness, approval and final execution; separated account cannot sign in |

Fixed a reproduced sign-in defect: the client-only submit handler allowed an early
submission to default to GET and place entered credentials in the URL. The form
now binds a Server Action through `useActionState`. Retesting passed with normal
JavaScript and with JavaScript disabled: native POST observed, no password query
parameter. TypeScript, focused lint and whitespace checks passed. Fix is local
and uncommitted in `TenantLoginForm.tsx` and `src/lib/auth/actions.ts`.

Two clearly marked synthetic employee fixtures were used. The second has seeded
historical employment so final exit can execute today without changing the new
hire's future notice dates or overriding policy. SMTP was redirected only in the
local process to a loopback test sink accepting `@fixture.invalid`; real recipients
and external email APIs were blocked. Activation links and test passwords remain
only in ignored local artifacts; no credentials are included here.

No production access, environment-file edits, migrations, policy invention,
payroll generation/finalization, final-pay creation, merge or deployment occurred.
Real employee records were not targeted. Read-only final state is recorded in
`verification.json`. Payroll needs authorized, approved period/compensation/policy
and statutory setup before it can be demonstrated. Current generation is
organization-wide, so do not test it against real employees under this scope.
