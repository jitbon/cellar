import { describe, expect, it } from 'vitest';
import { addBlock, moveBlock, removeBlock, renameBlock } from '../src/commands/block';
import type { Command } from '../src/commands/command';
import { setDayWindow } from '../src/commands/daySetting';
import { addItem, deleteItem, updateItem } from '../src/commands/item';
import {
  addTypedPlacement,
  movePlacement,
  placeItem,
  removePlacement,
  updatePlacement,
} from '../src/commands/placement';
import { renameTrip, updateTripDates } from '../src/commands/trip';
import { History } from '../src/history';
import type { TripState } from '../src/model/types';
import { blockIdByName, expectOk, newTripState } from './fixtures';

/** Arrays are unordered sets of rows; compare them sorted by a stable key. */
function normalize(s: TripState) {
  const by = <T extends { id?: string; date?: string }>(l: T[]) =>
    [...l].sort((a, b) => `${a.id}${a.date}`.localeCompare(`${b.id}${b.date}`));
  const strip = <T extends { updatedAt: string }>(l: T[]) =>
    l.map((row) => ({ ...row, updatedAt: '' }));
  const trip = { ...s.trip, updatedAt: '' };
  return {
    trip,
    blocks: strip(by(s.blocks)),
    daySettings: strip(by(s.daySettings)),
    items: strip(by(s.items)),
    placements: strip(by(s.placements)),
  };
}

function seeded() {
  let s = newTripState();
  s = expectOk(addItem('Ramen', 'food', 'n')(s)).state;
  s = expectOk(addTypedPlacement('2027-04-02', s.blocks[0].id, 'Walk')(s)).state;
  s = expectOk(placeItem(s.items[0].id, '2027-04-03', s.blocks[1].id)(s)).state;
  s = expectOk(setDayWindow('2027-04-01', s.blocks[3].id, null)(s)).state;
  return s;
}

describe('History', () => {
  const s = seeded();
  const p = s.placements[0];
  const item = s.items[0];
  const lunch = blockIdByName(s, 'Lunch');
  const cases: [string, Command][] = [
    ['renameTrip', renameTrip('Kyoto')],
    ['updateTripDates (shrink)', updateTripDates('2027-04-01', '2027-04-02')],
    ['updateTripDates (extend)', updateTripDates('2027-03-30', '2027-04-06')],
    ['addBlock', addBlock('Tea', lunch)],
    ['renameBlock', renameBlock(lunch, 'Midday')],
    ['moveBlock', moveBlock(blockIdByName(s, 'Evening'), blockIdByName(s, 'Dinner'))],
    ['removeBlock', removeBlock(lunch)],
    [
      'setDayWindow',
      setDayWindow('2027-04-02', blockIdByName(s, 'Lunch'), blockIdByName(s, 'Dinner')),
    ],
    ['setDayWindow clear', setDayWindow('2027-04-01', null, null)],
    ['addItem', addItem('Museum', 'activity')],
    ['updateItem', updateItem(item.id, { name: 'Ramen 2' })],
    ['deleteItem', deleteItem(item.id)],
    ['addTypedPlacement', addTypedPlacement('2027-04-04', lunch, 'New')],
    ['placeItem', placeItem(item.id, '2027-04-04', lunch)],
    ['movePlacement', movePlacement(p.id, '2027-04-04', lunch)],
    ['updatePlacement', updatePlacement(p.id, { name: 'Stroll', type: 'food' })],
    ['removePlacement', removePlacement(p.id)],
  ];

  for (const [name, command] of cases) {
    it(`${name}: undo restores the prior state and redo re-applies`, () => {
      const h = new History(s);
      const applied = expectOk(h.apply(command));
      expect(h.canUndo).toBe(true);
      const undone = expectOk(h.undo()!);
      expect(normalize(undone.state)).toEqual(normalize(s));
      expect(h.canRedo).toBe(true);
      const redone = expectOk(h.redo()!);
      expect(normalize(redone.state)).toEqual(normalize(applied.state));
    });
  }

  it('a new command after undo clears the redo stack', () => {
    const h = new History(s);
    h.apply(renameTrip('A'));
    h.undo();
    expect(h.canRedo).toBe(true);
    h.apply(renameTrip('B'));
    expect(h.canRedo).toBe(false);
    expect(h.redo()).toBeNull();
  });

  it('undo() returns the changes to persist', () => {
    const h = new History(s);
    h.apply(renameTrip('A'));
    const undone = expectOk(h.undo()!);
    expect(undone.changes).toEqual([
      expect.objectContaining({
        table: 'trips',
        op: 'upsert',
        row: expect.objectContaining({ name: 'Tokyo' }),
      }),
    ]);
  });

  it('undoes several steps in reverse order', () => {
    const h = new History(s);
    h.apply(renameTrip('A'));
    h.apply(renameTrip('B'));
    h.apply(renameTrip('C'));
    expect(expectOk(h.undo()!).state.trip.name).toBe('B');
    expect(expectOk(h.undo()!).state.trip.name).toBe('A');
    expect(expectOk(h.undo()!).state.trip.name).toBe('Tokyo');
    expect(h.undo()).toBeNull();
    expect(expectOk(h.redo()!).state.trip.name).toBe('A');
  });

  it('failed commands are not recorded', () => {
    const h = new History(s);
    expect(h.apply(renameTrip(' ')).ok).toBe(false);
    expect(h.canUndo).toBe(false);
  });

  it('clear() empties both stacks', () => {
    const h = new History(s);
    h.apply(renameTrip('A'));
    h.undo();
    h.clear();
    expect(h.canUndo || h.canRedo).toBe(false);
  });

  it('tracks the current state across apply/undo', () => {
    const h = new History(s);
    h.apply(renameTrip('A'));
    expect(h.state.trip.name).toBe('A');
    h.undo();
    expect(h.state.trip.name).toBe('Tokyo');
  });
});
