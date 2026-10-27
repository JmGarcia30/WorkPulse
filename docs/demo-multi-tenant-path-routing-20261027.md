# WorkPulse multi-tenant path demo — temporary Vercel hosting

## Goal
Demonstrate at least two organizations on the existing canonical Vercel host while retaining SAGA's existing `/saga` path. New workspaces are routed to `/w/<slug>`; login, dashboard and employee pages share the same isolated tenant guard.

This is a **temporary single-host alternative** to the planned custom-domain subdomain rollout. New organizations remain associated with separate `Organization` IDs, and server-side session checks compare the signed organization context to the authenticated session and stored organization.

## Verification before any merge or production enablement
1. Test new public registration from `/register` with two distinct emails and an isolated SMTP catcher; open verification email in the same browser; verify the resulting `/w/<slug>/login`.
2. Test platform-admin manual Create Organization + invitation activation on `/w/<slug>/activate/organization-admin`.
3. Test SAGA original `/saga/login`, `/saga/dashboard`, `/saga/employee`, RFID and careers routes.
4. For tenant B: log in at `/w/<slug>/login`, refresh HR dashboard, browse navigation, create isolated demo records, use export endpoints and log out.
5. Copy tenant B's authentication cookie to SAGA; verify it **cannot** read SAGA HR data. Repeat inverse direction, with anonymous requests, forged routing headers and unknown tenant.
6. Test platform routes and registration while the previous tenant routing cookie is present.
7. Test employee self-service and employee attendance. Confirm API calls / Server Actions see the correct server tenant. Verify tenant B data is not visible from tenant C.
8. Verify organization settings, email integration, public careers, and applicant portal before claiming feature-complete cross-tenant behavior.
9. Confirm same origin for production `PLATFORM_ROOT_DOMAIN` and `PLATFORM_PUBLIC_ORIGIN`. The new feature never requires exposing secrets or changing existing database records.
10. Finalize only after TypeScript, build, RBAC, tenant security tests and safe data-preservation checks pass.

**Never merge solely because Vercel compiles.** There is no automatic tenant creation or production data mutation in the code commit itself.
