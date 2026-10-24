# Phase 4 — Organization Gmail integration

SAGA support has since been enabled with a successful-test requirement and explicit activation/revert controls. See [SAGA recruitment sender activation](./saga-email-integration.md) for the current behavior and validation.

Implemented locally on verified recovery branch `workpulse-batch0-recovery` (`br-broad-forest-az55xwfe`). The additive migration `20261023000400_organization_gmail_integration` is already applied there. No production connection, production migration, push, or deployment was performed. Existing `.env` and recovery-profile files were preserved; `.env.example` documents the new server configuration without real values.

## Completed behavior

- HR and Organization Administrators have **Settings → Email Integration** at `/dashboard/settings/email-integration` on their tenant host. They can connect/reconnect, inspect safe status metadata, send a test to their own persisted HR email, and disconnect with confirmation. Hiring managers, employees, platform sessions, and another tenant's session cannot manage it.
- Google authorization requests `https://www.googleapis.com/auth/gmail.send`, plus `openid email` to identify the verified sender. There is no inbox-read, modify, full-mail, profile, SMTP password, or App Password request. Sending uses Gmail's `users/me/messages/send` API, not SMTP OAuth. Google classifies `gmail.send` as sensitive. [Gmail scope reference](https://developers.google.com/workspace/gmail/api/auth/scopes).
- Access and refresh tokens use AES-256-GCM encryption with a dedicated server key and organization-bound authenticated context. PKCE verifiers and temporary OAuth credentials are also encrypted. The browser receives no OAuth tokens. Settings select only address, connection state, last error code, backoff, and last-send time.
- A central callback supports every tenant with one Google redirect URI. An automatic round trip between the authenticated tenant and public host binds host-only browser proofs on both hosts before Google consent. State is random, hashed, expires after ten minutes, and is bound to the initiating HR user, organization, generation, and PKCE verifier. Fresh tenant authorization is required before the final connection is installed. Expired, replayed, superseded, cross-tenant, and wrong-browser attempts are rejected.
- Per-organization transaction locks serialize refresh, sends, reconnect, and disconnect. Refreshed credentials preserve an existing refresh token when Google does not rotate it. A definite 401 refreshes and retries once. Ambiguous network/5xx failures are not blindly resent. Quota errors create a visible backoff; revoked/expired authorization requires reconnection.
- The sender is Google's verified email, and the sender name comes from the persisted organization. There is no editable From, alias, or Reply-To. MIME composition rejects malformed recipients and header injection, and disables file/URL loading. A Google account can be connected to only one organization at a time, so disconnecting cannot revoke another organization's use of the same Google grant.
- Disconnect attempts Google revocation and removes local credentials/pending attempts. If Google cannot confirm revocation, local removal still completes and the UI directs the administrator to remove WorkPulse access in Google account security settings.

## Notification routing and SAGA preservation

Existing application-confirmation and document-review notification functions now require the actual organization ID. Document actions obtain it from the already authorized Application → Job → Organization record. Other companies use neutral templates and their connected account. The existing applicant email-ownership link also uses that applicant's organization sender; sensitive candidate links are never retained in previews or message logs. Failed delivery does not activate a candidate access link.

Document review remains saved if notification delivery fails. The UI now reports that distinction instead of claiming every notification was sent. There is no automatic queue/retry job in this phase; after an ambiguous send, check the Google Sent folder before retrying.

WorkPulse company-registration verification, account invitations, and other direct system `sendEmail` callers retain the separate platform transport. No new company can fall back to the platform/SAGA sender for recruitment. Companies must connect a sender before applicant notifications can be delivered.

SAGA is identified by the persisted `st-aloysius` organization slug. Its original SMTP/preview sender and institution-specific templates remain the default. HR can now connect/test Gmail and explicitly activate or revert recruitment delivery, as described in the SAGA update. Platform-email routing, policies, employees, and payroll are unchanged.

## Google Cloud setup for local testing

