# CareFlow Implementation Plan

## Product boundary

CareFlow is a portfolio demonstration of hospital operations and patient flow. It uses fictional records, does not provide clinical advice, and must never store real patient data.

## MVP — implemented

- [x] Responsive clinical workstation shell
- [x] Demo role switching for Reception, Nurse, Doctor, Pharmacy, Cashier, and Admin
- [x] Operational overview, patient registry, queue, and journey rail
- [x] Triage capture with staff-controlled priority
- [x] Doctor-entered consultation, prescriptions, lab requests, and follow-up
- [x] Pharmacy allergy and stock guards with inventory decrement
- [x] Billing, payment, and discharge transition
- [x] Append-only audit history
- [x] Fictional seed data, local persistence, and reset control
- [x] Domain-transition tests, lint, production build, and browser verification

## Phase 2 — production architecture

1. Replace local persistence with PostgreSQL and migrations.
2. Add authenticated staff accounts and server-enforced RBAC.
3. Model visits separately from patients to support longitudinal records.
4. Wrap dispensing and billing updates in database transactions.
5. Add registration, appointment scheduling, lab workflow, printable invoices, and export.
6. Add Playwright end-to-end tests for each staff journey.
7. Add security controls: encryption, session expiry, immutable audit storage, retention policy, and backup recovery.

## Portfolio release

1. Capture desktop and mobile screenshots from the verified MVP.
2. Record a short workflow demo: queue → triage → consultation → pharmacy → billing.
3. Deploy the credential-free MVP to Vercel.
4. Add CareFlow to the portfolio under Full Stack with a clear fictional-demo disclaimer.
