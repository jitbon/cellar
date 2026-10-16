import { describe, expect, it } from 'vitest';
import { addItem } from '../src/commands/item';
import { placeItem, placePlace, removePlacement } from '../src/commands/placement';
import type { Place } from '../src/model/types';
import { isItemPlaced, isPlacePlaced, placementsOfPlace } from '../src/queries/placed';
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

describe('isItemPlaced', () => {
  it('is false with no events, true after placeItem, false again once they are removed', () => {
    const s0 = expectOk(addItem('Ramen', 'food')(newTripState())).state;
    const itemId = s0.items[0].id;
    const blockId = s0.blocks[0].id;
    expect(isItemPlaced(s0, itemId)).toBe(false);

    const s1 = expectOk(placeItem(itemId, '2027-04-02', blockId)(s0)).state;
    expect(isItemPlaced(s1, itemId)).toBe(true);

    const s2 = expectOk(placeItem(itemId, '2027-04-03', blockId)(s1)).state;
    const s3 = expectOk(removePlacement(s2.placements[0].id)(s2)).state;
    expect(isItemPlaced(s3, itemId)).toBe(true);
    const s4 = expectOk(removePlacement(s3.placements[0].id)(s3)).state;
    expect(isItemPlaced(s4, itemId)).toBe(false);
  });
});

describe('isPlacePlaced', () => {
  it('is false when nothing in the trip has that place', () => {
    expect(isPlacePlaced(newTripState(), 'test-met')).toBe(false);
  });

  it('is true when an event carries the place', () => {
    const s0 = newTripState();
    const s = expectOk(placePlace(met, 'activity', '2027-04-02', s0.blocks[0].id)(s0)).state;
    expect(isPlacePlaced(s, 'test-met')).toBe(true);
    expect(isPlacePlaced(s, 'other')).toBe(false);
  });

  it('is true when a list item carries the place, even if never placed', () => {
    const s = expectOk(addItem('The Met', 'activity', null, null, met)(newTripState())).state;
    expect(isPlacePlaced(s, 'test-met')).toBe(true);
  });

  it('clears when the event is removed', () => {
    const s0 = newTripState();
    const s1 = expectOk(placePlace(met, 'activity', '2027-04-02', s0.blocks[0].id)(s0)).state;
    const s2 = expectOk(removePlacement(s1.placements[0].id)(s1)).state;
    expect(isPlacePlaced(s2, 'test-met')).toBe(false);
  });
});

describe('placementsOfPlace', () => {
  it('is empty when the place is not on the schedule', () => {
    expect(placementsOfPlace(newTripState(), 'test-met')).toEqual([]);
  });

  it('lists each event of the place by date, then block order, ignoring other places', () => {
    const s0 = newTripState();
    const [morning, , , lunch, afternoon] = [...s0.blocks].sort((a, b) =>
      a.position < b.position ? -1 : 1,
    );
    const other: Place = { ...met, id: 'test-other', name: 'Other' };
    let s = s0;
    for (const [date, block] of [
      ['2027-04-03', morning],
      ['2027-04-02', afternoon],
      ['2027-04-02', lunch],
    ] as const) {
      s = expectOk(placePlace(met, 'activity', date, block.id)(s)).state;
    }
    s = expectOk(placePlace(other, 'activity', '2027-04-01', morning.id)(s)).state;
    expect(placementsOfPlace(s, 'test-met')).toEqual([
      { date: '2027-04-02', blockName: 'Lunch' },
      { date: '2027-04-02', blockName: 'Afternoon' },
      { date: '2027-04-03', blockName: 'Morning' },
    ]);
  });
});
