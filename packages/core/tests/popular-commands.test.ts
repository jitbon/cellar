import { describe, expect, it } from 'vitest';
import { addTypedPlacement, placePlace } from '../src/commands/placement';
import type { Place } from '../src/model/types';
import { placeFields, placeOf } from '../src/places/fields';
import { cell } from '../src/queries/cell';
import { expectOk, newTripState } from './fixtures';

const met: Place = {
  id: 'test-met',
  provider: 'google',
  name: 'The Metropolitan Museum of Art',
  address: '1000 5th Ave, New York',
  lat: 40.7794,
  lon: -73.9632,
  category: 'art_museum',
};

describe('placePlace', () => {
  it('creates one linked placement with the given type and no source item', () => {
    const s = newTripState();
    const blockId = s.blocks[0].id;
    const r = expectOk(placePlace(met, 'food', '2027-04-02', blockId)(s));
    expect(r.state.placements).toHaveLength(1);
    expect(r.state.placements[0]).toMatchObject({
      name: 'The Metropolitan Museum of Art',
      type: 'food',
      date: '2027-04-02',
      blockId,
      sourceItemId: null,
      notes: null,
      link: null,
      ...placeFields(met),
    });
    expect(placeOf(r.state.placements[0])).toEqual(met);
    expect(r.changes).toHaveLength(1);
  });

  it('does not change the list', () => {
    const s = newTripState();
    const r = expectOk(placePlace(met, 'activity', '2027-04-02', s.blocks[0].id)(s));
    expect(r.state.items).toEqual(s.items);
  });

  it('puts the placement last, or before the given one', () => {
    const s0 = newTripState();
    const blockId = s0.blocks[0].id;
    let s = expectOk(addTypedPlacement('2027-04-02', blockId, 'First')(s0)).state;
    s = expectOk(addTypedPlacement('2027-04-02', blockId, 'Second', s.placements[0].id)(s)).state;
    const [first, second] = cell(s, '2027-04-02', blockId);
    const last = expectOk(placePlace(met, 'activity', '2027-04-02', blockId)(s)).state;
    expect(cell(last, '2027-04-02', blockId).map((p) => p.name)).toEqual([
      'First',
      'Second',
      met.name,
    ]);
    const before = expectOk(placePlace(met, 'activity', '2027-04-02', blockId, second.id)(s)).state;
    expect(cell(before, '2027-04-02', blockId).map((p) => p.name)).toEqual([
      first.name,
      met.name,
      second.name,
    ]);
  });

  it('rejects an invalid cell or place', () => {
    const s = newTripState();
    const blockId = s.blocks[0].id;
    const badDate = placePlace(met, 'activity', '2030-01-01', blockId)(s);
    const badBlock = placePlace(met, 'activity', '2027-04-02', 'nope')(s);
    const badPlace = placePlace({ ...met, lat: 91 }, 'activity', '2027-04-02', blockId)(s);
    expect(!badDate.ok && badDate.error.code).toBe('DATE_OUT_OF_RANGE');
    expect(!badBlock.ok && badBlock.error.code).toBe('NOT_FOUND');
    expect(!badPlace.ok && badPlace.error.code).toBe('INVALID_PLACE');
  });

  it('is one undo step', () => {
    const s = newTripState();
    const r = expectOk(placePlace(met, 'activity', '2027-04-02', s.blocks[0].id)(s));
    expect(expectOk(r.inverse(r.state)).state.placements).toEqual([]);
  });
});
