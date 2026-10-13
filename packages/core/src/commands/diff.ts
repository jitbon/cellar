import { rowKey, type Change, type Command, type Ok, type Table } from './command';
import type { TripState } from '../model/types';

type Row = Record<string, unknown>;

interface Delta {
  table: Table;
  /** The row before the command (null = it did not exist). */
  before: Row | null;
  /** The row after the command (null = it no longer exists). */
  after: Row | null;
}

/** Parents first when upserting; children first when deleting. */
const UPSERT_ORDER: Table[] = ['trips', 'blocks', 'items', 'day_settings', 'placements'];

function rowsOf(state: TripState, table: Table): Row[] {
  switch (table) {
    case 'trips':
      return [state.trip as unknown as Row];
    case 'blocks':
      return state.blocks as unknown as Row[];
    case 'day_settings':
      return state.daySettings as unknown as Row[];
    case 'items':
      return state.items as unknown as Row[];
    case 'placements':
      return state.placements as unknown as Row[];
  }
}

function sameContent(a: Row, b: Row): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if (k !== 'updatedAt' && a[k] !== b[k]) return false;
  return true;
}

function computeDeltas(before: TripState, after: TripState): Delta[] {
  const deltas: Delta[] = [];
  for (const table of UPSERT_ORDER) {
    const prev = new Map(rowsOf(before, table).map((r) => [rowKey(table, r), r]));
    const next = new Map(rowsOf(after, table).map((r) => [rowKey(table, r), r]));
    for (const [key, row] of next) {
      const old = prev.get(key) ?? null;
      if (!old || !sameContent(old, row)) deltas.push({ table, before: old, after: row });
    }
    for (const [key, row] of prev) {
      if (!next.has(key)) deltas.push({ table, before: row, after: null });
    }
  }
  return deltas;
}

function stateWithRows(state: TripState, entries: { table: Table; row: Row; present: boolean }[]) {
  let next = state;
  for (const { table, row, present } of entries) {
    const key = rowKey(table, row);
    const replace = <T>(list: T[]): T[] => {
      const at = list.findIndex((r) => rowKey(table, r as unknown as Row) === key);
      if (!present) return at < 0 ? list : list.filter((_, i) => i !== at);
      if (at < 0) return [...list, row as unknown as T];
      return list.map((r, i) => (i === at ? (row as unknown as T) : r));
    };
    if (table === 'trips') {
      if (present) next = { ...next, trip: row as unknown as TripState['trip'] };
    } else if (table === 'blocks') next = { ...next, blocks: replace(next.blocks) };
    else if (table === 'day_settings') next = { ...next, daySettings: replace(next.daySettings) };
    else if (table === 'items') next = { ...next, items: replace(next.items) };
    else next = { ...next, placements: replace(next.placements) };
  }
  return next;
}

function toChanges(deltas: Delta[]): Change[] {
  const upserts = deltas
    .filter((d) => d.after)
    .map((d) => ({ table: d.table, op: 'upsert' as const, row: d.after! }));
  const deletes = deltas
    .filter((d) => !d.after)
    .reverse()
    .map((d) => ({ table: d.table, op: 'delete' as const, row: d.before! }));
  return [...upserts, ...deletes];
}

/** A command that puts each touched row back to its `before` value (or removes it). */
function restoreRows(deltas: Delta[]): Command {
  return (current) => {
    const entries = deltas.map((d) =>
      d.before
        ? { table: d.table, row: d.before, present: true }
        : { table: d.table, row: d.after as Row, present: false },
    );
    return commit(current, stateWithRows(current, entries));
  };
}

/**
 * Turns a before/after pair into a Result. Changed and added rows get a fresh `updatedAt`.
 * The inverse restores only the rows this command touched, so undo never overwrites
 * unrelated edits made on other devices (research R7).
 */
export function commit(before: TripState, draft: TripState): Ok {
  const stamp = new Date().toISOString();
  const stamped = stamp_(before, draft, stamp);
  const deltas = computeDeltas(before, stamped);
  return {
    ok: true,
    state: stamped,
    changes: toChanges(deltas),
    inverse: restoreRows(deltas),
  };
}

function stamp_(before: TripState, draft: TripState, stamp: string): TripState {
  const deltas = computeDeltas(before, draft);
  const entries = deltas
    .filter((d) => d.after)
    .map((d) => ({ table: d.table, row: { ...d.after!, updatedAt: stamp }, present: true }));
  return stateWithRows(draft, entries);
}
