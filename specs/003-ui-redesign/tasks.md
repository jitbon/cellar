---

description: "Task list for Professional UI Redesign"
---

# Tasks: Professional UI Redesign

**Input**: Design documents from `/specs/003-ui-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: Included. research R13 turns the success criteria into automated checks, and the
001/002 suites must stay green (SC-006). Write new tests first where they can fail meaningfully.

**Organization**: Tasks are grouped by user story so each story can be built and tested on its
own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: User story the task belongs to (US1–US5)

## Path Conventions

Only `apps/web/` changes. Paths below are relative to the repo root. Ref docs (under
`specs/003-ui-redesign/`): research = `research.md`, UI contract = `contracts/ui.md`,
data-model = `data-model.md`. Visual reference: "Cellar Design Directions", option A
(https://claude.ai/artifact/JWu8yKVQD9fPnqpPfYra7U).

**Global rules for every task**: tokens only (stylelint enforces); no emoji in UI; keep every
accessible name listed in contracts/ui.md "Kept exactly as in 001/002"; when an action moves into
a menu, the menu item carries the old accessible name.

---

## Phase 1: Setup

- [X] T001 Add dependencies to `apps/web/package.json` with `pnpm --filter web add`: `lucide-react`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tooltip`, `@fontsource-variable/public-sans`. Pin each to an exact version published at least 14 days ago whose peer deps accept React 19; commit the updated `pnpm-lock.yaml`
- [X] T002 Import `@fontsource-variable/public-sans` once in `apps/web/src/main.tsx`
- [X] T003 [P] Create `apps/web/src/components/ui/Icon.tsx`: re-export the lucide icons used app-wide (`ArrowLeft`, `CalendarDays`, `MapPin`, `PlaneLanding`, `PlaneTakeoff`, `Flag`, `Utensils`, `MoreHorizontal`, `GripVertical`, `Plus`, `X`, `Undo2`, `Redo2`, `Search`, `PanelRight`, `Clock`, `Check`, `ChevronLeft`, `ChevronRight`, `Sun`, `CloudSun`, `Cloud`, `CloudFog`, `CloudRain`, `CloudSnow`, `CloudLightning`) plus an `Icon` wrapper that sets `size` from a `small | default` prop (12 / 14 px) and `strokeWidth={1.75}`, `aria-hidden` by default

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: New token set, base styles, and shared UI primitives used by every story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Write `apps/web/tests/tokens.test.ts` (reads `src/styles/tokens.css` as text): exactly five `--font-size-*` tokens (`xs, sm, md, lg, xl`); every token family in contracts/ui.md "Design tokens" exists; WCAG contrast ≥ 4.5:1 for these pairs in both light (`:root`) and dark (`@media (prefers-color-scheme: dark)`) values: text/bg, text-muted/bg, text/surface, on-accent/accent, activity/activity-bg, food/food-bg, header-text/header-bg, header-muted/header-bg
- [X] T005 Replace `apps/web/src/styles/tokens.css` with the research R2 set (light on `:root`, dark under `@media (prefers-color-scheme: dark)`), values exactly as listed in research R2: colors, `--font-size-xs 11px | sm 12px | md 13px | lg 15px | xl 20px`, `--space-1 2px … --space-8 32px`, `--radius-xs 3px | sm 4px | md 6px | pill 999px`, `--shadow-1 | -2 | -drag`, sizes `--size-chip 24px, --size-row-min 36px, --size-header 48px, --size-block-label 112px, --size-day-column 168px, --size-panel 248px, --size-icon 14px, --size-icon-button 24px, --size-touch 44px`, `--font-family: 'Public Sans Variable', system-ui, -apple-system, 'Segoe UI', sans-serif`. Also keep `--color-danger`, `--color-danger-bg`, `--color-backdrop`, `--color-focus`, `--size-day-cell` (date picker). Make T004 pass
- [X] T006 Migrate every `var(--…)` in `apps/web/src/**/*.module.css` and `apps/web/src/styles/global.css` from old to new names so the build and stylelint pass before restyling: `--color-surface`→`--color-bg`, `--color-surface-raised`→`--color-bg`, `--color-greyed`→`--color-surface`, `--color-range-bg`→`--color-accent-soft`, `--color-accent-text`→`--color-on-accent`, `--radius-lg`→`--radius-md`, `--shadow-sm`→`--shadow-1`, `--shadow-md`→`--shadow-2`, spacing `--space-1`→`--space-2`, `--space-2`→`--space-4`, `--space-3`→`--space-5`, `--space-4`→`--space-6`, `--space-5`→`--space-7`, `--space-6`→`--space-8` (do the spacing renames in one pass from highest to lowest to avoid double-mapping); names that exist in both sets stay. Run `pnpm --filter web lint:css` and `pnpm --filter web typecheck`
- [X] T007 Update `apps/web/src/styles/global.css`: body `font-family: var(--font-family)`, `font-size: var(--font-size-md)`, `line-height: 1.4`, `background-color: var(--color-bg)`, `color: var(--color-text)`; `:focus-visible` 2 px `--color-focus` outline with 2 px offset; `button`, `input`, `select`, `textarea` inherit font; `@media (prefers-reduced-motion: reduce)` sets transitions/animations to none
- [X] T008 [P] Create `apps/web/src/components/ui/Menu.tsx` + `Menu.module.css`: thin wrapper over `@radix-ui/react-dropdown-menu` exporting `Menu` (props: `trigger: ReactElement`, `children`), `MenuItem` (`onSelect`, `danger?`, `icon?`, `aria-label?` passthrough), `MenuSeparator`, `MenuLabel`; content styled with `--color-bg`, `--shadow-1`, `--radius-md`, `--font-size-md`, item height 28 px, `--space-4` horizontal padding; rendered in a portal; `sideOffset` 4
- [X] T009 [P] Create `apps/web/src/components/ui/Tooltip.tsx` + `Tooltip.module.css`: wrapper over `@radix-ui/react-tooltip` (`<Tooltip label>{child}</Tooltip>`), 400 ms delay, `--font-size-sm`, dark tooltip (`--color-text` bg, `--color-bg` text), `--radius-sm`; add a single `Tooltip.Provider` in `apps/web/src/App.tsx`
- [X] T010 [P] Create `apps/web/src/components/ui/Toast.tsx` + `Toast.module.css`: bottom-center toast with message, optional action, "Got it" dismiss button, auto-dismiss after 8 s (paused on hover/focus), `role="status"`; `useTip(tipId)` hook that hides the toast once `localStorage['cellar:tip:<tipId>'] === 'dismissed'` (try/catch around storage, data-model.md)
- [X] T011 Restyle shared primitives to the dense Airline look (tokens only): `apps/web/src/components/ui/Button.module.css` (variants primary = navy fill, secondary = white with `--color-border-strong`, ghost, danger; height 28 px default, 32 px `large`; `--radius-sm`; `--font-size-md` 500 weight; touch hit-area ≥ 44 px under `@media (pointer: coarse)`), `TextField.module.css` (28 px inputs, 11 px uppercase labels), `Dialog.module.css` (`--radius-md`, `--shadow-2`, title `--font-size-lg`), `Popover.module.css`, `Banner.module.css` (slim 32 px strip, icon + text, no border radius), `DateRangePicker.module.css`

