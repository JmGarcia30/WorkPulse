# Tenant-branded Email Integration test email

The **Send test email** content now uses a minimalist HTML layout with the sending organization's logo and prominent name, a plain-text alternative, and the small footer **Sent securely through WorkPulse**. This applies only to the Email Integration test template.

Existing organization branding is reused: an uploaded logo takes precedence, branding display name falls back to the organization name, and an existing public `Organization.logoUrl` is used directly. Owned private uploads and local public image files are embedded as inline MIME images, so recipients do not need a tenant login or access to localhost. Private storage keys are never exposed. Missing, invalid, oversized, or unreadable optional images fall back to a clean text header and do not prevent sending.

SAGA's HTML and plain text identify **St. Aloysius Gonzaga Academy – Human Resources Department**. Other tenants use their own branding and never inherit SAGA's header or logo. Tenant names/attributes are escaped; uploaded logo reads are restricted to the sending organization's storage namespace. Arbitrary public image URLs are referenced, not fetched by the application server.

The recipient validation, verified connected Gmail From address, tenant authorization, token refresh, and SAGA test-before-activation behavior are unchanged. Other onboarding, recruitment, and platform email templates were not changed. The optional inline-logo MIME field is unused by those workflows. No schema or migration changes were necessary.

Validation: **145 passing checks** — 125 service/template checks and 20 browser/concurrency checks — plus TypeScript, targeted ESLint, and a successful optimized build. Tests cover public logos, uploaded inline logos, no-logo and unreadable-logo fallbacks, SAGA content, different tenants, unsafe markup/URLs, cross-tenant storage keys, actual Gmail MIME, and preserved sender/recipient selection. Google responses were mocked. All 63 table fingerprints matched after rollback/fixture cleanup; existing data and environment files were preserved. Nothing was pushed, deployed, or changed in production.

Local previews: [SAGA](./email-test-branding/preview-saga.html) and [text-only company](./email-test-branding/preview-company.html). The SAGA preview uses the existing public logo asset; the preview substitutes a data URL for the inline CID solely for standalone viewing.

To test locally, run `npm run dev`, open the connected tenant's **Settings → Email Integration**, enter an inbox you control, and send a test. Configure logos through the existing organization settings. Confirm receipt before activating SAGA Gmail recruitment sending. Public remote logos may depend on the recipient's image-loading settings; the organization name is always visible.

Focused reruns:

```powershell
node scripts/email-integration-recovery.cjs test
node scripts/email-integration-browser.cjs --recipient-only
```
