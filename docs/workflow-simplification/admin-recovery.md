# Platform administrator investigation — 28 October 2026

No production accounts, credentials, hashes or sessions were changed.

## Evidence and unresolved target confirmation

- Vercel project `work-pulse` (`prj_O3lYRwFRzfShyGDhCzek5v0gW4pr`) serves this repository. Its inspected READY production deployment `dpl_C3uQsRepzcKkakYoRwEUWbQDycCR` was built from main commit `b8ed5a72eaa0dc61d3cddd7eb4e1aa7eb68b4bf6`.
- Vercel has a sensitive production `DATABASE_URL`. The connected Vercel metadata and single-variable inspection conceal its value. Deployment source identity does **not** prove database identity.
- A read-only query of Neon project `late-block-61364102`, branch `br-hidden-violet-azjl3vam` (named `production`), database `neondb`, returned **0 PlatformAdministrator records**. The database reported that branch ID itself.
- Therefore, the zero count is verified for that Neon branch, but **the live Vercel database target remains unconfirmed**. Do not provision based on the branch name or local `.env`.

The operator must securely obtain the database configuration used by the current live deployment and map its normalized Neon endpoint, database and schema to the console branch. Do not paste the connection string into chat, tickets or logs. With that exact configuration supplied as `DATABASE_URL` in a secure process environment, run:

```text
node scripts/inspect-platform-admin-target.cjs
node scripts/provision-platform-admin.cjs --show-target
```

The first command forces a read-only connection and prints only a credential-free target fingerprint, Neon branch/endpoint identity and administrator count. Its fingerprint uses the same normalized endpoint/database/schema algorithm as provisioning. Confirm it against the deployment's actual target before any recovery action. Do not treat an unavailable Neon setting as proof of a branch mapping.

## Existing first-administrator provisioning

Only after exact live-target confirmation, a fresh zero count, and explicit owner authorization:

```text
node scripts/provision-platform-admin.cjs --target <confirmed-fingerprint>
```

The existing script requires an interactive terminal and the literal confirmation `CREATE INITIAL PLATFORM ADMIN`. It prompts for name/email and a hidden password with confirmation. The password must satisfy the existing 14–72-character and 72-byte limits. The service serializes provisioning, hashes the password using the existing credential implementation, and refuses if any platform administrator already exists. It does not load or alter `.env`. Sign in on the public platform host at `/platform/login` afterward.

These commands are operator instructions, not authorization to provision. They were not executed to create a production administrator during this work.

## If an administrator exists on the confirmed target

Do not run initial provisioning. The repository supports changing a platform password from an authenticated Platform Account Settings session **with the current password**; the change revokes existing platform sessions. It does not implement a forgotten-password email flow or an operator reset command. `scripts/platform-admin-recovery.cjs` is an isolated test/migration runner, not a password-recovery tool.

Use a verified password-manager record or an existing authenticated session with the current password for the supported account-settings flow. If neither is available, recovery requires a separately authorized, reviewed operator procedure with exact target confirmation and session revocation; no secure reset can be claimed to exist today. Do not overwrite a hash, delete the account, use tenant HR credentials, or add a public first-admin registration endpoint.
