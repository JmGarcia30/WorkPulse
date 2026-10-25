# Sprint 1.1: local production SAGA login

## Cause

**The original `/saga/login` HTTP 500 was not reproduced. Its cause remains
unconfirmed. No application fix has been invented or applied.**

Sprint 1 retained the 500 status in `../auth-preview-sprint1/local-http.json` and
the separate `PrismaClientInitializationError` in `diagnostic-blocker.json`, but
did not retain the original server exception. Those are different observations;
the later initialization failure does not prove the cause of the earlier 500.

This sprint made exactly one initial reproduction request with the same compiled
production build (`6TMvrmctIVmL-h6ZZhfyg`), simulated Preview authority, port 3141,
read-only development datasource and production-mode cookie settings. It returned
**HTTP 200 with the Sign In form**, with no recorded server error.

Both direct and pooled connection preflights succeeded. The running application
also initialized Prisma successfully. Transient connectivity is possible but
unproven; environment precedence, tenant resolution and an application defect
were not established as causes of the original failure.

## Effective environment and tenant trace

- The existing recovery helper was read without modification. Before connection,
  the harness pins branch `workpulse-ess-design`, branch ID `br-damp-fog-azmmxhga`,
  endpoint ID `ep-wild-mud-az8yzifu`, database `neondb` and the public schema. The
  selected endpoint must differ from the protected original `.env` endpoint.
- The child process explicitly receives the pinned pooled `DATABASE_URL` and
  direct test URL with database read-only options, overriding inherited shell
  variables. No environment file is rewritten. A temporary process-only signing
  secret and exact matching Preview host/origin are supplied.
- A child-process preload guards **every PrismaClient construction** before
  initialization: the effective URL must match the expected URL digest and pinned
  development hostname/database and include read-only settings. An unexpected
  value throws before the client can connect. It logs only boolean checks, never
  credentials, URLs, tokens or hashes.
- Guard evidence confirms `NODE_ENV=production`, the intended routing variables
  and authorized read-only development selection inside the server process.
  PostgreSQL preflights confirm read-only mode and check its branch setting when
  available. The migration count remains **36**; no migration command was run.
- `/saga/login` resolves `st-aloysius` through the existing signed proxy rewrite,
  reads organization branding through Prisma and renders the form. Successful
  credential submission establishes the scoped session, which is revalidated
  against the persisted user and request tenant on the next request.

The only proven failure in this sprint was in the **new diagnostic harness**:
its first password submission used URL-encoded native form data. The installed
Next.js action handler explicitly ignores URL-encoded MPA actions, so it returned
the page with HTTP 200 without invoking `loginAction`. Multipart FormData corrected
that test request. This does not explain or change the historic GET 500.

## Files changed

New test/audit files only:

- `scripts/diagnose-production-login.cjs`: controlled single reproduction,
  sanitized diagnostics and a separate `--related-only` mode.
- `scripts/auth-login-safety-preload.cjs`: test-process-only fail-closed Prisma
  datasource guard. It is supplied only to the temporary server process.
- `scripts/test-saga-login-session.cjs`: eight HR_ADMIN-only assertions using
  actual action/session/guard modules with in-memory dependencies.
- `docs/auth-preview-sprint1-1/`: this report and sanitized evidence.

No application, RFID, UI, schema, migration, environment or recovery configuration
was changed. Existing employee/user records were not changed. All test database
connections enforce read-only mode. No seed, reset, production access, push or
deployment occurred. Protected configuration/schema file hashes are unchanged.

## HTTP result and tests

| Check | Result |
| --- | --- |
| Single original GET `/saga/login` reproduction | **200**, expected form; original 500 not reproduced |
| Existing SAGA account normal password login | **303** to `/saga/dashboard`; production session cookie issued |
| Authenticated return to SAGA login | **307**, persisted scoped session accepted |
| SAGA staff cookie presented to Platform Admin | **307** to `/platform/login`; no platform access |
| Foreign forwarded host with valid SAGA cookie | **404**, host spoof denied |
| Logout | **303** to `/saga/login`, production session cookie cleared |
| Anonymous dashboard after logout | **307**, authentication required |
| HR_ADMIN focused login/logout/session/tenant/role assertions | **8 passed**, no database connections |
| Focused ESLint for the three new scripts | Passed |

The actual HTTP credential check used an existing **ORGANIZATION_ADMIN** account,
authorized for HR back-office access. Its current password hash was verified
against the existing repository test credential, following the existing read-only
startup verifier; no seed was executed and no credential was printed or saved.
No matching HR_ADMIN credential was available through that mechanism. The exact
HR_ADMIN role was separately exercised by the eight module-level assertions; do
not misrepresent that as an actual existing HR_ADMIN browser login.

The first evidence file has `passed:false` because of the incorrect URL-encoded
POST, while its original GET check passed. It is intentionally preserved.
`related-login.json` records all **six related HTTP checks passing** after the
test encoding correction. No repeated initial GET reproduction or unrelated
regression suites were run. Cookie handling was tested over controlled raw HTTP
with simulated HTTPS proxy headers, not through a live TLS browser/Vercel session.

Evidence: `reproduction.json`, `related-login.json`, `hr-session-tests.json`.

## Remaining Preview blockers

- The historical 500's cause is unconfirmed. This run demonstrates working local
  production login; it is not evidence of a repaired application defect.
- Actual Preview URL/project settings, Preview-only database/environment scope,
  deployment protection, TLS/browser cookies and hosted login/logout remain
  unverified. No Vercel access or deployment was introduced in this sprint.
- Earlier feature gates remain: zero active development Platform Admin accounts,
  untested real verification email/Google callback delivery, private test document
  storage configuration, and no new-workspace provisioning on temporary Vercel
  path hosting. Staff login throttling and copied-JWT revocation remain separate
  unresolved security findings; this focused sprint does not change them.

No authentication production-readiness claim is made.
