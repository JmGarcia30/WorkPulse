# UAT Blocker 1 — CandidateAccess

24 October 2026. **Resolved on verified recovery only.** No production connection, reset, push or deployment. Existing migration SQL and application authentication/authorization code were not changed.

## Root cause and safety

Candidate authentication was already implemented, but its migration had only been exercised in rollback tests. Later recovery release bundles deliberately excluded it; see [Hiring release evidence](../../hiring-policy/release/REPORT.md). The starting ledger therefore contained 34/35 migrations and no `CandidateAccess` table. Credential issuance/verification, candidate files, and onboarding/rejection revocation require that table.

The unmodified `20261021000100_candidate_access` migration creates an empty table, its primary key, two nullable unique credential-hash indexes and a foreign key to `Application(id)`. It has no backfill, UPDATE, DELETE, DROP or existing-column rewrite. Cascades apply to the new credential child records, not applicant/employee records. Existing candidates gain no access merely because the table exists; fresh verified credentials are required.

The guarded runner checked the saved recovery branch/endpoint identity, excluded the protected original endpoint, compared pooled/direct read-only state and history, verified every applied checksum, and confirmed `Application.id` is the required non-null text primary key. It rehearsed the exact SQL inside a rolled-back transaction and confirmed orphan credentials fail the foreign key. A reviewed bundle containing applied history plus this sole missing migration was then applied through Prisma. No unrelated migration was included.

Evidence: [preflight](preflight.json), [rehearsal](rehearsal.json), [migration](migration.json), [Prisma status](status.json), [migration preservation](migration-preservation.json), [final preservation](final-preservation.json).

## Changes and security review

**Applying the migration resolves B1 without a runtime security patch.** No new candidate authentication bypass was reproduced in the inspected paths. Existing controls were retained and tested:

- Application-bound ownership verification; stored hashes rather than raw credentials; 15-minute, single-use email links and 24-hour candidate sessions.
- Neutral public responses, resend cooldown/hourly application limits, failed-delivery denial and replacement-link invalidation.
- Public reapplication cannot change shared applicant name, email or phone. There is no supported public identity-correction/email-change action.
- Tenant/application/document predicates, persisted staff permissions, invalid-staff-cookie denial, expiry, explicit HR revocation, fresh verification after re-enable, and rejection/withdrawal/completed-onboarding restrictions.

Test tooling was updated to use the existing table after migration, the current tenant-aware mail API and canonical test host, and the intended browser document input. A localhost-only HTTP transport preserves actual tenant Host headers: Node 24 `fetch` replaced Host with `127.0.0.1`, correctly triggering the existing forwarding guard. Authentication was not relaxed. New evidence is separate from earlier reports.

## Validation

| Check | Result |
|---|---|
| Migration rehearsal / postflight | Passed; 35/35 applied, no pending migration or checksum mismatch |
| Candidate HTTP/browser suite | **106 scenarios passed**; real production HTML, Server Actions and browser upload/download against migrated recovery |
| Candidate unit / document-handler checks | Passed; controlled mail/storage, private MIME/no-store behavior and ownership/expiry/revocation checks |
| Current focused conversion regression | Six scenarios: missing attestation, late contract, required onboarding evidence, foreign tenant, successful linked conversion and idempotent retry; see [results](conversion-regression.json) |
| Prisma validation, TypeScript, focused ESLint, production build | Passed; build used read-only recovery configuration |
| Preservation | Original-record counts/content fingerprints match across **all 67 pre-existing tables**, including applicants, organizations, employees and payroll. New table is empty after tests; rollback fixtures left no organizations behind. Original `.env` is unchanged. |

The legacy H1 regression fixture failed the newer probation guard because it omits the HR attestation and signs a historical contract at today's date. It is **not claimed as passing**. Its failed attempt is retained under `attempts/`; the focused current regression reuses only its fixture factory with valid disposable contract evidence and preserves the guard. An initial browser fixture selector/HTTP-header mismatch was corrected; these were test-harness failures, not authorization defects.

## Remaining limits and reruns

Mail is controlled in these tests; live SMTP/Gmail delivery and hosted Blob behavior remain manual acceptance gates. Rollback/savepoint tests do not certify independent committed races. Application-scoped resend limits do not establish infrastructure-wide abuse protection. Shared applicant identity corrections require a separate authorized process; previously downloaded files cannot be revoked. The existing staff JWT logout/revocation limitation remains as documented in the broader UAT plan.

Payroll verification expiry and new-tenant careers activation remain separate UAT blockers. Production schema/migration state remains unverified.

Run from the repository root, only with the existing verified recovery configuration:

```powershell
node scripts/candidate-access-checks.cjs unit
node scripts/candidate-access-checks.cjs headers
node scripts/candidate-access-checks.cjs http
node scripts/candidate-access-checks.cjs regression
node scripts/candidate-access-checks.cjs status
node scripts/candidate-access-recovery.cjs verify
```

The last command compares existing-record fingerprints with this run's saved pre-migration baseline. Legitimate later record changes require a new reviewed baseline, not overwriting or ignoring preservation failures. Do not rerun bare legacy fixture scripts against `.env` or apply a production migration based on this recovery result.
