import { describe, expect, it } from 'vitest';
import {
  addTypedPlacement,
  movePlacement,
  removePlacement,
  updatePlacement,
} from '../src/commands/placement';
import { cell } from '../src/queries/cell';
import type { Ok } from '../src/commands/command';
import type { Place, TripState } from '../src/model/types';
import { placeFields } from '../src/places/fields';
import { blockIdByName, expectOk, newTripState } from './fixtures';

const tacos: Place = {
  id: 'test-tacos',
  provider: 'google',
  name: 'Los Tacos No. 1',
  address: '75 9th Ave, New York',
  lat: 40.7441,
  lon: -74.0063,
  category: 'mexican_restaurant',
};

function add(state: TripState, date: string, blockId: string, name: string, after?: string): Ok {
  return expectOk(addTypedPlacement(date, blockId, name, after)(state));
}

describe('addTypedPlacement', () => {
  it('creates an activity with no source item, appended to the cell', () => {
    const s0 = newTripState();
    const b = blockIdByName(s0, 'Afternoon');
    const r1 = add(s0, '2027-04-02', b, 'Walk around Shibuya');
    const p = cell(r1.state, '2027-04-02', b)[0];
    expect(p).toMatchObject({ name: 'Walk around Shibuya', type: 'activity', sourceItemId: null });
    expect(r1.changes).toEqual([expect.objectContaining({ table: 'placements', op: 'upsert' })]);
  });

  it('appends after the given placement', () => {
    const s0 = newTripState();
    const b = blockIdByName(s0, 'Afternoon');
    const r1 = add(s0, '2027-04-02', b, 'one');
    const r2 = add(r1.state, '2027-04-02', b, 'three', cell(r1.state, '2027-04-02', b)[0].id);
    const first = cell(r2.state, '2027-04-02', b)[0];
    const r3 = add(r2.state, '2027-04-02', b, 'two', first.id);
    expect(cell(r3.state, '2027-04-02', b).map((p) => p.name)).toEqual(['one', 'two', 'three']);
  });

  it('rejects empty names, unknown blocks and out-of-range dates', () => {
    const s0 = newTripState();
    const b = s0.blocks[0].id;
    expect(addTypedPlacement('2027-04-02', b, ' ')(s0).ok).toBe(false);
    const nf = addTypedPlacement('2027-04-02', 'nope', 'x')(s0);
    expect(!nf.ok && nf.error.code).toBe('NOT_FOUND');
    const oor = addTypedPlacement('2027-05-02', b, 'x')(s0);
    expect(!oor.ok && oor.error.code).toBe('DATE_OUT_OF_RANGE');
  });

  it('inverse removes the placement', () => {
    const s0 = newTripState();
    const r1 = add(s0, '2027-04-02', s0.blocks[0].id, 'x');
    const back = expectOk(r1.inverse(r1.state));
    expect(back.state.placements).toEqual([]);
    expect(back.changes).toEqual([expect.objectContaining({ table: 'placements', op: 'delete' })]);
  });
});

describe('addTypedPlacement with a place', () => {
  it('stores the place fields and type', () => {
    const s0 = newTripState();
    const b = s0.blocks[0].id;
    const r = expectOk(
      addTypedPlacement('2027-04-02', b, 'Los Tacos', undefined, {
        place: tacos,
        type: 'food',
      })(s0),
    );
    expect(r.state.placements[0]).toMatchObject({
      name: 'Los Tacos',
      type: 'food',
      ...placeFields(tacos),
    });
  });

  it('keeps type activity and null place fields without opts', () => {
    const s0 = newTripState();
    const r = add(s0, '2027-04-02', s0.blocks[0].id, 'Walk');
    expect(r.state.placements[0]).toMatchObject({ type: 'activity', ...placeFields(null) });
  });

  it('rejects an invalid place', () => {
    const s0 = newTripState();
    const r = addTypedPlacement('2027-04-02', s0.blocks[0].id, 'x', undefined, {
      place: { ...tacos, lon: 200 },
    })(s0);
    expect(!r.ok && r.error.code).toBe('INVALID_PLACE');
  });
});

