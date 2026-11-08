# WorkPulse SaaS Subscriptions — Implementation Review

## State
This feature is on a draft branch. DO NOT merge/deploy until migration and end-to-end billing verification are complete.

## Product behavior
- Organizations compare active Basic/Pro plans from their HR dashboard and initiate Xendit-hosted checkout only after real pricing and live gateway configuration.
- Platform Admin controls plan prices, feature flags and SAGA's explicit two-year complimentary Pro grant.
- Active entitlements are tenant-scoped and read from PostgreSQL, not browser state.
- Server actions enforce AI resume parsing, advanced analytics, Gmail integration and branding features. Core payroll, RFID, leave, HR records and ESS are not disabled.
- Existing organizations are grandfathered as LEGACY PRO during the migration to prevent service disruption. New tenants do not inherit this grandfathering.
- Checkout amounts and plan are snapshotted in SubscriptionOrder. One successful payment covers one chosen month/year; automatic recurring debits are NOT implemented.
- Browser return URL is only informational. Only an authenticated webhook PLUS fresh Xendit session verification can activate an order.
- SAGA complimentary Pro requires a deliberate Platform Admin grant; no payment details or automatic charges.

## Required configuration (never commit values)
- XENDIT_SECRET_KEY (server only, merchant API key)
- XENDIT_WEBHOOK_TOKEN (server only, callback verification token)
- WORKPULSE_LIVE_BILLING_ENABLED=true (explicit production opt-in after review)
- A verified canonical public HTTPS origin for success/cancel redirects
- Register webhook URL: https://<your-workpulse-domain>/api/billing/xendit/webhook
- In production only an xnd_production_ key is accepted; a sandbox key will not turn on live billing.

## Blocking unfinished work
- Decide and approve Basic/Pro pricing, billing periods, employee caps and included features; both plans default INACTIVE without prices.
- Confirm Xendit merchant account and payment session product access; validate provider request formats against account configuration.
- Add proper in-production reconciliation tools for paid-but-conflicting/out-of-order checkouts and webhook retries.
- Test and enforce employee-count limits before advertising any limits.
- Define cancellation, expiry grace period, recurring debit mandates, invoice/receipt and refund policies. No automatic recurring charges exist yet.
- Add onboarding prompts for newly created organizations and a clear upgrade pathway for all disabled features.
- Validate cross-tenant data access, retries, webhook replay, provider errors, duplicate orders, pending-session expiry, maintenance windows, payment/plan race conditions.

## Release checks
1. Backup and fingerprint production metadata; verify database identity. Never modify SAGA's payroll/employees as part of billing migration.
2. Apply migration to an isolated full-schema test database; check all FK and enum constraints.
3. Run Prisma validate, TypeScript, ESLint, production build, domain/security tests, and authorized HR/Platform Admin browser tests.
4. Confirm SAGA and other legacy tenant access remains active (LEGACY PRO backfill) and no demo payment can activate a real plan.
5. Test gateway sandbox with external provider keys on a nonproduction database, verifying actual webhook and reconciliation behavior.
6. Obtain merchant credentials, approved prices, customer terms and deployment approval. Roll out cautiously; monitor errors.

## Demo distinction
The old Subscription Demo page is browser-only and separate. It does not write subscription/order data or activate entitlements. Never show it as proof of actual gateway integration.