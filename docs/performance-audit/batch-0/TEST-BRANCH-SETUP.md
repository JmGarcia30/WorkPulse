# WorkPulse Batch 0 — disposable Neon branch setup

## Development startup re-verification (2026-10-25)

`npm run dev` now invokes `scripts/dev-recovery.cjs`, which explicitly selects
`.env.recovery.local` and rejects stale identities or failed schema verification.
In PowerShell with script execution disabled, use `npm.cmd run dev`.
The original setup instructions below describe the earlier migration exercise.

To refresh verification without database writes or migration authorization:

```powershell
node scripts/batch0-recovery-environment.cjs
node scripts/execute-batch0-recovery.cjs verify-startup
npm.cmd run dev
```

The first command checks pooled/direct connections read-only, including live Neon
branch and endpoint IDs when exposed by the server. The branch name comes from
the local profile; confirm its mapping in Neon Console. The second checks the
current schema, H10 checksums, constraints, triggers and pending migrations. It
does not replace historical protected-data baselines or migration authorization.

Current profile: `workpulse-ess-design`, branch `br-damp-fog-azmmxhga`, endpoint
`ep-wild-mud-az8yzifu`. Both connections report those IDs and `neondb/public`.
Checkpoint `br-shy-glitter-az5vqooe`, endpoint `ep-young-salad-azvs78pp`, is a
separate development checkpoint. Its parent mapping to the development branch
comes from user-confirmed Console metadata; SQL does not expose parent metadata.
Its live branch/endpoint identity, supplied pooled connection and corresponding
direct connection passed read-only checks. Before migration, its schema, history
and all 51 original-table fingerprints matched development exactly.

The eleven reviewed migrations were applied only to development. All 35 local
migrations are now applied, with zero pending migrations, missing columns or enum
values. H10 checksums and all 16 H10 triggers pass. Existing records across all
51 original tables and the checkpoint remain unchanged. Prisma Client was
regenerated. A fresh local-only session secret was configured securely; the
working database URLs and original `.env` were preserved. `npm.cmd run dev`
reached Next.js Ready on port 3000 with the startup gate enabled.
The browser smoke check passed normal password login using an existing account,
the rendered dashboard, and actual SAGA workspace discovery form submission.
Discovery correctly returns an already signed-in SAGA user to the dashboard.
No fixture accounts, record updates, or record deletions were needed.
The agent's server process required network permission to reach Neon; running
inside the restricted sandbox alone produced database connectivity errors.

The supported continuation for this eleven-migration recovery was:

```powershell
node scripts/development-database-recovery.cjs checkpoint
node scripts/development-database-recovery.cjs migrate
node scripts/development-database-recovery.cjs finalize
npm.cmd run dev
# In another terminal, while development is running:
node scripts/verify-development-startup.cjs
```

Do not rerun checkpoint capture or migration deployment after completion.
`finalize` is a separate process so native Prisma engine locks are released before
Windows regenerates the client. The runner locks the authorized development
identity, compares reviewed SQL checksums, rejects unexpected pending migrations,
and preserves historical baselines in separate development evidence files.
For a read-only data recheck use
`node scripts/development-database-recovery.cjs verify-data`.

See `recovery/development-checkpoint-verification.json`,
`recovery/development-migration-completion.json`,
`recovery/development-protected-data-after.json`, and
`recovery/schema-and-history-verification.json` for current evidence. Browser
startup, discovery and login results are in
`recovery/development-startup-verification.json`.

The remaining sections preserve the original Batch 0 setup procedure. Its old
two-H10-migration assumptions do not describe the completed development recovery.

## Current setup

The existing local `.env` selects a pooled Neon connection to `neondb/public`; its endpoint indicates `ap-southeast-1`. Its deployment role remains uncertain, so keep treating it as production. There is no separate H10 test URL or direct URL configured. `prisma/schema.prisma` reads **DATABASE_URL only**; it has no `directUrl` setting.

Keep `.env` and Vercel settings unchanged. Use a separate `.env.recovery.local` in the repository root. The current `.gitignore` excludes it. Next does not automatically select this custom filename; use the explicit commands below.

