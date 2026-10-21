# WorkPulse — Profile authorization security follow-up

October 21, 2026. **FR-02 is fixed and retested. Overall merge recommendation remains HOLD**, pending review of the separate candidate-document access policy and the previously recorded functional coverage gaps.

## Confirmed root cause and attribution

Normal password login issues an HS256 JWT with a seven-day expiry and role/organization claims. Previously, `getSession()` verified the signature and expiry but treated those issuance-time claims as current authorization. Profile checked that role and loaded employee relations before any persisted permission check in its own execution path.

The parent Dashboard layout did validate persisted membership and reject a changed role. However, Next.js renders layout and page segments independently. The redirect did not stop the child Profile data from being serialized into the HTML/RSC payload. Thus **HTTP 307 was not evidence of confidentiality**. This was an authorization-order problem involving stale claims and independent server rendering; no signature forgery was involved.

Request caching was not the cause: the reproduction changed the persisted role, then made a new HTTP request using the same cookie. Profile reads have no global authenticated-data cache. React `cache` is scoped to the current render.

The exact reproduction was rerun against an isolated production build of the entire unchanged commit `ea1fc23b5efe1fefa27c87d77fd6d6e4712525ec`, before the final UX sprint's working-tree changes. It also returned **307 with employee identity in the body**. Therefore the final UX selective reads and loading boundary did not introduce the disclosure. This comparison does not establish its origin before the earlier optimization batches.

Evidence: `before-stale-role-profile.json`, `baseline-source.json`, `baseline-build.json`, `baseline/stale-role-profile.json`, `baseline-http.json`. The baseline negative test exits 1 because it correctly detects the old vulnerability; it is not counted as a passing authorization test.

## Security correction

- After cryptographic validation, `getSession()` reads the persisted user and rejects missing users or role/organization mismatches. Unchanged sessions remain valid. Current name/email come from the persisted user. Database failures propagate rather than silently becoming anonymous access.
- The persisted lookup uses React render-scoped memoization. The existing back-office guard consumes this verified session and retains its request-tenant and allowed-role checks, without a second user lookup.
- Profile calls the tenant-aware back-office guard before reading parameters into a protected query, loading employee data, or rendering employee components. Its employee-specific role check remains in place. Expected authorization failures redirect on the server; unexpected failures still propagate.
- Resume downloads use the same current-permission/tenant guard before document reads. Recruitment/onboarding downloads validate staff access before their document reads and reject a present but invalid staff cookie before candidate fallback. Successful file responses use `private, no-store` instead of an hour of browser caching.
- No JWT format, session secret, schema, migration, attendance/payroll calculation, or unrelated UI change was required. No blanket session invalidation was performed.

Policy is preserved: a role or organization change requires fresh login for the changed claims. If the original role/organization is restored, an otherwise valid old token with those same claims becomes valid again. There is no role-version field or per-token revocation registry. Logout removes the browser cookie; it does not blacklist copied JWTs. Disabled ESS accounts remain protected by the existing persisted account/employee checks.

## Exact source and test files changed

Application files for this security follow-up:

1. `src/lib/auth/session.ts`
2. `src/lib/auth/guards.ts`
3. `src/app/(dashboard)/dashboard/employees/[employeeId]/page.tsx`
4. `src/app/api/resumes/[id]/route.ts`
5. `src/app/api/recruitment-documents/[id]/route.ts`
6. `src/app/api/onboarding-documents/[id]/route.ts`

Test tooling:

1. `scripts/profile-security.cjs` — verified recovery configuration, isolated baseline build and validation runner.
2. `scripts/test-profile-session.cjs` — actual session module with controlled request/database dependencies.
3. `scripts/test-profile-security-http.cjs` — real production HTTP, body/header/status and persisted-state assertions.
4. `scripts/functional-rollback-browser.cjs` — security modes, separate evidence directories and read instrumentation; original functional mode retained.

