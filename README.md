# CareFlow

CareFlow is a portfolio-grade hospital operations workstation MVP. It demonstrates patient flow from registration through discharge across Reception, Nursing, Doctors, Pharmacy, Cashier, and Admin workflows.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. No credentials, database, API keys, or external services are required.

## Features

- Persistent workstation shell with role switcher, patient search, responsive navigation, and reset control.
- Overview KPIs, live queue, department load, safety alerts, and recent activity.
- Patient registry and detail drawer with demographics, allergies, visit history, and the Registration → Triage → Consultation → Pharmacy → Billing → Discharged journey rail.
- Queue priority ordering, triage capture, doctor-entered consultation, fictional lab requests, inventory-backed prescriptions, pharmacy stock/allergy guards, billing, and discharge.
- Append-only audit timeline with actor, role, patient, timestamp, and details.
- Typed client store persisted to `localStorage`; all records are explicitly fictional.

## Architecture

`src/lib/types.ts` defines the domain model. `src/lib/seed.ts` owns fictional seed data. `src/lib/domain.ts` contains pure transition functions and validation guards. `src/app/page.tsx` is the client workstation composed of feature views and workflow dialogs; `src/app/globals.css` contains CareFlow design tokens and responsive rules.

## Demo-data warning

This is a demo environment with fictional records only. It is not a clinical system and makes no automated medical decisions. Do not enter real patient data.

## Verification

```bash
npm test
npm run lint
npm run build
```
