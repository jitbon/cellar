import type { Item, ItemType, TripState } from '../model/types';

export function placedCount(state: TripState, itemId: string): number {
  return state.placements.filter((p) => p.sourceItemId === itemId).length;
}

export function filterItems(
  state: TripState,
  filter: { type?: ItemType; placed?: boolean } = {},
): Item[] {
  return state.items.filter((item) => {
    if (filter.type && item.type !== filter.type) return false;
    if (filter.placed !== undefined && placedCount(state, item.id) > 0 !== filter.placed) {
      return false;
    }
    return true;
  });
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/** Whether the item's name contains the text (case- and accent-insensitive); blank text matches all. */
export function matchesItemName(item: Pick<Item, 'name'>, text: string): boolean {
  const q = fold(text.trim());
  return q === '' || fold(item.name).includes(q);
}

/** Case- and accent-insensitive; names starting with the query rank above names containing it. */
export function suggestItems(state: TripState, query: string, limit = 5): Item[] {
  const q = fold(query.trim());
  if (q === '') return [];
  const prefix: Item[] = [];
  const contains: Item[] = [];
  for (const item of state.items) {
    const name = fold(item.name);
    if (name.startsWith(q)) prefix.push(item);
    else if (name.includes(q)) contains.push(item);
  }
  return [...prefix, ...contains].slice(0, limit);
}
