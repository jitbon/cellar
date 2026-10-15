# Tasks: Meal Rows

**Input**: [spec.md](./spec.md). Small feature; no separate plan.

## Phase 1: Core and storage

- [X] T001 Add `isMeal: boolean | null` to `Block` in `packages/core/src/model/types.ts` (null in `createTrip` and `addBlock`), `isMealName` / `isMealBlock` in `packages/core/src/queries/meal.ts`, and `setBlockMeal(id, isMeal)` in `packages/core/src/commands/block.ts`; tests in `packages/core/tests/meal-rows.test.ts` per FR-001, FR-003
- [X] T002 Add migration `supabase/migrations/0008_meal_rows.sql`: `blocks.is_meal boolean null`

## Phase 2: UI

- [X] T003 Add token `--color-food-row` (light and dark) in `apps/web/src/styles/tokens.css` with contrast pairs in `apps/web/tests/tokens.test.ts` per FR-002
- [X] T004 Tint meal rows (`--cell-bg`, `--label-bg` set on the row in `Grid.tsx` / `Grid.module.css`, read by `Cell.module.css` and `BlockLabel.module.css`), show the "Meal row" icon and the menu toggle in `apps/web/src/components/grid/BlockLabel.tsx`; tests in `apps/web/tests/BlockLabel.test.tsx` and `apps/web/e2e/meal-rows.spec.ts` per FR-002, FR-003
