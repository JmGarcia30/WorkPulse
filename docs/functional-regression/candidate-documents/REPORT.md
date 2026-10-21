> October 21 follow-up: CD-01 and CD-05 are now implemented and tested. See the [candidate identity security implementation](../candidate-identity/REPORT.md). The findings below preserve the earlier audit state.

# WorkPulse — Candidate document authorization review

October 21, 2026. **HOLD MERGE. Candidate-document authorization is not secure across all identified paths.** Established staff/tenant/file-state restrictions were corrected and tested. Critical candidate ownership and credential-lifetime decisions remain unanswered; no new candidate authentication architecture or product permissions were invented.

## 1. Access paths discovered

| Path | Storage/data access and existing boundary |
|---|---|
| Public `submitApplicationAction` in `src/features/careers/actions.ts` | Accepts an optional PDF/DOCX resume for a published, open job with careers enabled; creates an application-linked `Document`; mirrors its private key into the resume recruitment requirement. It also reuses/updates a shared Applicant by caller-supplied email. No candidate identity verification. |
| Candidate portal page and `generateMetadata` | Both call exported Server Action `getCandidatePortalData(slug, applicationId)`. Returns applicant identity, requirements, onboarding and hiring summaries. The page includes candidate identity in its title. Matching IDs are currently the only candidate credential. |
| Candidate recruitment upload | `submitCandidateRecruitmentDocumentAction`: IDs must agree across document/application/organization; uploads/replaces the requirement file. No verified candidate identity. |
| Candidate onboarding upload | `submitCandidateOnboardingDocumentAction`: task/process/application/organization IDs must agree. No verified candidate identity. |
| Staff recruitment actions | Initialize requirements, upload/replace, verify, reject and change requirement status. Same-organization ownership predicate plus existing `canManageRecruitmentDocuments`. |
| Staff onboarding actions | Initialize/synchronize requirements, upload/replace, review status, add tasks and complete onboarding. Existing Organization/HR Admin permissions and application-to-job organization predicates. Copying recruitment files into onboarding is scoped to the same application. |
| Resume parsing action | `parseResumeAction` reads private bytes and stores extraction/AI results. Organization/HR Admin only, with application/job organization verification. |
| GET `/api/resumes/[id]` | Original resume preview/download. Current staff role, request tenant and document/application organization checks. No candidate fallback. |
| GET `/api/recruitment-documents/[id]` | Staff download, or existing candidate fallback using `?appId=`. Current staff, matching request tenant and ownership relationships checked; candidate identity remains unverified. |
| GET `/api/onboarding-documents/[id]` | Same pattern through Task → Process → Application → Job → Organization. |
| Recruitment UI | `CandidateDocumentsSection`, `ApplicantDocumentsTab`, `ResumePreviewModal`, onboarding sections/upload/review dialogs all use these same-origin API handlers. The PDF iframe does not use an external document viewer. |
| Candidate UI | `CandidatePortalClient` uses the two candidate upload actions and the `?appId=` download URLs. Its upload controls already excluded verified/waived requirements and non-document tasks; server checks were missing. |
| Local storage | `storage/resumes`, outside `public`; generated storage keys. Raw local file URLs returned 404 in tests. No public raw-key route was found. Aggregate recovery metadata contains zero URL-based keys across 42 file references; no real keys/filenames were logged. |
| Hosted storage | `vercelBlobStorageProvider` calls private `put`/`get`, returning a pathname rather than a public URL. API handlers stream bytes; they do not issue signed download URLs or redirect to Blob URLs. SDK contract was tested with controlled dependencies; live hosted access was not exercised. |

Original resumes, recruitment requirements and onboarding tasks can reference the same private file after submission/synchronization. Authorization therefore must cover every handler referencing a key. No document deletion action/UI or candidate user role exists. The actual Prisma roles are ORGANIZATION_ADMIN, HR_ADMIN, HIRING_MANAGER and EMPLOYEE.

## 2. Established permissions and unresolved policy

All staff permissions below are limited to the authenticated user's organization and the request tenant. **Same-organization access is organization-wide:** the implemented predicates do not limit a Hiring Manager to assigned jobs or candidates. No narrower assignment permission was invented.

