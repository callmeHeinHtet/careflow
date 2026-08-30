# CareFlow Clinical Logistics Board — Design Specification

## Decision

Replace the current purple SaaS dashboard with a clinical logistics workstation grounded in physical nurse-station status boards, bedside equipment, handoff ledgers, and high-visibility safety labels.

## Subject and operating scene

CareFlow is used by receptionists, nurses, doctors, pharmacists, cashiers, and administrators during a live hospital shift. The interface is viewed under bright clinical lighting, scanned quickly from seated and standing positions, and used repeatedly with keyboard and pointer input. The single job is to expose the next safe operational handoff without making a clinical decision for staff.

## Rejected design tells

The previous pass is rejected because it contains category-generic AI patterns:

- purple SaaS accent
- dark sidebar with evenly spaced Lucide navigation
- four equal KPI boxes
- repeated bordered cards
- tiny uppercase labels and decorative numbering
- excessive empty canvas at wide desktop sizes
- generic centered dashboard composition
- uniformly rounded controls

## Visual thesis

### Direction: Clinical Logistics Board

The application should resemble a purpose-built hospital operations instrument rather than a startup dashboard. Information is arranged as a continuous ledger: facility and shift controls at the top, operational workspaces below, a connected patient Flowline, then an asymmetric live roster and attention lane.

### Palette

- **Clinical chalk — `#F5F6F3`:** primary work surface
- **Carbon — `#151918`:** command header and high-priority text
- **Equipment green — `#B8F25A`:** live/active state and primary action
- **Instrument cobalt — `#2F5BEA`:** navigation and information action
- **Alarm orange — `#EF6A48`:** attention and urgent state
- **Critical red — `#C83E50`:** allergy, blocked, and critical state only

No gradients. No purple. Status color always has a text label or distinct shape.

### Typography

- **Atkinson Hyperlegible:** interface text, forms, buttons, and clinical copy
- **Barlow Condensed:** workspace titles, stage counts, queue positions, and operational readouts
- **JetBrains Mono:** timestamps, queue identifiers, vitals, and currency

The display role is used sparingly. Data remains aligned and readable.

### Layout

Desktop removes the permanent sidebar.

```text
┌──────────────────────────────── COMMAND HEADER ────────────────────────────────┐
│ CareFlow / Meridian Clinic   search               shift · role · staff       │
├──────────────────────────── WORKSPACE NAVIGATION ──────────────────────────────┤
│ Overview  Patients  Live queue  Triage  Consultation  Pharmacy  Billing       │
├────────────────────────────────── FLOWLINE ────────────────────────────────────┤
│ Registration ━━━ Triage ━━━ Consultation ━━━ Pharmacy ━━━ Billing ━━━ Home    │
├────────────────────────────────────────────────────────────────────────────────┤
│ SHIFT STATUS: active / waiting / average wait / discharged                    │
├───────────────────────────────────────────────┬────────────────────────────────┤
│ LIVE PATIENT LEDGER                           │ ATTENTION LANE                 │
│ queue · patient · wait · priority · handoff   │ capacity / alerts / activity  │
└───────────────────────────────────────────────┴────────────────────────────────┘
```

Content uses the available desktop width instead of a narrow centered island. The live ledger receives approximately 70% of the width and the attention lane 30%.

Mobile keeps facility, search, and role controls visible; workspace navigation becomes an accessible overlay; the Flowline scrolls horizontally and visibly hints at additional stages. Tables become labeled record rows rather than compressed desktop grids.

### Signature element: Flowline

The existing stage ribbon becomes a connected operational Flowline inspired by IV tubing and bedside-monitor traces.

- one continuous track joins all six stages
- completed nodes are carbon with a check
- current stage is equipment green with a strong rectangular marker
- stage counts use Barlow Condensed
- every stage remains a semantic navigation button
- no boxed tab cells

### Overview composition

- Replace the four bordered KPI cards with one unboxed shift-status run.
- Make the live patient ledger the dominant surface.
- Combine department load, safety alerts, and recent activity into one continuous attention lane separated by spacing and rules—not separate cards.
- Remove decorative `01 / 02 / 03 / 04` section numbering.
- Use queue number and waiting time as the primary scan anchors.

### Workspaces

All existing Patients, Queue, Triage, Consultation, Pharmacy, Billing, and Audit workflows remain. They inherit the same header, Flowline, type system, controls, row geometry, statuses, dialogs, and drawers.

### Motion

- Flowline and active workspace changes use 160–200ms ease-out transitions.
- Buttons use only immediate press feedback.
- Drawers and dialogs retain a restrained state-change transition.
- Reduced-motion mode disables transforms and shortens transitions.

### Accessibility

- 4.5:1 contrast for normal text
- 44px touch targets on coarse pointers
- visible keyboard focus
- status never depends on color alone
- role and demo context remain persistent
- dialogs and drawers retain Escape handling and focus restoration
- no document-level horizontal overflow

### Scope boundary

This pass changes presentation and interaction hierarchy only. Domain state, workflow transitions, role permissions, deterministic safety warnings, fictional seed data, and local persistence are preserved.
