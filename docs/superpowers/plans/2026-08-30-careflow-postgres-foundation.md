# CareFlow PostgreSQL Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CareFlow's browser-only seed as the canonical data source with a reproducible PostgreSQL 16 database, Prisma migrations, deterministic fictional seed data, tested repositories, and database-backed read APIs.

**Architecture:** Docker Compose runs the same PostgreSQL major version for development and CI. Prisma 7 owns the operational schema and migrations through a standard `DATABASE_URL`; a lazy singleton client and focused repositories isolate persistence from route handlers. Vitest integration tests use a dedicated database URL and reset tables between suites.

**Tech Stack:** Next.js 16.3, TypeScript, PostgreSQL 16, Docker Compose, Prisma 7.10, `@prisma/adapter-pg`, `pg`, Zod 4, Vitest.

---

## File structure

- `compose.yaml` — local PostgreSQL service and persistent development volume.
- `.env.example` and `.env.test.example` — non-secret development and isolated-test environment contracts.
- `prisma.config.ts` — Prisma schema, migration, seed, and datasource configuration.
- `prisma/schema.prisma` — operational relational model and indexes.
- `prisma/migrations/*/migration.sql` — committed database history.
- `prisma/seed.ts` — deterministic fictional development records.
- `src/generated/prisma/` — generated and ignored Prisma client.
- `src/server/db/client.ts` — lazy Prisma client construction.
- `src/server/db/reset-test-db.ts` — integration-test cleanup helper.
- `src/server/repositories/dashboard-repository.ts` — dashboard projection queries.
- `src/server/repositories/patient-repository.ts` — bounded patient search and detail queries.
- `src/server/serializers/patient.ts` — converts Prisma records to API-safe values.
- `src/app/api/health/route.ts` — dependency-aware health endpoint.
- `src/app/api/dashboard/route.ts` — database-backed dashboard read endpoint.
- `src/app/api/patients/route.ts` — cursor-paginated patient search endpoint.
- `tests/integration/database.test.ts` — migration and schema behavior.
- `tests/integration/repositories.test.ts` — real PostgreSQL repository behavior.
- `tests/integration/routes.test.ts` — route contract behavior.
- `vitest.integration.config.mjs` — Node integration-test configuration.

### Task 1: Add PostgreSQL and Prisma tooling

**Files:**
- Create: `compose.yaml`
- Create: `.env.example`
- Create: `.env.test.example`
- Create: `prisma.config.ts`
- Modify: `.gitignore`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add a configuration smoke test**

Create `tests/config/database-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("database configuration", () => {
  it("documents separate development and test database URLs", () => {
    const development = readFileSync(".env.example", "utf8");
    const test = readFileSync(".env.test.example", "utf8");
    expect(development).toContain("/careflow?schema=public");
    expect(test).toContain("/careflow_test?schema=public");
  });

  it("keeps generated Prisma files out of Git", () => {
    const ignore = readFileSync(".gitignore", "utf8");
    expect(ignore).toContain("/src/generated/prisma");
    expect(ignore).toContain("!.env.example");
    expect(ignore).toContain("!.env.test.example");
  });
});
```

- [ ] **Step 2: Run the smoke test and confirm RED**

Run: `npx vitest run tests/config/database-config.test.ts`

Expected: FAIL because the environment examples and generated-client ignore rule do not exist.

- [ ] **Step 3: Install pinned database dependencies**

Run:

```powershell
npm install @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg@8.16.3 zod@4.1.5
npm install --save-dev prisma@7.10.0 tsx@4.20.5 dotenv-cli@8.0.0 @types/pg@8.15.5
```

- [ ] **Step 4: Add local infrastructure and scripts**

Create `compose.yaml` with PostgreSQL 16, health check, named volume, development database `careflow`, and test database creation through `POSTGRES_DB=careflow`. Tests use a separately created `careflow_test` database.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: careflow
      POSTGRES_PASSWORD: careflow_dev
      POSTGRES_DB: careflow
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U careflow -d careflow"]
      interval: 2s
      timeout: 3s
      retries: 15
    volumes:
      - careflow_postgres:/var/lib/postgresql/data

