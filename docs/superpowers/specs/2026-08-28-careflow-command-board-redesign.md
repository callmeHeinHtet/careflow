# CareFlow Command Board Redesign

## Objective

Redesign the entire CareFlow interface into a distinctive, portfolio-grade hospital command workstation while preserving every existing workflow and all fictional-data safeguards. The interface serves busy reception, nursing, doctor, pharmacy, cashier, and admin staff who scan changing operational information under bright clinical lighting.

## Considered directions

### 1. Quiet clinical SaaS

White cards, teal accent, generous whitespace, soft shadows. Easy to read but too close to the current interface and indistinguishable from generic healthcare dashboards.

### 2. Dark hospital control room

Near-black surfaces with luminous status colors. Dramatic in screenshots but inappropriate for the bright workspaces where the product is meant to be used, and likely to reduce sustained readability.

### 3. Handoff command board — selected

A bright, data-dense workstation inspired by physical nurse-station handoff boards and magnetic patient-status tabs. It uses a disciplined indigo command color, high-contrast steel neutrals, and a persistent patient-flow ribbon. This is the recommended direction because it is specific to hospital operations, improves scanning, and avoids both healthcare-teal and generic SaaS-card defaults.

## Visual system

### Physical scene

A nurse uses CareFlow at a shared workstation beneath bright overhead lights during a shift change. Several people may glance at the screen from a distance, so information must remain legible, calm, and immediately scannable.

### Palette

- Night ink `#161A2B`: navigation and primary text
- Command indigo `#5147E5`: actions, current stage, and selected navigation
- Signal cyan `#087F83`: normal/complete operational states
- Mist `#F1F3F7`: application canvas
- Sterile white `#FCFCFD`: work surfaces
- Steel `#606978`: supporting text
- Alert amber `#B85E00`: waiting and stock warnings
- Critical red `#B3263E`: critical status and blocked action only

Neutral surfaces remain cool and nearly chroma-free. Status color always appears with a label, icon, or shape.

### Typography

- Interface and headings: Instrument Sans Variable, with restrained weight changes instead of oversized headings.
- Operational values: JetBrains Mono Variable with tabular numerals.
- Headings use balanced wrapping and never exceed `-0.03em` letter spacing.

### Geometry

- 8px base spacing with denser 4px subdivisions in tables.
- 10–14px corner radius on floating controls and dialogs; tabular work surfaces use 0–8px corners.
- Dividers, alignment, and background shifts establish hierarchy. Shadows are reserved for drawers and dialogs.

## Signature element: patient-flow ribbon

A persistent horizontal ribbon directly below the command bar displays Registration, Triage, Consultation, Pharmacy, Billing, and Discharged with live patient counts. The selected/current stage is represented by a solid indigo tab and completed states by cyan checks. The ribbon reflects the actual ordered clinical journey, so numbering and progression are meaningful rather than decorative.

On patient records, the same visual language becomes a detailed journey timeline. On mobile, the ribbon scrolls horizontally with the current stage automatically visible.

## Information architecture

### App shell

- Compact 232px indigo-black navigation rail on desktop.
- Hospital and active shift context at the top.
- Role selector, patient search, demo warning, notifications, and mobile menu in a 64px command bar.
- Persistent patient-flow ribbon below the command bar.
- Mobile navigation uses a focused drawer; core workflow views remain one tap away.

### Overview

Replace the repeated KPI-card grid with three levels:

1. A slim operational metrics strip for patients, queue size, average wait, and discharge count.
2. A dominant live queue board occupying most of the first viewport.
3. Secondary department load, alerts, and audit activity arranged as structured panels with shared dividers rather than nested cards.

### Workspaces

Patients, live queue, triage, consultation, pharmacy, billing, and audit views share:

- A compact page masthead with one primary action.
- A context/filter toolbar.
- Edge-to-edge work tables with sticky headers where useful.
- Empty states that explain the next action.
- Role-gated controls with explicit disabled explanations.

### Patient drawer and dialogs

- Patient drawer uses a stronger identity block, allergy prominence, journey timeline, vitals grid, visit history, and stage-specific actions.
- Triage and consultation dialogs use a two-column clinical form on desktop and a single column on mobile.
- Dialog actions remain visible at the bottom and preserve keyboard focus.

## Motion

One deliberate motion system:

- View changes crossfade and lift by 4px over 180ms.
- Patient stage changes pulse the affected ribbon stage once.
- Drawers and dialogs use 200ms ease-out-quint transitions.
- No ambient animation or repeated entrance effects.
- Reduced-motion mode removes transforms and shortens all transitions to near-instant.

## Accessibility and resilience

- Minimum 4.5:1 body-text contrast and 3:1 control-boundary contrast.
- Visible `:focus-visible` outline on every interactive element.
- 44px minimum interactive targets on touch layouts.
- Priority never relies on color alone.
- Dialogs carry clear labels; workflow feedback uses `aria-live`.
- Tables collapse into labeled records on narrow screens without horizontal page overflow.
- Existing fictional-data warning remains continuously visible.

## Engineering boundaries

- Preserve domain transition functions and all nine existing tests.
- Preserve localStorage hydration and reset behavior.
- Split the 31KB page monolith into focused CareFlow components while keeping state ownership in one top-level client component.
- Avoid new backend dependencies or production-healthcare claims.
- Use Lucide icons; no emoji, decorative gradients, glassmorphism, giant hero copy, or generic repeated card grids.

## Acceptance criteria

- Every existing workflow remains usable: queue → triage → consultation → pharmacy → billing → discharge.
- All eight workspaces receive the new visual system.
- Desktop and mobile screenshots show no clipping, overlap, or horizontal page scrolling.
- Tests, lint, TypeScript, and production build pass.
- Browser verification confirms role switching, stage advancement, and visual consistency.
- The final Impeccable pass addresses typography, spacing, contrast, responsive behavior, microcopy, and prohibited design patterns.