1. Create/select a Google Cloud project and enable **Gmail API**. Configure **Google Auth Platform** branding and consent information. Choose **External** for independent customer Gmail/Workspace accounts; while testing, add the exact Google accounts as test users. An Internal app is limited to its own Workspace organization. [Google consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent).
2. Configure data access for `gmail.send` and the basic `openid`/email identity scopes. Do not add Gmail read/modify or `https://mail.google.com/`. No domain-wide delegation or service-account impersonation is needed.
3. Create an OAuth client of type **Web application**. Add this exact authorized redirect URI:

   ```text
   http://localhost:3000/api/email-integration/google/callback
   ```

   This is the public host, not a tenant subdomain. The server constructs it from `PLATFORM_PUBLIC_ORIGIN`. Add a separate exact localhost URI if you run a different port. The flow is server-side and does not need a browser Google SDK. [Google web-server OAuth flow](https://developers.google.com/identity/protocols/oauth2/web-server).
4. Supply these **server-only** variables in private local development configuration, such as an untracked `.env.development.local`, or the shell launching the dev server:

   | Variable | Required input |
   |---|---|
   | `GOOGLE_EMAIL_CLIENT_ID` | The Web application's client ID |
   | `GOOGLE_EMAIL_CLIENT_SECRET` | Its client secret |
   | `EMAIL_OAUTH_ENCRYPTION_KEY` | A stable, independent 32-byte random key in standard base64 |

   None of these inputs were present in the inspected local configuration. The app shows an actionable setup-required message until configured. They are not company Gmail credentials; companies authorize directly at Google.

   To generate a local encryption key into the current PowerShell process without printing its value:

   ```powershell
   $env:EMAIL_OAUTH_ENCRYPTION_KEY = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
   ```

   Generate it once and retain it securely across restarts. Do not regenerate or replace a key protecting saved connections: disconnect/reconnect deliberately, or implement a controlled re-encryption procedure first. Do not use `SESSION_SECRET` as this key, place values in `NEXT_PUBLIC_` variables, or commit them.
5. Run `npm run dev`. The existing launcher pins the verified recovery URLs, `PLATFORM_ROOT_DOMAIN=localhost:3000`, and `PLATFORM_PUBLIC_ORIGIN=http://localhost:3000`; it refuses an unverified target. No production environment changes are needed.
6. Sign in as HR on `http://<registered-slug>.localhost:3000/login`, open **Settings → Email Integration**, and select **Connect Google account**. Keep the flow in the same browser, choose the company's Gmail/Workspace account, and grant send permission. Return to the tenant settings, confirm its connected address, and select **Send test email**. The test recipient is the signed-in HR user's address.
7. Exercise a candidate verification/document notification in that tenant. Confirm the company's Google account is the sender. Disconnect and confirm company notifications stop rather than using SAGA or system SMTP. Use a second organization to confirm that its connection and status remain separate.

External OAuth apps in Testing normally receive refresh tokens expiring after seven days when Gmail scope is requested. Workspace policy or user revocation can also end authorization; the application then requests reconnection. [Google refresh-token expiration](https://developers.google.com/identity/protocols/oauth2#expiration). Google's public-app review for sensitive scopes, production HTTPS/domain setup, and real provider approval are separate release work; none was performed here.

## Validation and reruns

Original Phase 4 validation: **252 passing assertions** — 68 focused email checks, 16 browser/concurrency checks, 64 routing/session regressions, 60 manual-onboarding regressions, and 44 public-registration regressions. The optimized build, TypeScript, targeted ESLint, and Prisma schema validation passed. Current SAGA-specific results are reported in the SAGA update; the email and browser suites have been expanded since the original run.

The guarded runner verifies pooled/direct recovery identity, excludes the protected original endpoint, validates migration checksums, and bundles only applied migrations plus this feature's migration. It never runs a blanket deploy of unrelated pending work.

```powershell
node scripts/email-integration-recovery.cjs test
node scripts/email-integration-recovery.cjs regression
node scripts/email-integration-recovery.cjs build
node scripts/email-integration-browser.cjs
node scripts/company-registration-recovery.cjs test
```

Focused tests cover encrypted storage/context/tampering, authorization, OAuth/PKCE/state lifecycle, safe sender selection, cross-tenant credentials, refresh, invalid/revoked tokens, quotas, uncertain sends, disconnect, neutral notifications, applicant verification, and system/SAGA separation. They use synthetic Google responses and roll back all fixtures. The existing routing/manual-onboarding regression suites use isolated test rate-limit keys and remove only their own synthetic records.

The browser harness uses a production build on loopback port 3137 and headless Chrome debug port 9247. It intercepts Google consent and token/identity/send/revoke traffic, checks the real settings actions and cookie/redirect flow, and exercises refresh/disconnect races with independent database transactions. Its uniquely identified fixture records are removed afterward. **No real Google account was connected and no real Google email was sent.** Operator-supplied Google Cloud credentials are still required for live manual acceptance.

Evidence is saved under `docs/email-integration/`: `tests.json`, `browser-tests.json`, regression results, `build.json`, and before/after preservation reports. The migration compares all 61 pre-existing tables; subsequent checks compare all 63 tables. TypeScript, targeted ESLint, and Prisma validation are included in local verification. OAuth endpoint query logging is suppressed in the development server; these routes also return no-store/no-referrer/noindex headers. Any future external proxy should likewise redact OAuth code/state query strings.
