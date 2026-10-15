import { describe, expect, it } from 'vitest';
import { addItem, deleteItem, updateItem } from '../src/commands/item';
import { addTypedPlacement } from '../src/commands/placement';
import type { Place } from '../src/model/types';
import { placeFields, placeOf } from '../src/places/fields';
import { expectOk, newTripState } from './fixtures';

const chelsea: Place = {
  id: 'test-chelsea',
  provider: 'google',
  name: 'Chelsea Market',
  address: '75 9th Ave, New York',
  lat: 40.7424,
  lon: -74.0061,
  category: 'market',
};

describe('addItem', () => {
  it('adds an item with a type and optional notes/link', () => {
    const r = expectOk(
      addItem('Ichiran Ramen', 'food', 'tonkotsu', 'https://ichiran.com')(newTripState()),
    );
    expect(r.state.items).toHaveLength(1);
    expect(r.state.items[0]).toMatchObject({
      name: 'Ichiran Ramen',
      type: 'food',
      notes: 'tonkotsu',
      link: 'https://ichiran.com',
    });
    expect(r.changes).toEqual([expect.objectContaining({ table: 'items', op: 'upsert' })]);
  });

  it('requires a name of 1-200 chars and a valid type', () => {
    const s = newTripState();
    const code = (r: ReturnType<ReturnType<typeof addItem>>) => (r.ok ? null : r.error.code);
    expect(code(addItem(' ', 'food')(s))).toBe('EMPTY_NAME');
    expect(code(addItem('a'.repeat(201), 'food')(s))).toBe('EMPTY_NAME');
    expect(code(addItem('a'.repeat(200), 'activity')(s))).toBeNull();
    expect(addItem('x', 'bogus' as never)(s).ok).toBe(false);
    expect(code(addItem('x', 'food', null, 'ftp://nope')(s))).toBe('INVALID_LINK');
  });

  it('inverse removes the item', () => {
    const r = expectOk(addItem('x', 'food')(newTripState()));
    expect(expectOk(r.inverse(r.state)).state.items).toEqual([]);
  });
});

describe('addItem with a place', () => {
  it('stores all place fields', () => {
    const r = expectOk(addItem('Chelsea Market', 'activity', null, null, chelsea)(newTripState()));
    expect(r.state.items[0]).toMatchObject(placeFields(chelsea));
    expect(placeOf(r.state.items[0])).toEqual(chelsea);
  });

  it('rejects an invalid place', () => {
    const r = addItem('x', 'food', null, null, { ...chelsea, lat: 100 })(newTripState());
    expect(!r.ok && r.error.code).toBe('INVALID_PLACE');
  });

  it('leaves the place fields null when omitted', () => {
    const r = expectOk(addItem('Rest day', 'activity')(newTripState()));
    expect(r.state.items[0]).toMatchObject(placeFields(null));
  });

  it('undo removes the item', () => {
    const r = expectOk(addItem('Chelsea Market', 'activity', null, null, chelsea)(newTripState()));
    expect(expectOk(r.inverse(r.state)).state.items).toEqual([]);
  });
});

describe('updateItem / deleteItem never change placement content (FR-009)', () => {
  function withPlacement() {
    const s0 = newTripState();
    const s1 = expectOk(addItem('Ichiran', 'food')(s0)).state;
    const itemId = s1.items[0].id;
    const p = expectOk(addTypedPlacement('2027-04-02', s1.blocks[0].id, 'Ichiran')(s1)).state;
    const placement = { ...p.placements[0], sourceItemId: itemId };
    return { state: { ...p, placements: [placement] }, itemId, placement };
  }

  it('updateItem edits only the item', () => {
    const { state, itemId, placement } = withPlacement();
    const r = expectOk(updateItem(itemId, { name: 'Renamed', notes: 'n' })(state));
    expect(r.state.items[0]).toMatchObject({ name: 'Renamed', notes: 'n' });
    expect(r.state.placements).toEqual([placement]);
    expect(r.changes.every((c) => c.table === 'items')).toBe(true);
  });

  it('deleteItem keeps every placement and its content', () => {
    const { state, itemId, placement } = withPlacement();
    const r = expectOk(deleteItem(itemId)(state));
    expect(r.state.items).toEqual([]);
    expect(r.state.placements).toHaveLength(1);
    expect(r.state.placements[0]).toMatchObject({
      id: placement.id,
      name: placement.name,
      type: placement.type,
      notes: placement.notes,
      position: placement.position,
      date: placement.date,
      blockId: placement.blockId,
    });
    expect(r.state.placements[0].sourceItemId).toBeNull(); // the reference is cleared, as in the DB
  });

  it('delete is undoable and restores the reference', () => {
    const { state, itemId } = withPlacement();
    const r = expectOk(deleteItem(itemId)(state));
    const back = expectOk(r.inverse(r.state));
    expect(back.state.items[0].id).toBe(itemId);
    expect(back.state.placements[0].sourceItemId).toBe(itemId);
  });

  it('reports NOT_FOUND for unknown ids', () => {
    const s = newTripState();
    const u = updateItem('nope', { name: 'x' })(s);
    const d = deleteItem('nope')(s);
    expect(!u.ok && u.error.code).toBe('NOT_FOUND');
    expect(!d.ok && d.error.code).toBe('NOT_FOUND');
  });
});
