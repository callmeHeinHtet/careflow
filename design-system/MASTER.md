# CareFlow Design System

## Product direction

CareFlow is a hospital operations and patient-flow application for receptionists, nurses, doctors, pharmacists, cashiers, and administrators. The interface must feel calm, precise, trustworthy, fast, and operational—not like a generic SaaS template and not like a consumer wellness app.

## Signature

The signature element is the **patient journey rail**: a compact, persistent sequence of Registration → Triage → Consultation → Pharmacy → Billing → Discharged. It communicates each patient's current state without relying on color alone.

## Color tokens

- Ink: `#16231F` — primary text and navigation
- Clinical green: `#167C64` — primary action and active state
- Mint surface: `#E8F3EF` — selected/positive surface
- Canvas: `#F4F6F3` — application background
- Paper: `#FFFFFF` — cards and work surfaces
- Amber: `#B86B16` — waiting and medium priority
- Critical red: `#B33A3A` — urgent/critical states only
- Slate: `#66736E` — secondary text
- Border: `#D9E0DC` — separators

All status colors require text labels or icons. Body text must meet WCAG AA contrast.

## Typography

- Display and interface headings: Geist Sans, 650–750 weight
- Body: Geist Sans, 400–550 weight
- Operational data, queue numbers, vitals, timestamps: Geist Mono with tabular numerals

## Layout

- Desktop-first clinical workstation with a fixed 264px sidebar, compact top command bar, and responsive main canvas.
- Mobile collapses the sidebar into an accessible navigation drawer and stacks dashboard regions without horizontal page scrolling.
- 4/8px spacing system. Touch targets are at least 44px.
- Dense tables remain readable through strong column hierarchy, sticky headers where useful, and responsive card fallbacks.

## Components

- Corners: restrained 10–14px radius; no pill-shaped containers except statuses.
- Shadows: subtle, used only to separate floating layers.
- Icons: Lucide outline icons, consistent 1.75–2px stroke. No emoji icons.
- Buttons: one primary action per view; destructive actions separated and confirmed.
- Forms: persistent labels, helper text for clinical fields, inline validation, explicit required markers.
- Feedback: accessible `aria-live` status announcements, clear empty states, and recovery actions.

## Motion

150–250ms transitions for navigation and state changes. No decorative ambient animation. Respect `prefers-reduced-motion`.

## Demo-data safety

Every patient, staff member, phone number, address, diagnosis, and financial amount is fictional. The UI must display a visible “Demo environment · fictional records” notice. No AI diagnosis or automated clinical decisions.