describe('updatePlacement', () => {
  it('changes only that placement', () => {
    const s0 = newTripState();
    const b = s0.blocks[0].id;
    const r1 = add(s0, '2027-04-02', b, 'one');
    const r2 = add(r1.state, '2027-04-02', b, 'two');
    const [p1, p2] = cell(r2.state, '2027-04-02', b);
    const r3 = expectOk(
      updatePlacement(p1.id, {
        name: 'Uno',
        type: 'food',
        notes: 'good',
        link: 'https://example.com',
      })(r2.state),
    );
    const after = cell(r3.state, '2027-04-02', b);
    expect(after[0]).toMatchObject({ name: 'Uno', type: 'food', notes: 'good' });
    expect(after[1]).toEqual(p2);
    expect(r3.changes).toHaveLength(1);
  });

  it('validates name and link', () => {
    const s0 = newTripState();
    const r1 = add(s0, '2027-04-02', s0.blocks[0].id, 'one');
    const id = r1.state.placements[0].id;
    const e1 = updatePlacement(id, { name: '' })(r1.state);
    expect(!e1.ok && e1.error.code).toBe('EMPTY_NAME');
    const e2 = updatePlacement(id, { link: 'ftp://x' })(r1.state);
    expect(!e2.ok && e2.error.code).toBe('INVALID_LINK');
  });

  it('inverse restores the previous values', () => {
    const s0 = newTripState();
    const r1 = add(s0, '2027-04-02', s0.blocks[0].id, 'one');
    const r2 = expectOk(updatePlacement(r1.state.placements[0].id, { name: 'two' })(r1.state));
    const back = expectOk(r2.inverse(r2.state));
    expect(back.state.placements[0].name).toBe('one');
  });
});

describe('removePlacement', () => {
  it('removes and inverse restores', () => {
    const s0 = newTripState();
    const r1 = add(s0, '2027-04-02', s0.blocks[0].id, 'one');
    const id = r1.state.placements[0].id;
    const r2 = expectOk(removePlacement(id)(r1.state));
    expect(r2.state.placements).toEqual([]);
    const back = expectOk(r2.inverse(r2.state));
    expect(back.state.placements[0].id).toBe(id);
  });
});

describe('movePlacement', () => {
  it('moves across cells', () => {
    const s0 = newTripState();
    const [b1, b2] = [s0.blocks[0].id, s0.blocks[1].id];
    const r1 = add(s0, '2027-04-02', b1, 'x');
    const id = r1.state.placements[0].id;
    const r2 = expectOk(movePlacement(id, '2027-04-03', b2)(r1.state));
    expect(cell(r2.state, '2027-04-02', b1)).toEqual([]);
    expect(cell(r2.state, '2027-04-03', b2).map((p) => p.id)).toEqual([id]);
  });

  it('reorders within a cell, inserting before the given placement', () => {
    const s0 = newTripState();
    const b = s0.blocks[0].id;
    let s = s0;
    for (const n of ['a', 'b', 'c']) {
      const last = cell(s, '2027-04-02', b).at(-1);
      s = add(s, '2027-04-02', b, n, last?.id).state;
    }
    const [a, , c] = cell(s, '2027-04-02', b);
    const r = expectOk(movePlacement(c.id, '2027-04-02', b, a.id)(s));
    expect(cell(r.state, '2027-04-02', b).map((p) => p.name)).toEqual(['c', 'a', 'b']);
    const toEnd = expectOk(movePlacement(c.id, '2027-04-02', b)(r.state));
    expect(cell(toEnd.state, '2027-04-02', b).map((p) => p.name)).toEqual(['a', 'b', 'c']);
  });

  it('rejects unknown placement and out-of-range date', () => {
    const s0 = newTripState();
    const r1 = add(s0, '2027-04-02', s0.blocks[0].id, 'x');
    const nf = movePlacement('nope', '2027-04-02', s0.blocks[0].id)(r1.state);
    expect(!nf.ok && nf.error.code).toBe('NOT_FOUND');
    const oor = movePlacement(r1.state.placements[0].id, '2030-01-01', s0.blocks[0].id)(r1.state);
    expect(!oor.ok && oor.error.code).toBe('DATE_OUT_OF_RANGE');
  });
});
