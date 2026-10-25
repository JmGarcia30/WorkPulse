# WorkPulse Vercel Preview release — Sprint 2

Branch: `employee-ui-design`. **Local commits may be reviewed; do not push yet.**
The actual Vercel Preview-scoped database configuration has not been explicitly
verified. No push, deployment, database access, migration, reset or seed was
performed during this release preparation.

## Included behavior

- Tenant-scoped RFID card enrollment, replacement/deactivation and independent
  kiosk authorization. Leading zeroes remain strings; raw card IDs are HMACed,
  kiosk tokens are hashed, and accepted scans use server timestamps.
- Shared attendance event/projection services, original scan UUID retry receipts,
  cooldown, same-day Time In/Out and Asia/Manila display. A failed display lookup
  cannot roll back an already committed event.
- Calendar-month habitual tardiness threshold of four occurrences; complete,
  resolved attendance required for attendance-dependent payroll; input evidence
  checked before finalization. No company deduction rate was invented.
- Existing authentication implementation is retained. Portable focused test
  scripts are included; machine-specific diagnostic/recovery runners are excluded.

## Exact commit file manifest

### Commit 1: feat: add tenant-scoped RFID attendance enrollment and kiosk

- `prisma/schema.prisma`
- `prisma/migrations/20261025000100_rfid_attendance_phase1/migration.sql`
- `src/features/attendance/service.ts`
- `src/features/attendance/rfid-policy.ts`
- `src/features/attendance/rfid-service.ts`
- `src/features/attendance/rfid-server.ts`
- `src/features/attendance/rfid-actions.ts`
- `src/components/attendance/RfidEnrollment.tsx`
- `src/components/attendance/RfidKiosk.tsx`
- `src/app/(dashboard)/dashboard/attendance/page.tsx`
- `src/app/(dashboard)/dashboard/attendance/rfid/page.tsx`
- `src/app/attendance-kiosk/page.tsx`
- `src/app/api/attendance/rfid/kiosk/route.ts`
- `src/app/api/attendance/rfid/scan/route.ts`
- `src/app/api/attendance/rfid/transport.ts`
- `src/proxy.ts`
- `scripts/test-rfid-attendance.ts`
- `scripts/test-rfid-browser.cjs`

### Commit 2: fix: validate attendance inputs before payroll finalization

- `src/features/attendance/domain.ts`
- `src/app/(dashboard)/dashboard/attendance/[employeeId]/page.tsx`
- `src/features/payroll/attendance-evidence.ts`
- `src/features/payroll/service.ts`
- `src/features/payroll/review.ts`
- `scripts/test-attendance-payroll-rules.ts`
- `scripts/test-rfid-schedule-payroll.ts`
- `scripts/fixtures/rfid-schedule-payroll.json`

### Commit 3: test: document preview release gates and authentication checks

- `scripts/test-auth-preview.cjs`
- `scripts/test-saga-login-session.cjs`
- `docs/releases/vercel-preview-sprint2.md`
- `docs/releases/vercel-preview-sprint2-checks.json`

## Excluded local changes

These remain in the working tree and were not deleted, reverted or staged:

- All local `.env*` files and recovery credentials (already ignored by Git;
  the existing tracked `.env.example` is unchanged).
- Changes under `docs/performance-audit/batch-0/`, including database identity,
  checkpoint, schema-history and recovery verification outputs.
- Changes to `scripts/batch0-recovery-environment.cjs`,
  `scripts/dev-recovery.cjs`, `scripts/execute-batch0-recovery.cjs`,
  `scripts/test-runtime-startup.cjs`, plus the local development recovery and
  verification runners.
- Raw `docs/rfid/`, `docs/auth-preview-sprint1/` and
  `docs/auth-preview-sprint1-1/` reports/JSON: these contain machine-specific
  evidence, employee/event identifiers, counts or transient failures. Only the
  aggregate verification summary beside this document is committed.
- Environment-bound RFID/authentication audit, migration and diagnostic runners,
  including `rfid-development.cjs`, `audit-auth-preview.cjs`,
  `audit-rfid-payroll-readonly.cjs`, `diagnose-production-login.cjs` and its
  safety preload. The local recovery setup is not a Preview runtime dependency.
- `.next/`, private storage, browser sessions and temporary release inventory.

The explicit file allowlist, not a blanket stage operation, defines the release.
The selected files were scanned against locally configured secret values and
credential/private-key patterns without printing those values. This check does
not certify the repository's entire historical commit history.

## Migration and build checks

There are **36 migration directories with SQL files**: 35 existing tracked
migrations plus `20261025000100_rfid_attendance_phase1`. The latter creates four
RFID tables, tenant foreign keys, active-card partial unique indexes, validation
checks and immutable audit triggers. Existing migration SQL files are unchanged.
No migration was executed during Sprint 2.

Offline verification compares the 35 finished, non-rolled-back cached migration
checksums and the separately verified RFID migration checksum. It excludes an
old rolled-back history entry rather than counting it as applied. Retained
development evidence reports all 36 applied. **This is not a live verification
of whichever database Vercel currently selects.**

`npm run build` performs Prisma Client generation and a webpack Next build.
`postinstall` only generates Prisma Client; `start` invokes Next. None runs
migrations, seed, database push or recovery. Vercel must use its Next.js build
integration, not the local `npm run dev` recovery launcher. No remote build/install
override or Node.js runtime selection was inspected or changed.

The previously passing production build is reused because application source
did not change during release packaging. New checks are TypeScript, selected-file
ESLint, offline Prisma schema validation with a synthetic localhost URL, secret
screening, fixture parity and 20 database-free attendance/payroll assertions.
No broad regression suites or database-backed fixtures were rerun.

