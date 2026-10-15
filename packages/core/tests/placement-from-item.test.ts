import { describe, expect, it } from 'vitest';
import { addItem } from '../src/commands/item';
import { addTypedPlacement, placeItem } from '../src/commands/placement';
import { cell } from '../src/queries/cell';
import type { Place } from '../src/model/types';
import { placeFields } from '../src/places/fields';
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

function setup() {
  const s0 = newTripState();
  const s1 = expectOk(
    addItem('Ichiran Ramen', 'food', 'tonkotsu', 'https://ichiran.com')(s0),
  ).state;
  return { state: s1, item: s1.items[0], blockId: s1.blocks[3].id, otherBlock: s1.blocks[1].id };
}

describe('placeItem', () => {
  it('copies name/type/notes/link and sets sourceItemId; the item stays in the list', () => {
    const { state, item, blockId } = setup();
    const r = expectOk(placeItem(item.id, '2027-04-02', blockId)(state));
    expect(r.state.items).toEqual(state.items);
    expect(cell(r.state, '2027-04-02', blockId)[0]).toMatchObject({
      name: 'Ichiran Ramen',
      type: 'food',
      notes: 'tonkotsu',
      link: 'https://ichiran.com',
      sourceItemId: item.id,
    });
    expect(r.changes).toEqual([expect.objectContaining({ table: 'placements', op: 'upsert' })]);
  });

  it('copies the place fields; later item edits do not change the placement place', async () => {
    const { updateItem } = await import('../src/commands/item');
    const { state, blockId } = setup();
    const linked = expectOk(
      addItem('Chelsea Market', 'activity', null, null, chelsea)(state),
    ).state;
    const item = linked.items[1];
    const r1 = expectOk(placeItem(item.id, '2027-04-02', blockId)(linked));
    expect(r1.state.placements[0]).toMatchObject(placeFields(chelsea));
    const r2 = expectOk(updateItem(item.id, { name: 'Renamed' })(r1.state));
    expect(r2.state.placements[0]).toMatchObject(placeFields(chelsea));
  });

  it('can place the same item in several cells as independent copies', () => {
    const { state, item, blockId, otherBlock } = setup();
    const r1 = expectOk(placeItem(item.id, '2027-04-02', blockId)(state));
    const r2 = expectOk(placeItem(item.id, '2027-04-03', otherBlock)(r1.state));
    expect(r2.state.placements).toHaveLength(2);
    expect(new Set(r2.state.placements.map((p) => p.id)).size).toBe(2);
  });

  it('inserts before the given placement', () => {
    const { state, item, blockId } = setup();
    const r1 = expectOk(addTypedPlacement('2027-04-02', blockId, 'first')(state));
    const first = r1.state.placements[0];
    const r2 = expectOk(placeItem(item.id, '2027-04-02', blockId, first.id)(r1.state));
    expect(cell(r2.state, '2027-04-02', blockId).map((p) => p.name)).toEqual([
      'Ichiran Ramen',
      'first',
    ]);
  });

  it('later edits to the copy do not touch the list item', async () => {
    const { updatePlacement } = await import('../src/commands/placement');
    const { state, item, blockId } = setup();
    const r1 = expectOk(placeItem(item.id, '2027-04-02', blockId)(state));
    const r2 = expectOk(updatePlacement(r1.state.placements[0].id, { notes: 'changed' })(r1.state));
    expect(r2.state.items[0].notes).toBe('tonkotsu');
  });

  it('rejects unknown items, unknown blocks, and out-of-range dates', () => {
    const { state, item, blockId } = setup();
    const e1 = placeItem('nope', '2027-04-02', blockId)(state);
    const e2 = placeItem(item.id, '2027-04-02', 'nope')(state);
    const e3 = placeItem(item.id, '2030-01-01', blockId)(state);
    expect(!e1.ok && e1.error.code).toBe('NOT_FOUND');
    expect(!e2.ok && e2.error.code).toBe('NOT_FOUND');
    expect(!e3.ok && e3.error.code).toBe('DATE_OUT_OF_RANGE');
  });
});
