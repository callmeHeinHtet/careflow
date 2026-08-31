# CareFlow Auth, MFA, and Authorization Implementation Plan

> **Execution:** Complete tasks in order with test-driven development. Run the focused failing test before each implementation, keep `/api/health` public, and require an active MFA-complete database session at every operational data boundary.

**Goal:** Add production-oriented invite-only passwordless staff authentication, revocable database sessions, TOTP MFA, recovery codes, and role authorization to the PostgreSQL-backed CareFlow application.

**Status:** Complete and verified locally on 2026-08-31.

**Architecture:** Auth.js owns email verification tokens, secure cookies, and database sessions through the Prisma adapter. CareFlow owns invitation policy, account activation, MFA assurance, and permissions. SMTP is provider-neutral; Docker Mailpit captures local mail. `src/proxy.ts` performs optimistic page redirects only, while route handlers and repositories call the server authorization layer.

**Stack:** Next.js 16 App Router, Auth.js v5, Prisma 7/PostgreSQL, Nodemailer/SMTP, OTPAuth, Node AES-256-GCM and HMAC-SHA-256, Zod 4, Vitest 4.

## Task 1: Install and configure auth infrastructure

**Files:**
- Modify: `package.json`
- Modify: `compose.yaml`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Modify: `src/server/env.ts`
- Test: `src/server/env.test.ts`

1. Add a failing environment test for required Auth.js, SMTP, MFA-encryption, and recovery-code secrets.
2. Install `next-auth@beta`, `@auth/prisma-adapter`, `nodemailer`, `otpauth`, and required types.
3. Add Mailpit to Docker Compose with SMTP on `1025` and the local web inbox on `8025`.
4. Add safe example values and strict production validation for `AUTH_SECRET`, `AUTH_URL`, SMTP configuration, `MFA_ENCRYPTION_KEY`, and `RECOVERY_CODE_PEPPER`.
5. Run focused tests, lint, and package audit.

## Task 2: Add identity and session schema

**Files:**
- Modify: `prisma/schema.prisma`
- Add: `prisma/migrations/*_auth_identity/migration.sql`
- Modify: `prisma/seed.ts`
- Add: `src/server/auth/schema-contract.test.ts`
- Add: `src/server/auth/auth-integration.test.ts`

1. Add a failing schema contract test for Auth.js adapter models and CareFlow staff/MFA fields.
2. Add `User`, `Account`, `Session`, `VerificationToken`, `StaffProfile`, `MfaSecret`, and `RecoveryCode`; add `StaffRole` and account-status enums.
3. Extend `Session` with `lastSeenAt`, `absoluteExpiresAt`, and `mfaVerifiedAt` so authorization can enforce idle, absolute, and MFA requirements.
4. Generate and apply a migration to both development and disposable test databases.
5. Seed fictional invited staff for all six roles using `.test` addresses.
6. Add database integration coverage for unique employee numbers, deactivated users, sessions, and recovery-code single use.

## Task 3: Implement invite-only Auth.js email login

**Files:**
- Add: `src/auth.ts`
- Add: `src/app/api/auth/[...nextauth]/route.ts`
- Add: `src/server/auth/invite-policy.ts`
- Add: `src/server/auth/invite-policy.test.ts`
- Add: `src/types/next-auth.d.ts`
- Modify: `prisma/seed.ts`

1. Add failing tests that allow only active, pre-created staff email addresses and normalize email safely.
2. Configure the Prisma adapter, Nodemailer provider, database session strategy, secure production cookies, and bounded session expiry.
3. Prevent outbound mail for unknown, inactive, or soft-deleted staff and preserve a non-enumerating sign-in response.
4. Add callbacks that expose only safe user identity, staff role, and MFA status to server code.
5. Verify Auth.js route behavior and token persistence against the test database.

## Task 4: Implement TOTP MFA and recovery codes