volumes:
  careflow_postgres:
```

Create `.env.example`:

```dotenv
DATABASE_URL=postgresql://careflow:careflow_dev@localhost:5432/careflow?schema=public
```

Create `.env.test.example`:

```dotenv
DATABASE_URL=postgresql://careflow:careflow_dev@localhost:5432/careflow_test?schema=public
```

Create `prisma.config.ts`:

```ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") },
});
```

Add `/src/generated/prisma`, `!.env.example`, and `!.env.test.example` to `.gitignore`, then add scripts:

```json
{
  "db:start": "docker compose up -d postgres",
  "db:stop": "docker compose stop postgres",
  "db:migrate": "dotenv -e .env.local -- prisma migrate dev",
  "db:generate": "prisma generate",
  "db:seed": "dotenv -e .env.local -- prisma db seed",
  "test:integration": "dotenv -e .env.test -- vitest run --config vitest.integration.config.mjs"
}
```

- [ ] **Step 5: Run the smoke test and confirm GREEN**

Run: `npx vitest run tests/config/database-config.test.ts`

Expected: 2 tests pass.

- [ ] **Step 6: Commit tooling**

```powershell
git add compose.yaml .env.example .env.test.example prisma.config.ts .gitignore package.json package-lock.json tests/config/database-config.test.ts
git commit -m "build: add PostgreSQL and Prisma tooling"
```

### Task 2: Define the operational database schema

**Files:**
- Create: `prisma/schema.prisma`
- Create: `tests/schema/schema-contract.test.ts`

- [ ] **Step 1: Write the schema contract test**

The test reads `prisma/schema.prisma` and asserts the presence of the required operational models, PostgreSQL provider, visit version field, unique queue token, immutable transaction models, and critical indexes.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync("prisma/schema.prisma", "utf8");

describe("CareFlow Prisma schema", () => {
  it.each(["Department", "Patient", "PatientAllergy", "Visit", "TriageObservation", "Consultation", "LabOrder", "Medication", "Prescription", "InventoryLot", "InventoryTransaction", "Invoice", "InvoiceLine", "Payment", "AuditEvent"])("defines %s", (model) => {
    expect(schema).toContain(`model ${model} {`);
  });

  it("includes concurrency and query constraints", () => {
    expect(schema).toMatch(/model Visit \{[\s\S]*version\s+Int\s+@default\(1\)/);
    expect(schema).toMatch(/queueToken\s+String\s+@unique/);
    expect(schema).toContain("@@index([stage, priority, arrivedAt])");
    expect(schema).toContain("@@index([lastName, firstName])");
  });
});
```

- [ ] **Step 2: Run the contract test and confirm RED**

Run: `npx vitest run tests/schema/schema-contract.test.ts`

Expected: FAIL because `prisma/schema.prisma` does not exist.

- [ ] **Step 3: Create the complete Phase 1 schema**

Create `prisma/schema.prisma` exactly as follows, then adjust only formatting produced by `prisma format`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Sex { F M OTHER }
enum VisitStage { REGISTRATION WAITING TRIAGE CONSULTATION PHARMACY BILLING DISCHARGED }
enum Priority { ROUTINE SOON URGENT CRITICAL }
enum LabOrderStatus { ORDERED COLLECTED COMPLETED CANCELLED }
enum PrescriptionStatus { ORDERED DISPENSED CANCELLED }
enum InventoryTransactionType { RECEIPT ADJUSTMENT DISPENSE REVERSAL }
enum InvoiceStatus { DRAFT UNPAID PAID VOID }
enum InvoiceLineType { CONSULTATION LAB MEDICATION ADJUSTMENT }
enum PaymentStatus { PENDING COMPLETED VOIDED }
enum PaymentMethod { CASH CARD TRANSFER }

model Department {
  id           String   @id @default(uuid()) @db.Uuid
  code         String   @unique
  name         String   @unique
  active       Boolean  @default(true)
  capacity     Int      @default(1)
  displayOrder Int      @default(0)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  visits       Visit[]

  @@index([active, displayOrder])
}

model Patient {
  id                  String           @id @default(uuid()) @db.Uuid
  medicalRecordNumber String           @unique
  firstName           String
  lastName            String
  dateOfBirth         DateTime         @db.Date
  sex                 Sex
  phone               String
  address             String
  deletedAt           DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt
  allergies           PatientAllergy[]
  visits              Visit[]

  @@index([lastName, firstName])
  @@index([phone])
  @@index([deletedAt])
}

model PatientAllergy {
  id        String   @id @default(uuid()) @db.Uuid
  patientId String   @db.Uuid
  substance String
  notes     String?
  createdAt DateTime @default(now())
  patient   Patient  @relation(fields: [patientId], references: [id], onDelete: Restrict)

  @@unique([patientId, substance])
  @@index([patientId])
}

model Visit {
  id            String              @id @default(uuid()) @db.Uuid
  queueToken    String              @unique
  patientId     String              @db.Uuid
  departmentId  String              @db.Uuid
  stage         VisitStage          @default(REGISTRATION)
  priority      Priority            @default(ROUTINE)
  symptoms      String
  arrivedAt     DateTime
  dischargedAt  DateTime?
  version       Int                 @default(1)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  patient       Patient             @relation(fields: [patientId], references: [id], onDelete: Restrict)
  department    Department          @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  triage        TriageObservation?
  consultation  Consultation?
  labOrders     LabOrder[]
  prescriptions Prescription[]
  invoice       Invoice?

  @@index([stage, priority, arrivedAt])
  @@index([departmentId, arrivedAt])
  @@index([patientId, arrivedAt])
}

model TriageObservation {
  id             String   @id @default(uuid()) @db.Uuid
  visitId        String   @unique @db.Uuid
  temperature    Decimal  @db.Decimal(4, 1)
  bloodPressure  String
  heartRate      Int
  oxygenSat      Int
  notes          String
  authorUserId   String?  @db.Uuid
  recordedAt     DateTime @default(now())
  visit          Visit    @relation(fields: [visitId], references: [id], onDelete: Restrict)
}

model Consultation {
  id           String         @id @default(uuid()) @db.Uuid
  visitId      String         @unique @db.Uuid
  findings     String
  diagnosis    String
  followUp     String?
  authorUserId String?        @db.Uuid
  recordedAt   DateTime       @default(now())
  visit        Visit          @relation(fields: [visitId], references: [id], onDelete: Restrict)
  prescriptions Prescription[]
}

model LabOrder {
  id            String         @id @default(uuid()) @db.Uuid
  visitId       String         @db.Uuid
  name          String
  status        LabOrderStatus @default(ORDERED)
  orderedById   String?        @db.Uuid
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  visit         Visit          @relation(fields: [visitId], references: [id], onDelete: Restrict)

  @@index([visitId, status])
}

model Medication {
  id           String        @id @default(uuid()) @db.Uuid
  code         String        @unique
  name         String
  form         String
  strength     String
  unitPrice    Decimal       @db.Decimal(12, 2)
  reorderAt    Int
  active       Boolean       @default(true)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  lots         InventoryLot[]
  prescriptions Prescription[]
  transactions InventoryTransaction[]

  @@index([active, name])
}

model Prescription {
  id                String             @id @default(uuid()) @db.Uuid
  visitId           String             @db.Uuid
  consultationId    String             @db.Uuid
  medicationId      String             @db.Uuid
  quantity          Int
  directions        String
  status            PrescriptionStatus @default(ORDERED)
  orderedByUserId   String?            @db.Uuid
  dispensedByUserId String?            @db.Uuid
  orderedAt         DateTime           @default(now())
  dispensedAt       DateTime?
  visit             Visit              @relation(fields: [visitId], references: [id], onDelete: Restrict)
  consultation      Consultation       @relation(fields: [consultationId], references: [id], onDelete: Restrict)
  medication        Medication         @relation(fields: [medicationId], references: [id], onDelete: Restrict)
  transactions      InventoryTransaction[]

  @@index([visitId, status])
  @@index([medicationId, status])
}

model InventoryLot {
  id             String                 @id @default(uuid()) @db.Uuid
  medicationId   String                 @db.Uuid
  batchNumber    String
  expiresAt      DateTime               @db.Date
  quantityOnHand Int
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
  medication     Medication             @relation(fields: [medicationId], references: [id], onDelete: Restrict)
  transactions   InventoryTransaction[]

  @@unique([medicationId, batchNumber])
  @@index([medicationId, expiresAt])
}

model InventoryTransaction {
  id             String                   @id @default(uuid()) @db.Uuid
  medicationId   String                   @db.Uuid
  lotId          String?                  @db.Uuid
  prescriptionId String?                  @db.Uuid
  type           InventoryTransactionType
  quantity       Int
  notes          String?
  actorUserId    String?                  @db.Uuid
  createdAt      DateTime                 @default(now())
  medication     Medication               @relation(fields: [medicationId], references: [id], onDelete: Restrict)
  lot            InventoryLot?            @relation(fields: [lotId], references: [id], onDelete: Restrict)
  prescription   Prescription?            @relation(fields: [prescriptionId], references: [id], onDelete: Restrict)

  @@index([medicationId, createdAt])
  @@index([prescriptionId])
}

model Invoice {
  id        String        @id @default(uuid()) @db.Uuid
  visitId   String        @unique @db.Uuid
  status    InvoiceStatus @default(DRAFT)
  currency  String        @default("MMK")
  subtotal  Decimal       @db.Decimal(12, 2)
  total     Decimal       @db.Decimal(12, 2)
  version   Int           @default(1)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  visit     Visit         @relation(fields: [visitId], references: [id], onDelete: Restrict)
  lines     InvoiceLine[]
  payments  Payment[]

  @@index([status, createdAt])
}

model InvoiceLine {
  id          String          @id @default(uuid()) @db.Uuid
  invoiceId   String          @db.Uuid
  type        InvoiceLineType
  description String
  quantity    Int             @default(1)
  unitPrice   Decimal         @db.Decimal(12, 2)
  total       Decimal         @db.Decimal(12, 2)
  createdAt   DateTime        @default(now())
  invoice     Invoice         @relation(fields: [invoiceId], references: [id], onDelete: Restrict)

  @@index([invoiceId])
}

model Payment {
  id            String        @id @default(uuid()) @db.Uuid
  invoiceId     String        @db.Uuid
  amount        Decimal       @db.Decimal(12, 2)
  method        PaymentMethod
  status        PaymentStatus @default(PENDING)
  reference     String?       @unique
  cashierUserId String?       @db.Uuid
  paidAt        DateTime?
  createdAt     DateTime      @default(now())
  invoice       Invoice       @relation(fields: [invoiceId], references: [id], onDelete: Restrict)

  @@index([invoiceId, status])
}

model AuditEvent {
  id            String   @id @default(uuid()) @db.Uuid
  actorUserId   String?  @db.Uuid
  actorName     String
  roleSnapshot  String
  action        String
  entityType    String
  entityId      String
  before        Json?
  after         Json?
  correlationId String
  ipAddress     String?
  createdAt     DateTime @default(now())

  @@index([entityType, entityId, createdAt])
  @@index([actorUserId, createdAt])
  @@index([createdAt])
}
```

- [ ] **Step 4: Validate and generate the client**

Run:

```powershell
npx prisma format
npx prisma validate
npx prisma generate
```

Expected: each command exits 0 and the contract test passes.

- [ ] **Step 5: Commit the schema**

```powershell
git add prisma/schema.prisma tests/schema/schema-contract.test.ts
git commit -m "feat: define CareFlow operational schema"
```

### Task 3: Create and verify the initial migration

**Files:**
- Create: `prisma/migrations/*/migration.sql`
- Create: `vitest.integration.config.mjs`
- Create: `tests/integration/database.test.ts`
- Create: `src/server/db/reset-test-db.ts`

- [ ] **Step 1: Start PostgreSQL and create the test database**

Run:

```powershell
docker compose up -d --wait postgres
docker compose exec -T postgres psql -U careflow -d postgres -c "SELECT 'CREATE DATABASE careflow_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'careflow_test')\gexec"
```

- [ ] **Step 2: Create local environment files from the safe contracts when absent**

Run only if `.env.local` does not exist:

```powershell
Copy-Item .env.example .env.local
Copy-Item .env.test.example .env.test
```

- [ ] **Step 3: Generate the initial migration**

Run: `npx dotenv -e .env.local -- prisma migrate dev --name operational_foundation`

Expected: migration applies to `careflow` and Prisma client generation succeeds.

- [ ] **Step 4: Write the failing database integration test**

The test connects with `DATABASE_URL` loaded from `.env.test`, verifies the PostgreSQL major version is 16, inserts a department/patient/visit, rejects duplicate queue tokens, and verifies deleting a patient with a visit is restricted.

- [ ] **Step 5: Run the integration test and confirm RED before applying the test migration**

Run: `npm run test:integration -- tests/integration/database.test.ts`

Expected: FAIL because the test database has no CareFlow tables.

- [ ] **Step 6: Apply migrations to the test database and confirm GREEN**

Run:

```powershell
npx dotenv -e .env.test -- prisma migrate deploy
npm run test:integration -- tests/integration/database.test.ts
```

Expected: integration test passes. The integration script and migration command both load `.env.test`, so neither can target the development database accidentally.

- [ ] **Step 7: Commit migration and integration harness**

```powershell
git add prisma/migrations vitest.integration.config.mjs tests/integration/database.test.ts src/server/db/reset-test-db.ts
git commit -m "feat: add initial PostgreSQL migration"
```

### Task 4: Add the lazy database client and health check

**Files:**
- Create: `src/server/env.ts`
- Create: `src/server/db/client.ts`
- Create: `src/app/api/health/route.ts`
- Create: `tests/server/env.test.ts`
- Create: `tests/integration/health-route.test.ts`

- [ ] **Step 1: Write failing environment and health tests**

`tests/server/env.test.ts` asserts `readServerEnv({})` returns a structured missing-variable error and accepts a valid PostgreSQL URL. `tests/integration/health-route.test.ts` imports `GET`, calls it against the running database, and expects `{ status: "ok", database: "reachable" }` with HTTP 200.

- [ ] **Step 2: Run both tests and confirm RED**

Run:

```powershell
npx vitest run tests/server/env.test.ts
npm run test:integration -- tests/integration/health-route.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement validated lazy database construction**

`src/server/env.ts` uses Zod to validate `DATABASE_URL` only when server data access is invoked. `src/server/db/client.ts` exposes `getDb()` and caches a `PrismaClient` in development without constructing it at module import time:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { getServerEnv } from "../env";

const globalForDb = globalThis as typeof globalThis & { careflowDb?: PrismaClient };

export function getDb() {
  if (globalForDb.careflowDb) return globalForDb.careflowDb;
  const adapter = new PrismaPg({ connectionString: getServerEnv().DATABASE_URL });
  const client = new PrismaClient({ adapter });
  if (process.env.NODE_ENV !== "production") globalForDb.careflowDb = client;
  return client;
}
```

The health route performs `SELECT 1`, returns HTTP 200 when reachable, and HTTP 503 with `{ status: "degraded", database: "unreachable" }` on connection failure. It never returns exception messages or configuration values.

- [ ] **Step 4: Run tests and confirm GREEN**

Run the two commands from Step 2.

Expected: all environment and health tests pass.

- [ ] **Step 5: Commit database runtime**

```powershell
git add src/server/env.ts src/server/db/client.ts src/app/api/health/route.ts tests/server/env.test.ts tests/integration/health-route.test.ts
git commit -m "feat: add validated database runtime"
```

### Task 5: Seed deterministic fictional operations data

**Files:**
- Create: `prisma/seed.ts`
- Create: `tests/integration/seed.test.ts`
- Modify: `README.md`

- [ ] **Step 1: Write the failing seed integrity test**

The test resets the test database, runs the seed function twice, and asserts both runs produce exactly:

- 6 departments;
- 8 patients;
- 8 active or completed visits with unique queue tokens;
- 4 medications and inventory lots;
- invoices for billing/discharged visits;
- 3 baseline audit events;
- no names, emails, or phone numbers outside the documented fictional seed set.

- [ ] **Step 2: Run the seed test and confirm RED**

Run: `npm run test:integration -- tests/integration/seed.test.ts`

Expected: FAIL because the seed module does not exist.

- [ ] **Step 3: Implement an idempotent seed transaction**

Export `seedCareFlow(db)` from `prisma/seed.ts`. Use stable UUIDs and upserts for reference data, delete/recreate only known demo records in dependency order, and wrap the operation in a transaction. Keep the eight existing fictional patients and current queue tokens so the UI remains recognizable.

The executable footer creates a database client, calls `seedCareFlow`, logs only record counts, and disconnects in `finally`.

- [ ] **Step 4: Run seed and integrity tests**

Run:

```powershell
npm run db:seed
npm run test:integration -- tests/integration/seed.test.ts
```

Expected: seed succeeds and the integration test passes on repeated runs.

- [ ] **Step 5: Document database startup and seed commands**

Update README with exact commands: install, copy `.env.example`, `db:start`, `db:migrate`, `db:seed`, `dev`, `test`, and `test:integration`. Retain the fictional-data warning.

- [ ] **Step 6: Commit deterministic seed**

```powershell
git add prisma/seed.ts tests/integration/seed.test.ts README.md
git commit -m "feat: seed fictional CareFlow operations data"
```

### Task 6: Build tested dashboard and patient repositories

**Files:**
- Create: `src/server/repositories/dashboard-repository.ts`
- Create: `src/server/repositories/patient-repository.ts`
- Create: `src/server/serializers/patient.ts`
- Create: `tests/integration/repositories.test.ts`

- [ ] **Step 1: Write failing repository integration tests**

Tests seed the database and assert:

- dashboard totals, waiting count, completed count, average wait, low-stock count, and department capacity are derived from rows;
- patient search matches queue token, first name, last name, or department case-insensitively;
- patient listing returns at most 25 records and a nullable cursor;
- soft-deleted patients never appear;
- serialized decimal values become numbers and dates become ISO strings.

- [ ] **Step 2: Run repository tests and confirm RED**

Run: `npm run test:integration -- tests/integration/repositories.test.ts`

Expected: FAIL because repositories do not exist.

- [ ] **Step 3: Implement focused read repositories**

Expose:

```ts
export async function getDashboardSnapshot(db: PrismaClient, now: Date): Promise<DashboardSnapshot>;
export async function listPatients(db: PrismaClient, input: { query?: string; cursor?: string; limit: number }): Promise<PatientPage>;
export async function getPatientById(db: PrismaClient, id: string): Promise<PatientDetail | null>;
```

Use Prisma predicates, relation selection, cursor pagination, and aggregate queries. Clamp limit to `1..25`. Do not expose Prisma records directly from the repository boundary.

- [ ] **Step 4: Run repository tests and confirm GREEN**

Run: `npm run test:integration -- tests/integration/repositories.test.ts`

Expected: all repository tests pass.

- [ ] **Step 5: Commit repositories**

```powershell
git add src/server/repositories src/server/serializers tests/integration/repositories.test.ts
git commit -m "feat: add database-backed operations repositories"
```

### Task 7: Expose database-backed read APIs

**Files:**
- Create: `src/server/http/json-response.ts`
- Create: `src/app/api/dashboard/route.ts`
- Create: `src/app/api/patients/route.ts`
- Create: `tests/integration/routes.test.ts`

- [ ] **Step 1: Write failing route contract tests**

Call route handlers directly with real `Request` objects and assert:

- dashboard returns `{ data: snapshot }` and `Cache-Control: no-store`;
- patients supports `query`, `cursor`, and `limit`;
- `limit=1000` is clamped to 25;
- malformed cursor returns HTTP 400 with `{ error: { code: "VALIDATION_FAILED", message: "Invalid patient query" } }`;
- unexpected repository errors return a generic HTTP 500 response without database details.

- [ ] **Step 2: Run route tests and confirm RED**

Run: `npm run test:integration -- tests/integration/routes.test.ts`

Expected: FAIL because route modules do not exist.

- [ ] **Step 3: Implement response helper and route handlers**

Use Zod query parsing and the repository functions. All responses follow:

```ts
type ApiSuccess<T> = { data: T };
type ApiFailure = { error: { code: string; message: string; fields?: Record<string, string[]> } };
```

Set `Cache-Control: no-store` on patient and dashboard responses. Log a generated correlation ID for unexpected failures without patient data and return it as `X-Correlation-Id`.

- [ ] **Step 4: Run route tests and confirm GREEN**

Run: `npm run test:integration -- tests/integration/routes.test.ts`

Expected: all route contract tests pass.

- [ ] **Step 5: Commit read APIs**

```powershell
git add src/server/http src/app/api/dashboard src/app/api/patients tests/integration/routes.test.ts
git commit -m "feat: add database-backed CareFlow read APIs"
```

### Task 8: Phase 1 verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-30-careflow-postgres-foundation.md`

- [ ] **Step 1: Verify a fresh database lifecycle**

Run:

```powershell
docker compose down -v
docker compose up -d --wait postgres
docker compose exec -T postgres psql -U careflow -d postgres -c "SELECT 'CREATE DATABASE careflow_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'careflow_test')\gexec"
Copy-Item .env.example .env.local -Force
Copy-Item .env.test.example .env.test -Force
npx dotenv -e .env.local -- prisma migrate deploy
npx dotenv -e .env.test -- prisma migrate deploy
npm run db:seed
```

Expected: PostgreSQL starts healthy, the same committed migrations apply to development and test databases, and seed reports deterministic counts.

- [ ] **Step 2: Run all verification commands**

Run:

```powershell
npm test
npm run test:integration
npm run lint
npm run build
```

Expected: all unit/config tests, integration tests, lint, TypeScript, and Next.js production build pass with no warnings caused by CareFlow.

- [ ] **Step 3: Verify API behavior through the running server**

Start `npm run dev`, then request `/api/health`, `/api/dashboard`, `/api/patients?limit=3`, and `/api/patients?query=May`. Confirm HTTP status, no-store headers, bounded results, and absence of secrets or raw Prisma objects.

- [ ] **Step 4: Update the README architecture section**

Describe PostgreSQL as canonical state, Prisma migrations, fictional seed data, API endpoints, test database isolation, and the fact that authentication arrives in Phase 2 before production deployment.

- [ ] **Step 5: Mark every completed checkbox in this plan and commit**

```powershell
git add README.md docs/superpowers/plans/2026-08-30-careflow-postgres-foundation.md
git commit -m "docs: complete PostgreSQL foundation phase"
```

## Phase 1 completion gate

Phase 1 is complete only when a clean checkout can start PostgreSQL, apply committed migrations, seed fictional data, pass all unit and integration tests, build the app, and serve database-backed health/dashboard/patient APIs. The UI remains visually unchanged in this phase. Phase 2 adds Auth.js, invite-only staff identities, server-enforced role authorization, account controls, and MFA before any API is considered production-accessible.
