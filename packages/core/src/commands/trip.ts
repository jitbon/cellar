import { newId, positionBetween } from '../model/ids';
import type { Block, ISODate, TripState } from '../model/types';
import { DEFAULT_BLOCK_WINDOWS } from '../queries/window';
import { validateDateRange, validateTripName } from '../model/validation';
import type { Command, Ok, Result } from './command';
import { commit } from './diff';

export const DEFAULT_BLOCK_NAMES = [
  'Morning',
  'Breakfast',
  'Late morning',
  'Lunch',
  'Afternoon',
  'Late afternoon',
  'Dinner',
  'Dessert',
  'Evening',
  'Night',
];

const noop: Command = (state) => ({ ok: true, state, changes: [], inverse: noop });

/** Creates a trip with the default blocks. There is no prior state, so the inverse is a no-op. */
export function createTrip(ownerId: string, name: string, start: ISODate, end: ISODate): Result {
  const error = validateTripName(name) ?? validateDateRange(start, end);
  if (error) return { ok: false, error };

  const now = new Date().toISOString();
  const tripId = newId();
  const blocks: Block[] = [];
  let prev: string | null = null;
  for (const blockName of DEFAULT_BLOCK_NAMES) {
    const position = positionBetween(prev, null);
    blocks.push({
      id: newId(),
      tripId,
      name: blockName,
      position,
      windowStartMin: DEFAULT_BLOCK_WINDOWS[blockName].startMin,
      windowEndMin: DEFAULT_BLOCK_WINDOWS[blockName].endMin,
      updatedAt: now,
    });
    prev = position;
  }
  const state: TripState = {
    trip: {
      id: tripId,
      ownerId,
      name: name.trim(),
      startDate: start,
      endDate: end,
      deletedAt: null,
      locationName: null,
      locationLat: null,
      locationLon: null,
      locationTz: null,
      updatedAt: now,
    },
    blocks,
    daySettings: [],
    items: [],
    placements: [],
  };
  return {
    ok: true,
    state,
    changes: [
      { table: 'trips', op: 'upsert', row: { ...state.trip } },
      ...blocks.map((b) => ({ table: 'blocks' as const, op: 'upsert' as const, row: { ...b } })),
    ],
    inverse: noop,
  };
}

export function renameTrip(name: string): Command {
  return (state) => {
    const error = validateTripName(name);
    if (error) return { ok: false, error };
    return commit(state, { ...state, trip: { ...state.trip, name: name.trim() } });
  };
}

/** Changes the date range; placements and day settings outside it are removed. */
export function updateTripDates(start: ISODate, end: ISODate): Command {
  return (state) => {
    const error = validateDateRange(start, end);
    if (error) return { ok: false, error };
    const inRange = (d: ISODate) => d >= start && d <= end;
    const kept = state.placements.filter((p) => inRange(p.date));
    const result: Ok = commit(state, {
      ...state,
      trip: { ...state.trip, startDate: start, endDate: end },
      placements: kept,
      daySettings: state.daySettings.filter((d) => inRange(d.date)),
    });
    return { ...result, removedPlacementCount: state.placements.length - kept.length };
  };
}
