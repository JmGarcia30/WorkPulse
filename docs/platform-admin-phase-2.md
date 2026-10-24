# Platform Admin Phase 2 — Organization onboarding

Implemented locally on 2026-10-23. No production writes/migrations, deployment, push, database reset, or environment-file changes.

## Features and workflow

`/platform` now links to a protected Create Organization form. It collects only organization name, workspace slug, contact email, timezone and initial HR administrator email. A server-generated request identifier accompanies the form. Server Actions authorize a fresh platform session on the public platform host; service operations also verify that the platform actor is active.

Slugs are normalized, validated as DNS labels, and checked against reserved platform names, SAGA aliases and existing tenants. Existing tenant login emails cannot be reassigned. Timezones are validated with the runtime's IANA timezone support. Unsupported SAGA-only temporary path hosting returns actionable `SETUP_REQUIRED` before creating a tenant.

One transaction creates the organization, a passwordless `HR_ADMIN` User, its pending invitation and creation/issuance audit records. New organizations start with careers disabled, no employee records, no payroll/leave/hiring setup, and no inherited SAGA policies or institution configuration. Their landing page/login labels use their own identity. Existing SAGA presentation and accounts are preserved.

Creation uses persistent request keys bound to normalized inputs and the creating platform actor. Transaction advisory locks serialize request retries and competing workspace/email claims; unique database keys provide final protection. A same-key retry returns the existing tenant without another invitation. Altered payloads or another actor cannot repurpose that key. Initialization errors roll back every tenant/account/invitation/audit write together. A post-commit failure can be retried safely using the same request key.

## HR invitation and activation

- Reuses the existing cryptographic invitation factory: random 256-bit, 24-hour, single-use tokens; only their hashes are persisted.
- Email is sent after the initialization transaction. The platform UI never receives or displays a bearer link or password. Sensitive messages are excluded from email previews/log retention.
- The new mail template uses a neutral WorkPulse sender and requires a configured sender address. It does not use the hardcoded SAGA fallback. Actual SMTP delivery is separate from email ownership verification.
- Activation links target the invited workspace's subdomain and carry tokens in the URL fragment. The activation page removes the fragment from browser history, including when a replacement invitation opens in the same tab.
- Activation requires the matching request tenant, current pending/unexpired token, matching invited User/email/organization, `HR_ADMIN` role, and an unset password. The recipient chooses their name and a confirmed password (14–72 characters, at most 72 UTF-8 bytes; bcrypt cost 12).
- A row-locked transaction sets the password, consumes the token, marks activation and records its audit event. Activation does not automatically sign the user in: existing tenant login and session protections remain in force.
- Only platform administrators can resend or revoke pending invitations. Controls require confirmation. Resend rotates the token, increments its version, invalidates the old link, and enforces a 60-second issue cooldown. Revocation clears the token permanently. Activated accounts cannot be changed through these controls.
- Resend/revoke request keys are persisted in audit records and bound to actor, organization and action. Row locks serialize activation, resend and revocation; version/hash-conditional delivery updates prevent late email acknowledgements from overwriting newer invitation state.

Organization details show contact information, pending/expired/activated/revoked invitation state, delivery state, explicit email-ownership verification state, and recent onboarding audit activity. Existing organizations without a record are labeled as not tracked through this workflow; no historical invitation or verification state is invented. Career portal status remains independent of onboarding, subscription and suspension.

## Email failure and recovery

Email cannot participate in a database transaction. Delivery failure leaves a complete, passwordless pending tenant with `FAILED` delivery status and a visible resend instruction. A process failure between commit and delivery acknowledgement can leave `PENDING`/unconfirmed delivery. Retry of an already committed request does not send another email; an authorized resend issues a fresh token. No durable plaintext-token outbox or automatic background mail worker was introduced.

Revoked invitations cannot be resurrected. Changing the initial HR email, issuing a replacement invitation after revocation, managing additional HR administrators and account recovery are outside this phase. The existing global tenant `User.email` uniqueness is preserved, so the same login email cannot be assigned to multiple organizations.

## Migration

Required: `prisma/migrations/20261023000200_organization_onboarding/migration.sql`.

