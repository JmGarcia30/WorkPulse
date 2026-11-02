# WorkPulse final-defense production release

## Current outcome — promoted 2026-11-03 Asia/Singapore

The blocker below was diagnosed and resolved under explicit rotation authorization. **Application commit `947a14547c3863f0058750c946271d1118fc29fd` is live on deployment `dpl_5P4nncE8EsMb79aKPGNjaexXF4Hm`.** Both active RFID card assignments and all original production data remain preserved. The hosted session/database/authentication-boundary checks and 11 staged/11 live Chrome checks passed. [Completed fix and remaining controlled-test limitations](../session-key-fix/RESULT.md). The failed-stage records below are retained as historical evidence, not current release status.

## Final checkpoint: staged authentication failure — 2026-11-02

**NO-GO for promotion. Production migration and main push are complete; new IT features are not yet serving on the live domain.**

| Required result | Actual verified result |
|---|---|
| Production migrations | **40/40 PASS**, zero unresolved, both exact rehearsed hashes, no-op repeat, full schema match and all 73 original-table fingerprints preserved. |
| GitHub main | **PUSHED:** `93a1718d774c9bb32661df04dd3ae52abc45efad`, remote SHA independently matched, ordinary push without force. |
| Staged release | `dpl_27wDq5pqiuxptSRigZZamkaghYTS`, exact committed source, Production target, build READY; **runtime FAIL / HTTP 500**. |
| Concrete safety blocker | `WORKPULSE_SESSION_SECRET_REJECTED` from the staged Production runtime. The hosted session-key policy rejects absent/short, public-template and development-only keys. The credential was never exposed; the generic diagnostic does not distinguish those rejected categories. |
| Live deployment preserved | **READY:** `dpl_GEyVH15HCeu243vUbeohkTy6AFcR`, schema-compatible diagnostic baseline from old source SHA `b24616ba92294018da82341b2f3e8d3a35c69f32` plus read-only identity instrumentation. |
| Live URL | https://work-pulse-omega.vercel.app — existing login still renders in Chrome and HTTP after the staging failure. |
| New feature tests | Local 48 safety assertions and isolated 64 routing/security assertions PASS; TypeScript, lint and production build PASS. Authenticated staged/live My Profile, name/password changes, actual fifth-failure events, audit viewer, deletion/archive and business workflows **NOT VERIFIED** because the runtime safety gate failed; approved controlled credentials also remain unavailable. |
| Browser results | Existing live baseline public login PASS in actual Chrome; new-release browser tests NOT RUN past the failed runtime boundary. The prepared read-only browser harness is retained locally. |
| Email results | **BLOCKED / UNVERIFIED:** no approved controlled receiving inbox/account access. Zero external email attempts and no test emails to employees. |
| Deployment controls | Saved project ignored-build command remains `exit 0`; repository `git.deploymentEnabled` remains false. **Not restored** because the new release is not healthy. |

[Staged runtime result](staged-runtime.json) and [push result](push-result.json) record the actual failure/success boundaries. No final release promotion was performed, no guard was bypassed, and no production credential was automatically rotated. The diagnostic baseline promotion happened earlier solely to establish the mandatory live database binding before migration.

**Required owner decision:** authorize replacement of Production `SESSION_SECRET` with a fresh cryptographically random value (at least 32 bytes of entropy), or set it directly through Vercel's secret editor. The earlier user instruction prohibited automatic production secret changes; a replacement also invalidates existing signed staff/platform session cookies and requires sign-in again. Do not paste the credential into chat, logs, command arguments or reports. The current release guard must remain enabled.

Once that credential action is explicitly authorized/completed, restage **the same reviewed commit** with Production environment capture and `--skip-domain`, verify the session/database guards, run protected staged browser/auth checks with approved synthetic accounts, promote only after critical checks pass, verify the live domain, then restore normal Git behavior. Keep the freeze while doing so. Existing source archive is retained under ignored `node_modules/.cache/workpulse-release/release-93a1718d774c`; do not deploy unreviewed local artifacts. The failed stage captured the old secret and must not be promoted after merely editing project settings; create a new deployment that captures the replacement.

