# CareFlow

CareFlow is a portfolio-grade hospital operations workstation. It demonstrates a secure staff journey and patient flow from registration through discharge across Reception, Nursing, Doctors, Pharmacy, Cashier, and Admin roles.

CareFlow uses fictional records only. It is not certified for clinical use and must never receive real patient data.

## Local setup

Requirements: Node.js 24+, npm, and Docker Desktop.

```powershell
npm install
Copy-Item .env.example .env.local
npm run services:start
npm run db:deploy
npm run db:seed
npm run dev
```

Before starting the app, replace these three placeholders in `.env.local` with independently generated values:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" # AUTH_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" # MFA_ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))" # RECOVERY_CODE_PEPPER
```

Open:

- CareFlow: `http://localhost:3000`
- Local Mailpit inbox: `http://localhost:8025`

The first sign-in sends a single-use link to Mailpit, then requires TOTP authenticator enrollment. Recovery codes are displayed once. To stop PostgreSQL and Mailpit without deleting data, run `npm run services:stop`.

## Fictional staff invitations

The seed creates one invite per role:

| Role | Email |
| --- | --- |
| Reception | `reception@careflow.test` |
| Nurse | `nurse@careflow.test` |
| Doctor | `doctor@careflow.test` |
| Pharmacy | `pharmacy@careflow.test` |
| Cashier | `cashier@careflow.test` |
| Admin | `admin@careflow.test` |

There are no passwords and no public sign-up. Unknown, suspended, deactivated, or ended-employment addresses receive the same generic browser response but no email or usable token.

## Implemented backend foundation

- PostgreSQL 16 schema and reproducible Prisma migrations for patients, visits, clinical records, inventory, billing, audits, staff identities, sessions, and MFA.
- Deterministic fictional seed with six departments, eight patients, operational records, and six staff invitations.
- Auth.js invite-only email authentication over provider-neutral SMTP.
- Revocable database sessions with absolute expiry, 30-minute idle expiry, and bounded activity refresh.
- Required TOTP MFA with AES-256-GCM encrypted secrets, replay protection, and hashed one-time recovery codes.
- Central capability matrix for all six roles; operational routes enforce authentication, MFA, and role permissions on the server.
- Protected `/api/dashboard` and `/api/patients` reads plus public dependency-aware `/api/health`.
- Responsive sign-in, MFA enrollment, recovery, and verification interfaces.

The visual workstation’s remaining workflow mutations still use its typed client demo store. Transactional server APIs and full client-to-server migration are the next delivery phase; the README does not claim those unfinished workflows are production-backed.

## Architecture and security boundary

`prisma/schema.prisma` defines the canonical PostgreSQL model, `prisma/migrations` contains the migration history, and `prisma/seed.ts` owns fictional seed data. `src/server/auth` owns invite policy, database-session validation, MFA, and permissions. `src/proxy.ts` performs only an optimistic cookie redirect; every protected route repeats authoritative database-backed authorization.

MFA and authentication secrets exist only in environment variables. Sensitive responses use `Cache-Control: no-store`. CareFlow does not log magic-link tokens, MFA secrets, recovery codes, or patient payloads. Production must use a managed PostgreSQL database, HTTPS, a real SMTP provider, independently generated secrets, and migration credentials appropriate to the selected host.

## Integration-test database

Create the isolated test database once after starting services:

```powershell
docker compose exec -T postgres createdb -U careflow careflow_test
Copy-Item .env.test.example .env.test
npm run db:test:deploy
npm run test:integration
```

The integration helper refuses to run unless the database name is exactly `careflow_test`.

## Verification

```powershell
npm test
npm run test:integration
npm run lint
npm run build
npm audit
```
