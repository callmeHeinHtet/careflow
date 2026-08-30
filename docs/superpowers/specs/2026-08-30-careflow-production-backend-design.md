# CareFlow Production Backend Design

**Date:** 2026-08-30

**Status:** Approved architecture; implementation pending

**Scope:** Replace CareFlow's browser-only demo state with a production-oriented PostgreSQL and Auth.js backend while preserving the current clinical operations interface and workflows.

## 1. Objective

CareFlow will become a complete full-stack hospital operations portfolio application. All operational state will be stored in PostgreSQL and accessed through authenticated, authorized server endpoints. The implementation will remain clearly labeled as a fictional-data demonstration and will not claim regulatory certification or readiness for real patient data.

Success means:

- staff authenticate with durable, revocable sessions;
- every protected read and mutation enforces role permissions on the server;
- patient workflow transitions are persisted transactionally;
- inventory, billing, and audit records remain consistent under concurrent requests;
- the existing dashboard reads database-backed information instead of `localStorage`;
- migrations, seed data, tests, and CI are reproducible from a fresh Git checkout;
- the application can later deploy to Vercel with any managed PostgreSQL service that provides a standard connection string.

## 2. Architecture

### 2.1 Runtime

- Next.js 16 App Router remains the application framework.
- Route handlers under `src/app/api` expose the application API.
- Server components may perform protected reads through the data-access layer when that reduces client round trips.
- Client components use the API for interactive mutations and refresh authoritative server state afterward.
- `src/proxy.ts` performs optimistic session redirects only. It does not replace authorization at the data layer.

### 2.2 Persistence

- PostgreSQL 16 is the canonical datastore.
- Docker Compose provides PostgreSQL for local development and CI-compatible workflows.
- Prisma ORM owns the typed schema, generated client, migrations, and seed process.
- Production uses the same schema and migrations against a managed PostgreSQL connection.
- No runtime patient, workflow, inventory, billing, session, or audit state is stored in `localStorage`.

### 2.3 Authentication

- Auth.js provides the session framework and route integration.
- Authentication uses invite-only passwordless email staff accounts; there is no public sign-up.
- Auth.js sends single-use magic links through SMTP only after confirming the address belongs to an active invited staff member.
- Sessions are database-backed, revocable, use secure cookies in production, and have absolute and idle expiry.
- Administrators invite staff accounts by email. Local development routes mail to Mailpit; production accepts any standard SMTP provider through environment variables.
- Authentication endpoints are rate-limited and return non-enumerating responses for unknown or inactive addresses.
- TOTP two-factor authentication is required after enrollment. Recovery codes are one-time values stored only as hashes.
- Authentication secrets, encryption keys, and database credentials exist only in environment variables and are never committed.

### 2.4 Authorization

Supported roles remain:

- Reception
- Nurse
- Doctor
- Pharmacy
- Cashier
- Admin

Every protected operation calls a shared authorization function near the data-access boundary. The UI may hide unauthorized controls, but UI visibility is never treated as enforcement.

Permission summary:

| Capability | Reception | Nurse | Doctor | Pharmacy | Cashier | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Read operational dashboard | Yes | Yes | Yes | Yes | Yes | Yes |
| Register/update patient demographics | Yes | Limited | Read | Read | Read | Yes |
| Change queue priority | Yes | Yes | No | No | No | Yes |
| Record triage | No | Yes | Read | No | No | Yes |
| Record consultation/orders | No | Read | Yes | Read | No | Yes |
| Dispense medication/adjust stock | No | No | Read | Yes | No | Yes |
| Settle invoice | No | No | Read | Read | Yes | Yes |
| Manage staff/departments/settings | No | No | No | No | No | Yes |
| Read audit history | Limited | Limited | Limited | Limited | Limited | Yes |

Limited audit access means events related to the staff member's permitted workflow area; Admin can inspect all events.

## 3. Data Model

### 3.1 Identity and organization

- `User`: Auth.js identity fields, account status, MFA enrollment state, timestamps, and soft-deactivation metadata.
- `Account`, `Session`, and `VerificationToken`: Auth.js adapter records.
- `StaffProfile`: user-facing name, employee number, role, department, employment status.
- `MfaSecret`: encrypted TOTP secret and enrollment timestamp.
- `RecoveryCode`: hashed one-time recovery code and consumption timestamp.
- `Department`: name, code, active status, capacity, and display order.
- `Shift`: start/end time, label, active status, and optional department assignment.
- `StaffShift`: many-to-many roster assignment between staff and shifts.

