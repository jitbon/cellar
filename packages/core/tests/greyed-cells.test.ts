import { describe, expect, it } from 'vitest';
import { setDayWindow } from '../src/commands/daySetting';
import { addItem } from '../src/commands/item';
import { addTypedPlacement, movePlacement, placeItem, placePlace } from '../src/commands/placement';
import type { Place, TripState } from '../src/model/types';
import { blockIdByName, expectOk, newTripState } from './fixtures';

const DAY = '2027-04-02';
const met: Place = {
  id: 'test-met',
  provider: 'google',
  name: 'The Met',
  address: '1000 5th Ave',
  lat: 40.78,
  lon: -73.96,
  category: 'museum',
};

/** Day 2 arrives at Lunch, so Morning on day 2 is greyed; an event was already there. */
function setup() {
  let s: TripState = newTripState();
  s = expectOk(addTypedPlacement(DAY, blockIdByName(s, 'Morning'), 'Early walk')(s)).state;
  s = expectOk(addItem('Museum', 'activity')(s)).state;
  s = expectOk(setDayWindow(DAY, blockIdByName(s, 'Lunch'), null)(s)).state;
  return {
    s,
    morning: blockIdByName(s, 'Morning'),
    lunch: blockIdByName(s, 'Lunch'),
    walk: s.placements.find((p) => p.name === 'Early walk')!,
    item: s.items.find((i) => i.name === 'Museum')!,
  };
}

const rejected = (r: { ok: boolean; error?: { code: string } }) => {
  expect(r.ok).toBe(false);
  expect(r.error?.code).toBe('OUTSIDE_TRAVEL_WINDOW');
};

describe('greyed cells (outside the travel window) take nothing new', () => {
  it('rejects typing an event into a greyed cell', () => {
    const { s, morning } = setup();
    rejected(addTypedPlacement(DAY, morning, 'Coffee')(s) as never);
  });

  it('rejects placing a list item or a popular place there', () => {
    const { s, morning, item } = setup();
    rejected(placeItem(item.id, DAY, morning)(s) as never);
    rejected(placePlace(met, 'activity', DAY, morning)(s) as never);
  });

  it('rejects moving an event into a greyed cell', () => {
    const { s, lunch, morning } = setup();
    const lunchEvent = expectOk(addTypedPlacement(DAY, lunch, 'Ramen')(s)).state;
    const ramen = lunchEvent.placements.find((p) => p.name === 'Ramen')!;
    rejected(movePlacement(ramen.id, DAY, morning)(lunchEvent) as never);
  });

  it('still lets an event already in a greyed cell move out', () => {
    const { s, lunch, walk } = setup();
    const r = expectOk(movePlacement(walk.id, DAY, lunch)(s));
    expect(r.state.placements.find((p) => p.id === walk.id)!.blockId).toBe(lunch);
  });

  it('accepts the same actions on cells inside the window and on other days', () => {
    const { s, lunch, morning, item } = setup();
    expect(addTypedPlacement(DAY, lunch, 'Coffee')(s).ok).toBe(true);
    expect(placeItem(item.id, '2027-04-03', morning)(s).ok).toBe(true);
  });
});