**Checkpoint**: App builds, lint and existing unit tests pass with the new tokens (old layout, new colors/fonts)

---

## Phase 3: User Story 1 - A calm, compact schedule grid (Priority: P1) 🎯 MVP

**Goal**: One-line chips with menu actions, quiet empty cells, rows that grow to 3 then "+N more", fixed column widths, one-line block labels without time ranges, small monochrome weather glyphs.

**Independent Test**: At 1440×900 with the item panel closed, a 5-day trip shows ≥ 5 days and ≥ 8 blocks; adding 1/2/3/5 events to one cell gives 1/2/3/3 chip lines with "+3 more" and no column width change.

### Tests for User Story 1 ⚠️

- [X] T012 [P] [US1] Unit test `apps/web/tests/cellOverflow.test.ts` for `visibleChips(count)` per data-model.md table: 0→{0,0}, 1→{1,0}, 2→{2,0}, 3→{3,0}, 4→{2,2}, 9→{2,7}
- [X] T013 [P] [US1] Component test `apps/web/tests/PlacementChip.test.tsx`: renders type icon + name in one line; `aria-label`/tooltip carry the full name; "Actions for <name>" opens a menu with items named `Switch <name> to Food place` (or Activity), `Move <name> to another block`, `Edit <name>`, `Remove <name>`; each calls its handler; a visually hidden button `Drag <name>` exists; click without movement calls `onEdit`
- [X] T014 [P] [US1] E2E `apps/web/e2e/layout.spec.ts` (desktop project, viewport 1440×900, item panel closed via toggle): ≥ 5 day headers and ≥ 8 block labels fully inside the viewport; each chip's height ≤ 32 px; record every day column's width, add events to one cell one by one (1, 2, 3, then 5 total) and assert widths are unchanged and the row height equals 1/2/3/3 chip lines (± 4 px) with "+3 more" visible at 5; block label elements have `scrollHeight <= clientHeight + 1` (no wrap) and contain no time range text (no `\d{1,2}[–-]\d{1,2}`)

