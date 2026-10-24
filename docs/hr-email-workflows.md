# Complete HR email workflows

HR Administrators and Organization Administrators can open an applicant profile and choose **Preview and send HR email**. The applicant's own recruitment workspace now provides all five branded email actions through the existing renderer, Gmail transport, and SAGA sender selector. No status-change, interview-save, offer-save, onboarding-save, or public application-submit hook was added. Acknowledgment is also an explicit HR action.

## Local use

1. Start `npm run dev`; the existing launcher verifies recovery and pins the child process to that database. Sign in with an existing organization HR account at `http://<workspace>.localhost:3000/login` (SAGA: `http://saga.localhost:3000/login`).
2. Open **Recruitment → Applicants → applicant profile → Preview and send HR email**, or `/dashboard/hiring/applicants/<applicationId>/email` within the authenticated tenant workspace.
3. Choose a type, select the saved interview if applicable, and optionally add onboarding instructions. Click **Preview recipient and email**. Inspect the saved recipient, selected sender, subject, sandboxed branded HTML, and plain text.
4. Check the explicit confirmation box and click **Confirm and send email**. Loading, submission, failure, and duplicate-blocking messages are shown. Delivery history records the event's attempt count, latest attempt time, provider-submission time, and status.

| Email | Required existing workflow state | Recipient / details |
| --- | --- | --- |
| Applicant acknowledgment | Active application before hiring | Saved applicant email, applicant name, position, candidate portal |
| Interview invitation | Future scheduled interview on an active application; interviewer belongs to the organization | Saved applicant email; interview time in organization timezone, duration, location, meeting URL, interviewer name |
| Successful applicant | Application at Offer/Hired with a current offer approved by this organization | Saved applicant email; position and planned start date; not a replacement for the formal offer |
| Rejection | Application already Rejected through the existing authorized status workflow | Saved applicant email; professional rejection without internal evaluation notes |
| Onboarding instructions | Accepted offer, application at Offer/Hired, and Not Started/In Progress onboarding | Saved linked employee email when present, otherwise saved applicant email; start date, outstanding task titles/due dates, and HR-reviewed additional instructions |

The sending action does not approve or send an offer, reject an application, schedule an interview, complete onboarding, or activate an employee account. Those existing permission checks and transitions remain in their original workflows. Hiring Managers cannot use these HR decision-email actions.

## Safety and delivery semantics

- Every preview/send rechecks persisted HR membership and the authenticated request tenant. Organization, recipient, branding, sender identity, interview, offer, onboarding, and employee data are selected server-side. Callers cannot supply a different recipient or sender.
- A changed recipient, sender, subject/body, branding, relevant details, or application status invalidates the confirmation. Sender identity is checked again inside the existing Gmail transaction; a sender switch cannot substitute an unpreviewed account.
- `HrEmailDelivery` is a single durable event record for idempotency and delivery metadata, not a second email transport or automatic queue. Its unique organization/event key and atomic send claim prevent double-clicks, concurrent confirmation, reloads, and repeated previews from submitting the same event twice. A rescheduled interview gets a new invitation slot. Acceptance uses its offer ID; onboarding uses its process ID; acknowledgment/rejection are once per application.
- Statuses are `DRAFT`, `SENDING`, `SUBMITTED`, `FAILED`, and `UNKNOWN`. `SUBMITTED` means provider acceptance, not verified inbox delivery. There is no bounce/webhook tracking in this scope. The record retains the latest status/error and cumulative attempt count, not a full per-attempt audit journal.
- Definite failures allow a fresh preview and explicitly confirmed retry, up to five attempts per event. Ambiguous SMTP/network failure, or a process failure after claiming delivery, blocks repeat sending. Check the sending account before administrator investigation; this feature deliberately has no automatic reset/resend for uncertain delivery.
- Message bodies, applicant internal notes, reviewer comments, storage keys, and OAuth secrets are not stored in the delivery table. New explicit SAGA SMTP sends disable development preview-log success so a console preview is never reported as a submitted email.
- SAGA retains its legacy sender until the existing successful Gmail test and explicit activation. Revert and disconnect still use the existing controls. Other organizations use only their own connected Gmail account. WorkPulse verification, registration, password reset, and account invitation behavior is unchanged.

## Schema and recovery validation

The additive migration is `20261024000200_hr_email_delivery`. Only this new table, indexes, checks, and foreign keys were added on **verified recovery** through the curated migration runner. The unrelated pending candidate-access migration was excluded. Existing applicant, employee, payroll, and other record fingerprints were unchanged. No migration was run against production.

The local Prisma Client was regenerated and the development-cache guard now checks the new delegate. A Windows engine DLL lock was handled by retaining the existing DLL only after verifying it is byte-identical to the generated replacement.

Focused commands:

```powershell
node scripts/email-integration-recovery.cjs workflows
node scripts/email-integration-recovery.cjs test
node scripts/email-integration-recovery.cjs build
node scripts/email-integration-browser.cjs --recipient-only --hr-workflows
node scripts/test-prisma-client-cache.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

The workflow/integration suites use an outer rollback transaction. The browser uses disposable synthetic applicants, offers, interviews, and onboarding records and removes them afterward; all Google calls are intercepted. SMTP calls are mocked. Tests do not modify real applicant or employee records or deliver to real inboxes. The build uses read-only recovery URLs. Preserve these recovery runners rather than invoking test scripts against whichever database happens to be in `.env`.

Results: **168 focused workflow assertions**, **125 existing email integration assertions**, **117 template assertions**, **48 browser assertions**, and **9 database-free Prisma cache checks** passed (467 checks). Full TypeScript, targeted ESLint, whitespace checks, and the read-only recovery production build passed. All **64 tables** had identical existing-record fingerprints after workflow tests, regressions, browser fixture cleanup, and build; the additive migration preserved the original 63 tables' records. Browser checks submitted all five types through the real Server Actions with Google intercepted, verified confirmation and duplicate blocking, and preserved each fixture's application status.

See [validation summary](hr-email-workflows/validation.json), [focused workflow checks](hr-email-workflows/workflow-tests.json), [browser checks](hr-email-workflows/browser-tests.json), and [data preservation](hr-email-workflows/browser-preservation.json). No real delivery was attempted or certified. No production connection/write, push, or deployment occurred.
