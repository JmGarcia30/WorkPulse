# Staff authentication security fixes

Implemented on `employee-ui-design`. No push, merge, production connection,
production change, database reset, application seed, SESSION_SECRET rotation or
recovery configuration change was performed.

## Behavior

- Staff password login reuses the established database-backed
  `consumeAuthenticationAttempt` mechanism. Purpose-separated hashed keys scope
  budgets to tenant and normalized identity: five attempts per identity and 200
  per tenant within 15 minutes. Attempts include successful logins, matching the
  Platform Admin pattern. Failed/unknown identities retain committed budgets;
  exhausted tenant budgets cannot create more random-identity rows. Organization
  Admin, HR Admin, Employee and existing Hiring Manager login paths are covered.
- Password inputs retain existing credential behavior but reject non-string and
  oversized bcrypt inputs. Error feedback is generic for invalid/blocked login.
- Existing staff JWT cookies remain host-only, Secure/HttpOnly in production,
  SameSite Lax, path `/`, with seven-day expiration. Each new JWT also receives
  an unpredictable 256-bit identity and a server-side `StaffSession` record. Only
  the SHA-256 token hash is stored, with tenant/user ownership and expiration.
- Every session validation requires signature/expiry, random identity, matching
  persisted session, current role/membership, request tenant, and active employee
  access where applicable. Old stateless JWTs and signed tokens without matching
  persisted records fail closed. Database errors propagate rather than grant access.
- Logout deletes the current scoped server record before clearing its cookie.
  A copied token cannot authenticate afterward. Another browser's independent
  session remains valid. Failed/unscoped revocation cannot claim successful
  browser-only logout. A foreign tenant cannot delete another tenant's record.
- Session issuance locks the User row and rechecks the credential snapshot and
  account state after bcrypt comparison. A password change committed between
  comparison and issuance cannot authorize a new token using the old comparison.
- Database triggers revoke affected sessions atomically with password clearing/
  changes, role/membership changes, EmployeeAccount status/identity changes or
  deletion, and Employee status changes. They cover existing activation,
  administrator invitation, disablement and separation paths without duplicating
  revocation calls across those services. Re-enabling an account, restoring a role
  or restoring an old password does not resurrect deleted session records.
  A transaction rollback rolls back the credential change and revocation together.
- Platform Admin sessions remain separate and unchanged. Candidate verification
  remains separate, tenant scoped, one use and expiring. RFID kiosk sessions remain
  independent; kiosk authorization now also invalidates the copied HR JWT when
  it signs the browser out of staff mode. No RFID attendance code was changed.

## Migration and rollout requirement

New additive migration:
`prisma/migrations/20261025000200_staff_session_security/migration.sql`.

It creates `StaffSession`, its tenant/user foreign keys, hash/expiry checks and
indexes, plus three revocation functions and four triggers on existing account
lifecycle events. It does not edit existing migrations, rewrite passwords,
change employee/attendance/payroll records, or backfill/revoke unrelated platform,
candidate or kiosk sessions.

There are now **37 migration directories in the working tree**, with the new
migration not committed automatically. It was first tested in new, owned
`staff_auth_test_*` fixture schemas, which were removed after use. In the subsequent
authorized development deployment it was applied to public `workpulse-ess-design`
only after both connections, its sole-pending status and reviewed checksum were
verified. Development now has **37 applied / zero pending**. All 14 protected
employee/attendance/RFID table fingerprints and recovery configuration stayed
unchanged. Production remains unapplied. See `development-migration.json` and
`development-preservation.json`.

All previously issued staff cookies require a fresh sign-in after rollout.
SESSION_SECRET and existing RFID card digests need no rotation/re-enrollment.
Expired StaffSession rows can be removed later by an approved housekeeping job;
this change does not introduce a retention/deletion job for historical attendance.

## Exact implementation/test files changed

- `prisma/schema.prisma`
- `prisma/migrations/20261025000200_staff_session_security/migration.sql`
- `src/lib/auth/actions.ts`
- `src/lib/auth/session.ts`
- `src/lib/auth/staff-security.ts`
- `src/lib/db/prisma.ts` — refresh a cached development client missing the new model
- `scripts/test-auth-preview.cjs`
- `scripts/test-saga-login-session.cjs`
- `scripts/staff-auth-test-double.cjs`
- `scripts/test-staff-session-security.cjs`
- `scripts/validate-staff-session-security.cjs`

New documentation/evidence under `docs/auth-security/`:
`IMPLEMENTATION.md`, `focused-tests.json`, `preview-boundaries.json`,
`hr-session-tests.json`, `preservation.json`, and `validation.json`.
Historical Sprint 1/1.1 evidence was preserved. Unrelated release-gate files
already in the working tree were left untouched.

## Validation

| Check | Result |
| --- | --- |
| Actual PostgreSQL + action/session/guard modules in an isolated development schema | **63 assertions passed** |
| Existing focused authentication/routing/Platform Admin/candidate/RFID boundaries | **69 assertions passed**, in-memory database/request fixtures |
| Existing HR-only login/session assertions | **8 assertions passed**, in-memory fixtures |
| TypeScript `tsc --noEmit` | Passed |
| Prisma schema validation with synthetic local URL (no connection) | Passed |
| Prisma Client generation to a fresh isolated output | Passed |
| Focused ESLint on changed source/test scripts | Passed without warnings |
| `git diff --check` | Passed |
| Protected public development records and environment/recovery file hashes | Unchanged |

Tests include simultaneous failures and successes, persisted budget exhaustion/
expiry, tenant caps, correct credentials for each requested role, normal HR action
redirects, hashed session persistence, copied-token logout replay, multiple browser
sessions, cross-tenant rejection, stale password comparison, password/role/tenant
changes, account disable/re-enable, employee deactivate/reactivate, expired/missing/
legacy tokens, rollback semantics, Platform Admin revocation, candidate proof and
RFID authorization/session preservation. Request cookies/headers are injected;
this is not a hosted HTTPS/browser or physical-scanner certification.

Initial fixture setup missed the existing ACTIVE-account activatedAt constraint;
the fixture was corrected without weakening production constraints. The old
in-memory RFID permission fixture also retained a disabled account and was
corrected. No unrelated suites were rerun.

The standard local `prisma generate` initially hit an in-use Windows engine DLL.
During the authorized development deployment only the identified WorkPulse dev
process tree was stopped; standard regeneration then passed and localhost:3000
was restarted with the unchanged verified launcher. Actual existing SAGA
`HR_ADMIN` login, dashboard access, logout, persisted-session deletion and copied
token HTTP replay denial all passed (seven checks in `development-login.json`).

## Remaining release blockers

The two staff authentication findings are addressed in code and focused tests.
The new migration has been applied to authorized development only; it still
requires the separately approved production deployment procedure. Actual Vercel
Production database binding, backup/restore readiness and hosted deployment checks
remain unverified from the previous release gate. No production-readiness or
deployment approval is implied by these local tests. No commit, merge or push was
performed automatically.