**Files:**
- Add: `src/server/auth/mfa-crypto.ts`
- Add: `src/server/auth/mfa-service.ts`
- Add: `src/server/auth/mfa-crypto.test.ts`
- Add: `src/server/auth/mfa-service.integration.test.ts`
- Add: `src/app/api/auth/mfa/setup/route.ts`
- Add: `src/app/api/auth/mfa/verify/route.ts`
- Add: `src/app/api/auth/mfa/recovery/route.ts`

1. Add failing tests for AES-256-GCM secret encryption, tamper rejection, TOTP verification windows, recovery-code hashing, and one-time consumption.
2. Implement versioned authenticated encryption with key material supplied only by the environment.
3. Implement enrollment that stores a pending secret, confirms a valid TOTP, generates one-time recovery codes, and marks the user enrolled transactionally.
4. Implement verification that upgrades only the current database session by setting `mfaVerifiedAt`.
5. Implement recovery-code verification and atomic consumption without returning stored hashes.
6. Apply strict Zod input limits, no-store responses, and generic failure messages.

## Task 5: Add centralized session and role authorization

**Files:**
- Add: `src/server/auth/permissions.ts`
- Add: `src/server/auth/permissions.test.ts`
- Add: `src/server/auth/authorize.ts`
- Add: `src/server/auth/authorize.integration.test.ts`
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `src/app/api/patients/route.ts`

1. Add a failing permission-matrix test for the six approved staff roles.
2. Implement named capabilities rather than scattered role comparisons.
3. Implement a database-backed authorization function that rejects missing, expired, idle, revoked, inactive, or MFA-incomplete sessions and touches `lastSeenAt` at a bounded interval.
4. Protect dashboard and patient APIs at the route/data boundary while leaving health public.
5. Return stable `UNAUTHENTICATED`, `MFA_REQUIRED`, and `FORBIDDEN` envelopes with 401/403 status and `Cache-Control: no-store`.
6. Add integration tests proving unauthenticated and insufficient-role requests cannot reach repositories.

## Task 6: Add sign-in and MFA user flows

**Files:**
- Add: `src/app/sign-in/page.tsx`
- Add: `src/app/sign-in/sign-in-form.tsx`
- Add: `src/app/verify-mfa/page.tsx`
- Add: `src/app/verify-mfa/mfa-form.tsx`
- Add: `src/app/enroll-mfa/page.tsx`
- Add: `src/app/enroll-mfa/enrollment-form.tsx`
- Add: `src/proxy.ts`
- Modify: `src/app/globals.css`

1. Add minimal, accessible CareFlow-styled email, TOTP, recovery, and enrollment screens.
2. Keep account-discovery responses generic and explain that local links appear in Mailpit.
3. Add optimistic page redirects in `src/proxy.ts`; do not query PostgreSQL or treat Proxy as authorization.
4. Require enrollment before operational access and MFA verification for every new session.
5. Verify keyboard behavior, labels, error focus, loading states, and narrow-screen layout.

## Task 7: Security and completion verification

**Files:**
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml` if present, otherwise add it in the later CI phase
- Modify: this plan

1. Document local Mailpit, fictional invited accounts, environment setup, migrations, and the no-real-patient-data boundary.
2. Run a clean migration and seed against newly recreated project-scoped Docker volumes.
3. Run unit tests, integration tests, lint, production build, and `npm audit`.
4. Exercise the real local flow: request a link, retrieve it from Mailpit, sign in, enroll/verify MFA, access protected APIs, sign out, and confirm revocation.
5. Review the diff for leaked secrets, unsafe logging, public operational routes, and generated files.
6. Mark this plan complete and commit Phase 2 in small, reviewable commits. Do not push without explicit user instruction.

## Completion record

- Tasks 1–6 were implemented in focused commits with red-green tests.
- Auth.js email login was exercised against Docker Mailpit with both invited and unknown addresses.
- TOTP enrollment, recovery-code issuance, protected page entry, and responsive layouts were exercised through a real browser.
- Dashboard and patient APIs reject missing or MFA-incomplete database sessions; `/api/health` remains public.
- A clean project-scoped PostgreSQL volume was migrated and seeded from committed files before final completion.
- Unit, integration, lint, production build, and dependency-audit checks all passed at completion.
