# CareFlow

CareFlow is a portfolio-grade hospital operations workstation MVP. It demonstrates patient flow from registration through discharge across Reception, Nursing, Doctors, Pharmacy, Cashier, and Admin workflows.

## Run locally

```bash
npm install
npm run db:start
copy .env.example .env.local
npm run db:migrate -- --name local_setup
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. Docker must be running for the PostgreSQL-backed API. The committed environment examples contain development-only credentials for the local container; production credentials must be provided through the deployment environment.

To stop the local database without deleting its volume, run `npm run db:stop`.

## Features

- Persistent workstation shell with role switcher, patient search, responsive navigation, and reset control.
- Overview KPIs, live queue, department load, safety alerts, and recent activity.
- Patient registry and detail drawer with demographics, allergies, visit history, and the Registration → Triage → Consultation → Pharmacy → Billing → Discharged journey rail.
- Queue priority ordering, triage capture, doctor-entered consultation, fictional lab requests, inventory-backed prescriptions, pharmacy stock/allergy guards, billing, and discharge.
- Append-only audit timeline with actor, role, patient, timestamp, and details.
- PostgreSQL 16 operational schema with deterministic fictional seed data and immutable audit records.
- Dependency-aware database health endpoint at `/api/health`.
- The visual workstation still uses its typed client store while server-backed workflow APIs are completed in the next implementation phases.

## Architecture

PostgreSQL is the canonical server datastore. `prisma/schema.prisma` defines the operational relational model, `prisma/migrations` contains its reproducible history, and `prisma/seed.ts` owns deterministic fictional records. `src/server` contains build-safe database access and will contain authorization and repositories. Existing pure workflow functions under `src/lib` remain in place until their transactional server replacements are connected.

## Database tests

Create the isolated test database once after starting PostgreSQL:

```bash
docker compose exec -T postgres createdb -U careflow careflow_test
copy .env.test.example .env.test
npx dotenv -e .env.test -- prisma migrate deploy
npm run test:integration
```

The integration test helper refuses to connect unless the database name is exactly `careflow_test`.

## Demo-data warning

This is a demo environment with fictional records only. It is not a clinical system and makes no automated medical decisions. Do not enter real patient data.

## Verification

```bash
npm test
npm run test:integration
npm run lint
npm run build
```
