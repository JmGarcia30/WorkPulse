# Organization-specific Leave configuration

Implemented in the existing working tree. Changes are limited to Leave pages, components, services and tests. No migration, production connection/write, deployment, environment file edit, Hiring edit or `.impeccable` change.

## Behavior

- The settings page derives SAGA identity from the authenticated organization's persisted unique slug (`st-aloysius`). Only SAGA sees Configure Current Year. The preset service enforces the same identity and HR role restriction; display names and submitted tenant IDs cannot select SAGA.
- Every SAGA leave definition matches the committed baseline: combined five-day Sick/Personal pool, 105-day maternity policy, seven-day/four-delivery paternity policy, seven-day Solo Parent policy, three-day bereavement policy, and unpaid Study Leave rules. Existing eligibility, document checks, scheduled/calendar counting, automatic grants and balance projections remain for SAGA.
- Other organizations create their own Leave Types and Leave Cycles. HR can set paid status, counting basis, balance tracking, default grant, policy reference, employment classification, minimum service months, maximum request units, retrospective filing and explicit HR verification. Optional eligibility fields default to no restriction. There is no SAGA policy fallback based on a leave code.
- On a tracked type, open its Cycles drawer to edit the default entitlement. This edit is available to non-SAGA tenants only, affects future grants, and writes only `LeaveType.defaultGrantUnits`. Existing immutable grants, debits, requests, snapshots, histories and attendance records are not rewritten. Grant the default to an employee for an open cycle through Leave Balances; duplicate grants remain rejected.
- SAGA-only maternity delivery-date/SSS checks, paternity delivery-sequence checks, Sick/Personal and Solo Parent automatic grants, and Sick/Personal projected balances are scoped to SAGA. Other organizations follow their own stored policy fields and explicitly granted balances, even when using those same leave codes.
- Server validation rejects invalid dates, reversed cycle ranges, blank required fields, invalid enum values, negative/nonfinite/oversized entitlements and amounts with more than four decimal places. Tenant and actor IDs in grant/review actions are always taken from authenticated context after caller fields are read.

## Verification

- `node scripts/test-leave-organization-policy.cjs`: 20 scenarios passed, including real Prisma writes/reads on the verified disposable recovery branch, server-action/service authorization, SSR settings visibility, Company B grants and approval/rejection, SAGA baseline equality and preset protection. All fixtures rolled back; fingerprints of the seven existing Leave tables match before/after.
- `node scripts/test-leave-regression-recovery.cjs`: all 103 existing H5 assertions passed. Covers SAGA eligibility and documents, balances and projections, approval calculations, cancellation/reversal, idempotent grants, schedule handling, attendance materialization interactions, notifications and tenant isolation. The isolated SAGA fixture uses the unique SAGA slug only inside its rollback transaction; the prior SAGA organization's full row and all existing Leave data match afterward.
- `tsc --noEmit --incremental false`: passed.
- ESLint on all changed Leave source and test files: passed. The new integration script's initial unused import warning was removed and that file passed with `--max-warnings 0`.
- `git diff --check`: passed. Prisma schema/migrations and Hiring work were not changed. No production build/deploy or broad audit was run.

## Limits

- Existing type eligibility and counting definitions are not edited in place through this UI; create a replacement type and deactivate the old one where a policy needs those changes. Only the future default entitlement has a new editor. Previously approved requests and grants remain authoritative.
- Arbitrary request categories, attestation/document rules, occurrence rules, bulk grants, accrual/proration, carryover and retroactive balance adjustment editors are outside this focused change. Existing schema/services remain available where already supported.
- Default changes do not top up employees who already received a grant for that cycle. Such adjustments require a separate explicit ledger workflow. No balances are silently reset or recalculated.
- New UI visibility was checked through server rendering and actions through controlled authenticated contexts against recovery. No full browser/end-to-end production smoke test was performed.

Existing production records containing previously copied SAGA fields are left untouched; no automatic cleanup or policy rewrite is performed.