| Principal / resource | Upload | Preview/download | Update/replace/review | Delete | After application status changes |
|---|---|---|---|---|---|
| Organization Admin / recruitment requirement | Yes | Yes | Yes | No implemented operation | Existing staff access has no application-status cutoff |
| HR Admin / recruitment requirement | Yes | Yes | Yes | No implemented operation | Same |
| Hiring Manager / recruitment requirement | Yes | Yes | Yes, including verify/reject | No implemented operation | Same |
| Organization Admin or HR Admin / onboarding document | Yes | Yes | Yes; existing task transition rules retained | No implemented operation | No application-status cutoff in existing staff action gates |
| Hiring Manager / onboarding document | No | Yes | No upload/review | No implemented operation | Read permission retained |
| Three back-office roles / original resume | No separate staff original-resume upload action | Yes | No separate replacement action; parsing is Organization/HR Admin only | No implemented operation | Read permission retained |
| Employee / staff document paths | No | No | No | No | No |
| New public applicant / initial resume | Yes, during published/open-job application | No original-resume download grant | No existing-original-resume mutation feature | No | Initial submission only |
| Candidate / own recruitment requirements | Intended own-application upload | Intended own-file access | UI-established replacement only while not VERIFIED/NOT_APPLICABLE; now enforced server-side | No | Identity proof, expiry and rejected/withdrawn retention are unspecified |
| Candidate / own onboarding document tasks | Intended own-application upload | Intended own-file access | DOCUMENT tasks only; not VERIFIED/WAIVED; now enforced server-side | No | Post-hire onboarding access is explicitly part of the existing workflow; later retention/expiry unspecified |
| Other candidate / another application | No intended grant | No intended grant | No intended grant | No | **Cannot enforce ownership securely with the current ID-only mechanism** |

Tests verified staff reads in all nine actual application statuses: APPLIED, SCREENING, SHORTLISTED, INTERVIEW, ASSESSMENT, OFFER, HIRED, REJECTED and WITHDRAWN. This does not certify every write in every state. Staff writes retain existing status/role rules. Candidate lifetime or terminal-state cutoffs cannot be inferred merely from the absence of checks.

**Decision requested before implementing candidate credential changes:**

1. How must an individual prove ownership of a specific application: an application-bound verified session or an authenticated, expiring emailed grant?
2. What are the grant lifetime, renewal/lost-link procedure, revocation policy and treatment of existing identifier-only portal/email URLs?
3. When should candidate access end after rejection, withdrawal or completed onboarding, while preserving the implemented hired-candidate onboarding workflow?
4. Must email ownership be verified before reusing or changing an existing shared Applicant identity during a new application?

The repository has no candidate login, independent candidate token, grant version, expiry or documented resolution for these decisions. The question was raised during the session; no answer was received. Guessing a credential lifetime or disabling an existing candidate workflow would invent policy. The owner-verification portion remains unimplemented and blocks merging.

## 3. Vulnerabilities and reproduction

### CD-01 — Unverified candidate ownership: HIGH, OPEN

Using only synthetic IDs and no staff/candidate session:

1. Supply a valid application ID to its portal data Server Action; applicant identity is returned.
2. Pair that application ID with a recruitment document or onboarding task ID in the download URL; HTTP 200 returns private file bytes.
3. Pair the same IDs and organization slug in a candidate upload Server Action; a permitted requirement changes to SUBMITTED with the uploaded file.

These behaviors remain reproducible after the scoped fixes. Matching related IDs prevents inconsistent object combinations but does not prove that the caller owns them. An Employee's direct staff API request is denied, but a caller can omit its staff cookie and use the ID-only candidate path. There is no expiry or per-candidate revocation. Candidate page/metadata, exported data action, both upload actions and both candidate download paths all require the eventual ownership credential.

Evidence: `candidate/open-policy-exposures.json`. These exposure probes are recorded as **open security failures**, not successful authorization restrictions. `candidate-result.json` explicitly sets `secureAcrossAllPaths: false`.

### CD-02 — Tenant context not enforced consistently: corrected for reviewed document paths