### Implementation for User Story 1

- [X] T015 [P] [US1] Implement `visibleChips(count): { shown: number; more: number }` in `apps/web/src/lib/cellOverflow.ts` (count ≤ 3 → all; count ≥ 4 → `{ shown: 2, more: count - 2 }`); make T012 pass
- [X] T016 [US1] Create `apps/web/src/components/grid/PlacementChip.tsx` + `PlacementChip.module.css` replacing `PlacementCard`: height `--size-chip`, `--radius-xs`, `--font-size-sm` 500, `Flag` (activity, `--color-activity` on `--color-activity-bg`) or `Utensils` (food, `--color-food` on `--color-food-bg`) icon, name with ellipsis wrapped in `Tooltip`; `MoreHorizontal` actions button (`aria-label="Actions for <name>"`) visible on `:hover`/`:focus-within` and always on `(pointer: coarse)`, opening `Menu` with the four actions; whole chip is the dnd-kit sortable node (`useSortable` listeners on the chip root) plus a visually hidden `Drag <name>` button carrying `attributes`/keyboard listeners; click without drag opens the existing edit popover/dialog; move the logic from `PlacementCard.tsx` (switch type, move dialog, edit, remove) unchanged; make T013 pass
- [X] T017 [US1] Delete `apps/web/src/components/grid/PlacementCard.tsx` and `PlacementCard.module.css`, update all imports to `PlacementChip`
- [X] T018 [US1] Rework `apps/web/src/components/grid/Cell.tsx` + `Cell.module.css`: padding `--space-3`, gap `--space-2`, `min-height: var(--size-row-min)`, `min-width: 0`; render `visibleChips(n)` chips and, when `more > 0`, a text button "+N more" (`aria-label="Show all <total> events in <Block> on <date>"`, `--font-size-sm` 600 `--color-accent`); empty cell shows nothing at rest, and on hover/focus-within a subtle "+ Add" text button keeping the accessible name `Add event to <Block> on <date>` (always visible on `(pointer: coarse)`); typing flow (combobox, suggestions, Enter for another) unchanged; greyed cells use a `--color-greyed-hatch` background with the existing "Outside travel window" marker as a small icon; weather icon absolutely positioned top-right (12 px, `--color-text-muted`), chips reserve right padding so the icon never adds a line
- [X] T019 [US1] Create `apps/web/src/components/grid/CellListPopover.tsx` + `.module.css`: opened by "+N more", anchored to the cell (`Popover`), header "<Weekday> · <Block>", all chips in a dnd-kit `SortableContext` (reorder within, drag out to other cells), registered as a droppable for the same cell id so drops land in this cell; closes on Escape/outside click
- [X] T020 [US1] Rework `apps/web/src/components/grid/BlockLabel.tsx` + `BlockLabel.module.css`: one line, block name only (`--font-size-xs`, uppercase, `letter-spacing: .06em`, 600, ellipsis + `Tooltip` with full name), no time range text; on hover/focus-within show a `GripVertical` reorder handle (`Reorder <Block>`) and an `Options for <Block>` `MoreHorizontal` button opening `Menu` with items `Rename <Block>` (inline rename as today), `Edit time window for <Block>` (opens the existing time-window dialog), `Add block below <Block>`, `Remove <Block>` (existing confirm); remove the always-visible 🕒 / + / × buttons
- [X] T021 [US1] Update `apps/web/src/components/grid/Grid.tsx` + `Grid.module.css`: tracks `var(--size-block-label) repeat(var(--day-count), minmax(var(--size-day-column), 1fr))`, every cell `min-width: 0`; thin `--color-border` lines (1 px), header bottom `--color-border-strong`; sticky header row (`top: 0`) and sticky label column (`left: 0`) with `--color-bg`; scroller `max-height: calc(100dvh - var(--size-header) - <strip heights>)`, no outer radius; phone (< 640 px) label column + one day with the existing day nav restyled (chevron icon buttons)
- [X] T022 [US1] Restyle `apps/web/src/components/weather/WeatherIcon.tsx` + `.module.css`: replace the inline SVGs with lucide `Sun`, `CloudSun`, `Cloud`, `CloudFog`, `CloudRain`, `CloudSnow`, `CloudLightning` (12 px, `--color-text-muted`), 20×20 px button hit area (44 px on coarse pointers via pseudo-element), keep `aria-label` and popover behavior; popover styled with tokens
- [X] T023 [US1] Update e2e helpers and specs for moved actions: add `openChipMenu(page, name)` and `openBlockMenu(page, block)` to `apps/web/e2e/helpers.ts`; in `apps/web/e2e/planner.spec.ts`, `weather.spec.ts`, `a11y.spec.ts`, `perf.spec.ts`, `sync.spec.ts` open the menu before clicking `Switch …`, `Move …`, `Edit …`, `Remove …`, `Rename <Block>`, `Edit time window for …`, `Add block below …`, `Remove <Block>`; keep all assertions otherwise unchanged; run the full e2e suite (local Supabase) and fix regressions