Documentation: this report, parent `REPORT.md`, `FINDINGS.json`, `preexisting-authorization-pattern.json`, and sanitized evidence under `profile-security/`. All pre-existing optimization and UI changes were preserved.

## Executed evidence

| Check | Executed result |
|---|---|
| Original stale-admin reproduction on the vulnerable local build | Disclosure reproduced: 307 with fixture identity |
| Unchanged pre-final-UX commit build and HTTP replay | Build passed; same disclosure reproduced |
| Final production HTTP security matrix | **PASS, 71 scenarios**, including real password login and 70 HTTP response assertions |
| Six Profile tabs, authorized administrator | HTML and RSC 200; identity/data present; loading shell present in all 12 responses |
| Same old JWT after persisted administrator downgrade | All six tabs denied in HTML and RSC; 307 HTML / 200 RSC redirect payloads; **zero tested sensitive markers and zero protected employee delegate calls across all 12 responses** |
| Prefetch and related routes with stale JWT | Denied without fixture employee fields; Directory, Attendance detail, Dashboard, Hiring pipeline and applicant detail exercised |
| Real lifecycle Server Action POST with stale JWT | HTTP 200 containing unauthorized action result; no sensitive markers, zero protected employee delegate calls and zero decision records |
| Current Hiring Manager | Profile denied; Hiring pipeline allowed |
| Role changed to HR Admin | Old administrator token denied; fresh HR Admin claims allowed |
| Expired, malformed, invalid-signature and invalid-claim tokens | HTML/RSC denial without protected data; invalid-token unit cases do not query the user table |
| Membership revocation supported by existing model | Same token works for an isolated user before deletion and is denied after deleting that fixture user; nonexistent-user token also denied |
| Organization transfer / foreign tenant host | Old membership rejected; Profile denied before protected reads on foreign host |
| Foreign organization's employee ID | No foreign identity/email; not-found response/signal in HTML and RSC |
| Three document endpoints | Authorized fixture bytes returned with no-store; stale/invalid staff cookies denied even with matching candidate appId; wrong tenant host denied |
| Missing Profile / recovery | Not-found boundary verified, then valid Profile recovers without stale cached denial |
| Session module | PASS: live identity, role/membership checks, missing user, signature/expiry/types and database-error propagation |
| Full existing browser workflow suite on final build | **PASS, 45 scenarios**, including all Profile tabs, validation and regularization save/history, Hiring stage transition/history and job edit/reload, Dashboard, ESS ownership, payroll pending/exact Decimal completion/repeat protection, login failure/recovery |
| H4/H7 ESS integration rerun | PASS, seven logged groups covering persisted roles/account state/ownership |
| H8 Analytics/Dashboard rerun | PASS, 48 assertions including full role-dependent Dashboard parity |
| Targeted Hiring / payroll feedback / runtime startup | All PASS |
| TypeScript / changed-file ESLint / Prisma validation | All PASS; ESLint exits 0 with one pre-existing unused catch-binding warning in the resume handler; Prisma validation made no schema changes |
| Final production build | PASS, 78,622 ms; local webpack build, not deployment telemetry |
| git diff --check | PASS |

The HTTP matrix checks whole response bodies, selected transport/cache headers and status codes. Denied Profile responses additionally check every response-header value for the protected fixture markers. Tests use manual redirect handling. RSC requests include Next 16's correct header-derived `_rsc` parameter so a framework canonicalization redirect cannot masquerade as an authorization success. Streamed not-found responses can retain HTTP 200 after shell flush; tests require the 404 signal as well as absence of foreign data.

Read instrumentation counts Prisma delegate calls, not total SQL statements. Every authorized Profile response recorded **one** persisted user lookup shared between layout and page. Denied Profile responses recorded no calls to the instrumented protected employee/employment/account delegates. Fixture identities, email, phone, compliance content and application content are checked in memory; raw bodies, passwords, JWTs and database URLs are not saved.

