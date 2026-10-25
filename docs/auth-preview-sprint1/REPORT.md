# Sprint 1: authentication and Vercel Preview readiness

Branch: `employee-ui-design`. Development target: `workpulse-ess-design`.
No migrations, resets, production access, environment/recovery edits, pushes or
deployments were performed. This sprint adds two focused audit/test scripts and
this evidence directory; it makes **no application authentication changes**.

## Checklist

| Status | Check and evidence |
| --- | --- |
| PASS | Read-only development connection is distinct from the protected original endpoint; **36 applied migrations, zero unfinished**, matching 36 local migration directories. |
| PASS | **69 focused behavioral assertions** against actual authentication, session, guard, tenant/proxy, candidate and RFID modules with in-memory request/database fixtures. No database writes or network calls in this suite. This includes expected behavior documenting a logout limitation, not 69 security guarantees. |
| PASS | HR login/password rejection, tenant-scoped lookup, role redirects, logout cookie removal, malformed/expired JWT rejection, current-role invalidation, cross-tenant rejection and back-office role permissions in those fixtures. |
| PASS | ESS active account login and linked employee resolution; disabled account rejected at login and at the ESS access boundary. |
| PASS | Platform fixture login, separate secure eight-hour session cookie, active administrator lookup, expiry/disablement, tenant-host denial, persistent-budget logic and server-side logout revocation. Persistence/locking are mocked here, not a new independent PostgreSQL concurrency test. |
| PASS | Candidate ID alone denied; delivered one-use email proof creates a scoped secure session; reuse, foreign application/tenant, expiry, revocation and invalid-staff-cookie fallback denied in fixtures. |
| PASS | RFID permits HR/Organization Admin authorization, rejects Hiring Manager/Employee; separate kiosk session needs no HR cookie; foreign tenant, raw card ID, expired/revoked kiosk and demoted authorizer rejected. HTTPS same-origin accepted; cross-origin rejected. |
| PARTIAL | Local compiled production server with simulated Preview authority: **13/14 HTTP checks passed**. Public platform login, platform/HR/ESS redirects, invalid-cookie denial, kiosk authorization UI, 401/403 kiosk API denials, cross-origin rejection, registration page, cancelled OAuth callback and unknown-host rejection passed. |
| FAIL | **`GET /saga/login` returned HTTP 500** in that production-mode simulation. The exact application exception was not retained in the first run; the single follow-up diagnostic was blocked by `PrismaClientInitializationError`. Do not infer that the database caused the original 500. Root cause remains unresolved; no further retry was attempted after that blocker. |
| BLOCKED | Actual hosted Vercel hostname, TLS/browser cookie persistence, deployment protection, remote Preview variables and hosted successful login/logout could not be verified: no `.vercel/project.json`, connected Vercel tools, or actual Preview URL was available. A URL was requested during the sprint. |
| BLOCKED | Development has **zero active Platform Administrators**. Platform fixture authentication passes, but real Platform Admin login needs an operator-provisioned development-only account. No account was created. |
| BLOCKED BY DESIGN | New company registration/manual workspace provisioning is rejected with `SETUP_REQUIRED` on temporary `*.vercel.app` hosting. `/register` rendering 200 does not establish successful registration. Existing SAGA path access and new company onboarding are different capabilities. |
| BLOCKED | Real verification email delivery, Google consent/token exchange and private hosted document storage were not exercised. Remote sender, Google Console and Blob configuration were unavailable. Local credential-presence flags are not delivery/authorization evidence. |
| PASS | All **11 protected authentication/attendance table fingerprints** and six protected environment/recovery/schema file hashes were unchanged across the HTTP run. The connection enforced database read-only mode. |
| PASS | Focused ESLint for both new scripts. No full regression suites, database migrations or new build were run; HTTP tests use the previously completed local production build. |

Evidence: `focused-tests.json`, `read-only-preflight.json`, `local-http.json`,
and `diagnostic-blocker.json`.

## Preview hostname and routing contract

For a selected stable Preview alias, configure `PLATFORM_ROOT_DOMAIN` as its exact
hostname only and `PLATFORM_PUBLIC_ORIGIN` as its matching HTTPS origin with no
application path. The source does **not** automatically substitute `VERCEL_URL`.
Another generated deployment URL/alias is not automatically trusted: mismatched
hosts fail closed. Do not weaken Host validation to accept arbitrary `vercel.app`.

