# ADR-0008: Signed-cookie demo session for employee vs HR (refines ADR-0004)

- **Status:** accepted
- **Date:** 2026-09-23
- **Deciders:** architect

## Context
R-15 requires employee/HR separation enforced server-side. R-16 requires that no employee can see another employee's engagement data. R-13 rules out any personal accounts.

## Decision
`/login` lists the dataset's employee ids plus an "HR" identity. `POST /api/session` sets the HttpOnly, SameSite=Lax cookie `cq_session`, HMAC-signed with `SESSION_SECRET` (the dev default is documented as demo-only). `lib/auth/session.ts` guards run before any data access. An employee can reach only its own id. HR reaches aggregates, individual profiles (audited) and import. Anything unrecognised gets 401/403.

## Security trade-off
Anyone can log in as anyone, by design, for a demo with synthetic data. This is disclosed in the README. What we demonstrate is the authorization, not the authentication. The upgrade path is to swap `getSession` for an SSO/OIDC claim with the same `Session` type.