**Checkpoint**: US1 complete — compact grid works with all 001/002 behavior

---

## Phase 4: User Story 2 - Compact day and trip headers (Priority: P1)

**Goal**: One-line day headers with small indicators and a day menu; a single 48 px navy trip bar; tips as toasts.

**Independent Test**: Day 1 with arrival Lunch and Day 3 with location Osaka show small plane/pin indicators only on those days; every day header is ≤ 2 lines; the trip header is ≤ one block-row tall; no "Travel…"/"Location…" text links remain.

### Tests for User Story 2 ⚠️

- [X] T024 [P] [US2] Component test `apps/web/tests/DayHeader.test.tsx`: renders "THU" and "Oct 15" for 2026-10-15; no indicators when nothing set; with arrival block "Lunch" shows `PlaneLanding` + "Arrive · Lunch", with departure shows `PlaneTakeoff` + "Depart · <Block>", with a location override shows `MapPin` + the place's short name (text before the first comma); `Day options for <date>` opens a menu with `Set arrival and departure for <date>`, `Set location for <date>`, and (only with an override) `Use trip location on <date>`
- [X] T025 [P] [US2] Extend `apps/web/e2e/layout.spec.ts`: every day header's text spans ≤ 2 lines (height ≤ 2 × line-height + padding); the trip header height ≤ the smallest block row height + 12 px; no visible text "Travel…" or "Location…" in the grid

### Implementation for User Story 2

- [X] T026 [US2] Rework `apps/web/src/components/grid/DayHeader.tsx` + `DayHeader.module.css`: line 1 = weekday (`--font-size-xs` uppercase 600) + short date ("Oct 15", `--font-size-sm`, tabular) + `Day options for <date>` `MoreHorizontal` button (hover/focus, always on coarse pointers) opening `Menu` with `Set arrival and departure for <date>` (opens the existing travel dialog), `Set location for <date>` (existing `LocationDialog`), `Use trip location on <date>` (only when overridden); line 2 only when set: indicator buttons (`--font-size-xs`, `--color-accent`, 12 px icons) for arrival, departure, location override, each opening the day menu; "Forecast from <date>" moves into the day menu as a disabled info item and into the weather icon's absence tooltip; make T024 pass
- [X] T027 [US2] Create `apps/web/src/components/layout/TripHeader.tsx` + `TripHeader.module.css` and use it in `apps/web/src/pages/TripPlanner.tsx`: height `--size-header`, `--color-header-bg` with `--color-header-text`; contents: back link (`ArrowLeft`, "Trips"), trip name (`--font-size-lg` 700), date range button (`CalendarDays` + "Oct 15 – 19 · 5 days", keeps `Change trip dates (…)`), location button (`MapPin` + name, keeps `Change trip location (<name>)` / `Add a location`), flexible spacer, `Undo` / `Redo` icon buttons with tooltips, the panel toggle (`PanelRight`, "Items", name `Show list`, `aria-expanded`), and a `More trip actions` menu holding `Trip settings`; remove the old header markup and its CSS from `TripPlanner.module.css`
- [X] T028 [US2] In `apps/web/src/pages/TripPlanner.tsx` replace the full-width info banner ("Trip created … Got it") with `Toast` via `useTip('trip-created')`; render warning banners (save failed, weather unavailable, add-a-location prompt) as one slim strip stack under the header using the restyled `Banner`
- [X] T029 [US2] Update e2e specs that clicked "Travel…" / "Location…" / `Set arrival and departure for …` / `Set location for …` / `Use trip location on …` to first open `Day options for <date>` (add `openDayMenu(page, date)` to `apps/web/e2e/helpers.ts`); update the trip-created banner dismissal to the toast's "Got it"; run the e2e suite