The completed additive schema40 does not require rollback for this credential failure. Retain the recovery checkpoint/reconstruction and old deployments. Do not drop security/reset tables, rewrite migration history, restore over production or delete existing records. Final-status edits and later operational evidence are intentionally local after the stop; the already pushed application commit remains the SHA above.

## Migration and recovery completed — 2026-11-02

Production runtime was verified on a schema-compatible diagnostic baseline before migration: project `work-pulse` / `prj_O3lYRwFRzfShyGDhCzek5v0gW4pr`, deployment `dpl_GEyVH15HCeu243vUbeohkTy6AFcR`, canonical domain `work-pulse-omega.vercel.app`, Neon project `late-block-61364102`, branch `br-hidden-violet-azjl3vam`, endpoint `ep-weathered-mouse-azpx765h`, database `neondb`. The original deployment `dpl_G2xJzwCrDAxQaLPynEmLucZKDHTZ` remains retained. This establishes the adopted diagnostic baseline's actual runtime, not the replaced deployment's historical secret value.

Named snapshot creation was rejected because the account snapshot quota was full. No existing backup was removed. A fresh supported branch recovery point was created: `br-withered-forest-azrnxfkw`, pinned to production LSN `0/167645B8`, timestamp `2026-11-02T15:01:30Z`. Independent recovery branch `br-ancient-field-azlcd2u0` reconstructed that checkpoint. Read-only checks verified 38-migration history and all original-column fingerprints for all 73 tables on both recovery branches. Both are retained without expiration and must not be reset/deleted before separately approved cleanup.

Exact rehearsed migrations 39 and 40 were applied sequentially with Prisma 6.19.3, with stage-specific checks. **40/40 successful; zero unresolved migrations; repeat deploy is a no-op.** All 73 original public tables retained exact original-column counts and fingerprints after each stage. Full schema matches the rehearsal: 891 columns, 963 constraints, 288 indexes, 55 non-internal triggers; security-event immutability function verified. New security/reset tables began empty. No production reset, seed, historical employee modification, attendance change or real payroll generation occurred. The known unattached legacy helper was retained after the documented no-current-effect review.

The schema-compatible diagnostic baseline's canonical login still returns HTTP 200 after migration. Production-only non-secret identity pins were added earlier; production credentials remained unchanged. Effective project freeze was read back through authenticated CLI as `exit 0`, Git/main, no deploy hooks. The canceled review-branch deployment remains supporting evidence. The repository Git deployment flag is retained false until release health is confirmed; restoring normal Git behavior requires handling both controls after that point.

## Release candidate verification

Completed Batch 1–3 and IT Evaluation code is preserved. Operational application changes support the **exact provider-assigned hostname of the current Production deployment** so a staged build can be tested before domain assignment, and reject unsafe hosted session keys. Host handling preserves canonical routing, rejects unrelated Vercel hosts, conflicting forwarded headers, nested hosts and ports, and leaves Preview behavior unchanged. It does not introduce wildcard tenant trust or bypass application sessions.

Validation: 48 focused environment/transport/startup/host/session-key checks; existing 64 tenant/auth/security assertions on an isolated schema of the rehearsal clone; TypeScript; targeted ESLint; local production build. Earlier 67 account-security, 26 browser and broader Batch regression results remain preserved evidence. These are not claimed as new live authenticated tests.

The local session key matches the pre-existing public example value. That value is already public and is not a newly exposed credential. The hosted runtime now explicitly rejects the public template, missing/short keys and development-only keys before handling application requests. Production's protected value remains undisclosed; the staged runtime must pass this guard before promotion. No credential was automatically rotated.

This document initially accompanies the reviewed release candidate. A Git push alone is not release success. The required remaining operations are exact-commit push under freeze, staged Production deployment, runtime/HTTP/browser verification, promotion, live checks, and healthy-release restoration of normal Git behavior. Results must be recorded after those operations.

Approved controlled account credentials and external receiving-inbox access have not been supplied. Never use real employee identities for destructive/password/lockout tests, manufacture account verification, or seed production to obtain a test identity. Report authenticated/live email checks as unverified if that access remains unavailable. Existing November payroll statutory-verification limits remain unchanged; do not generate actual November payroll or extend legal verification dates for the defense.
