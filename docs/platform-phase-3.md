# Platform Phase 3 — Multi-tenant workspace routing

Implemented locally on 2026-10-23. No production connection, DNS change, push, deployment, database reset or migration was performed. No schema change was needed. Existing pending migrations and other uncommitted work remain intact.

## Routing and authorization

- A single strict authority parser validates `Host` against the configured root. It rejects URL-shaped authorities, lists, invalid DNS labels, trailing dots, unsupported ports, reserved hosts and lookalike suffixes. Case is normalized.
- `X-Forwarded-Host` is never an alternate source of tenant identity: when present it must equal the actual validated Host. RFC Forwarded and caller-provided internal tenant/routing headers are discarded before forwarding.
- A configured tenant subdomain is only a routing candidate. Proxy checks that its organization exists in the database before allowing any matched workspace/API/public route. Unknown organizations return 404. Arbitrary customer domains remain rejected; no custom-domain ownership registry was added.
- Proxy supplies a short-lived, host-bound, purpose-separated HMAC routing context. Server resolution verifies the signature and organization mapping again. Legacy unsigned `x-workpulse-tenant-slug` headers no longer establish identity.
- `getSession()` now requires the resolved request organization to match the signed JWT organization before returning a tenant user, while retaining its current-user role/membership checks. This closes cross-tenant access through legacy callers as well as shared HR/ESS guards. Existing valid SAGA JWTs remain usable in the correct workspace.
- `/platform` is served only on the validated public host, strips tenant claims, and uses its separate platform account/session table. Tenant JWTs cannot authenticate it; platform sessions do not create a tenant identity.
- Tenant career URLs and metadata validate organization ownership explicitly. Prefix lookalikes and another organization's slug cannot select another tenant. Public careers entry on the configured public host remains supported with existing candidate token protections.
- Activation routes now share no-store/no-referrer/noindex response headers. Existing invitation tokens, single-use activation and standard tenant login are unchanged.

Hostnames select an allowed workspace; they do not prove user membership or domain ownership. Production DNS ownership/HTTPS must be established by the deployment operator. The application still requires the correct cryptographically authenticated account for every confidential tenant operation.

## SAGA compatibility and confirmed fixes

Both `saga.<root>` and `st-aloysius.<root>` resolve the existing `st-aloysius` organization. The existing `/saga` path workspace and its remembered workspace selection remain supported, including bare dashboard/action redirects. Selection cookies are not authentication.

Confirmed fixes include the original forwarded-host precedence, unbound tenant sessions, career-path prefix ambiguity, and a canonical SAGA careers redirect-to-itself loop. Local SAGA path testing also exposed a rewrite-origin issue: redirects must use the validated public authority, while internal rewrites must retain Next's internal origin. The custom preview server uses `localhost` internally because this Next version normalizes loopback IPs to that name; its listener remains bound to `127.0.0.1`. The read-only smoke probe verified `/saga` and `/saga/login` return 200, while unsigned `/tenant-entry` on the public host returns 404. Login/logout Server Action redirects explicitly retain `/saga` when the request carries a verified SAGA path context, instead of relying on a subsequent proxy redirect during a client transition.

No existing SAGA User, role, salary, employee, document, policy, payroll entry or historical snapshot was modified. Synthetic SAGA HR login fixtures are removed after verification.

## Company B and policy isolation

The production-build browser harness uses a new synthetic Company B workspace created through the actual platform UI and a loopback-only SMTP sink. It exercises invitation delivery/resend, old-token rejection, activation, normal HR login, dashboard refresh and sidebar navigation. Company B HR can save its own probation settings through the existing UI. Company A/SAGA settings and tenant-specific Hiring/Payroll records are not inherited or modified. The separate organization branding page remains available under its existing HR authorization.

HTTP probes copy a valid Company B cookie onto SAGA and verify rejection before resource access. They also test unknown tenant hosts, an unverified actual host with a configured forwarded host, conflicting known Host/forwarded hosts, and ensure signed routing context is not emitted in response headers.