**Checkpoint**: US1 + US2 — grid and headers match the mockup

---

## Phase 5: User Story 3 - Drag that feels free (Priority: P1)

**Goal**: A lifted chip floats under the pointer, origin placeholder, highlighted target with insertion line, edge auto-scroll, animated drop, Escape cancels, reduced motion respected.

**Independent Test**: Drag a chip from Day 1/Lunch to Day 4/Dinner with mouse and with touch long-press; the overlay stays under the pointer, the target highlights, and the chip lands there.

### Tests for User Story 3 ⚠️

- [X] T030 [P] [US3] E2E `apps/web/e2e/drag.spec.ts` (desktop and mobile-360 where noted): during a mouse drag (12 steps), an element with `data-drag-overlay` exists and its center stays within 8 px of the pointer at steps 3, 6, 9; the origin chip has `data-placeholder`; the hovered cell has `data-drop-target="true"`; after drop the chip is in the target cell; a second drag cancelled with Escape returns the chip to its origin; with `page.emulateMedia({ reducedMotion: 'reduce' })` the overlay's computed `transform` contains no rotation; on mobile-360 a 300 ms touch hold then move drags the chip (use `page.touchscreen` / dispatched touch events); dragging from the item panel into a cell shows the same overlay

### Implementation for User Story 3

- [X] T031 [US3] Create `apps/web/src/components/grid/DragLayer.tsx` + `DragLayer.module.css`: dnd-kit `DragOverlay` in a `createPortal` to `document.body`, `zIndex` above the panel and menus; renders a `PlacementChip` (or list item chip) in `overlay` mode with `--shadow-drag`, `transform: scale(1.04) rotate(-1.5deg)`, `cursor: grabbing`, `data-drag-overlay`; under `prefers-reduced-motion: reduce` no scale/rotate; `dropAnimation` = 180 ms ease-out, or `null` with reduced motion (read via `matchMedia`)
- [X] T032 [US3] Update `apps/web/src/components/grid/DndProvider.tsx`: track `activeId` in state and render `DragLayer`; keep `PointerSensor` (distance 5) and `TouchSensor` (delay 200, tolerance 8) and keyboard sensor + existing announcements; enable `autoScroll` with `threshold: { x: 0.1, y: 0.1 }`; on drag start mark the origin chip `data-placeholder` (dashed `--color-border-strong` outline, opacity .5); Escape cancel uses dnd-kit default
- [X] T033 [US3] In `apps/web/src/components/grid/Cell.tsx` + `Cell.module.css` and `CellListPopover.tsx`: when the cell is `isOver`, set `data-drop-target="true"`, fill `--color-accent-soft` with a 1.5 px inset `--color-accent` ring, and show a 2 px `--color-accent` insertion line at the sortable index (use `verticalListSortingStrategy` and the `over` index); collapsed cells (4+ events) insert at the end
- [X] T034 [US3] Make list-panel items use the same overlay: in `apps/web/src/components/list/ItemList.tsx` (or `ItemPanel.tsx` once US4 lands) set the drag data so `DragLayer` renders the item as a chip; make T030 pass

**Checkpoint**: US1–US3 — the P1 experience is complete