## Create the isolated branch in Neon Console

1. Open the project containing the currently configured endpoint. Identify its actual parent branch from the endpoint mapping; do not infer this from the database name.
2. Select **Branches → New branch**, select that parent, and name the child `workpulse-batch0-recovery`.
3. Select **Current data** so the existing schema, migration history and representative SAGA records are copied. This is needed for the previously broken page baselines; schema-only would omit their data.
4. Choose an expiry long enough to finish testing. Leave the parent/default selection unchanged; do not promote or connect the child to Vercel.
5. Record the child branch name/ID, its compute/endpoint ID, parent branch ID and creation time. These identifiers are sufficient for branch confirmation; connection secrets stay local.

Neon child branches isolate changes from their parent. [Neon branch management](https://neon.com/docs/manage/branches).

## Establish recreation before migrations

Create a second child, `workpulse-batch0-checkpoint`, **from the newly created testing branch before any migrations**. Keep this checkpoint unchanged and retain it through the recovery exercise.

The recreation procedure is to create a fresh replacement testing branch from this checkpoint and select the replacement's connection details locally. This neither resets nor restores the production-treated parent. Before migration approval is exercised, we will verify the checkpoint mapping, accessibility and expected pre-H10 schema/migration history. Do not delete either branch during verification.

This checkpoint is a recovery option for the disposable test environment; it does not establish a verified production backup. Branch creation/retention must fit the project's available quota and your authorization.

## Configure secrets locally

On the **testing child** select Connect, choose its compute, `neondb`, and an appropriate migration-capable role. Copy the pooled connection locally, then disable Connection pooling and copy the direct connection for the **same child/compute/database**. Preserve the URL's SSL/channel-binding options. [Neon connection selection](https://neon.com/docs/connect/connect-from-any-app).

Create `G:\CAPSTONE\WorkPulse\.env.recovery.local` using your editor. Replace placeholders there, never in chat:

```dotenv
# Pooled URL from the disposable testing branch's Connect dialog.
DATABASE_URL="<testing-branch pooled PostgreSQL URL>"

# Direct URL from the SAME testing branch. Existing H10 runners use this variable.
H10_TEST_DATABASE_URL="<testing-branch direct PostgreSQL URL>"

# Non-secret identifiers copied from the testing branch overview.
WORKPULSE_TEST_NEON_BRANCH_NAME="workpulse-batch0-recovery"
WORKPULSE_TEST_NEON_BRANCH_ID="<testing br-... ID>"
WORKPULSE_TEST_NEON_ENDPOINT_ID="<testing ep-... ID, without -pooler>"
WORKPULSE_TEST_NEON_CHECKPOINT_BRANCH_ID="<checkpoint br-... ID>"

PLATFORM_ROOT_DOMAIN="localhost:3000"
PLATFORM_PUBLIC_ORIGIN="http://localhost:3000"
SESSION_SECRET="<fresh local-only secret of at least 32 characters>"

# Prevent fallback to live email/storage/AI credentials in the existing .env.
GMAIL_USER=""
GMAIL_APP_PASSWORD=""
SMTP_USER=""
SMTP_PASSWORD=""
SMTP_HOST=""
BLOB_READ_WRITE_TOKEN=""
GOOGLE_AI_API_KEY=""
VERCEL="0"
```

Use complete URL literals; do not use `${...}` interpolation in this file. Do not add `NODE_ENV` or `NEXT_PUBLIC_` secret variables. Use a password manager/editor to set the local secret without printing it. A copied database can contain live-looking asset keys and email addresses; testing will use synthetic fixtures and avoid external sends or shared Blob writes. Local asset reads may lack copied files; report that separately from database/rendering failures.

## Select the profile consistently

Several existing scripts explicitly load `.env`, while Next has its own environment-file loading rules. A standalone `.env.local` does not guarantee consistent selection across them. Load this profile into the process before launching any recovery command.

In a fresh PowerShell terminal at the repository root, stop any old local WorkPulse server and clear stale overrides **in that terminal only**:

```powershell
Remove-Item Env:DATABASE_URL, Env:H10_TEST_DATABASE_URL, Env:DIRECT_URL, Env:NODE_ENV -ErrorAction SilentlyContinue
Remove-Item Env:SESSION_SECRET, Env:PLATFORM_ROOT_DOMAIN, Env:PLATFORM_PUBLIC_ORIGIN -ErrorAction SilentlyContinue
Remove-Item Env:GMAIL_USER, Env:GMAIL_APP_PASSWORD, Env:SMTP_USER, Env:SMTP_PASSWORD, Env:SMTP_HOST -ErrorAction SilentlyContinue
Remove-Item Env:BLOB_READ_WRITE_TOKEN, Env:GOOGLE_AI_API_KEY, Env:VERCEL -ErrorAction SilentlyContinue
Remove-Item Env:WORKPULSE_TEST_NEON_BRANCH_NAME, Env:WORKPULSE_TEST_NEON_BRANCH_ID, Env:WORKPULSE_TEST_NEON_ENDPOINT_ID, Env:WORKPULSE_TEST_NEON_CHECKPOINT_BRANCH_ID -ErrorAction SilentlyContinue
```

This does not edit `.env`, system/user environment settings, Vercel, or any database. Pre-existing environment values override Node's `--env-file`, which is why stale URL overrides must be cleared. Do not run `Get-ChildItem Env:` or echo connection variables.

These are the explicit local launch commands for **after branch verification, authorization and schema recovery**:

```powershell
node --env-file=.env.recovery.local node_modules/next/dist/bin/next dev --webpack
```

Use `http://saga.localhost:3000/login` and a normal authorized sign-in in a separate/private browser session. The fresh local session secret keeps this browser session separate from sessions signed with the original configuration. No token forgery or authorization removal is needed.

For a later local production-mode comparison, the same profile must be supplied to both build and start, with NODE_ENV explicitly production. We will orchestrate generation, build and benchmarks after authorization. Do not run plain `npm run dev`, unprefixed test commands or migration commands during recovery; those can select the original `.env`.

Next gives existing process variables precedence over its files. Local verification also confirmed `process.loadEnvFile('.env')` preserves an already inherited value on the installed Node version. [Next environment precedence](https://nextjs.org/docs/app/guides/environment-variables#environment-variable-load-order).

## What will be verified before any write

- Explicit authorization identifies the testing branch and permits its migrations plus disposable-schema fixture tests.
- The effective pooled/direct endpoints normalize to the same endpoint ID, match the Console's testing child mapping, and differ from the unchanged original `.env` endpoint. A `neondb/public` name or connection success alone does not establish isolation.
- Branch/project metadata confirms the intended child; an endpoint difference alone is insufficient. Checkpoint metadata and a read-only connection establish recreation availability.
- Read-only preflight confirms expected H10 gaps, migration checksums and exactly the two intended pending migrations. Preserve the original audit files; save recovery evidence separately.
- Protected cloned SAGA/history records receive a before/after comparison. Fixture regressions run in fresh random schemas inside the authorized testing branch, rather than writing the cloned SAGA records in public.
- Migration deployment uses the direct child connection injected as DATABASE_URL for that process. Merely defining DIRECT_URL or H10_TEST_DATABASE_URL does not redirect the Prisma migration CLI in this repository.

After these gates, apply H10.1 then H10.2, verify the tables/column/constraints/16 triggers, check actual rendered content and framework errors, run the requested fixture regressions, and measure successful responses. Use the existing audit methodology with normal authorized sessions and a new output directory. Report failed tests or remaining errors instead of treating HTTP 200 or a build as recovery proof. Stop after compatibility and measurements; no optimization or production deployment follows automatically.

## Reply when ready

No secrets are needed in the reply. Example:

> I created the disposable testing branch and pre-migration checkpoint, configured `.env.recovery.local`, and confirmed neither is used by Vercel. I authorize verification, H10.1/H10.2 migrations, and isolated regression tests on that testing branch only.

Until then, migration execution, database regressions, recovered-page verification and new performance measurements remain pending.