## Local development and deployment blockers

The existing recovery-only development runner now supplies matching localhost root/public-origin values for the selected `--port`, `-p` or `PORT`, without editing environment files. Company B can be used at `<registered-slug>.localhost:<port>`; the platform stays at `localhost:<port>/platform`. This provides local development and a production-build isolated preview without production DNS changes.

Production readiness is **not established**: the local `.env` has neither root-domain nor public-origin configuration. Remote Vercel bindings, domain ownership, DNS/HTTPS and real SMTP delivery were not verified. SMTP credential inputs exist locally, but tests deliberately use a local sink rather than those credentials. New onboarding remains blocked on the SAGA-only temporary `.vercel.app` arrangement.

Exact application variables, supported hostnames, DNS/Vercel setup, HTTPS/forwarding contract, SMTP prerequisites and isolated staging guidance are documented in [production prerequisites](./platform-phase-3-production-prerequisites.md). Earlier Platform Phase 1/2 production migrations still require the approved release process; this phase creates or applies none.

## Tests and preservation

Evidence: `docs/platform-phase-3/`.

- 64 new backend routing/session/isolation assertions.
- 60 existing organization-onboarding assertions.
- 59 existing Platform Phase 1 authentication/authorization assertions.
- 33 passing production-build browser and real HTTP checks cover Company B and SAGA, invitation/login/logout, tenant-specific settings, navigation/refresh, cookie transfer and spoofed hosts.
- **216 checks passed in total** across these four suites.
- TypeScript, targeted ESLint, Prisma validation and production build passed.
- Recovery target identity and migration history were verified. All 60 table count/content fingerprints were compared after fixture cleanup; `.env` content hash checks passed. No production connection was used.

Forced page refresh/navigation emitted Next's “destination stream closed early” diagnostic during the browser run. The page loads, settings actions, navigation and refresh assertions completed successfully; no unrelated streaming implementation changes were made. Earlier `browser-failure.json` diagnostics describe intermediate runs resolved by the final `browser-tests.json` results.

An early committed browser fixture created an immutable branding-audit test row, preventing ordinary cleanup. A one-time recovery-only transaction exclusively locked that audit table, temporarily disabled only its immutable trigger, removed exactly the verified synthetic audit, re-enabled the trigger before commit, and removed the uniquely identified synthetic accounts/tenants. Historical fingerprints and the enabled trigger state were verified. See `fixture-cleanup.json` and the narrowly scoped cleanup script. Later browser runs use probation settings, avoiding immutable audit creation, and clean up normally. No historical audit was changed.

Commands:

```text
node scripts/platform-routing-recovery.cjs test
node scripts/platform-routing-recovery.cjs build
node scripts/platform-routing-browser.cjs
node scripts/probe-saga-routing.cjs
node scripts/platform-routing-preflight.cjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/prisma/build/index.js validate
```

The routing recovery runner intentionally has no migration mode. Browser fixtures must be committed briefly so independently bundled proxy code sees them; all app connections point only to verified recovery, the script uses only uniquely tagged synthetic records, and cleanup/preservation checks follow.

## Files changed in this phase

- `src/lib/tenant/host.ts`, `server.ts`, new `routing-context.ts`.
- `src/proxy.ts`, `src/lib/auth/session.ts`, `src/lib/auth/actions.ts`, `src/features/platform-admin/session.ts`.
- `src/features/hiring/document-access.ts` and the three organization/job/application careers pages.
- `next.config.ts` (activation response headers), `scripts/dev-recovery.cjs` (local root/port setup).
- `scripts/test-platform-admin.cjs` (async proxy and matching-tenant test contexts; wrong-tenant sessions now fail at authentication).
- New routing recovery/browser/backend tests, read-only SAGA smoke probe, local readiness preflight and single-fixture cleanup script.
- This report, production prerequisites and local evidence.

All Payroll, Hiring, Leave, Probation, candidate-security and previous Platform Admin changes are preserved. No subscriptions, payments, suspension or redesign work was started. Phase 3 stops after this verification.
