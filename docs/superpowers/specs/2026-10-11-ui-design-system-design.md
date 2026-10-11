# Elevra.ai UI design system: design

Date: 11 Oct 2026 · Owner: Mahesh · Scope: whole app (agreed with the user)

## Goal
One product, not three. Admin, faculty, insights and student pages share one look that judges find credible and that a
college would use daily. Works from 360 px phones to 1920 px screens, in light and dark. It must not look AI-generated
or templated.

## What we avoid (the generic-AI tells)
Inter or Arial type; indigo or purple accents and gradients; soft shadows on big rounded cards; rows of three identical
icon cards; gradient text; emoji; everything centred; colour-only meaning.

## Direction: "campus annual report"
Restrained and editorial, closer to an FT or Our World in Data report than a SaaS template.
- **Type** (self-hosted, OFL, no package): IBM Plex Sans for the interface, IBM Plex Serif for page titles and headline
  numbers, IBM Plex Mono for IDs and code. `font-variant-numeric: tabular-nums` on all figures.
- **Shape**: 6 px radius, 1 px hairline rules, no decorative shadows (overlays only), generous whitespace, left-aligned.
- **Charts**: one palette, direct labels where possible, light dotted grids, no animation, risk colours fixed.

## Tokens (HSL triplets so `hsl(var(--x))` in `tailwind.config.ts` works; today the values are oklch and silently fail)
| Token | Light | Dark | Use |
|---|---|---|---|
| background | #F4F1EA paper | #101613 | page |
| card | #FBFAF6 | #161E1A | panels |
| muted | #ECE8DE | #1F2A25 | quiet fills, table headers |
| foreground | #1B2420 ink | #E7EAE3 | text |
| muted-foreground | #5B655F | #9DA8A0 | secondary text |
| border / input | #DDD7CB | #2C3832 | rules |
| primary | #1E5A4E evergreen | #7FB8A4 | actions, active nav, focus |
| accent (ochre) | #B9802A | #DDB262 | one highlight per view |
| risk-red | #A8402D on #F6E3DD | #E08A76 on #3A211C | Red tier |
| risk-amber | #8F6415 on #F5EBD3 | #DDB262 on #352A16 | Amber tier |
| risk-green | #3F6E45 on #E2EDDF | #93C08F on #1F2E21 | Green tier |
| risk-none | #6F6A5F on #ECE8DE | #A39E92 on #232B27 | Not assessed |
| chart 1-6 | evergreen, ochre, slate #3E5C76, brick, plum #6B4E71, olive #7C8B58 | lighter equivalents | series |

Dark mode: `dark` class on `<html>`, set by the shell's toggle and remembered in `localStorage("elevra-theme")`.

## App shell (one component, all roles)
- Sidebar ≥ 1024 px (collapsible to an icon rail); icon rail 768-1023 px; below 768 px a top bar with a menu button
  opening a drawer. Focus is trapped in the open drawer; Escape closes it; navigation closes it.
- Top bar: page title slot, "find a student" (admin, faculty), theme toggle, user name and role, sign out.
- Navigation groups:
  - Admin: Overview · Act (Response & workload, Interventions, Notifications) · Students (Action Queue, Attendance,
    Segments) · Data & trust (Data Health, Method & Trust, Evidence) · Tools (Ask your data, Users).
  - Faculty: My students · Attendance · Segments · Data Health · Method & Trust · Guided demo.
  - Student: Home · My plan · Certifications · Hackathons · Annual events · Mock interview · Inbox (same items as today).
- `/insights` and `/faculty` pages opened by an admin show the admin navigation.

## Shared building blocks (`components/shared/ui-kit/`)
`PageHeader` (serif title, one-line purpose, actions), `Section`, `Stat` (label, serif number, note), `RiskTag` (colour
plus words), `DataTable` (rows become stacked cards below 768 px), `EmptyState`, `chartTheme` (palette, axis, grid,
tooltip). Pages use tokens (`bg-card`, `text-muted-foreground`, `border-border`), never raw hex.

## Page changes
- Admin Overview: brief, 4 headline figures, a follow-through strip (students → need a check-in → contacted), then charts.
- Faculty home: My week first, then the list (cards on phones).
- Student 360: header with score, band and both flags; tabs Summary · Why · Timeline · Support; actions always reachable.
- All other pages: same header, sections and tables; Data Health keeps its source → clean → unified flow as the hero.
- Student area: same tokens; the `!important` dark-mode overrides in `StudentWorkspace` are removed.

## Responsive and accessibility rules
No horizontal page scroll at 360 px; touch targets ≥ 40 px; AA contrast in both themes; visible focus ring (primary);
`prefers-reduced-motion` respected; `aria-current` on nav; colour never the only signal.

## Ownership and order (each step its own PR)
1. Tokens, fonts, shell, ui-kit. 2. Admin overview, faculty home, Student 360. 3. Remaining admin and faculty pages,
insights inside the shell. 4. Student area on tokens (after Aayush pauses student UI pushes). 5. QA matrix.
`globals.css` and `tailwind.config.ts` are shared: the team is told before step 1 merges. Frozen files are untouched.

## Testing
Existing unit tests; `tsc`, lint and build; screenshot matrix (every page × 360/768/1366/1920 × light/dark) with an
automatic check that `document.documentElement.scrollWidth <= innerWidth` and no console errors.
