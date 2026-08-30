# CareFlow Command Board Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CareFlow’s generic clinical dashboard styling with the Handoff Command Board system while preserving all domain workflows and improving maintainability, accessibility, and responsiveness.

**Architecture:** Keep domain data and transitions in `src/lib`. Move the client state coordinator into `CareFlowApp`, split shared shell/patient/workspace/dialog UI into feature-focused components, and centralize the visual system in a readable token-based stylesheet. The redesign changes presentation and interaction structure without changing domain behavior.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 import layer, Lucide React, Instrument Sans Variable, JetBrains Mono Variable, Vitest.

---

### Task 1: Establish redesign dependencies and tokens

**Files:**
- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] Install `@fontsource-variable/instrument-sans` and `@fontsource-variable/jetbrains-mono`.
- [ ] Import the local variable fonts from `layout.tsx` so builds do not depend on a remote font service.
- [ ] Replace legacy hex variables with semantic command-board tokens for canvas, surfaces, ink, indigo, cyan, amber, red, borders, focus, spacing, radii, motion, and z-index.
- [ ] Add global focus, selection, reduced-motion, and responsive typography rules.
- [ ] Run `npm run lint` and confirm no warnings or errors.

### Task 2: Split the client application shell

**Files:**
- Create: `src/components/careflow/constants.tsx`
- Create: `src/components/careflow/ui.tsx`
- Create: `src/components/careflow/app-shell.tsx`
- Create: `src/components/careflow/careflow-app.tsx`
- Modify: `src/app/page.tsx`

- [ ] Move roles, navigation metadata, stage labels, priorities, and journey order into typed constants.
- [ ] Create reusable priority badge, page masthead, empty state, and patient journey components.
- [ ] Build the compact navigation rail, command bar, demo notice, role switcher, global search, mobile drawer, and persistent stage ribbon.
- [ ] Move localStorage hydration, selected patient, view, role, workflow dialog, and feedback state into `CareFlowApp`.
- [ ] Reduce `src/app/page.tsx` to rendering `CareFlowApp`.
- [ ] Run `npm run build` and confirm the shell compiles before workspace extraction continues.

### Task 3: Redesign operational overview and registry views

**Files:**
- Create: `src/components/careflow/overview-view.tsx`
- Create: `src/components/careflow/patients-view.tsx`
- Modify: `src/app/globals.css`

- [ ] Build the operational metrics strip without repeated floating KPI cards.
- [ ] Make the live queue board the dominant overview region.
- [ ] Add department-capacity bars, safety alerts, and recent activity using aligned divided panels.
- [ ] Build an edge-to-edge patient registry with clear queue, patient, priority, and stage columns.
- [ ] Preserve patient search and drawer selection behavior.
- [ ] Verify at 1280px and narrow mobile widths that no content clips.

### Task 4: Redesign clinical and financial workspaces

**Files:**
- Create: `src/components/careflow/workspace-views.tsx`
- Modify: `src/app/globals.css`

- [ ] Implement live queue, triage, consultation, pharmacy, billing, and audit workspaces with the shared masthead and toolbar grammar.
- [ ] Preserve stage filtering, queue ordering, inventory warnings, dispensing, billing, and audit interactions.
- [ ] Add explicit role-gating explanations through titles and disabled-control text.
- [ ] Use row separators and grouped work surfaces instead of nested cards.
- [ ] Confirm empty states identify what causes a record to appear in each workspace.

### Task 5: Redesign patient details and workflow dialogs

**Files:**
- Create: `src/components/careflow/patient-drawer.tsx`
- Create: `src/components/careflow/workflow-dialogs.tsx`
- Modify: `src/app/globals.css`

- [ ] Build the patient identity block, prominent allergy state, detailed journey rail, vitals, visit history, and stage-specific actions.
- [ ] Build accessible triage and consultation dialogs with persistent labels and responsive field layouts.
- [ ] Disable save actions until required clinical fields are complete.
- [ ] Keep dialog actions visible and make close controls keyboard accessible.
- [ ] Preserve the exact domain transition payloads used by `submitTriage` and `completeConsultation`.

### Task 6: Frontend-design critique and correction

**Files:**
- Modify: all files under `src/components/careflow/`
- Modify: `src/app/globals.css`
- Modify: `design-system/MASTER.md`

- [ ] Compare the implementation with the design spec’s palette, typography, layout, signature element, and motion.
- [ ] Remove repeated kicker/eyebrow scaffolding, unnecessary cards, excess radius, decorative shadows, or generic copy.
- [ ] Confirm the persistent flow ribbon is the single memorable visual signature.
- [ ] Update `design-system/MASTER.md` to document the implemented command-board system.

### Task 7: Impeccable setup, audit, and polish

**Files:**
- Create or modify: `PRODUCT.md`
- Create or modify: `DESIGN.md`
- Modify: relevant CareFlow UI and style files based on findings

- [ ] Run the Impeccable context script; if project-local scripts are absent, initialize the required product and design context using the skill references.
- [ ] Read the Impeccable product-register reference for application dashboards.
- [ ] Audit contrast, hierarchy, spacing rhythm, typography, card usage, responsive behavior, focus, motion, copy, error states, and the Impeccable absolute bans.
- [ ] Apply all priority-one polish findings directly to the interface.
- [ ] Re-run the audit after changes and ensure no known high-priority design defect remains.

### Task 8: Verification

**Files:**
- Test: `tests/domain.test.ts`
- Verify: all UI files

- [ ] Run `npm test`; expect all nine domain tests to pass.
- [ ] Run `npm run lint`; expect zero errors and warnings.
- [ ] Run `npm run build`; expect successful TypeScript and static-page generation.
- [ ] Start the production server on a free local port.
- [ ] Browser-check overview, patient registry, queue, triage, consultation, pharmacy, billing, audit, patient drawer, role switching, and one complete stage transition.
- [ ] Inspect desktop and mobile layouts for overlap, clipping, unreadable text, weak contrast, and horizontal page scrolling.
- [ ] Stop the verification server and report exact results.
