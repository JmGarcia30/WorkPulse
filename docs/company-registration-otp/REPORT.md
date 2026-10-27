# Company registration email OTP

Public registration now sends a cryptographically random six-digit code through the existing sensitive SMTP pipeline and redirects to `/register/verify`. Organization creation still uses the shared transaction-scoped `initializeOrganization` service. The HR administrator then signs in at the tenant login and completes the existing branding setup.

Codes expire after ten minutes, allow five incorrect attempts, and have a sixty-second resend cooldown. Resend replaces the verifier, nonce, expiry, and attempt counter; even a random repeat of the previous numeric value is excluded. HMAC-SHA256 binds each code to its normalized email and random nonce. Plaintext codes never enter database writes, API responses, preview logs, or application logs. Failed verification counters commit before an error is returned. Existing persistent global and per-email fifteen-minute rate limits remain in place.

The six inputs support numeric keyboards, full-code paste/autofill, focus advance, backspace, and arrow navigation. Resend displays countdown feedback. Registration and verification password fields have visibility controls. Email addresses passed from registration use a URL fragment that is removed on capture; codes are never included in URLs.

Cross-device verification needs the email, code, and original registration password; it never requires the original cookie. The original browser can verify with only its code. This preserves the existing defense against someone pre-registering an email with an attacker-chosen password. Cross-browser resend also accepts the registration password. Live pending registrations cannot have their company details/password replaced by an unauthenticated retry.

Pending legacy links remain valid until their existing expiry and retain their browser-or-password safeguard. Resend converts the same pending record to OTP and invalidates its link. Both paths share exactly the same organization initializer, email/slug locks, verification consumption, and audit transaction.

## Files changed

- `src/features/company-registration/otp.ts`: secure generation and keyed, constant-time verification.
- `src/features/company-registration/service.ts`: issuance, delivery, resend, durable attempts, legacy compatibility, shared completion.
- `src/features/company-registration/actions.ts`: verification redirect and code/email/password action inputs.
- `src/features/company-registration/forms.tsx`: registration, six-box verification, password controls, resend feedback.
- `src/features/company-registration/schema.ts`: cooldown response metadata.
- `src/app/register/verify/page.tsx`: verification page caption.
- `src/lib/email/index.ts`: neutral OTP template through the existing sensitive SMTP sender.
- `prisma/schema.prisma` and `prisma/migrations/20261027000100_company_registration_otp/migration.sql`: three additive fields.
- `scripts/test-company-registration.cjs`: OTP security and legacy regressions.
- `scripts/company-registration-recovery.cjs`: current verified recovery identity, curated migration, isolated regression schema.
- `scripts/company-registration-browser.cjs`: SMTP/browser/mobile/branding/concurrency tests in a disposable schema.
- `scripts/test-platform-onboarding.cjs`: update an obsolete test fixture to use mismatched Vercel authorities; matching Vercel authorities now support existing path tenancy.
- `docs/public-company-onboarding.md`: pointer from the historical link report to this report.
- `docs/company-registration-otp/`: report and validation evidence.

No payroll, attendance, schedules, leave, tenant-authentication, or branding implementation was changed.

## Validation

All database work used the verified isolated `workpulse-ess-design` recovery endpoint, distinct from the protected original endpoint. OTP integration fixtures run in a rolled-back transaction. Routing/manual-onboarding and staff-authentication regressions use disposable schemas. Browser tests also use a disposable schema, real production-build Chrome, and a loopback SMTP sink that accepts only synthetic recipients.

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript `tsc --noEmit` | Passed | Also checked by production build |
| Production build, read-only test connections | Passed | `build.json` |
| Targeted ESLint and whitespace checks | Passed | Source and changed test scripts |
| Registration/OTP integration | 61 passed | `tests.json` |
| Existing routing/tenant-security regression | 64 passed | `routing-regression.json` |
| Existing manual-onboarding regression | 60 passed | `manual-onboarding-regression.json` |
| Staff authentication/session security | 63 passed | `staff-auth-tests.json` |
| Browser/SMTP/mobile/concurrency | 27 passed | `browser-tests.json` |

Total: 275 functional/security assertions, plus TypeScript, production build, lint, and preservation checks.

Coverage includes correct, incorrect, expired, used, and resent codes; persistent five-attempt lockout; cross-device verification/resend without the original cookie; duplicate emails; neutral initialization; rollback on onboarding failure; simultaneous incorrect attempts; concurrent verification creating one organization/account; tenant login boundaries; and first-time branding save followed by dashboard access. Chrome checks desktop plus mobile viewports, code paste/focus, and password visibility. Cross-browser coverage uses a fresh cookie-free browser session; physical mobile devices and other browser engines were not exercised.

Final preservation checks compare all 73 public tables and report unchanged existing records. The additive migration preserved existing column values. Existing SAGA/organization rows were never updated or deleted, and production was never accessed. No environment files changed.

An older routing harness initially left synthetic login-budget rows on recovery; it was replaced with disposable-schema execution. The first branding browser run also encountered immutable audit cleanup protection. Only the two organizations created by that test were cleaned up, after exact fixture ownership and empty-business-data checks; the test database's immutable audit trigger was restored within that cleanup transaction. Final runs dispose their whole test schemas and preserve public data. These harness issues did not affect production or existing organization records.

Rerun against verified recovery:

```powershell
node scripts/company-registration-recovery.cjs migrate
node scripts/company-registration-recovery.cjs test
node scripts/company-registration-recovery.cjs regression
node scripts/company-registration-recovery.cjs build
node scripts/company-registration-browser.cjs
```

Run the public-table integration/preservation suite separately from any test that commits public fixtures. The current browser and regression runners isolate all writes in disposable schemas. Chrome must be installed at the harness's existing Windows path; local ports 3127 and 9237 must be available.

## Migration and production gate

Migration `20261027000100_company_registration_otp` adds nullable `otpHash`, nullable `otpNonce`, and `otpAttempts INTEGER NOT NULL DEFAULT 0` to `CompanyRegistration`. It performs no row deletion, organization update, or registration reset. It is applied only to the verified isolated recovery database in this task.

Before deploying this application revision, apply this exact migration through the production release process after checking its actual migration history. The repository's build command generates Prisma Client and builds Next.js; it does not apply migrations. Do not infer production schema parity from recovery or apply unrelated pending migrations.

The verifier uses `COMPANY_REGISTRATION_OTP_SECRET` when configured, otherwise the existing `SESSION_SECRET`. The selected value must be a stable, server-only secret of at least 32 characters, shared by all instances. There is no development fallback. Rotating that key invalidates outstanding OTPs; resend issues a code under the current key. Existing SMTP configuration is reused without a new provider or credentials.

Production is not yet certified ready: its migration and hosted SMTP/registration smoke check remain unverified. No production database connection, migration, or deployment was performed. A push to `main` is source publication, not evidence that the production migration has been applied.
