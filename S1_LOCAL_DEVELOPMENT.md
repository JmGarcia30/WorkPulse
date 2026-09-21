# S1 local tenant routing

Run `npm run dev`, then use `localhost:3000` for the public site, `app.localhost:3000` for workspace discovery, and `saga.localhost:3000` for SAGA.

Modern browsers resolve `*.localhost` to loopback. If yours does not, map `app.localhost` and `saga.localhost` to `127.0.0.1` in the operating-system hosts file. Keep `PLATFORM_ROOT_DOMAIN=localhost:3000`.

Production uses `PLATFORM_ROOT_DOMAIN=workpulse.com` with wildcard DNS/TLS. Authentication cookies are host-only. Hostname supplies routing context only; protected requests also validate the signed session organization against the resolved tenant.