On the matching temporary Vercel hostname, SAGA is `/saga`, sign-in is
`/saga/login`, HR is `/saga/dashboard`, ESS is `/saga/employee` and the kiosk is
`/saga/attendance-kiosk`. The database organization slug remains `st-aloysius`.
Workspace discovery is `/workspace-discovery`. Temporary routing supports SAGA,
not arbitrary new workspace paths or automatic wildcard subdomains.

Platform routes are public-origin `/platform` and `/platform/login`, outside
tenant rewrites. Registration uses the canonical public origin. OAuth start and
callback also require that exact canonical public host, outside tenant context.

Production-mode staff, platform, candidate and kiosk cookies use separate
`__Host-workpulse_*` names, `Secure`, `HttpOnly`, path `/` and no `Domain`.
They are host-only: changing Preview aliases does not carry a browser session.
The SAGA path cookie is a routing hint, not an authentication credential.
The server validates actual Host, forwarded-host agreement and a signed,
short-lived internal tenant context; caller-supplied internal context is replaced.
TLS termination/header preservation still needs a real Vercel smoke test.

The local HTTP harness initially had two independently identified transport
problems: Node 24 `fetch` ignored the supplied Host, and NextURL normalized
127.0.0.1 to localhost, turning the mismatched loopback rewrite into an external
request. Raw HTTP plus consistent localhost startup and the HTTPS forwarded
protocol corrected the harness. These were **test harness fixes**, not application
fixes. The earlier harness results are retained separately. The final login 500
is not explained away by those corrected transport issues.

## Existing security findings: current state

| Finding | Current source/test evidence |
| --- | --- |
| JWT-only stale role/workspace authorization | Previously fixed: shared session boundary re-reads the persisted user and rejects role/membership changes and request-tenant mismatch. Rechecked in this sprint. |
| Candidate documents accessible by application ID alone | Previously fixed: current candidate access requires a hashed, delivered one-use verification proof and a scoped expiring/revocable session. Document handlers call that boundary and reject invalid staff-cookie fallback. Older profile-security reports describing ID-only access predate the candidate-identity fix. This sprint does not repeat full document HTTP suites. |
| Spoofed tenant/forwarded headers | Previously fixed: configured Host validation, forwarded agreement, persisted organization lookup and signed request context. Focused assertions rechecked these boundaries. |
| Platform and kiosk session revocation | Implemented: server-backed sessions, expiry and role/administrator checks; platform logout revokes its stored token. Current focused tests pass. |
| Staff login brute-force protection | **Unresolved:** `src/lib/auth/actions.ts` has no persistent attempt budget/throttle. Platform login, candidate link issuance and RFID have separate controls; those do not protect staff password login. No Vercel WAF policy was inspected, so external mitigation cannot be assumed. |
| Staff logout/password-change revocation | **Unresolved design limitation:** logout deletes the browser JWT but has no server-side JWT revocation. A copied unexpired JWT remains valid while persisted role and membership match; the focused test confirms this. Session lifetime is seven days. Password changes alone are not checked by the shared JWT boundary. ESS account disablement is separately checked by ESS guards. |
| Full authentication production readiness | **Not established.** Hosted paths, successful real mailbox/Google flows, and the local login 500 remain unverified/unresolved. |

## Vercel Preview environment variables

Set these in the **Preview environment**, optionally scoped to
`employee-ui-design`; do not bulk-import the local `.env`. The local default
database URL is the protected original endpoint, whereas the recovery development
profile targets a distinct endpoint. Neither file was modified or copied.

