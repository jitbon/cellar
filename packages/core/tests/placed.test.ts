import { describe, expect, it } from 'vitest';
import { addItem } from '../src/commands/item';
import { placeItem, placePlace, removePlacement } from '../src/commands/placement';
import type { Place } from '../src/model/types';
import { isItemPlaced, isPlacePlaced } from '../src/queries/placed';
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
