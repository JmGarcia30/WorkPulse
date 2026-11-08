# WorkPulse subscription implementation

Branch: `feature/subscription-admin-continuation`.
Base: `origin/feature/real-saas-subscriptions-foundation` at `131cb2d8` (draft PR #14). Latest fetched main is `0d7657b2` and is already an ancestor. No main reconciliation merge was necessary. Local payroll recovery changes were preserved.

## Current behavior

- Organization Admin and HR Admin use `/dashboard/subscription` to compare Basic/Pro, request a plan, and view pending/reviewed requests, current access, expiration and tenant history.
- Platform Admin uses `/platform/subscriptions` to configure descriptions, nullable PHP prices, optional feature permissions and employee limits; approve/reject requests; select explicit durations of 1–120 calendar months; activate/extend terms; inspect organization history; and grant SAGA two years of complimentary Pro.
- A request never activates access. Approval atomically records the review, manual subscription and audit events. Rejection requires a reason and leaves current access intact.
- One pending request per organization is enforced by a PostgreSQL partial unique index and tenant transaction locks. Concurrent approvals cannot activate a request twice.
- Same-plan manual renewals extend from the current expiration. Plan changes replace the term immediately and preserve before/after history. Forms describe this behavior. A repeated direct administrator grant is a new, explicit extension; request approvals and the active SAGA complimentary grant are replay protected.
- Complimentary SAGA grants last exactly 24 calendar months from grant, including correct leap-year/month-end clamping. All subscription relationships, forms and locks use immutable organization IDs. SAGA's existing protected slug is read only to identify/verify the agreement recipient; no workspace-routing code is changed.
- Optional server gates cover AI resume parsing, advanced analytics, Gmail integration and branding. Core HR, recruitment, RFID, payroll, leave and ESS remain available during transition.
- `legacyAccess` is backfilled for preexisting tenants and persists independently of later plan changes and expiry. This intentionally preserves their existing optional features during transition. New tenants require a current subscription whose plan includes each optional feature.
- Expiration is enforced at the exact timestamp on every optional-feature authorization check, without relying on a scheduler. Pages display the effective expired status immediately. Platform Admin can persist elapsed expirations with an idempotent audit event; activation also persists an elapsed prior term before replacing it.
- Audit events include actor IDs, request IDs and configuration/term snapshots. PostgreSQL prevents event updates/deletes. Global catalog edits are audited without depending on SAGA's existence.

## Commercial definitions and payments

No Basic/Pro prices or employee limits have been invented. Both remain nullable. Pending-definition plans accept requests; Platform Admin can pause requests independently of pricing. Optional feature inclusions are configurable and unset in the unapproved catalog; flags enabled by the automated tests exist only in synthetic test data.

Employee limits are stored and displayed but deliberately not enforced until the approved definitions and counting/over-limit policy arrive. Final definitions can be entered in the existing admin screen without schema/code changes.

There is no payment gateway integration. The foundation's Xendit adapter and webhook were removed. Manual approvals and complimentary grants never create payment orders, set `paidAt`, or claim payment. The existing main-branch browser-only demo remains separate and cannot activate database entitlements. Reserved order/provider fields remain available for a separately reviewed future PayMongo integration; it must verify provider payment independently before writing any paid record.

## Migration readiness

Keep the original foundation migration unchanged. Apply these in order only after review:

1. `20261108000100_saas_subscription_foundation`: existing plan/subscription/order/event tables, null prices and legacy tenant backfill.
2. `20261108000200_manual_subscription_requests`: manual source, independent legacy-access flag, requests and review constraints, pending uniqueness, nullable organization IDs for global audit, structured event snapshots and append-only trigger.

The verification runner uses an exact verified non-production Neon branch/endpoint and a new random `subscription_test_*` schema. It applies the baseline migrations, seeds a pre-subscription tenant, then applies both subscription migrations. It verifies the existing organization is unchanged, legacy access is backfilled, prices/limits stay unset, and checks Prisma schema drift. Original `.env` is not replaced. No production migration or deployment is performed.

Do not deploy application code before its additive migrations. Missing subscription tables intentionally fail visibly rather than silently granting new tenants premium access. The first migration's legacy backfill should be scheduled while tenant registration is paused or protected by the release transaction/process so concurrent organization creation has a clearly defined transition boundary.

## Verification

Run `node scripts/verify-subscriptions.cjs` for guarded migration rehearsal, real authorization/actions/PostgreSQL concurrency tests, domain tests, relevant existing regressions, TypeScript, Prisma validation, full lint, schema diff and production build. It writes credential-redacted logs and results to `docs/subscriptions/verification/` and an ignored `.env.subscriptions-test.local` profile. The synthetic schema is retained for local browser validation, not production use. Never substitute the application's production URL.

The action suite uses the real tenant/platform session guards and the real Prisma database. Only Next request adapters (headers/cookies/navigation/revalidation) are supplied by the standalone harness. Browser verification, when recorded, exercises the actual built application and server actions.

See `REPORT.md` and `verification/results.json` for final results and any preexisting regression failures.
