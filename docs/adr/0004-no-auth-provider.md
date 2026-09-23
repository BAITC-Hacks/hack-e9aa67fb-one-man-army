# ADR-0004: Seeded role switching instead of an auth provider

- **Status:** accepted
- **Date:** 2026-09-19
- **Deciders:** kit author

## Context

Real authentication costs 45+ minutes of a five-hour budget and earns no points
directly. But *authorization* is scored under reliability and security, and a
fintech demo with no access control is not credible.

These are different problems, and conflating them is the expensive mistake.

## Decision

Skip authentication. Implement authorization properly.

The demo ships seeded identities (citizen, officer, supervisor) and a visible
switcher. Every privileged operation still performs a real server-side
authorization check that fails closed, exactly as it would with real identity.

## Alternatives considered

| Option | Cost | Why not |
| --- | --- | --- |
| NextAuth / Clerk / Supabase Auth | 45+ min, extra config and possibly an account | Buys a login form, not a single scored point |
| No authorization at all | zero | Loses reliability points and makes the demo unbelievable |
| Hand-rolled sessions | 30 min | All of the risk, none of the credibility |

## Consequences

**Good:** the interesting half — role-based access, fail-closed checks, no
insecure direct object access, audited privileged actions — is fully implemented
and demonstrable. The demo can *show* authorization by switching roles, which is
better television than a login screen.

**Bad:** not production-ready. Stated plainly in the README's limitations and in
`SECURITY.md` under accepted risks.

**Reversible?** Yes. Authorization reads an actor from one place; replacing the
switcher with a real identity provider does not touch the checks themselves.
