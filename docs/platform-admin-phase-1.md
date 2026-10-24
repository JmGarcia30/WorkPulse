# Platform Super Admin — Phase 1

Implemented locally on 2026-10-23. No deployment, push, production migration, production writes, or environment-file changes.

## Authorization boundary

Platform administrators are stored in `PlatformAdministrator`, separate from tenant `User`, `Role`, and `Organization` membership. No tenant role was added or reassigned. `/platform` is served only on the configured public platform host; tenant and workspace discovery hosts are rejected. Existing SAGA path-tenancy cookies do not rewrite platform routes. Protected pages and account actions independently authorize a fresh database-backed session.

Platform sessions use random 256-bit opaque tokens, persist only SHA-256 token hashes, expire after eight hours, and recheck account disablement on every lookup. Production cookies are host-only, Secure, HttpOnly, SameSite Strict, and use the `__Host-` prefix. Tenant JWTs and platform cookies cannot substitute for each other. Next.js Server Actions retain their origin checks. Logout removes the database session; password changes revoke every platform session. Login and account password verification use persistent, transactionally serialized throttling (five attempts per identity per 15-minute window; login also has a global 200-attempt window).

Passwords use bcrypt cost 12, require at least 14 characters, and reject values over 72 UTF-8 bytes to prevent silent truncation. The dummy comparison hash for unknown identities is not attached to any account and cannot authenticate one.

## Dashboard and settings

- Organization counts, paginated organization list, and organization details.
- Explicit organization metadata allowlist: ID, name, slug, career portal enabled/disabled status, time zone, and registration date.
- Own account name and password settings, requiring the current password. Sign-in email is read-only.
- Existing WorkPulse CSS conventions, pending buttons, inline errors/success messages, and mobile layouts.

No organization user, employee, applicant, payroll, or document data is selected by platform pages. No tenant impersonation or automatic workspace authorization exists. Existing document authorization is unchanged.

The existing Organization model has no lifecycle/suspension status. This phase displays the persisted **career portal status**, explicitly labeled, and does not imply that disabling careers suspends the organization. Organization suspension, tenant editing, MFA, password recovery, additional administrator management, and an administrator audit dashboard are outside this phase.

## Secure initial provisioning

`scripts/provision-platform-admin.cjs` is an operator-only interactive CLI, not a public registration endpoint or Server Action. It does not load or modify `.env`. An operator must supply `DATABASE_URL` through their secure process environment, inspect the credential-free target fingerprint, and explicitly select that fingerprint:

```text
node scripts/provision-platform-admin.cjs --show-target
node scripts/provision-platform-admin.cjs --target <fingerprint>
```

The CLI requires a terminal and an explicit typed confirmation, then prompts for name, email, and a hidden, confirmed password. It accepts no password command-line argument and contains no default account/password. A PostgreSQL advisory transaction lock permits exactly one initial account even under concurrent bootstrap attempts. Bootstrap refuses whenever any platform administrator already exists, including a disabled one. No permanent administrator was created during this task.

## Migration and release prerequisites

Required migration: `prisma/migrations/20261023000100_platform_administration/migration.sql`. It creates only `PlatformAdministrator`, `PlatformAdministratorSession`, and `PlatformAuthenticationAttempt`, with unique email/token keys, session indexes, and a cascading session foreign key. It does not alter existing tenant tables or records.

Tested only on identity-verified isolated recovery branch `br-broad-forest-az55xwfe`, through `scripts/platform-admin-recovery.cjs migrate`. The runner verifies pooled/direct connection identity, checks applied migration checksums, excludes the protected original endpoint, and deploys a curated bundle of already-applied migrations plus this migration. It does not apply the unrelated pending candidate-access migration. All 55 pre-existing tables retained identical row counts/content fingerprints after migration.

Before production: review the actual production migration history and all pending local migrations; apply an approved migration plan through normal release procedures; verify the configured public hostname, trusted forwarding headers, and HTTPS; then deliberately provision the first administrator through the operator CLI. Production history was not inspected or changed. Do not run an unreviewed blanket migration deploy from this working tree. Operational recovery/additional-admin procedures remain a separate phase.

## Validation

Evidence: `docs/platform-admin-phase-1/`.

- **59 passing targeted assertions** in the database/request-adapter suite: provisioning safeguards, concurrent bootstrap, all tenant roles, wrong-tenant access, document endpoint denial, session/token boundaries, expiry, disablement, password/name changes, logout, login throttling and concurrent rate-limit enforcement.
- Nine production-build browser checks exercise actual login/logout and settings Server Actions, dashboard counts, organization details, production cookie flags, and mobile organization details.
- TypeScript, targeted ESLint, Prisma validation, and production build passed.
- Existing data fingerprints matched across all 58 tables after synthetic tests. Browser fixtures run inside a rolled-back outer transaction; core concurrency fixtures are explicitly removed. Environment-file fingerprint checks also passed.

Re-run only against the verified isolated recovery target:

```text
node scripts/platform-admin-recovery.cjs test
node scripts/platform-admin-recovery.cjs build
node scripts/platform-admin-browser.cjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prisma/build/index.js validate
```

The concurrent-bootstrap suite requires empty platform authentication tables, fails if those tables are already populated, and never clears pre-existing platform accounts. Browser tests use synthetic fixtures and leave no administrator behind.

## Files changed in this phase

- `prisma/schema.prisma` and the additive platform-administration migration.
- `src/proxy.ts` (platform-route host boundary only).
- `src/features/platform-admin/{credentials,service,session,actions}.ts` and `forms.tsx`.
- `src/app/platform/layout.tsx`, `login/page.tsx`, `(protected)/layout.tsx`, `(protected)/page.tsx`, `(protected)/organizations/[id]/page.tsx`, and `(protected)/settings/page.tsx`.
- `scripts/provision-platform-admin.cjs`, `platform-admin-recovery.cjs`, `test-platform-admin.cjs`, and `platform-admin-browser.cjs`.
- This report and local verification evidence in `docs/platform-admin-phase-1/`.

All existing Payroll, Hiring, Leave, Probation, candidate-security and other uncommitted changes were preserved. Phase 1 stops here.