| Name | Purpose / requirement |
| --- | --- |
| `DATABASE_URL` | Pooled Neon connection to the explicitly verified **development/test** branch only; never the protected original/production endpoint. The runtime datasource uses this variable. Use an already migrated test branch; build/start must not run migrations. The read-only audit URL is for auditing, not functional Preview writes. |
| `SESSION_SECRET` | Stable server-only secret, at least 32 characters, for staff JWTs, internal routing signatures and RFID card HMACs. Use a deliberately managed test secret. Existing development RFID cards require the matching enrollment key; do not silently rotate it. Alternatively enroll isolated fixtures under a separate Preview key. |
| `PLATFORM_ROOT_DOMAIN` | Exact selected Preview hostname, without scheme, port or path. |
| `PLATFORM_PUBLIC_ORIGIN` | Matching canonical HTTPS origin, without `/saga`; used for verification links and OAuth callback construction. |
| `GOOGLE_EMAIL_CLIENT_ID` | Web-application OAuth client for the test Google project, if Gmail integration is in scope. |
| `GOOGLE_EMAIL_CLIENT_SECRET` | Server-only secret for that OAuth client. |
| `EMAIL_OAUTH_ENCRYPTION_KEY` | Stable, independent 32-byte key in canonical standard base64 for stored Gmail tokens and OAuth proofs; required with Google credentials. Existing encrypted test grants require their matching key. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Authenticated platform test sender for company verification and account invitations. Use a controlled test mailbox/transport. Configure a coherent set; presence is not verified delivery. |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Alternative legacy Gmail SMTP transport. These take precedence over generic SMTP credentials; avoid stale conflicting values. They are separate from Gmail OAuth. |
| `BLOB_READ_WRITE_TOKEN` | Private **test** Blob store for applicant/employee documents on Vercel. Required for document journeys, not basic password-session verification. Local `storage/` files are not durable Vercel storage. Missing in inspected local configuration; remote configuration unknown. |

`VERCEL`, `VERCEL_ENV` and `VERCEL_URL` are platform-provided context, not secrets
to copy from recovery. Do not override Vercel's environment with recovery defaults.
`H10_TEST_DATABASE_URL` is test-tool configuration, not the runtime datasource;
`DIRECT_URL` is not referenced by the current Prisma datasource. None of these
credentials should be `NEXT_PUBLIC_*`. No new secret variable is introduced here.

Vercel supports separately scoped Preview variables, and generated deployment
URLs differ from branch aliases. Select the intended stable alias explicitly;
remote values were not inspected. [Vercel environment variables](https://vercel.com/docs/environment-variables),
[generated URLs](https://vercel.com/docs/deployments/generated-urls).

## Google and verification requirements

Google/Gmail OAuth connects an organization's **sender**; it does not implement
staff, ESS, candidate or Platform Admin "Sign in with Google".

Register the exact callback
`https://<selected-preview-host>/api/email-integration/google/callback` in the
Google Web application's authorized redirect URIs. It must not include `/saga`.
Gmail API must be enabled; request only `openid`, `email` and `gmail.send`.
Add the controlled Gmail/Workspace accounts to the OAuth consent test-user list
when the external application is in Testing. Google requires an exact redirect
match; its Testing refresh tokens with Gmail scopes ordinarily expire in seven
days. No live Google Console settings or token exchange were inspected.
[Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server),
[Testing refresh-token expiry](https://developers.google.com/identity/protocols/oauth2).

Current OAuth source binds state to an actor, organization, browser proofs,
generation, ten-minute expiry and PKCE; secrets are encrypted with organization
context. Configuration/PKCE scope construction passed this sprint's focused
tests; successful provider consent and the complete callback exchange did not.

Company registration requires the browser proof, unexpired hashed email token,
successful delivery and supported workspace hosting before provisioning. The
Preview-host rejection and malformed verification were tested. Successful new
company verification is intentionally unavailable on temporary Vercel path hosting;
it requires a configured custom root with functioning tenant subdomains. Applicant
verification separately requires a working organization recruitment sender.

## Exact next blockers

1. Obtain the intended Preview URL/project access and inspect its Preview-scoped
   variables, selected test database endpoint and deployment-protection settings.
   No remote deployment or environment modification was attempted.
2. Resolve and retest the local production-mode SAGA login 500. The subsequent
   connection initialization failure prevented collecting its server exception;
   no cause has been asserted or speculative application patch made.
3. Provision a development-only Platform Admin if Platform Admin testing is
   required. Zero active administrators currently exist; tenant HR credentials
   cannot substitute for a Platform Admin.
4. Supply controlled test sender/Google callback configuration for email journeys,
   and private test Blob configuration for document journeys. Test actual delivery,
   consent, browser cookie persistence and hosted login/logout after deployment.
5. If new workspace registration is part of Preview acceptance, use supported
   custom-domain tenant hosting. A temporary SAGA Preview alias cannot satisfy it.

Staff login throttling and copied-JWT revocation remain explicit security findings
for follow-up. This sprint is **not authentication production sign-off**.
