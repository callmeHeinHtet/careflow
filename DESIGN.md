# CareFlow Design Context

## Direction

Calm Hospital Workspace: a simple clinical operations interface modeled on the supplied Meditech reference. The product prioritizes a familiar light navigation rail, quiet summary cards, and two obvious work panels over a visually dominant command-center identity.

## Visual language

- Instrument Sans Variable for interface typography, headings, and clinical copy.
- JetBrains Mono Variable for queue metadata, timestamps, vitals, and aligned financial values.
- White work surfaces on a cool-gray page, with restrained teal for active navigation and primary actions.
- Amber indicates attention; red is reserved for critical/allergy/blocked states.
- Status colors always include labels or distinct geometry.
- Cards use subtle borders, modest 7–12px radii, and very soft elevation.
- Rows use compact 8px/12px rhythm; distinct sections use 18px/28px separation.

## Component grammar

- Desktop uses a slim grouped sidebar and one quiet search/role header.
- Patient stages remain visible as a compact secondary strip rather than a signature visual centerpiece.
- Overview hierarchy: concise title, four restrained metric cards, patient queue, and one attention/capacity panel.
- Workspaces use a compact masthead, simple toolbar, and one primary table/list surface.
- Patient details use a right drawer. Triage and consultation use focused dialogs with sticky actions.
- Mobile turns the sidebar into a navigation drawer and keeps the patient-flow strip horizontally scrollable.

## Bans

No decorative gradients, glassmorphism, giant hero typography, command-center treatments, oversized operational numbers, nested cards, pill-shaped generic text, side-stripe cards, gradient text, excessive rounding, or ambient animation.

## Accessibility and motion

- Visible focus indicators for all controls.
- 44px targets on touch input.
- AA text contrast.
- Priority and stage never rely on color alone.
- View changes use one short fade/lift; drawers and dialogs use restrained ease-out motion.
- Reduced-motion mode removes transforms and makes transitions nearly instant.
