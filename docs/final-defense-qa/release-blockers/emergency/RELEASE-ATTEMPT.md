# Emergency production release attempt — 2026-11-02

**Outcome: BLOCKED in Phase 1; NO-GO.** The user authorized the operational release subject to the mandatory database-identity, recovery and compatibility gates. This is no longer an authorization blocker. The unresolved safety boundary is the **active Vercel deployment's actual captured Neon database connection**.

## Verified progress

- Exact production domain resolves to project `work-pulse` / `prj_O3lYRwFRzfShyGDhCzek5v0gW4pr`, team `team_UJrtsVOW9iHGOJYrMtflRVU2`, READY deployment `dpl_G2xJzwCrDAxQaLPynEmLucZKDHTZ`, SHA `b24616ba92294018da82341b2f3e8d3a35c69f32`.
- General Preview access to production database, Gmail, session and AI credentials has been removed. Blob is now scoped to Production/Development. The old `employee-ui-design` Preview-only database override remains; no general Preview production DB default remains. These scope edits preceded this attempt and were not made by the agent.
- Provider evidence confirms review deployment `dpl_HDYQwemwJXAR52dPFjJUQGePGuCf`, branch `review/release-freeze-smoke-20261102`, SHA `dea272ea75b6f4bf81b69980ae84a9fe14f02a96`, was CANCELED with the ignored-build-step documentation reference. The latest project deployment is this canceled review, **not** the currently serving production deployment. Exact effective ignored-build command remains unavailable in the connector's reduced project metadata; CLI readback still needs authentication.
- Read-only SQL on the intended Neon target confirms project `late-block-61364102`, branch `br-hidden-violet-azjl3vam`, endpoint `ep-weathered-mouse-azpx765h`, database `neondb`, **38 successful migrations and zero unresolved migrations**. This provider connection does not establish Vercel's active binding.
- Pending migration byte hashes still match the successful rehearsal exactly: 39 `03544310cff45c2014a32aeaf2874239f1f3c00c1a744c4307b6cd29cfa133c9`; 40 `8274df43cf0f6af94c39f77aaae7193b60cb6d3ac0f66bd5d4729b98f9be1c23`. Both are additive. The previous exact-deployed-client seven-check compatibility result remains applicable because the active SHA and migration artifacts have not changed. The completed 38 → 39 → 40 rehearsal was not repeated.
- Reviewed current tracked changes and security/profile/recovery/notification code. Baseline preservation still passes: 2,195 of 2,200 files byte-identical, five previously intended edits, zero unexpected edits. Local environment checks passed 35 assertions; the existing singleton suite passed 13. No statutory calculation or legal verification date changed.
- Actual Chrome read-only baseline: existing live `/saga/login` renders a password input. No login attempt, form submission, employee lookup or business mutation occurred. [Result](browser-baseline.json). This is **not** a new-feature test.
- Remote `origin/main` still equals local HEAD `b24616ba92294018da82341b2f3e8d3a35c69f32`.

## Concrete blocking evidence

The Vercel connector's protected DATABASE_URL read returns only metadata, with **no readable value**. The active deployed SHA predates the new runtime identity instrumentation. A scoped runtime-log query returned no matching database-identity entries; the preceding wider query was rejected by log retention and was not treated as an empty successful result. No safe existing runtime SQL endpoint exists.

Vercel CLI was absent. Installed **65.9.0** under ignored `node_modules/.cache/workpulse-release/vercel-cli`, leaving application dependencies/package files untouched. `whoami --format json` returned `loggedIn:false`, `linkedProject:null`. Exact-project inspection started Vercel's device authentication flow and is still waiting for owner authentication at reporting. No Vercel credential was requested in chat, read from a secret file or printed.

**Required next action:** complete the pending Vercel device login presented in the conversation, or run:

```powershell
node node_modules/.cache/workpulse-release/vercel-cli/node_modules/vercel/dist/vc.js login
```

Then obtain IDs-only server-side evidence bound to the actual production environment. Do not substitute local DATABASE_URL, current environment metadata, a provider SQL Editor session or a matching branch name. If the existing deployment cannot execute diagnostics, use an explicitly controlled schema-compatible diagnostic baseline with production credentials and verified no-domain staging, preserve the working domain, and clearly distinguish a new runtime baseline from proof about the old deployment. Do not deploy the schema-dependent release merely to discover its database.

This missing binding is a concrete safety blocker: proceeding could migrate an unused branch and activate code against a different 38-migration database, breaking authentication and account security. The user explicitly requires identity proof before production migration.

## Preparatory production configuration performed

Added and independently read back four **Production-only, non-secret expected identity pins**, required by the already implemented fail-closed application guard:

| Key | Value |
|---|---|
| `WORKPULSE_DB_PROJECT_ID` | `late-block-61364102` |
| `WORKPULSE_DB_BRANCH_ID` | `br-hidden-violet-azjl3vam` |
| `WORKPULSE_DB_ENDPOINT_ID` | `ep-weathered-mouse-azpx765h` |
| `WORKPULSE_DB_DATABASE` | `neondb` |

These pins specify the intended target; they do not prove the active runtime target. They apply to future deployments. Existing deployed code does not reference them. No connection string, SMTP credential, session secret, protection policy, domain, build-freeze setting or deployment was changed by this attempt. [IDs-only operational evidence](attempt.json).

## Recovery status

Only the existing October 25 manual snapshot was returned by the provider. It was **not** accepted as a fresh pre-migration recovery point. No new snapshot/restore or production migration was performed before the runtime-identity gate. After binding is verified, create a fresh named snapshot from that exact branch, read back source/LSN/time/retention, restore to a separate target, verify catalog/history and complete original-column fingerprints, and keep messaging disabled. Never test restoration over production. The earlier rehearsal/backup plan remains the recovery procedure; no failed migration needs repair in this attempt.

## Required result status

| Required result | Actual status |
|---|---|
| Production migrations | **38/40; migrations 39/40 NOT ATTEMPTED**, gated before writes. |
| GitHub main | `b24616ba92294018da82341b2f3e8d3a35c69f32`; **no release commit or push**. |
| Vercel Production | Existing `dpl_G2xJzwCrDAxQaLPynEmLucZKDHTZ`, **READY, unchanged**; no new staged release or promotion. |
| Live URL | https://work-pulse-omega.vercel.app |
| New live features | **NOT DEPLOYED / NOT VERIFIED** in this attempt. |
| Browser tests | Existing public login baseline PASS; authenticated release/new-feature tests NOT RUN. |
| Email tests | **BLOCKED:** no approved controlled receiving-inbox/test-account access confirmed. Zero external email attempts. No SMTP acceptance was relabeled as inbox delivery. |
| Preservation | No production business writes, database resets/seeds, attendance changes, real payroll generation, historical edits or real-employee test messages. |

Owner-controlled test identities are still needed for authenticated stage/live tests. Use only established approved synthetic accounts or normal approved application setup, never seed production tables or manufacture mailbox verification history. If inbox access remains absent, report recovery/alert email deliverability as unverified as requested; do not claim it passed.

After authentication and runtime proof, continue the user's authorized sequence: fresh verified recovery → exact supported Prisma migration39 → stage39 verification → migration40 → complete preservation/postflight and old-app health → reviewed commit to main → ordinary push and remote SHA verification with freeze retained → supported staged Production deployment of that SHA without domain assignment → controlled stage tests → promotion → actual live browser tests → restore normal Git behavior only after health. The local `vercel.json` currently disables Git deployments; account for that file as well as the ignored-build setting when preparing the final reviewed release configuration. Do not claim normal deployment behavior is restored merely by clearing one of the two controls.