### 3.2 Patient operations

- `Patient`: stable internal identifier, medical record number, demographics, contact information, and soft-delete fields.
- `PatientAllergy`: normalized allergy records rather than a string array.
- `Visit`: queue token, department, arrival time, current stage, priority, symptoms, version number, and discharge timestamp.
- `TriageObservation`: temperature, blood pressure, heart rate, oxygen saturation, notes, author, and timestamp.
- `Consultation`: findings, diagnosis text entered by a doctor, follow-up, author, and timestamp.
- `LabOrder`: ordered investigation, status, ordering clinician, and timestamps.
- `Prescription`: medication, quantity, directions, status, ordering clinician, and dispensing record.

CareFlow stores clinician-entered information but does not generate diagnoses or treatment recommendations.

### 3.3 Inventory and billing

- `Medication`: name, form, strength, unit price, reorder threshold, and active status.
- `InventoryLot`: batch, expiry, quantity on hand, and acquisition metadata.
- `InventoryTransaction`: immutable receipt, adjustment, reservation, dispense, or reversal entry.
- `Invoice`: visit, status, totals, currency, version, and timestamps.
- `InvoiceLine`: typed consultation, lab, medication, or adjustment line.
- `Payment`: amount, method, reference, cashier, status, and timestamp.

Stock is calculated from inventory transactions and may be cached in a transactionally updated balance field. Dispensing cannot create negative stock. Invoice totals are calculated on the server from persisted line items; clients cannot submit trusted totals.

### 3.4 Audit and safety

- `AuditEvent`: immutable actor, role snapshot, action, entity type/id, before/after JSON where appropriate, request correlation identifier, IP metadata where available, and timestamp.
- Audit records are written in the same PostgreSQL transaction as the mutation they describe.
- Normal application code cannot update or delete audit events.
- Patient and staff records use soft deletion where removal is permitted. Clinical events, payments, inventory movements, and audit events are never hard-deleted through the application.

## 4. Workflow Rules

Valid visit stages are:

`registration -> waiting -> triage -> consultation -> pharmacy -> billing -> discharged`

The server owns transition rules. A transition verifies:

1. the authenticated role may perform it;
2. the visit is currently in an allowed source stage;
3. required information for the target stage exists;
4. the submitted version matches the persisted version;
5. dependent inventory or billing operations can complete;
6. the workflow mutation and audit event commit together.

Invalid or stale transitions return a conflict response and the latest visit state. The UI shows a clear message and refreshes rather than silently overwriting another user's work.

## 5. API Surface

All endpoints return JSON with a consistent success or error envelope. Mutations accept an idempotency key and validated request body.

Initial route groups:

- `GET /api/dashboard` — metrics, attention items, capacity, and queue summary.
- `GET|POST /api/patients` — search/list and registration.
- `GET|PATCH /api/patients/:id` — authorized patient detail and demographic update.
- `GET /api/visits` and `GET /api/visits/:id` — filtered operational views.
- `POST /api/visits/:id/triage` — triage capture and transition.
- `POST /api/visits/:id/consultation` — consultation, lab orders, prescriptions, and transition.
- `POST /api/visits/:id/dispense` — atomic stock movement and workflow transition.
- `POST /api/visits/:id/payment` — atomic payment and discharge transition.
- `GET|POST|PATCH /api/inventory` — inventory reads and authorized adjustments.
- `GET /api/audit` — permission-filtered audit stream.
- `GET|POST|PATCH /api/admin/users` — Admin-only staff management.
- `GET|POST|PATCH /api/admin/departments` — Admin-only department management.
- `GET|POST|PATCH /api/admin/shifts` — Admin-only schedule and roster management.
- `GET|POST /api/auth/*` — Auth.js handlers and MFA completion endpoints.
- `GET /api/health` — dependency-aware health response without sensitive details.

Pagination is cursor-based for patients, visits, inventory movements, and audit events. Search inputs are bounded and indexed. Rate limits apply to sign-in, recovery, exports, and mutation endpoints.

## 6. UI Integration

- `CareFlowApp` no longer initializes domain state from `createDemoState()` or persists to `localStorage`.
- The authenticated session supplies the real staff identity and role; the role switcher is removed from production mode.
- A demo-mode seed may include separate test accounts for every role, but changing role requires signing in as that account.
- Overview metrics, queues, rosters, appointments, departments, inventory, billing, and reports load from server data.
- Static support screens introduced during the redesign become database-backed features.
- Global patient search and the persistent fictional-demo notice are restored.
- Mutations use pending, success, validation-error, forbidden, and conflict states.
- Sensitive patient responses use `Cache-Control: no-store`.