---

## Phase 6: User Story 4 - Item list as a slide-in panel (Priority: P2)

**Goal**: Collapsible right panel (bottom sheet on phones) with search, compact filters, and an "Add" popover form; open state remembered per device.

**Independent Test**: Toggle the panel; the grid widens when closed; items drag from the open panel into cells; "Add" opens a compact form that closes after adding; reload keeps the open/closed state.

### Tests for User Story 4 ⚠️

- [X] T035 [P] [US4] Component test `apps/web/tests/ItemPanel.test.tsx`: search "ram" (case- and accent-insensitive: "Ramen", "RAMÉN") filters by name; segmented All / Activities / Food and the "Not yet placed" toggle filter; "Add" opens a form (name, type, notes, link), submitting calls `addItem` and closes it; each row shows "placed N×" when N > 0 and keeps `Drag <item>`, `Edit <item>`, `Delete <item>`, `Place <item> in a block` names (the last three via `Actions for <item>` menu)
- [X] T036 [P] [US4] Extend `apps/web/e2e/layout.spec.ts`: with the panel open at 1440×900 ≥ 4 day headers are fully visible (FR-007); toggling closed widens the grid; after reload the state persists

### Implementation for User Story 4

- [X] T037 [US4] Create `apps/web/src/components/list/ItemPanel.tsx` + `ItemPanel.module.css` replacing `ItemList`: region `aria-label="Activities and food"`, width `--size-panel`, `--color-surface` background, left border; header "Activities & food" (`--font-size-sm` 700) + "Add" button opening a `Popover` form (existing add-item fields, compact); search field (`Search`, normalizes with `toLocaleLowerCase()` + `normalize('NFD')` stripping diacritics); segmented control (All / Activities / Food) and a "Not yet placed" toggle chip; list of 28 px rows (type icon, name with ellipsis, "N×" muted count, `Actions for <item>` menu with Edit / Delete / Place in a block); rows draggable via the same sortable/draggable setup as today; make T035 pass
- [X] T038 [US4] Wire the panel in `apps/web/src/pages/TripPlanner.tsx` + `TripPlanner.module.css`: layout `grid-template-columns: 1fr auto`; panel visibility from `localStorage['cellar:itemPanelOpen']` (`"1"`/`"0"`, default `"1"` at ≥ 1280 px wide else `"0"`, try/catch — data-model.md) toggled by the header's `Show list` button; slide transition 160 ms (none with reduced motion); below 640 px render the panel as a bottom sheet (existing "Show list" behavior restyled: 60% viewport height, drag handle bar, closes on Escape/backdrop)
- [X] T039 [US4] Delete `apps/web/src/components/list/ItemList.tsx` and `ItemList.module.css`; update imports and any e2e selectors that relied on the always-open form (`apps/web/e2e/planner.spec.ts`: open "Add" first); run the e2e suite

**Checkpoint**: Planner screen complete

---

## Phase 7: User Story 5 - Consistent look across the whole app (Priority: P2)

**Goal**: Sign in / sign up / reset / trips / settings share the system; no emoji anywhere; light and dark themes pass axe.

**Independent Test**: Visit every screen in light and dark; same type scale, icons, buttons, navy accent; trips appear as itinerary rows; axe reports zero violations.

### Tests for User Story 5 ⚠️

- [X] T040 [P] [US5] Unit test `apps/web/tests/no-emoji.test.ts`: read every `apps/web/src/**/*.tsx` file and fail if any string literal or JSX text contains a code point matching `/\p{Extended_Pictographic}/u` (allow-list: none)
- [X] T041 [P] [US5] Extend `apps/web/e2e/a11y.spec.ts`: run axe on Sign in, Sign up, Reset password, Trips, Trip planner (panel open, a menu open, a popover open), and Settings, each under `page.emulateMedia({ colorScheme: 'light' })` and `'dark'`; zero violations

### Implementation for User Story 5

