import type { ValidationError } from '../model/errors';
import type { TripState } from '../model/types';

export type Table = 'trips' | 'blocks' | 'day_settings' | 'items' | 'placements';

export interface Change {
  table: Table;
  op: 'upsert' | 'delete';
  /** Domain row (camelCase). A delete may carry only the primary key. */
  row: Record<string, unknown>;
}

export type Command = (state: TripState) => Result;

export type Result =
  | {
      ok: true;
      state: TripState;
      changes: Change[];
      inverse: Command;
      removedPlacementCount?: number;
    }
  | { ok: false; error: ValidationError };

export type Ok = Extract<Result, { ok: true }>;

/** Primary-key string for a change row, used for pending-change tracking and merge. */
export function rowKey(table: Table, row: Record<string, unknown>): string {
  return table === 'day_settings' ? `${table}:${row.tripId}:${row.date}` : `${table}:${row.id}`;
}