Previously, staff document mutations checked the user's organization but did not validate the request tenant. Candidate actions accepted an arbitrary organization slug; candidate download fallback did not bind IDs to the tenant host. The scoped correction now checks the existing tenant context before these operations. Unknown tenant hosts are denied; the existing platform-host careers routes remain supported. Tests cover wrong tenant staff mutation, candidate mutation, download and portal HTML/metadata, plus an unprovisioned tenant hostname.

### CD-03 — UI-only verified/waived task protection: corrected

Calling candidate upload actions directly could bypass hidden upload controls for VERIFIED/NOT_APPLICABLE recruitment requirements and VERIFIED/WAIVED or non-DOCUMENT onboarding tasks. Server checks now mirror the existing UI policy. Conditional `updateMany` predicates also prevent a file upload from overwriting a newly protected state; if the row no longer qualifies, the newly uploaded file is removed and an error returned. Genuine independently committed verification/upload races were not exercised.

### CD-04 — Active MIME type accepted via filename fallback: corrected

Candidate validation previously accepted a disallowed explicit MIME type when its extension was allowed, including HTML declared as `text/html` with a `.pdf` filename. Hosted private storage preserves that declared type. The previous inline response trusted the storage type, creating a same-origin active-content risk. No hosted exploit was performed.

Candidate uploads now require both a supported extension and an allowed MIME type. Empty/generic browser types are inferred from the supported extension. All three file handlers allow only supported PDF/Word/raster-image response types; other legacy types become `application/octet-stream` attachments with `nosniff`. Actual handler tests inject HTML/SVG private storage responses and verify safe attachment headers; supported PDF inline previews remain available.

### CD-05 — Shared Applicant changed by unverified reapplication: HIGH, OPEN

With a newly created fixture applicant already associated with organization A, submit a public application to organization B's published fixture job using that applicant's email but a different name/phone. The existing initial-application action finds the Applicant by email and updates its shared identity without proving email ownership. The fixture's persisted first name changed. The new resume remained correctly scoped to organization B's new application and was denied to organization A's staff.

This is a separate confirmed write-authorization gap in an identified upload path. It needs the ownership/email-verification policy above; it was not silently altered or replaced with a new authentication feature. All affected identities/jobs existed only inside the rollback fixture.

## 4. Fixes and exact application files

- `src/features/hiring/document-access.ts`: current staff/request-tenant context, tenant/public-careers distinction and safe response MIME types.
- `src/features/hiring/recruitment-document-actions.ts`: use the tenant-aware staff guard for initialization, upload and review mutations.
- `src/features/hiring/onboarding-actions.ts`: use that guard for onboarding mutations while retaining existing role/transition rules.
- `src/features/hiring/resume-parser-actions.ts`: tenant-aware guard before private resume access.
- `src/features/careers/portal-actions.ts`: tenant checks before portal data or upload reads; server-enforced existing file-state restrictions, conditional writes and MIME validation.
- `src/app/api/resumes/[id]/route.ts`, `src/app/api/recruitment-documents/[id]/route.ts`, `src/app/api/onboarding-documents/[id]/route.ts`: safe no-store/nosniff preview/download types, generic missing-storage 404s; candidate handlers enforce request-host scope and reject missing appId before document lookup.

Test tooling: `scripts/test-candidate-document-http.cjs`, `scripts/test-candidate-document-headers.cjs`, plus scoped modes/evidence directories in `scripts/profile-security.cjs` and `scripts/functional-rollback-browser.cjs`. Existing Profile security test semantics were preserved. No user-facing interface redesign, schema/migration, authentication-token format, or attendance/payroll calculation change was made.

## 5. Validation evidence