It adds a nullable `Organization.contactEmail`, two invitation enums, `OrganizationAdministratorInvitation`, and `PlatformOrganizationAudit`. Constraints include unique organization/user/request/token identifiers, audit operation-key uniqueness, and a composite foreign key binding the invited User to its own organization. Existing tenant Users/roles and all earlier migrations are preserved.

Tested only through `scripts/platform-onboarding-recovery.cjs migrate` on verified isolated recovery branch `br-broad-forest-az55xwfe`. The runner verifies pooled/direct endpoint identity and migration checksums, rejects the protected original endpoint, and applies a curated bundle containing existing applied history plus this migration. It does not apply unrelated pending migrations. All 58 pre-existing tables retained matching counts/content fingerprints after migration; later test preservation compares all 60 tables.

## Validation

Evidence is stored in `docs/platform-admin-phase-2/`.

- **60 passing onboarding assertions:** creation, reserved/duplicate identifiers, email conflicts, invalid setup, persisted status, no inherited tenant records, rollback, idempotent/concurrent creation, invitation expiry/reuse/revocation/resend, concurrent activation, activation/revocation races, stale delivery acknowledgements, database-enforced tenant linkage, unauthorized access, and login separation.
- **59 passing Phase 1 authorization regressions.**
- **19 passing production-build browser checks** exercise actual Server Actions and a loopback-only SMTP sink accepting synthetic `.invalid` recipients: creation, invitation delivery, resend, activation, normal HR login, revoke, mobile controls, platform separation and neutral new-tenant pages. Combined with the suites above, **138 checks passed**.
- TypeScript, targeted ESLint, Prisma validation and production build passed.
- Core fixtures are explicitly removed; browser fixtures run inside a rolled-back transaction. Preservation fingerprints cover all existing records, including SAGA. Original environment-file fingerprint checks passed.

The browser test found and fixed a same-tab fragment replacement defect: a new invitation can change only the URL fragment without remounting the activation page. The final form handles `hashchange`, captures the new token and removes the fragment again. The test verifies the superseded link fails and the replacement activates successfully.

Commands (recovery runners reject unverified targets):

```text
node scripts/platform-onboarding-recovery.cjs test
node scripts/platform-onboarding-recovery.cjs build
node scripts/platform-onboarding-browser.cjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prisma/build/index.js validate
```

## Production prerequisites and limits

1. Review the real production migration history and all pending local migrations; approve/apply an explicit release migration plan. No production history or database was contacted for this task.
2. Configure and verify the public root hostname, wildcard tenant DNS/routing and HTTPS. The current SAGA-only temporary `.vercel.app` path arrangement is intentionally blocked for new tenant creation.
3. Configure and verify real SMTP delivery and an appropriate WorkPulse sender address. Successful transport tests here use only a local sink; no real email-provider deliverability was tested.
4. Provision/authorize the real platform operator through the Phase 1 operator-only workflow when approved. No permanent platform or HR account or organization was retained during verification.
5. New tenants must configure their own Hiring, Leave, Probation and Payroll policies before using those modules. No configuration is copied from SAGA or inferred.

No public organization signup, subscriptions, payments or suspension controls were added. Platform identities remain separate from all tenant Users; onboarding does not grant platform administrators confidential tenant record access. Phase 2 stops here.

## Files changed in this phase

- `prisma/schema.prisma` and `prisma/migrations/20261023000200_organization_onboarding/migration.sql`.
- `src/features/platform-admin/onboarding-schema.ts`, `onboarding.ts`, `onboarding-actions.ts`, `onboarding-forms.tsx`.
- `src/app/platform/(protected)/page.tsx`, `organizations/new/page.tsx`, and `organizations/[id]/page.tsx`.
- `src/app/activate/organization-admin/page.tsx`.
- `src/app/tenant-entry/page.tsx` and `src/app/(auth)/login/page.tsx` (neutral identity for non-SAGA tenants).
- `src/lib/email/index.ts` (new sensitive invitation template and opt-in neutral sender support; previous callers retain their behavior).
- `scripts/platform-onboarding-recovery.cjs`, `test-platform-onboarding.cjs`, `platform-onboarding-browser.cjs`.
- This report and local validation evidence.

All existing Payroll, Hiring, Leave, Probation, candidate-security, Phase 1, pending migrations and unrelated uncommitted work were preserved.