## Previously completed evidence reused

- RFID integration: **65 assertions**, pass.
- Browser enrollment, authorization, scan retry and attendance visibility:
  **21 checks**, pass; keyboard simulation, not physical-reader certification.
- RFID → schedule → attendance → payroll: **42 assertions**, pass.
- Existing H3 attendance: **39 assertions**, pass.
- Current statutory payroll integration: **55 assertions**, pass.
- Authentication/routing: **69 focused assertions**, pass.
- Sprint 1.1: login page **200**, six related HTTP checks pass using an existing
  Organization Admin account, and eight HR_ADMIN fixture assertions pass.
  Historical login 500 was not reproduced; no application repair was claimed.
- Local production build passed. Actual hosted Preview, TLS/browser cookies,
  Google exchange, physical reader and remote environment remain unverified.

The schedule fixture copies exactly the audited seven-day schedule values and
15-minute grace without organization, employee, card, credential or event IDs.
It replaces a dependency on an uncommitted raw audit file. Fixture parity was
checked offline; the 42 database-backed scenarios were not rerun for this
packaging-only change. Tests now create their local output directories when
needed in a fresh checkout.

Older Batch 3/H6 foundation fixture failures remain documented limitations:
they omit required reviewed statutory/opening inputs and retain outdated
generation assumptions. They were not rerun, bypassed or silently reported green.

## Preview environment — names and purpose only

Configure these in **Vercel Preview scope**, preferably scoped to this branch.
Do not bulk-import local `.env`, copy production credentials, or overwrite
Production variables.

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled connection to the approved development/test Neon endpoint; must be explicitly verified distinct from production before push. |
| `SESSION_SECRET` | Stable server-only signing/routing/RFID HMAC key, at least 32 characters. Existing test cards need the enrollment key; do not silently rotate it. |
| `PLATFORM_ROOT_DOMAIN` | Exact selected Preview hostname, no scheme or path. |
| `PLATFORM_PUBLIC_ORIGIN` | Matching canonical HTTPS origin, without `/saga`. |
| `GOOGLE_EMAIL_CLIENT_ID`, `GOOGLE_EMAIL_CLIENT_SECRET`, `EMAIL_OAUTH_ENCRYPTION_KEY` | Optional Gmail integration test client and stable canonical-base64 32-byte encryption key. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Controlled platform verification/invitation email transport. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Alternative legacy SMTP sender; takes precedence over generic SMTP credentials. |
| `BLOB_READ_WRITE_TOKEN` | Private test document store when testing document journeys. |

`H10_TEST_DATABASE_URL` is local test-tool configuration, not the runtime
datasource; the current Prisma datasource does not reference `DIRECT_URL`.
Do not expose server secrets with `NEXT_PUBLIC_*`. Let Vercel supply its own
`VERCEL*` context. The source does not automatically substitute `VERCEL_URL`
for the explicitly configured WorkPulse host/origin.

On the matching temporary Vercel host use `/saga/login`, `/saga/dashboard`,
`/saga/employee` and `/saga/attendance-kiosk`. Another deployment alias is not
automatically trusted. Cookies are host-only, so switching aliases starts a new
browser session. Platform login stays at `/platform/login`.

If Google integration is tested, register the exact canonical HTTPS callback
`/api/email-integration/google/callback`, without `/saga`, in the test OAuth
client; enable Gmail API and allow the controlled test accounts. Gmail OAuth is
a sender connection, not staff Sign in with Google.

## Push/deployment gate

Before any push that can trigger Vercel, explicitly verify in the intended project:

1. The branch deploys as **Preview**, not as the Production branch, and remote
   build/install commands do not run migration/recovery/seed operations.
2. The effective Preview `DATABASE_URL` selects the approved development/test
   branch/endpoint, database and schema, distinct from production; include any
   branch overrides and automatic Neon integration variables in that review.
3. That target already has the 36 required migrations. Do not apply them as part
   of this release preparation. A different empty/stale test database is blocked.
4. The selected Preview alias, public origin, stable signing key and required
   feature-specific email/storage/OAuth settings match the test plan.
5. Deployment protection permits the intended testers and OAuth callback journey.

No Vercel project/URL or remote variable access is available in this checkout, so
the database gate is **not verified** and **push is not allowed yet**.

New workspace registration is intentionally unavailable on temporary Vercel
path hosting; use supported custom-domain tenant hosting if that feature is
required. Development has no active Platform Admin account for real platform
login. SAGA operational payroll still needs active approved compensation,
reviewed statutory/opening inputs and approved deduction policies. A stale draft
payroll is safely blocked; an approved recalculation/adjustment workflow is still
needed. Staff login throttling and copied-JWT revocation remain unresolved
security findings. None of these is silently certified by preparing commits.

## Preview smoke and physical reader checklist

After an explicitly approved Preview deployment, use designated isolated test
employees and a controlled mailbox:

- Sign in/out through SAGA, check role/tenant rejection and host-only cookie use.
- Enroll a ten-digit card beginning with zeroes; replace/deactivate it and verify
  unknown/inactive card feedback.
- Verify the actual USB reader's Enter suffix or idle submission and automatic
  focus restoration.
- Verify displayed employee, Time In/Out and Asia/Manila date/time; rapid repeat
  must not switch direction.
- Interrupt one confirmation, retry the same UUID and confirm one attendance
  event, visible in HR/ESS and Recent RFID Activity.
- Exercise an assigned workday and grace boundary; evaluate no-scan absences after
  shift end. Confirm missing/open/incomplete attendance blocks affected payroll.
- Validate only configured approved deduction policies; do not introduce rates
  to make a demo pass.
