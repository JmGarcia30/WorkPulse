# Applicant Archive + HR My ESS — implementation and release checks

## What this changes

1. Applications with status `REJECTED` or `WITHDRAWN` can be archived or restored by HR/Organization Admin.
2. Archive is **not** a new application decision; the status and all documents, applications, recruitment stage history, interviews, offers, email deliveries and candidate-access records remain unchanged. No record is deleted.
3. Archived applications disappear from the ordinary Applicants list and Hiring Pipeline. They appear under the dedicated **Archived** filter, retain their original terminal status, and can be viewed and restored.
4. The mutation has separate persistent 15-minute budgets (30 requests per actor, 300 per tenant), including rejected requests. Successful archive/restore writes a separate append-only `ApplicationArchiveEvent` tied to the actor and organization in the same transaction. Unauthorized, cross-tenant, non-terminal or concurrent changes are rejected.
5. The HR sidebar's **Public Career Site** entry is replaced by **My ESS** on desktop and mobile. The actual public careers URL remains available to applicants; no public career functionality is disabled.
6. HR uses their **existing user login and HR_ADMIN role** for both workspaces. My ESS sends an already-linked, active employee account to `/employee`; otherwise, it shows setup instructions. Existing `Employee Registration → Link existing account` already supports Organization Admin linking to an eligible HR employee. We do not silently create employee records or copy login credentials.

## Schema

Migration: `20261111000200_application_soft_archive`.
- New nullable `Application.archivedAt` field and index.
- New `ApplicationArchiveEvent` append-only table with tenant/account relations and an immutable trigger.
- No historical rows are rewritten; default `archivedAt` is NULL.

**Dependency:** Prior production audit fix PR #23 (`20261111000100_job_lifecycle_audit_actions`) must be reconciled/merged into the repo first; that migration was applied to Production separately. Do **not** apply this new migration until review and test on a production-shaped isolated Neon branch.

## Tests required before production

- Prisma generate/validate, TypeScript typecheck, lint and Next.js production build with current branch.
- Database clone: migrate deploy; verify `_prisma_migrations`, compare old row counts/fingerprints and validate append-only archive events.
- HR archive from REJECTED and WITHDRAWN in both applicant inspector and terminal pipeline; records disappear from default list and pipeline but show under Archived.
- HR restore from Archived and profile; decisions and status history unchanged and the record returns to the regular list.
- Reject APPLIED/SCREENING/HIRED archives, cross-tenant IDs and forged/unauthorized role requests.
- Concurrent duplicate archive clicks must not create multiple audit events; rapid archive/restore must retain a consistent history.
- Candidates retain the same verified portal behavior, with no recruitment status changes or automatic notifications from archiving.
- HR with already-linked active EmployeeAccount enters ESS without creating a second user; password, role and organization remain the same. ESS only shows own data.
- HR without account sees setup instructions; Organization Admin links an existing employee and activated HR account, preserving the current password. Reject mismatched email, role, tenant and inactive employee.
- Public career pages remain functional and reachable externally. Verify desktop/mobile navigation and SAGA `/saga` routing.

## Deployment state

Changes are on a feature branch for review only. No production schema migration, HR account creation, archive action, job status change, deployment or production data mutation has been performed for this feature.
