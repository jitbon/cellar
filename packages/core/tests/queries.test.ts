import { describe, expect, it } from 'vitest';
import { cell } from '../src/queries/cell';
import { days } from '../src/queries/days';
import type { TripState } from '../src/model/types';
import { placeFields } from '../src/places/fields';
import { newTripState } from './fixtures';

describe('days', () => {
  it('returns each date inclusive with weekday', () => {
    const s = newTripState('2027-04-01', '2027-04-04');
    expect(days(s.trip)).toEqual([
      { date: '2027-04-01', weekday: 'Thursday' },
      { date: '2027-04-02', weekday: 'Friday' },
      { date: '2027-04-03', weekday: 'Saturday' },
      { date: '2027-04-04', weekday: 'Sunday' },
    ]);
  });

  it('handles a single-day trip and month boundaries', () => {
    expect(
      days({ startDate: '2027-04-30', endDate: '2027-05-01' } as TripState['trip']),
    ).toHaveLength(2);
    expect(
      days({ startDate: '2027-04-30', endDate: '2027-04-30' } as TripState['trip']),
    ).toHaveLength(1);
  });
});

describe('cell', () => {
  it('orders by position, then id for equal positions, and filters by date and block', () => {
    const s = newTripState();
    const b = s.blocks[0].id;
    const mk = (id: string, position: string, date = '2027-04-02', blockId = b) => ({
      id,
      tripId: s.trip.id,
      date,
      blockId,
      position,
      name: id,
      type: 'activity' as const,
      notes: null,
      link: null,
      ...placeFields(null),
      sourceItemId: null,
      updatedAt: '',
    });
    const state: TripState = {
      ...s,
      placements: [
        mk('z', 'a1'),
        mk('b', 'a0'),
        mk('a', 'a0'),
        mk('other-day', 'a0', '2027-04-03'),
        mk('other-block', 'a0', '2027-04-02', s.blocks[1].id),
      ],
    };
    expect(cell(state, '2027-04-02', b).map((p) => p.id)).toEqual(['a', 'b', 'z']);
  });
});
