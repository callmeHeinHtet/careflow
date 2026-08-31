# CareFlow Transactional Workflows Implementation Plan

**Goal:** Replace browser-only clinical mutations with authenticated, validated, idempotent PostgreSQL transactions that enforce workflow versions and write immutable audit events.

**Architecture:** Route handlers perform HTTP boundary checks and authorize a capability. Domain services own workflow rules and execute mutations through Prisma transactions. Every successful mutation writes its audit event in the same transaction. Durable idempotency records prevent duplicate submissions and optimistic version checks reject stale clients.

**Stack:** Next.js 16 App Router, Prisma 7/PostgreSQL, Zod 4, Vitest 4.

## Task 1: Shared mutation infrastructure — Complete

- Add typed application errors and one safe error-to-response translator.
- Add strict JSON/content-length parsing, same-origin enforcement, correlation IDs, and validated idempotency keys.
- Persist completed idempotent responses with request fingerprints and expiry.
- Add a transactional audit writer and database-level audit immutability guard.
- Cover helpers and persistence behavior with unit and integration tests.

## Task 2: Patient registration and demographics — Complete

- Add strict patient registration/update schemas.
- Generate stable MRNs and queue tokens on the server.
- Register a patient and initial waiting visit atomically with allergies and audit records.
- Reject replayed idempotency keys with different payloads.
- Add `POST /api/patients` and `GET|PATCH /api/patients/:id` with capability enforcement.

## Task 3: Visit reads, priority, and triage — Complete

- Add paginated visit list/detail repositories.
- Add versioned priority and triage services.
- Enforce allowed stages, role capabilities, and conflict responses containing current state.
- Add visit read, priority, and triage routes with integration coverage.

## Task 4: Consultation and orders — Complete

- Persist consultation, lab orders, prescriptions, invoice lines, and the next visit stage atomically.
- Calculate all prices from persisted medication and service data.
- Reject inactive or unknown medication records and stale visit versions.
- Add consultation routes and role-boundary tests.

## Task 5: Dispensing and billing — Complete

- Lock and consume inventory lots in earliest-expiry order without allowing negative stock.
- Record immutable inventory movements and move visits to billing only when all prescriptions are dispensed.
- Settle invoices with server-calculated totals, idempotent payments, and discharge transition.
- Add dispense/payment routes plus rollback and concurrency tests.

## Task 6: Audit reads and client migration — In progress

- Add permission-filtered cursor-based audit reads. — Complete
- Add a role-filtered PostgreSQL workspace snapshot matching the current UI view model. — Complete
- Replace the CareFlow client demo store with server reads and mutation refreshes.
- Add pending, validation, forbidden, and stale-conflict UI states.
- Verify a complete multi-role journey persists across process restarts.

## Completion gate

- Run unit and integration suites, lint, production build, and dependency audit.
- Recreate a clean database, apply committed migrations, seed, and rerun the critical journey.
- Review for sensitive logging, missing `no-store`, authorization gaps, non-atomic writes, and uncommitted generated artifacts.
- Commit each task in a focused change; do not push without explicit instruction.