- Final document matrix: **66 passing guard/functional assertions**, including actual HTTP bodies/statuses/headers, multipart Server Actions, persisted upload/review/status results, a real browser replacement upload and exact downloaded bytes. **Six ownership exposure findings remain open**, independently recorded rather than counted as security passes.
- FR-02 existing security matrix: **71 scenarios passed** on the final production build; Profile stale-role bodies, RSC/prefetch, role/membership removal, invalid/expired tokens, tenant checks and denied lifecycle action remain covered.
- Original session unit suite: passed during this review.
- Existing H1 recruitment-to-employee integration: **22 assertions plus Profile parity passed** in the no-DDL rollback adapter.
- Existing H4/H7 ESS authorization and H8 Dashboard/Analytics: passed; H8 reported **48 assertions**. Targeted Hiring, payroll-feedback and startup suites passed.
- Existing full browser workflow suite: **45 scenarios passed on the final production build**, including Profile, Hiring, Dashboard, ESS and payroll feedback.
- Deleted/inaccessible ownership checks: **four scenarios passed**, including normal fixture login, a deleted requirement, an orphan resume without an application, and a task without a file. These checks deleted only a newly created rollback fixture record.
- Actual route/private-storage controlled tests: passed for HTML/SVG attachment containment, PDF preview, no-store/nosniff, missing storage, private Blob upload/read options, unknown tenant denial and public-careers compatibility. No live Blob SDK network call or external email delivery occurred.
- TypeScript, changed-file ESLint, Prisma validation and final production build: passed. Production build elapsed **65,988 ms**, local webpack mode. No deployment timing claim.

Evidence is under this directory: `summary.json`, `candidate/`, `deleted/`, `http/`, `browser/`, `document-headers.json`, `storage-metadata.json`, `recruitment-core.json`, `test-*.json`, `session-unit.json`, `typescript.json`, `eslint.json`, `prisma.json`, `build.json`, `diff-check.json`, and `integrity-summary.json`.

Initial candidate browser harness attempts stopped because an already-uploaded requirement exposes its file input only after opening the replacement menu. The final test opens that real menu and uses Chrome's native file input. Those earlier attempts were not reported as application passes or application regressions.

## 6. Safety and coverage limits

Only the verified local recovery database was used. The existing local Git branch remained `main`; no branch switch occurred. Synthetic organizations, users, applications and document writes run inside rollback transactions; nested service transactions are serialized savepoints. Only this run's individually identified new local files were removed. Final fingerprints match across **all 50 application tables**, namespaces, catalog definitions, migration history and the original `.env`. Final HTTP, candidate, deleted-resource and browser cleanup records confirm zero remaining fixture organizations. No push, merge or deployment occurred.

Aggregate metadata also found **nine of twelve existing original Document rows have no application association**. The handler fails closed for those rows; the isolated orphan-resume test verifies that behavior. No existing ownership associations were guessed or repaired. Historical accessibility therefore needs a separate approved data/ownership review; these records were neither deleted nor exposed.

Not certified: authenticated candidate ownership (no mechanism/policy yet), lifetime/revocation and terminal-state retention, every write in every application state, real independent commits/races, hosted Blob delivery/legacy public assets, end-to-end email-link issuance/recovery, live AI parsing, malware/content scanning or every document format's native browser viewer. The legacy recruitment scripts target named seeded applicants and mutate their files; they were not run against existing user data. Equivalent scoped action/readiness assertions and the existing isolated H1 suite were executed instead.

The new conditional state predicates are not a substitute for independent-transaction concurrency testing. Private SDK options alone do not establish that every historical hosted asset is private. Existing file URLs cannot retroactively erase data already received by authorized clients.

## 7. Recruitment impact

Legitimate staff upload/review/download and PDF preview behavior is preserved. Same-organization access across candidates remains permitted for the existing three back-office roles; onboarding mutation remains HR/Admin-only. Public application resume upload still works, and stored resumes remain organization-scoped. Wrong tenant contexts, verified/waived candidate replacements, non-document task uploads and explicit active MIME uploads now return safe errors. Missing file objects return generic 404 rather than storage-path-bearing errors.

Existing optimization and FR-02 corrections remain present. No further performance optimization or controlled navigation benchmark was performed. Current-permission and tenant checks may add authorization reads to formerly JWT-only mutation paths; no latency improvement is claimed.

## 8. Merge recommendation

**HOLD MERGE.** The scoped corrections and executed regressions do not resolve candidate ownership. Both ID-only private access and unverified shared-identity mutation are demonstrated high-severity risks. Establish the explicit candidate/email-ownership credential and lifecycle policy, implement it at every identified portal/action/download path, and rerun the exposure probes as denial tests before reconsidering merge readiness. Prior functional/concurrency/external-service coverage gaps also remain.
