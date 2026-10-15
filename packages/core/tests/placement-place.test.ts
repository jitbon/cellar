import { describe, expect, it } from 'vitest';
import { addTypedPlacement, updatePlacement } from '../src/commands/placement';
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
const other: Place = { ...chelsea, id: 'test-other', name: 'Other Place', category: null };

function plainPlacement() {
  const s0 = newTripState();
  const s = expectOk(addTypedPlacement('2027-04-02', s0.blocks[0].id, 'Joes Pizza')(s0)).state;
  const id = s.placements[0].id;
  const withNotes = expectOk(updatePlacement(id, { notes: 'thin crust', type: 'food' })(s)).state;
  return { state: withNotes, id };
}

describe('updatePlacement with a place', () => {
  it('links a plain placement', () => {
    const { state, id } = plainPlacement();
    const r = expectOk(updatePlacement(id, { place: chelsea })(state));
    expect(placeOf(r.state.placements[0])).toEqual(chelsea);
    expect(r.changes).toHaveLength(1);
  });

  it('replaces a linked place', () => {
    const { state, id } = plainPlacement();
    const linked = expectOk(updatePlacement(id, { place: chelsea })(state)).state;
    const r = expectOk(updatePlacement(id, { place: other })(linked));
    expect(placeOf(r.state.placements[0])).toEqual(other);
  });

  it('clears all seven fields with null and keeps name, type and notes', () => {
    const { state, id } = plainPlacement();
    const linked = expectOk(updatePlacement(id, { place: chelsea })(state)).state;
    const r = expectOk(updatePlacement(id, { place: null })(linked));
    expect(r.state.placements[0]).toMatchObject({
      ...placeFields(null),
      name: 'Joes Pizza',
      type: 'food',
      notes: 'thin crust',
    });
  });

  it('keeps the place when only the name changes', () => {
    const { state, id } = plainPlacement();
    const linked = expectOk(updatePlacement(id, { place: chelsea })(state)).state;
    const r = expectOk(updatePlacement(id, { name: 'Chelsea Market lunch' })(linked));
    expect(r.state.placements[0].name).toBe('Chelsea Market lunch');
    expect(placeOf(r.state.placements[0])).toEqual(chelsea);
  });

  it('rejects an invalid place', () => {
    const { state, id } = plainPlacement();
    const r = updatePlacement(id, { place: { ...chelsea, lat: 91 } })(state);
    expect(!r.ok && r.error.code).toBe('INVALID_PLACE');
  });

  it('is one undo step each', () => {
    const { state, id } = plainPlacement();
    const linked = expectOk(updatePlacement(id, { place: chelsea })(state));
    expect(placeOf(expectOk(linked.inverse(linked.state)).state.placements[0])).toBeNull();
    const cleared = expectOk(updatePlacement(id, { place: null })(linked.state));
    expect(placeOf(expectOk(cleared.inverse(cleared.state)).state.placements[0])).toEqual(chelsea);
  });
});