- [X] T042 [P] [US5] Restyle auth screens `apps/web/src/pages/SignIn.tsx`, `SignUp.tsx`, `ResetPassword.tsx` and `Auth.module.css`: centered 360 px card on `--color-surface`, "Cellar" wordmark (`--font-size-xl` 700, `--color-accent`), 28 px fields, full-width primary button, links `--font-size-sm`
- [X] T043 [P] [US5] Restyle `apps/web/src/pages/Trips.tsx` + `Trips.module.css`: slim navy header ("Your trips" + primary "New trip" button, white variant); trips as itinerary rows (name `--font-size-md` 600; `CalendarDays` date range; `MapPin` location when set; "5 days" muted; `ChevronRight`), row hover `--color-surface`; trip actions (`Rename <trip>`, `Delete <trip>`) in a row `Menu`; "Recently deleted" as a collapsible section with `Restore <trip>`
- [X] T044 [P] [US5] Restyle `apps/web/src/pages/Settings.tsx` (and its CSS module if any): single column ≤ 560 px, `--font-size-xs` uppercase section labels, restyled buttons; danger zone uses `danger` button variant
- [X] T045 [US5] Replace every remaining emoji and ad-hoc SVG in `apps/web/src/**/*.tsx` (e.g. 📅 📍 🎟 🕒 ✈ in DateRangePicker, LocationPicker, LocationDialog, ConfirmDialog, SaveStatusBanner, Banner) with `Icon.tsx` icons; make T040 pass
- [X] T046 [US5] Fix any axe or contrast failures from T041 by adjusting tokens in `apps/web/src/styles/tokens.css` (keep T004 passing)

**Checkpoint**: Whole app consistent

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T047 Remove CSS classes, components, and tokens made unused by this feature (`apps/web/src/**`); confirm with `pnpm --filter web typecheck` and `pnpm lint`
- [ ] T048 Run all checks: `pnpm lint`, `pnpm --filter @cellar/core test`, `pnpm --filter web test`, `pnpm --filter web typecheck`, `pnpm --filter web build`, `pnpm test:db`, `pnpm --filter web e2e` (local Supabase); fix failures. Do not commit changes under `apps/web/dist`
- [ ] T049 Walk through the 19 scenarios in `specs/003-ui-redesign/quickstart.md` against the running app and note any failures (scenario 19 is the user's side-by-side review)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (1)** → **Foundational (2)** → stories
- **US1 (3)**: after Foundational
- **US2 (4)**: after Foundational; independent of US1 except shared e2e helper file edits (do T023 before T029)
- **US3 (5)**: after US1 (overlay renders `PlacementChip`; drop target styling lives in the reworked `Cell`)
- **US4 (6)**: after Foundational; T034 targets `ItemList` before US4 or `ItemPanel` after
- **US5 (7)**: after Foundational; T045 best after US1–US4 so their emoji are already gone
- **Polish (8)**: after all stories

### Within Each Story

- Tests first where marked (T012→T015, T013→T016, T024→T026, T030→T031–T034, T035→T037, T040→T045)
- T005 before T006; T006 before any restyle task
- T016 before T017–T019; T019 before T033

### Parallel Opportunities

- Setup: T003 alongside T001/T002
- Foundational: T004, T008, T009, T010 in parallel (after T001)
- US1: T012, T013, T014, T015 in parallel
- US2: T024, T025 in parallel; US2 can run alongside US1 except `helpers.ts`
- US4: T035, T036 in parallel; US4 can run alongside US3
- US5: T040, T041, T042, T043, T044 in parallel

---

## Parallel Example: User Story 1

```bash
Task: "Unit test visibleChips in apps/web/tests/cellOverflow.test.ts"
Task: "Component test PlacementChip in apps/web/tests/PlacementChip.test.tsx"
Task: "E2E layout checks in apps/web/e2e/layout.spec.ts"
Task: "Implement visibleChips in apps/web/src/lib/cellOverflow.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phases 1–2 (new tokens, fonts, icons, primitives)
2. Phase 3 (compact grid)
3. **Stop and validate**: T014 + quickstart scenarios 1–6

### Incremental Delivery

1. US1 → compact grid
2. US2 → slim headers
3. US3 → floating drag (P1 complete)
4. US4 → item panel
5. US5 → whole-app consistency
6. Polish → full suite + quickstart; merge `feature/003-ui-redesign` into `main` only after the user's side-by-side review (SC-008)

---

## Notes

- [P] = different files, no dependency on unfinished tasks
- No changes to `packages/core` or `supabase/`; if a task seems to need one, stop and flag it
- Commit after each phase
