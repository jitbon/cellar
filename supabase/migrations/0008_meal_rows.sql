-- Meal rows: null follows the block name; true/false is the traveler's explicit choice.
-- Nullable, so existing blocks stay in auto mode with no backfill. RLS unchanged.

alter table blocks
  add column is_meal boolean null;
