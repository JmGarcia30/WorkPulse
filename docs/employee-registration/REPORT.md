# Direct employee registration and access-role delivery

Branch: `feature/direct-employee-registration`.
Base: subscription continuation commit `33b99ad`. All subscription commits are retained. Existing uncommitted payroll recovery work is excluded from this feature.

## Complete

- Employee Management now offers **Add Employee** at `/dashboard/employees/new` for authorized HR and Organization Administrators.
- The form records name, email, phone, employee number, department, job title, actual employment date, employee/employment status, category, employment type, contract salary, pay frequency, registration reason and access role.
- Employee, employment record, account link and audit history commit together. Direct registration creates no applicant, application, job, interview, offer, onboarding candidate or pipeline record.
- Recruitment source fields are nullable for direct registrations. Existing recruitment links remain unchanged. Profile/compliance pages handle direct employees without broken hiring links.
- Direct registration and recruitment conversion share `createEmployeeWithEmployment`; their tenant lock protects contact-email duplication across the two paths. Conversion retains its readiness/contract/probation checks, transaction retries and idempotency. Its number allocator skips numbers already imported through direct registration.
- Registration keys protect repeated/concurrent submissions. Employee number and email checks ignore case, existing organization/number uniqueness remains, and a partial database index protects direct-registration email uniqueness. Existing global login-email uniqueness is retained.
- Every directly registered employee gets one linked account atomically. New active accounts are invited with no preset password; inactive employees receive disabled accounts and no invitation.
- Activation reuses existing invitation generation, hashed single-use tokens, expiry, bcrypt, account audit, staff sessions and tenant authentication. Public Server Actions bind activation to the request tenant. Invitation URLs select the workspace; shared-path/SAGA activation rewrites and fragment cleanup preserve that workspace. No slug renaming, alias ownership or workspace-slug management behavior was changed.
- Existing account resend/disable/enable operations recheck management authority inside their transaction. Regular HR can manage ordinary Employee accounts; management-role accounts require an Organization Administrator. The UI hides those management actions from regular HR as well.
- Organization Administrators can explicitly link matching, activated, unlinked accounts, both while adding an employee and on the account tab of an existing employee. Email, tenant and role must match. Passwords and roles are preserved; there is no automatic link by email and no duplicate account.

## Access roles

| Role | Current access | Who can assign/change it |
| --- | --- | --- |
| Employee | Personal ESS | HR/Organization Admin can register; role changes require Organization Admin |
| HR Administrator | Existing HR workspace plus personal ESS when actively linked | Organization Admin |
| Finance Officer | Personal ESS only | Organization Admin |
| Organization Head | Personal ESS only | Organization Admin |

Job titles remain employment data and confer no access permissions. Finance Officer and Organization Head have no HR/payroll administration or unfinished Finance/Executive workspace permissions. Their normal login lands in ESS. Linked HR staff use their existing login, with navigation between HR and personal ESS.

Role changes require an active account, an active employee, an explicit confirmation and a reason. Pending invitations cannot be promoted: activate the account first, or choose its intended role when registering it. Successful role changes revoke existing staff sessions and append a before/after role audit. Account/employee/user ownership remains immutable, and database checks prevent cross-tenant or unsupported-role reassignment of linked users.

## Employment and payroll boundaries

Direct registration stores required contract salary and employment history. It does **not** fabricate EmployeeCompensation, statutory setup, government identifiers, opening balances, schedules, leave balances or payroll entries. Existing payroll readiness and finalization requirements still apply.

Existing regular and probationary employment is supported. Probationary registration uses the actual original start date, the existing organization probation policy and an explicit attestation of agreed standards. SAGA teaching employees require the existing exact contract end-date rule. It does not restart probation or automatically regularize an employee. Future employment dates and direct entry as formally separated are not offered; established lifecycle/separation workflows remain responsible for those cases.

## Verification

| Check | Result | Evidence in `verification/` |
| --- | --- | --- |
| Registration, activation, linking, roles, isolation, conversion | PASS, 46 scenarios | `scenarios.json`, `02-registration-and-roles.log` |
| Actual browser / production server / normal login / Server Actions | PASS, 10 checks | `browser.json`, `browser-*.png` |
| Own ESS and finalized payslips for Employee, HR, Finance, Organization Head | PASS; unlinked staff rejected | `role-payslip-access.log` |
| Existing ESS/account/ownership/activation regressions | PASS | `regression-test-h4-employee-self-service.log` |
| Leave | PASS, 103 assertions | `regression-test-h5-leave-management.log` |
| Attendance | PASS, 39 assertions | `regression-test-h3-attendance.log` |
| RFID | PASS, 65 assertions | `regression-test-rfid-attendance.log` |
| Payroll integration / presentation / workflow / Phase 3 | PASS, 56 + 28 + 24 + 15 = 123 assertions | `regression-payroll.log` |
| Tenant/navigation and hiring policy | PASS | corresponding `regression-*.log` |
| TypeScript | PASS | `03-typescript.log`, `final-results.json` |
| Prisma validation | PASS | `04-prisma-validation.log` |
| Changed implementation and test file lint | PASS, no errors/warnings | `05-changed-eslint.log` |
| Production build | PASS | `07-production-build.log` |
| Migration rehearsal | PASS, all 47 migrations finished | `migration-readiness.json` |

