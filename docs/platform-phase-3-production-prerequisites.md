# Platform Phase 3: production workspace prerequisites

**Production onboarding is not verified or ready to enable from this local checkout.** The read-only local preflight found no `PLATFORM_ROOT_DOMAIN` or `PLATFORM_PUBLIC_ORIGIN` in `.env`. Vercel's remote environment, domain ownership, DNS, certificates and real SMTP delivery were not inspected or changed. Credential presence alone is not delivery verification. See `platform-phase-3/local-domain-readiness.json`.

## Supported routing contract

This phase supports configured tenant **subdomains**, with a database organization lookup and tenant-bound authentication. It does not admit arbitrary custom domains, even if someone points a CNAME at the deployment. A future verified, unique domain registry would be required before admitting independent customer domains.

For an owned root such as `workpulse.example.com`, configure the following application environment values through the approved release process, not by copying test credentials:

| Variable | Required production value |
| --- | --- |
| `PLATFORM_ROOT_DOMAIN` | `workpulse.example.com` — hostname only, without a scheme, path, trailing dot or port |
| `PLATFORM_PUBLIC_ORIGIN` | `https://workpulse.example.com` |
| `SESSION_SECRET` | Stable, random, private value of at least 32 characters; identical across the application's proxy/server instances; separate from isolated test environments |
| `DATABASE_URL` | Approved production database connection for the application/proxy; never the recovery URL |
| `EMAIL_FROM` | Provider-authorized WorkPulse sender email address |
| SMTP variables | Provider-specific values described below |

The public host serves `/platform`. `www.workpulse.example.com` is also a recognized public alias if deliberately configured. `app.workpulse.example.com` serves workspace discovery. `saga.workpulse.example.com` and `st-aloysius.workpulse.example.com` both map to the existing `st-aloysius` organization. An onboarded slug such as `company-b` resolves at `company-b.workpulse.example.com`; an unknown slug returns 404. Slug existence is not user authorization: the tenant session must also match the resolved organization.

Do not configure the production root as a generated deployment hostname merely to bypass a missing owned domain. The SAGA-only temporary `.vercel.app` path remains supported for SAGA; Phase 2 intentionally blocks new-organization creation there.

## DNS and Vercel domain assignment

1. Verify control of the intended root and choose the WorkPulse Vercel project/environment.
2. In **Project Settings → Domains**, assign the root and `*.workpulse.example.com` to that environment. Add `www` only if used.
3. Apply the exact A/CNAME/verification values shown for that project. With an external DNS provider, the documented wildcard alternative delegates `_acme-challenge.workpulse` via NS to `ns1.vercel-dns.com.` and `ns2.vercel-dns.com.`, and routes `*.workpulse` via CNAME to `cname.vercel-dns-0.com.`. Alternatively use Vercel's nameservers. Preserve existing mail/verification records. Verify the current dashboard instructions before changing anything. These values and options come from [Vercel's domain configuration guide](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

The root itself must also resolve; a wildcard does not cover it. Confirm public root, discovery, SAGA and a registered Company B hostname all reach the same intended deployment. Confirm an unregistered hostname is rejected by WorkPulse. Nothing in this task assigned domains or changed DNS.

## HTTPS and forwarding

Vercel certificate issuance depends on successful domain validation and propagated DNS. Verify both root and wildcard certificate status and renewal configuration before sending activation emails. See [Vercel SSL documentation](https://vercel.com/docs/domains/working-with-ssl).

Production login and platform cookies use Secure, HttpOnly, host-only cookies. Internal routing signatures use the stable session secret with a separate HMAC purpose. Deployments must preserve the requested `Host`; `X-Forwarded-Host`, when present, must contain the same single authority. Mismatched/list-valued forwarded hosts are rejected. Additional reverse proxies must strip untrusted forwarding/internal routing headers, preserve the real authority, and prevent direct untrusted access to the origin. Vercel documents `X-Forwarded-Host` as identical to `Host`: [request-header contract](https://vercel.com/docs/headers/request-headers).

Hostnames route requests; they are never proof of user membership. JWT signature, current persisted user role/organization, and resolved request tenant are checked together. Do not enable wildcard Server Action allowed origins to work around a host mismatch. Fix the domain/proxy configuration instead. Preserve dynamic authenticated response caching semantics; do not cache authenticated HTML/RSC/API responses across hosts or users.

## SMTP and actual activation delivery

The existing transport accepts either `GMAIL_USER` plus `GMAIL_APP_PASSWORD`, or `SMTP_USER` plus `SMTP_PASSWORD`; a custom server additionally uses `SMTP_HOST`, `SMTP_PORT` and `SMTP_SECURE`. Configure one coherent transport, avoiding stale Gmail variables overriding an intended custom SMTP user. Provide `EMAIL_FROM` when the SMTP login is not itself a valid sender email.

For implicit TLS on port 465, use `SMTP_SECURE=true`. For provider-supported STARTTLS on port 587, use `SMTP_SECURE=false` and verify the provider upgrades the connection securely; do not disable certificate verification. These transport conventions are documented by [Nodemailer](https://nodemailer.com/smtp). Follow the chosen provider's sender-domain verification and mail-DNS requirements.

Before live onboarding, send an approved test invitation to a controlled real mailbox and confirm delivery, sender identity, HTTPS tenant hostname, activation, normal login, expiry, resend and revocation. The tests here use a loopback-only sink accepting synthetic `.invalid` recipients. No real SMTP provider or mailbox was contacted; real deliverability remains unverified.

## Local and isolated preview support

No production DNS change is needed for local verification:

```text
npm run dev -- --port 3000
```

The existing recovery-only development runner verifies its isolated database profile and sets `PLATFORM_ROOT_DOMAIN=localhost:3000` and the matching public origin in the child process. It respects a requested local port. No environment file is changed.

| Local URL | Purpose |
| --- | --- |
| `http://localhost:3000/platform` | Separate System Administrator interface |
| `http://app.localhost:3000` | Workspace discovery |
| `http://saga.localhost:3000` | Existing SAGA via subdomain |
| `http://st-aloysius.localhost:3000` | Existing canonical SAGA alias |
| `http://localhost:3000/saga` | Existing SAGA path workspace |
| `http://<registered-slug>.localhost:3000` | New organization workspace |

If a local resolver does not resolve `*.localhost`, map only the required test hosts to loopback using local resolver/browser configuration. The automated preview harness binds to loopback on port 3133, supplies its own verified recovery environment, starts a production build and uses synthetic SMTP. It does not require a Vercel deployment or production DNS.

For a remotely hosted preview, use a separately owned staging root and wildcard assigned to the Preview environment, with isolated database/storage/email credentials and a different session secret. Do not assume a production deployment staged behind a generated URL is isolated: Vercel distinguishes preview credentials from staged production credentials in its [environment documentation](https://vercel.com/docs/deployments/environments). A standalone generated `.vercel.app` URL is not a wildcard tenant namespace. Retain deployment protection where configured; do not disable it to make tenant tests pass.

## Release blockers

- Owned production root, actual Vercel bindings and HTTPS remain unverified; the local root/public-origin inputs are absent.
- Real SMTP sender authorization and mailbox deliverability remain unverified.
- Production migration history and application of the earlier Platform Phase 1/2 migrations still need the approved release process. Phase 3 adds no migration and applied none.
- New organizations must configure their own HR/payroll policies; SAGA configuration is not copied.

This document is a release prerequisite checklist, not authorization to change production infrastructure. No push, deployment, domain assignment, DNS update, production database connection, or production migration was performed.
