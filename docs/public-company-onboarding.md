# Public self-service company onboarding

The current six-digit code flow supersedes the link flow described in this historical implementation report. See [Email OTP verification](company-registration-otp/REPORT.md) for current behavior, validation, and migration requirements. Existing pending links remain supported.

Implemented locally against the verified `workpulse-batch0-recovery` branch (`br-broad-forest-az55xwfe`). No production connection, production migration, deployment, push, or environment-file edit was performed.

The public website now has a **Create Workspace** action linking to `/register`. The mobile-friendly form collects company name, administrator name, email, and password. The email must be verified before either an Organization or a login-capable User is created. No System Administrator approval is required.

## Flow and existing behavior reused

1. Registration validates and normalizes input using the existing platform email/name/password rules. Passwords require 14–72 characters and at most 72 UTF-8 bytes, with bcrypt cost 12.
2. A pending `CompanyRegistration` stores the password hash, a hashed browser proof, and the hash of a random single-use 24-hour verification token. It creates no tenant, employee, or User.
3. The existing sensitive email pipeline sends a neutral WorkPulse verification email. Its link targets the public `/register/verify` page and carries the token in a URL fragment, which the page removes from browser history.
4. The recipient opens the link **in the browser where they registered** and clicks **Verify email and create workspace**. A host-only HttpOnly browser cookie prevents someone else's pre-registration from activating a password the recipient did not choose. Production cookies also use Secure and the `__Host-` prefix.
5. Verification atomically creates the Organization and its initial `HR_ADMIN` User, consumes the token, clears the pending password hash, and records a platform organization audit. The workspace slug is generated from the company name, validated against the existing reserved-name/DNS rules, and given a random suffix on collision.
6. The administrator is redirected to their validated tenant `/login?registered=1`, then signs in through the existing tenant authentication flow to `/dashboard`. Verification creates no platform account and no cross-host authentication token.

Manual System Administrator organization creation and invitation/activation remain available. Both workflows now share the same transaction-scoped organization initializer, email uniqueness lock, workspace slug lock, and neutral defaults. Pending public registrations cannot replace existing tenant accounts. A live registration cannot have its name/password replaced by an unauthenticated retry.

New companies use UTC, careers disabled, and no copied employee, payroll, hiring, leave, branding, schedule, probation, or SAGA institution configuration. Verified organizations appear automatically in the existing platform organization list and counts. Organization details display self-service verification metadata through an explicit email/date allowlist.

Persistent registration/verification budgets reuse the existing serialized attempt store with separate purpose prefixes. Resending requires the original browser, waits 60 seconds, and rotates the token. Tokens expire after 24 hours; an expired registration can be restarted. Concurrent duplicate submissions and verification are serialized. All verification and tenant creation writes commit or roll back together.

## Local manual test

The additive migration `20261023000300_public_company_registration` is **already applied to verified recovery**. Do not run a blanket migration deploy from this working tree. The recovery runner constructs a migration bundle containing applied history plus only this feature's migration.

1. Configure an authenticated **test SMTP inbox/catcher** for the application process. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and a valid `EMAIL_FROM`. Clear process-level `GMAIL_USER` and `GMAIL_APP_PASSWORD` when using generic SMTP, because those values otherwise take precedence. The transporter requires nonempty username and password, including for a local catcher. Use process-local overrides; production settings do not need to change.
2. Start the application from the repository root:

   ```powershell
   npm run dev
   ```

   Confirm the launcher reports verified disposable recovery. It overrides both database URLs from `.env.recovery.local`, supplies `PLATFORM_ROOT_DOMAIN=localhost:3000` and `PLATFORM_PUBLIC_ORIGIN=http://localhost:3000`, and refuses an unverified target. It retains existing email inputs, so configure the test mail transport deliberately.
3. Open `http://localhost:3000/register`, or click **Create Workspace** on the public homepage. Use a unique test email accepted by your SMTP inbox. Submit the four fields.
4. Confirm there is no new company in the System Administrator dashboard yet. Open the complete verification email link in the same browser and select **Verify email and create workspace**.
5. Confirm redirection to `http://<generated-slug>.localhost:3000/login?registered=1`. Sign in with the registered email and password. Confirm the company's own identity at `/dashboard`, refresh, and inspect the empty module states.
6. Open `http://localhost:3000/platform` in your provisioned System Administrator session. Confirm the new organization is listed and its details identify verified self-service registration. Manual creation remains at `/platform/organizations/new`.
7. Confirm the company account cannot sign in at `http://saga.localhost:3000/login`. Registration on a tenant host returns 404. Test a second disposable company to check distinct generated slugs and membership boundaries.

`npm run dev -- --port 3001` changes both local domain values automatically; use that port in all URLs. The browser must resolve `<slug>.localhost` to loopback. A verification email sent by an earlier port configuration must still be opened on its configured port while that app is available.

Without SMTP, registration returns a delivery error and retains only a pending registration. **Verification links are never printed to console, returned to the client, or retained in development previews.** After correcting SMTP, restart with the desired process environment and use **Resend verification email** after the cooldown. If the form was refreshed, resubmit the original email in the same browser to reach the resend control. An expired registration should be submitted again. Manually created test companies persist in recovery; stopping the application does not delete them.

## Focused validation and evidence

Evidence is in `docs/public-company-onboarding/`:

- `tests.json`: 44 focused integration assertions covering validation, neutral initialization, duplicate protection, email/browser proofs, token rotation/expiry/replay, transaction rollback, existing tenant login, SAGA isolation, and delivery failure/privacy. These fixtures and budgets run in an outer transaction that is rolled back.
- `browser-tests.json`: 17 real production-build browser/HTTP assertions, including mobile width, loopback SMTP delivery, verification, HR login/refresh, copied-cookie rejection on SAGA, automatic platform visibility, preserved manual creation, and true concurrent submissions/verification on independent database transactions. Only uniquely identified synthetic records are committed briefly, then removed. An isolated temporary platform session avoids modifying existing operator login budgets.
- `routing-regression.json` and `manual-onboarding-regression.json`: existing routing/session and manual organization-onboarding suites. The runner isolates the regression suite's global login-rate key so existing operator login history is preserved.
- `migrate-preservation.json`, `test-preservation.json`, `build-preservation.json`, `browser-preservation.json`, and `regression-preservation.json`: before/after fingerprints of pre-existing tables and environment-file checks. Migration compares the original 60 tables; subsequent checks compare all 61 tables.
- `build.json`: successful optimized application build using read-only recovery connections. TypeScript, targeted ESLint, and Prisma schema validation also passed.

Rerun only as needed, against verified recovery:

```powershell
node scripts/company-registration-recovery.cjs test
node scripts/company-registration-recovery.cjs regression
node scripts/company-registration-recovery.cjs build
node scripts/company-registration-browser.cjs
```

The browser harness requires Chrome at its existing Windows installation path and unused local ports 3127/9237. It deliberately uses a loopback-only SMTP sink accepting synthetic recipients, not the configured Gmail or production SMTP account. It refuses to reuse pre-existing public-registration global rate-limit rows, rather than deleting or modifying them. The platform bootstrap suite was not rerun because it requires completely empty platform authentication tables; existing operator records were preserved.

No subscriptions, payments, approval workflow, payroll changes, institution policy changes, or production domain setup were introduced. Production release and verified SMTP/DNS/HTTPS setup remain separate operator work.
