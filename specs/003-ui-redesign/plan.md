# Implementation Plan: Professional UI Redesign

**Branch**: `feature/003-ui-redesign` | **Date**: 2026-10-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-ui-redesign/spec.md`

## Summary

Restyle and re-lay-out the web app in the approved Airline direction (navy, white, Public Sans,
dense): a compact grid with one-line chips whose actions live in menus, rows that grow to three
chips and then show "+N more", slim navy trip header and one-line day headers with small
travel/location indicators, a floating lifted chip during drag, and a collapsible item panel.
Sign-in, trips, and settings adopt the same system.

Technical approach: stay on React + Vite + CSS Modules. Replace the token set (5 text sizes,
compact spacing, small radii), self-host Public Sans, switch all icons to `lucide-react`, use
Radix DropdownMenu/Tooltip (unstyled) for accessible menus, and use dnd-kit's `DragOverlay` for
the floating chip. Core, data, and Supabase are untouched ([research.md](./research.md)).

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 22 LTS (unchanged)

**Primary Dependencies**: Existing React 19, Vite, dnd-kit, supabase-js. New (web only):
`lucide-react`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`,
`@fontsource-variable/public-sans` — each pinned to a release ≥ 2 weeks old that lists React 19
support

**Storage**: No changes. Two per-device `localStorage` keys for UI preferences
([data-model.md](./data-model.md))

**Testing**: Vitest + Testing Library (web), Playwright + axe (e2e, light and dark); core and DB
suites must stay green unchanged

**Target Platform**: Evergreen desktop and mobile browsers, 360 px and up

**Project Type**: Web application (`apps/web` only in this feature)

**Performance Goals**: Drag overlay tracks the pointer at 60 fps (SC-003); no layout shift in
other columns when chips are added (SC-002)

**Constraints**: Constitution v1.1.0 Principle II (tokens only, dense visual language, 360 px,
WCAG 2.1 AA, status not by color alone); no emoji as UI icons; ≤ 5 text sizes; existing
accessible names preserved ([contracts/ui.md](./contracts/ui.md))

**Scale/Scope**: ~25 component/style files touched, ~10 new components, 5 screens

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan complies | Pre | Post |
|---|---|---|---|
| I. Flexible block-based planning | No planning rule changes; typing into cells, drag copy/move, block editing, undo all kept; overflow popover keeps every event editable and draggable | ✅ | ✅ |
| II. Clean, friendly interface (v1.1.0) | New token set with compact scale and small radii, one navy accent (R2); 5 text sizes; one icon set; 360 px layout; axe light+dark, contrast unit test, keyboard drag and menus via Radix (R5, R13); travel/weather/type shown with icons + labels | ✅ | ✅ |
| III. Portable core | `packages/core` untouched; overflow rule is a web-presentation helper | ✅ | ✅ |
| IV. Integrations behind adapters | No integration changes; weather icons only restyled | ✅ | ✅ |
| V. Simplicity & verified changes | No new data or abstractions beyond components needed; 3 small deps justified below; automated checks for every measurable criterion (R13) | ✅ | ✅ |
| Workflow | spec → clarify (3 Qs) → constitution amended → plan, on a feature branch | ✅ | ✅ |

No violations.

## Project Structure

### Documentation (this feature)

```text
specs/003-ui-redesign/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui.md            # tokens, components, accessible names, layout guarantees
├── checklists/
│   └── requirements.md
└── tasks.md             # created by /speckit-tasks
```

### Source Code (repository root)

```text
apps/web/
├── src/
│   ├── styles/tokens.css, global.css       # REPLACED token set; Public Sans import
│   ├── lib/cellOverflow.ts                 # NEW visibleChips()
│   ├── components/
│   │   ├── ui/        Menu.tsx, Tooltip.tsx, Toast.tsx, Icon.tsx (NEW); Button, TextField,
│   │   │              Dialog, Popover, Banner, DateRangePicker (restyled)
│   │   ├── layout/    TripHeader.tsx (NEW)
│   │   ├── grid/      Grid, Cell, DayHeader, BlockLabel (reworked); PlacementChip,
│   │   │              CellListPopover, DragLayer (NEW); PlacementCard (removed)
│   │   ├── list/      ItemPanel.tsx (NEW, replaces ItemList)
│   │   └── weather/   WeatherIcon (lucide icons), LocationPicker/Dialog (restyled)
│   └── pages/         TripPlanner, Trips, SignIn, SignUp, ResetPassword, Settings (restyled)
├── tests/             cellOverflow, no-emoji, tokens (count + contrast), PlacementChip,
│                      ItemPanel, DayHeader tests (NEW); existing tests updated
└── e2e/               layout.spec.ts, drag.spec.ts (NEW); helpers + existing specs updated
                       for menus; a11y.spec.ts runs light + dark
```

**Structure Decision**: Same monorepo; this feature touches only `apps/web`.

## Complexity Tracking

| Item | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Radix DropdownMenu + Tooltip | Five new menus must be fully keyboard/screen-reader accessible (WCAG AA) | Hand-written menus re-implement roving focus, typeahead, focus return, and collision handling |
| lucide-react | One consistent icon set replacing emoji and ad-hoc SVGs (FR-013) | Hand-drawn SVGs for ~25 glyphs are inconsistent and more code |
| Self-hosted Public Sans | Airline look needs a consistent face across OSes | System font varies by platform; Google Fonts adds a third-party request |
