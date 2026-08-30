# CareFlow Clinical Logistics Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CareFlow’s generic purple SaaS dashboard with a distinctive clinical logistics workstation while preserving all workflow behavior.

**Architecture:** Keep the existing domain and state orchestration intact. Restructure only the app shell and overview markup, establish a new token/type system in global CSS, and let the existing focused workspace components inherit the revised component grammar.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS import layer, CSS, Lucide React, Vitest.

---

### Task 1: Install the approved typography

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/app/layout.tsx`

- [ ] Install `@fontsource/atkinson-hyperlegible` and `@fontsource-variable/barlow-condensed`.
- [ ] Import both local packages from `src/app/layout.tsx`; retain JetBrains Mono for data.
- [ ] Remove Instrument Sans from the layout and dependencies.
- [ ] Run `npm run build` and confirm local font imports compile without network access.

### Task 2: Rebuild the application shell

**Files:**
- Modify: `src/components/careflow/app-shell.tsx`
- Modify: `src/app/globals.css`

- [ ] Replace the fixed sidebar desktop structure with a two-tier command header.
- [ ] Keep facility, shift, search, fictional-demo context, role selector, and reset controls visible.
- [ ] Render workspaces as horizontal operational navigation on desktop.
- [ ] Preserve the mobile navigation overlay using `mobileNav` state.
- [ ] Keep Ctrl+K search and all existing navigation callbacks.
- [ ] Verify semantic landmarks and `aria-current` values.

### Task 3: Transform the patient ribbon into the Flowline

**Files:**
- Modify: `src/components/careflow/ui.tsx`
- Modify: `src/app/globals.css`

- [ ] Preserve current stage-to-view mapping and counts.
- [ ] Remove boxed-tab styling.
- [ ] Add one connected track with completed, active, and future nodes.
- [ ] Use equipment green only for the current node and preserve text/check state.
- [ ] Keep horizontal mobile scrolling without document overflow.

### Task 4: Recompose the overview as a live ledger

**Files:**
- Modify: `src/components/careflow/overview-view.tsx`
- Modify: `src/app/globals.css`

- [ ] Replace the metric-card strip with an unboxed shift-status run.
- [ ] Replace panel numbering and repeated cards with one dominant patient ledger.
- [ ] Convert department load, safety warnings, and recent activity into a continuous attention lane.
- [ ] Make queue number, wait, priority, department, and handoff action visibly scannable.
- [ ] Preserve patient drawer and workspace navigation callbacks.

### Task 5: Apply the clinical component grammar across workspaces

**Files:**
- Modify: `src/app/globals.css`
- Inspect: `src/components/careflow/patients-view.tsx`
- Inspect: `src/components/careflow/workspace-views.tsx`
- Inspect: `src/components/careflow/workflow-dialogs.tsx`
- Inspect: `src/components/careflow/patient-drawer.tsx`

- [ ] Replace purple tokens and rounded SaaS controls with the approved palette and sharper equipment geometry.
- [ ] Increase weak 9–10px body metadata where readability requires it.
- [ ] Standardize button, filter, table, status, form, dialog, and drawer states.
- [ ] Preserve semantic priority labels, allergy treatment, focus visibility, and touch targets.
- [ ] Verify every workspace visually rather than changing domain logic.

### Task 6: Run the separate Impeccable pass

**Files:**
- Modify as findings require: `src/app/globals.css`, `src/components/careflow/*.tsx`
- Update: `DESIGN.md`
- Update: `docs/impeccable-audit.md`

- [ ] Critique the implemented screen for AI design tells, hierarchy, density, contrast, typography, state clarity, and responsive behavior.
- [ ] Remove remaining generic card patterns, decorative labels, unnecessary icons, and weak gray text.
- [ ] Record concrete findings and fixes.

### Task 7: Verify behavior and presentation

**Files:**
- Test: `tests/domain.test.ts`

- [ ] Run `npm run test`; expect all nine domain tests to pass.
- [ ] Run `npm run lint`; expect zero ESLint errors.
- [ ] Run `npm run build`; expect a successful production build.
- [ ] Run `git diff --check`; expect exit code zero.
- [ ] Exercise queue → triage → consultation and role switching in a production browser.
- [ ] Inspect desktop and a true 390×844 CDP-emulated viewport.
- [ ] Confirm no browser console errors and `documentElement.scrollWidth === innerWidth` on mobile.
- [ ] Stop disposable servers and debugging ports.

## Self-review

- Spec coverage: shell, Flowline, overview, all workspaces, Impeccable, responsive behavior, accessibility, and verification are covered.
- Placeholder scan: no TBD, TODO, or deferred implementation placeholders.
- Type consistency: existing `ViewId`, `Patient`, `Role`, and callback boundaries remain unchanged.
- Scope: visual hierarchy and component presentation only; domain behavior remains out of scope.