Evidence: `summary.json`, `http/responses.json`, `http/security-result.json`, `http/policy.json`, `session-unit.json`, `browser/browser-scenarios.json`, `browser/browser-result.json`, `test-*.json`, `typescript.json`, `eslint.json`, `prisma.json`, `build.json`, `diff-check.json`.

Initial harness attempts were not application failures or passing runs: RSC requests initially lacked the required cache-busting parameter; the foreign fixture initially omitted required phone/cover-letter fields; and an assertion initially required HTTP 404 rather than accepting the streamed 404 signal. These were corrected before the final successful matrix. A sandbox Windows user-lookup failure required rerunning the TS-loader test with approved execution. The initial isolated baseline locations also encountered Next module-resolution failures before the successful same-drive baseline build. `harness-attempt-last-failure.json` is historical, not the final run result.

## Integrity and safety

Used only the verified `workpulse-batch0-recovery` database. Git remained on the existing local `main` branch; no branch switch, push, merge or deployment occurred. Original `.env` remained byte-identical. All 50 application-table fingerprints match the original functional-test baseline; namespaces, catalog definitions and migration history also match.

HTTP and browser writes use isolated synthetic tenants within rollback transactions; both final cleanup records confirm zero fixture organizations remain. The one uniquely named local test upload is created exclusively and removed individually in `finally`; no existing uploads or user records are deleted. The deliberately deleted user is newly created inside the rollback fixture. Fallback application connections are read-only. No external email/blob/AI side effects were enabled.

The test server's nested transactions use serialized savepoints. These tests do not establish independent committed transactions, races or production concurrency. The unchanged calculation services were not modified.

## Related inspection and remaining security risks

- Proxy performs routing and cookie-presence checks, not current-role authorization. Server-side session/permission checks remain the boundary.
- Employee Directory, Attendance and several Hiring pages/actions consume `getSession()`; they now receive persisted-role/membership validation. Employee conversion/lifecycle services also retain their transaction-scoped persisted actor checks. Dashboard, Analytics, payroll, leave and separation already use current back-office guards; ESS retains its account/ownership guard. The HTTP matrix does not certify every endpoint and mutation in those modules.
- **Candidate-document policy requires review:** with no staff cookie, a matching application ID plus document/task ID returns fixture file bytes from recruitment/onboarding endpoints (HTTP 200). There is no independent candidate session, signature or expiry in these handlers. This is a pre-existing identifier-as-bearer-capability policy, separately recorded in `http/candidate-access-risk.json`; the access behavior is confirmed, but intended security acceptance is not established. The invalid-staff-cookie fallback is fixed. Redesigning candidate authentication is outside this focused correction.
- There is no server-side per-token logout revocation or monotonic role version. Existing current-role/organization checks reject stale grants on subsequent requests, but do not retract data already received by a previously authorized browser. Previously cached document responses cannot be retroactively erased by changing future cache headers.
- Prior gaps remain: independent-transaction concurrency, full recruitment/candidate/external-service journeys, deployment/load behavior and system-wide security certification.

## Navigation/performance effect and merge readiness

Profile selective reads, all six tabs, loading UI, Hiring parallel reads, Dashboard projections and payroll pending feedback remain present and passed the applicable regression checks. Profile still makes one persisted user lookup per tested render, now shared through the session boundary. JWT-only consumers gain a persisted permission check; document handlers also validate the request tenant. No controlled before/after navigation benchmark was performed during this security task, and the fixture timings do not establish a speed improvement or regression. No Vercel measurement was made. Historical attendance/payroll throughput limitations remain unchanged.

**FR-02 is demonstrably resolved for the tested HTML/RSC/prefetch/action paths. Do not merge yet:** review or separately correct the candidate identifier-based document access policy, and address the previously documented functional coverage requirements. Passing these focused tests is not a full-system security or functional sign-off.
