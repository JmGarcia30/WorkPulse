# Organization-branded HR email templates

Follow-up: [Complete HR email workflows](hr-email-workflows.md) adds explicit preview-and-confirm HR actions for these templates. The original rendering work and preview-only Settings page described here remain intact.

All five templates share the existing Email Integration design, tenant branding loader, optional logo handling, HTML layout, plain-text alternative, HR signature, and small WorkPulse footer:

| Template | Internal notification service |
| --- | --- |
| Applicant acknowledgment | `sendApplicationConfirmationEmail` (existing contract retained) |
| Interview invitation | `sendInterviewInvitationEmail` |
| Successful applicant | `sendSuccessfulApplicantEmail` |
| Rejection notification | `sendApplicantRejectionEmail` |
| Employee onboarding information | `sendEmployeeOnboardingEmail` |

Organization identity and logo come from the selected organization's stored branding. SAGA uses “St. Aloysius Gonzaga Academy – Human Resources Department.” Missing logos and unreadable or cross-tenant private uploads fall back to the organization text header. Public logo URLs retain the existing behavior: only HTTP(S) URLs without embedded credentials are included, and the recipient's mail client loads the image. Dynamic content is escaped, optional details are omitted, and interview times include their timezone.

## Workflow boundaries

The existing acknowledgment service now uses the shared branded renderer and the stored workspace slug for its candidate portal link. The other four templates have internal notification helpers using the same transport. Inspection found no email send operation in the existing interview scheduling, offer/status, or onboarding record actions, so none was added. Opening previews, scheduling interviews, changing status, and starting onboarding do not introduce new automated email events.

Employee account activation remains the existing platform invitation, separate from informational onboarding. Company registration, verification, password reset, administrator invitations, applicant verification, and document-review notifications retain their existing behavior. No applicant, employee, payroll, status-transition, or onboarding record code was changed.

Company mail uses only the selected organization's encrypted Gmail credentials and verified connected sender address. SAGA continues through its legacy sender until HR successfully tests and explicitly activates Gmail. Reverting, disconnecting, and provider failure behavior remain unchanged; Gmail failures never silently choose another sender. Internal notification helpers are server-only services, not new public actions or sending endpoints; their callers retain responsibility for authorized record selection.

## Inspect locally without sending

1. Run `npm run dev` (the existing launcher verifies the recovery profile and sets local root-domain/public-origin values for its child process; it does not edit `.env`). A missing or unverified recovery profile stops startup.
2. Sign in as an existing organization HR Administrator at `http://<workspace-slug>.localhost:3000/login`, or SAGA at `http://saga.localhost:3000/login`.
3. Open **Settings → Email Integration → Preview HR email templates**. The route is `/dashboard/settings/email-integration/templates` within the authenticated workspace, with `?type=acknowledgment`, `interview`, `acceptance`, `rejection`, or `onboarding`.
4. Inspect the subject, HTML preview, and expandable plain-text alternative. The page uses the authenticated tenant's branding with fictional people and details, never real applicant/employee information. It has no send operation and does not require a Gmail connection.

Standalone [HTML and plain-text previews](hr-email-templates/previews/index.html) include all five templates for SAGA, fictional Northstar Services with a logo, and a fictional organization without a logo. Regenerate with `node scripts/preview-hr-emails.cjs`; this reads no database and sends nothing. Preview links use `example.invalid` and are intentionally nonfunctional. The Northstar initials logo is a preview-only illustration.

## Focused validation

Run only through the existing verified recovery launchers:

```powershell
node scripts/email-integration-recovery.cjs test
node scripts/email-integration-recovery.cjs templates
node scripts/email-integration-recovery.cjs build
node scripts/email-integration-browser.cjs --recipient-only
node node_modules/typescript/bin/tsc --noEmit
```

The `test` mode runs the existing integration and new template suites together; `templates` runs only the new focused suite. The recovery test runner verifies the isolated branch, executes fixtures inside an outer rollback transaction, and compares all 63 table fingerprints before/after. Google and SMTP delivery are mocked. The browser runner uses disposable synthetic recovery organizations and removes its fixtures; `--recipient-only` avoids changing SAGA's existing connection. The build uses read-only recovery database URLs. No migration is needed.

Results: **117 focused template assertions**, **125 existing email integration assertions**, and **28 browser assertions** passed. TypeScript, targeted ESLint, and the local production build passed. Template, browser, and build preservation checks confirmed all **63 tables unchanged**. Gmail and SMTP delivery were mocked; this validates composition and routing, not live inbox delivery. No production changes, migration, reset, push, or deployment occurred.

The focused matrix covers all five types with SAGA, a separate company logo, and no logo; optional details; HTML escaping and unsafe links; HTML/plain text; exact recipients; each tenant's connected Gmail credentials; forged branding inputs; SAGA legacy SMTP, successful-test gating, explicit Gmail activation and revert; provider failure; and separate platform invitations. The browser suite covers all five authorized previews, cross-tenant denial, and zero sends while previewing.

See [validation summary](hr-email-templates/validation.json), [template checks](hr-email-templates/template-tests.json), [browser checks](hr-email-templates/browser-tests.json), and [preservation evidence](hr-email-templates/template-preservation.json).
