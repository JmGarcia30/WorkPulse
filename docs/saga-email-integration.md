# SAGA recruitment sender activation

SAGA now uses the same Email Integration settings, Google OAuth, encrypted credentials, token refresh, test-send, and disconnect services as every other organization. No separate Gmail integration was introduced.

## Sender behavior

- SAGA recruitment uses its existing sender by default, even after Google connects and a test succeeds.
- A successful **Send test email** records `testedAt` on that connection inside the same locked transaction as the send. Ordinary notifications do not qualify a connection for activation.
- SAGA HR must check the confirmation and select **Activate Gmail for recruitment**. The server requires a currently connected, successfully tested account and fresh SAGA HR/Organization Administrator authorization.
- **Use existing SAGA sender** explicitly reverts recruitment without deleting the Gmail connection, including when Gmail is unavailable. Other organizations cannot select or borrow SAGA's legacy sender.
- Reconnecting clears test readiness and activation. Disconnect also removes credentials and returns SAGA recruitment to its existing sender. The settings explain these transitions before the administrator connects or disconnects.
- When activated Gmail fails, recruitment reports the failure. It does not silently use legacy SMTP. HR can explicitly revert. Already-selected legacy messages may finish in flight during a sender change.
- SAGA's existing recruitment templates and candidate verification content are preserved with either sender. WorkPulse company-registration verification, invitations, and other platform-email routing are unchanged by activation or revert.

SAGA's `saga`/`st-aloysius` subdomains and remembered `/saga` workspace path remain supported. The existing encrypted OAuth state carries only a validated return workspace, preserving the original host-only login cookies. A return host belonging to another organization is rejected.

## Local manual check

1. The additive migration `20261024000100_saga_recruitment_sender` is already applied to verified recovery. It adds nullable `testedAt` and default-false `recruitmentGmailActive` to the existing integration table. No employee, applicant, payroll, or organization-policy tables were changed. Prisma Client was regenerated locally; restart an already-running dev server once to load the generated fields.
2. Start `npm run dev` and sign in as SAGA HR. Open `http://saga.localhost:3000/dashboard/settings/email-integration`, the canonical `st-aloysius.localhost` equivalent, or your existing `/saga/dashboard/settings/email-integration` path.
3. Use the existing Google Cloud client configuration from [Email Integration setup](./email-integration.md#google-cloud-setup-for-local-testing). The public callback URI and OAuth permissions are unchanged.
4. Select **Connect Google account**. Confirm that status shows the verified Google account while **Recruitment sender** still says **Existing SAGA sender**.
5. Select **Send test email** and check the HR inbox. After success, confirm and select **Activate Gmail for recruitment**. Confirm that the sender label changes to SAGA's verified Gmail connection.
6. Confirm and select **Use existing SAGA sender** to revert. The Google account stays connected for another test/activation. Disconnect separately if you want to remove its credentials.

## Verification

Completed: **128 passing checks** — 98 focused email/service checks, 23 real-browser/concurrency checks, and 7 Prisma cache regression checks. The optimized build (including TypeScript), targeted ESLint, and Prisma schema validation passed. All 63 table fingerprints matched after migration and tests, including existing employee, applicant, and payroll records. Browser fixtures were removed; Google consent and API calls were synthetic.

The recovery-only runner validates branch/endpoint identity and existing migration checksums. Its curated migration bundle includes only the two Gmail integration migrations in addition to already-applied history. It does not deploy unrelated pending work.

```powershell
node scripts/email-integration-recovery.cjs test
node scripts/email-integration-recovery.cjs build
node scripts/email-integration-browser.cjs
node scripts/test-prisma-client-cache.cjs
```

The focused suite rolls back all fixtures, including temporary SAGA integration changes. It covers legacy defaults, test-gated activation, confirmed sender actions, revert during failure, no silent fallback, reconnection/disconnect invalidation, alias/path OAuth, platform-email separation, and unchanged connections in other organizations.

The browser suite retains the existing company checks and adds SAGA Connect, status, Test Email, activation, revert, and Disconnect on `saga.localhost`. It intercepts Google consent/API traffic and sends no real Google email. It refuses to replace a pre-existing SAGA connection or test-rate record. Only its own temporary integration/HR fixtures are removed afterward, with full table fingerprints checked.

Results and preservation evidence are in `docs/email-integration/`, with this update summarized in `docs/saga-email-integration/`. No production changes, push, deployment, or changes to existing environment files were performed.
