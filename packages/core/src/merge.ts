import { rowKey, type Change } from './commands/command';
import type { TripState } from './model/types';

type Row = Record<string, unknown>;

/**
 * Applies a change received from another device: last-write-wins by `updatedAt`.
 * Rows with a save still pending locally are ignored. A delete may carry only the primary key.
 */
export function applyRemote(state: TripState, change: Change, pendingKeys: Set<string>): TripState {
  const key = rowKey(change.table, change.row);
  if (pendingKeys.has(key)) return state;

  if (change.table === 'trips') {
    if (change.op === 'delete' || change.row.id !== state.trip.id) return state;
    if (state.trip.updatedAt >= String(change.row.updatedAt)) return state;
    return { ...state, trip: change.row as unknown as TripState['trip'] };
  }

  const field = (
    {
      blocks: 'blocks',
      day_settings: 'daySettings',
      items: 'items',
      placements: 'placements',
    } as const
  )[change.table];
  const list = state[field] as unknown as Row[];
  const at = list.findIndex((r) => rowKey(change.table, r) === key);

  if (change.op === 'delete') {
    if (at < 0) return state;
    return { ...state, [field]: list.filter((_, i) => i !== at) };
  }

  if (at >= 0) {
    if (String(list[at].updatedAt) >= String(change.row.updatedAt)) return state;
    return { ...state, [field]: list.map((r, i) => (i === at ? change.row : r)) };
  }
  return { ...state, [field]: [...list, change.row] };
}
