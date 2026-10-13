import { describe, expect, it } from 'vitest';
import { addItem } from '../src/commands/item';
import { placeItem } from '../src/commands/placement';
import { filterItems, placedCount, suggestItems } from '../src/queries/items';
import type { ItemType, TripState } from '../src/model/types';
import { expectOk, newTripState } from './fixtures';

function withItems(items: [string, ItemType][]): TripState {
  let s = newTripState();
  for (const [name, type] of items) s = expectOk(addItem(name, type)(s)).state;
  return s;
}
const idOf = (s: TripState, name: string) => s.items.find((i) => i.name === name)!.id;

describe('placedCount / filterItems', () => {
  const base = withItems([
    ['Ichiran Ramen', 'food'],
    ['teamLab', 'activity'],
    ['Sushi Dai', 'food'],
  ]);
  const blockId = base.blocks[0].id;
  let s = expectOk(placeItem(idOf(base, 'Ichiran Ramen'), '2027-04-01', blockId)(base)).state;
  s = expectOk(placeItem(idOf(s, 'Ichiran Ramen'), '2027-04-02', blockId)(s)).state;
  s = expectOk(placeItem(idOf(s, 'teamLab'), '2027-04-03', blockId)(s)).state;

  it('placedCount counts placements copied from the item', () => {
    expect(placedCount(s, idOf(s, 'Ichiran Ramen'))).toBe(2);
    expect(placedCount(s, idOf(s, 'teamLab'))).toBe(1);
    expect(placedCount(s, idOf(s, 'Sushi Dai'))).toBe(0);
  });

  it('filters by type and by placed / not placed', () => {
    expect(filterItems(s, {}).length).toBe(3);
    expect(filterItems(s, { type: 'food' }).map((i) => i.name)).toEqual([
      'Ichiran Ramen',
      'Sushi Dai',
    ]);
    expect(filterItems(s, { placed: false }).map((i) => i.name)).toEqual(['Sushi Dai']);
    expect(filterItems(s, { placed: true }).map((i) => i.name)).toEqual([
      'Ichiran Ramen',
      'teamLab',
    ]);
    expect(filterItems(s, { type: 'food', placed: true }).map((i) => i.name)).toEqual([
      'Ichiran Ramen',
    ]);
  });
});

describe('suggestItems', () => {
  const s = withItems([
    ['Ramen Ichiran', 'food'],
    ['Ichiran Ramen', 'food'],
    ['Café de l’Ambre', 'food'],
    ['Cafe Kitsune', 'food'],
    ['Ichigo Farm', 'activity'],
    ['Museum', 'activity'],
    ['Ichi-1', 'activity'],
    ['Ichi-2', 'activity'],
  ]);

  it('is case-insensitive and ranks prefix matches above contains matches', () => {
    const names = suggestItems(s, 'ICHI').map((i) => i.name);
    expect(names.slice(0, 4).sort()).toEqual(['Ichi-1', 'Ichi-2', 'Ichigo Farm', 'Ichiran Ramen']);
    expect(names).not.toContain('Museum');
    expect(names.indexOf('Ramen Ichiran')).toBeGreaterThan(names.indexOf('Ichiran Ramen'));
  });

  it('honors limit (default 5)', () => {
    expect(suggestItems(s, 'ichi')).toHaveLength(5);
    expect(suggestItems(s, 'ichi', 2)).toHaveLength(2);
  });

  it('is accent-insensitive', () => {
    expect(
      suggestItems(s, 'cafe')
        .map((i) => i.name)
        .sort(),
    ).toEqual(['Cafe Kitsune', 'Café de l’Ambre']);
    expect(suggestItems(s, 'café').length).toBe(2);
  });

  it('returns nothing for an empty query', () => {
    expect(suggestItems(s, '')).toEqual([]);
    expect(suggestItems(s, '   ')).toEqual([]);
  });

  it('returns nothing when nothing matches', () => {
    expect(suggestItems(s, 'zzz')).toEqual([]);
  });
});
