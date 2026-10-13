import { createTrip } from '../src/commands/trip';
import type { Ok } from '../src/commands/command';
import type { TripState } from '../src/model/types';

export function expectOk<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error('expected ok result: ' + JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
}

export function newTripState(start = '2027-04-01', end = '2027-04-04'): TripState {
  return expectOk(createTrip('user-1', 'Tokyo', start, end)).state;
}

export function blockIdByName(state: TripState, name: string): string {
  const b = state.blocks.find((x) => x.name === name);
  if (!b) throw new Error('no block ' + name);
  return b.id;
}

export type { Ok };