The 46 scenarios cover direct creation with null recruitment provenance; no invented payroll setup; replay/concurrent duplicate prevention; single-use, expired and replaced activation tokens; workspace-specific invitation URLs; foreign-tenant activation rejection; unauthenticated shared-path and SAGA activation routing; actual session guards; all four access roles; denied HR privilege escalation; management-account invitation/disable protection; pending-invitation promotion denial; explicit existing-user links at registration and for an employee already in the directory; atomic rollback on bad/foreign links; role-session revocation; immutable audit; recoverable email failure; and recruitment conversion including employee-number collision avoidance.

The browser uses the actual production build and Server Actions. It registers an employee as HR, verifies the account/profile, activates a fresh test-issued invitation for that synthetic account, logs into ESS, changes the access role as Organization Admin, then verifies the same account's HR and personal ESS navigation. Activation email transport is captured in the service tests; the browser uses a synthetic invitation without sending email. No real email was sent. No uncaught browser runtime errors occurred.

Initial test-fixture errors were corrected: the conversion fixture now supplies current mandatory onboarding evidence; a test-local variable no longer shadows its registration-data factory; the new payslip fixture supplies the existing explicit finalization confirmation. The first browser assertion expected a retired ESS heading and was updated to verify the actual personalized welcome and employee route. Final scenario and technical-check evidence above supersedes the first broad-run `results.json`.

## Migration readiness

Two new migrations are included:

1. `20261108000300_employee_access_roles`: append Finance Officer, Organization Head and the role-change audit enum value.
2. `20261108000400_direct_employee_registration`: nullable recruitment links; registration-key uniqueness; direct-email uniqueness; paired-source constraint; updated employee-account consistency checks; linked-user tenant/role protection.

They add constraints/columns and relax the two recruitment-source NOT NULL requirements without deleting or rewriting employee, payroll, user, subscription or recruitment rows. Apply enum additions before the dependent application/migration. Existing foundation migration files and their checksums are unchanged.

All migrations and tests ran only in the newly owned `batch3_test_*` schema on the verified non-production recovery branch `br-damp-fog-azmmxhga`. The primary `.env` was not modified. The ignored `.env.employee-registration-test.local` profile and synthetic schema are retained for local review. No production data, migration, account grant, merge, push or deployment was performed.

## Remaining limitations / existing blockers

- Full-repository lint remains red on historical files: the broad run recorded 463 errors and 76 warnings, including preexisting local audit scripts and existing JSX apostrophes. Changed-file lint is clean. The prior subscription report contains the main-baseline comparison proving the repository lint failures already existed; unrelated files were not rewritten here.
- Full Prisma schema diff reports the same two inherited payroll index-name differences (`EmployeeCompensation`, `OrganizationPayrollPolicy`) documented before this feature. It reports no employee-registration, role or subscription schema differences. No production index correction was attempted.
- Live SMTP delivery was intentionally not exercised. If sending fails or mail is unconfigured, the employee/account remain safely invited and the administrator receives a warning and can use the existing resend action.
- Existing global User.email uniqueness is preserved: the same login email cannot create independent accounts in two organizations. Cross-organization account reuse/linking is rejected.
- Pending or disabled accounts must be activated/enabled before changing access roles. HR/ESS access for linked HR accounts follows the linked employee's active account/status; disabling such a management account is an Organization Administrator operation.
- Finance and Executive workspaces are intentionally absent. Their later permissions require a separate implementation.

There is no remaining HR-dual-ESS architecture blocker. Production remains pending a reviewed migration/release decision and acceptance or cleanup of the inherited broad-check failures. Do not point the changed application at the production database before its reviewed additive migrations.

## Changed areas

- Prisma schema and the two employee migrations.
- New `src/features/employees/records.ts`, `registration.ts`, `registration-schema.ts`, `registration-actions.ts`, `registration-form.tsx` and the new employee registration page.
- Employee directory/profile queries and profile source/account components.
- Shared employee-account provisioning/errors, activation and account-management services.
- Existing role/routing/session eligibility helpers, personal payslip/notification eligibility, personal leave/document eligibility, verified mailbox/recovery eligibility and HR/ESS navigation.
- Only employee activation route allowances in the existing proxy; slug creation, rename, alias and ownership handling are unchanged.
- Test runners and evidence under `scripts/test-employee-*`, `scripts/verify-employee-registration.cjs`, and `docs/employee-registration/`.
- One payroll test-cleanup type adjustment filters nullable applicant IDs after the schema change. Payroll calculation code is unchanged.

All existing subscription source/report files remain unchanged. Original uncommitted payroll recovery documents and scripts remain uncommitted and outside this feature.