## 7. Validation and Error Handling

- Zod schemas validate all external input before domain logic runs.
- Unknown properties are rejected on security-sensitive mutations.
- Errors use stable codes such as `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION_FAILED`, `CONFLICT`, `INSUFFICIENT_STOCK`, and `INTERNAL_ERROR`.
- Server logs include correlation identifiers but exclude passwords, session tokens, MFA secrets, recovery codes, and unnecessary patient details.
- Database constraint errors are translated into safe client responses.
- Transactions roll back completely on failed workflow, inventory, billing, or audit operations.

## 8. Security Controls

- Secure, HTTP-only, same-site session cookies in production.
- CSRF protection through Auth.js and same-origin checks on custom mutations.
- Content Security Policy and standard security headers.
- Request size limits and strict JSON content types.
- Rate limiting for authentication and high-risk mutations uses PostgreSQL-backed counters and row-level locking initially, keeping limits shared across application instances without adding another provider. The store remains replaceable if traffic later warrants a dedicated limiter.
- Magic-link requests never reveal whether an address is invited and never log login tokens.
- Encrypted MFA secrets with key rotation support.
- Parameterized database access through Prisma.
- Least-privilege production database credentials; migration credentials are separate from runtime credentials where the host supports it.
- CSV exports are permission checked, bounded, and protected against spreadsheet-formula injection.
- Health endpoints reveal status only, never configuration or credentials.

This security posture supports a credible production-oriented portfolio application. It is not a claim of HIPAA, GDPR, or local healthcare-regulation compliance.

## 9. Testing Strategy

### 9.1 Unit tests

- validation schemas;
- role permission matrix;
- workflow transition policy;
- invoice calculation;
- stock calculation and insufficient-stock handling;
- email-login policy and recovery-code helpers;
- error translation.

### 9.2 Integration tests

Integration tests use a disposable PostgreSQL database and real Prisma queries. They cover:

- migrations and seed integrity;
- authentication and session revocation;
- invite-only email login and session revocation;
- MFA enrollment, verification, and recovery-code consumption;
- role denial at each protected boundary;
- concurrent visit version conflicts;
- transaction rollback when audit, inventory, or billing writes fail;
- full visit progression from registration to discharge;
- audit event completeness and immutability.

### 9.3 Browser tests

Playwright covers:

- sign-in and sign-out;
- unauthorized redirect;
- one critical workflow for each role;
- complete multi-role patient journey;
- global patient search;
- stale-update conflict recovery;
- desktop and mobile navigation;
- keyboard operation and critical accessibility checks.

## 10. Local Development and Repository

The repository includes:

- `compose.yaml` for PostgreSQL;
- Prisma schema, migrations, and deterministic fictional seed data;
- `.env.example` containing names and safe descriptions only;
- scripts for database start, migrate, seed, reset, test, and production verification;
- GitHub Actions services for PostgreSQL integration tests;
- branch protection guidance and dependency update configuration;
- an updated README with setup, architecture, demo credentials, data warning, and deployment instructions.

Generated clients, environment files, database volumes, and test artifacts are ignored. No secrets or real patient data enter the repository.

## 11. Delivery Sequence

1. Establish PostgreSQL, Prisma, migrations, and seed data.
2. Add Auth.js, invite-only email login, database sessions, account controls, and MFA.
3. Build shared authorization, validation, error, and audit infrastructure.
4. Implement repositories and transactional workflow services test-first.
5. Add authenticated API routes.
6. Replace client-local state with server data and complete static screens.
7. Add integration, browser, accessibility, and concurrency coverage.
8. Add CI, security headers, operational scripts, and documentation.
9. Verify a clean clone can start, migrate, seed, test, and build without hidden local state.

## 12. Acceptance Criteria

- No CareFlow operational record depends on browser storage.
- Unauthenticated requests cannot access protected pages or APIs.
- Every mutation is rejected when performed by an unauthorized role.
- Workflow, inventory, billing, and audit writes are atomic.
- Concurrent stale updates cannot overwrite newer clinical state.
- Every demonstrated workflow persists across browser and server restarts.
- All current UI destinations show database-backed information or an explicit empty state.
- A fresh local setup can be completed from documented commands.
- CI applies migrations and passes unit, integration, browser, lint, and production-build checks.
- The repository contains no secrets, generated database state, or real patient information.
