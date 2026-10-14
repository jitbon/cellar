import { describe, expect, it } from 'vitest';
import {
  addBlock,
  impactOfRemoveBlock,
  moveBlock,
  removeBlock,
  renameBlock,
} from '../src/commands/block';
import { setDayWindow } from '../src/commands/daySetting';
import { addTypedPlacement } from '../src/commands/placement';
import { orderedBlocks } from '../src/queries/cell';
import type { TripState } from '../src/model/types';
import { blockIdByName, expectOk, newTripState } from './fixtures';

const names = (s: TripState) => orderedBlocks(s).map((b) => b.name);

describe('addBlock', () => {
  it('inserts after the given block', () => {
    const s = newTripState();
    const r = expectOk(addBlock('Tea', blockIdByName(s, 'Afternoon'))(s));
    expect(names(r.state)).toEqual([
      'Morning',
      'Breakfast',
      'Late morning',
      'Lunch',
      'Afternoon',
      'Tea',
      'Late afternoon',
      'Dinner',
      'Dessert',
      'Evening',
      'Night',
    ]);
    expect(r.changes).toEqual([expect.objectContaining({ table: 'blocks', op: 'upsert' })]);
  });

  it('appends at the end without an anchor, and allows duplicate names', () => {
    const s = newTripState();
    const r = expectOk(addBlock('Morning')(s));
    expect(names(r.state).at(-1)).toBe('Morning');
    expect(r.state.blocks).toHaveLength(11);
  });

  it('requires a name of 1-40 chars', () => {
    const s = newTripState();
    const code = (n: string) => {
      const r = addBlock(n)(s);
      return r.ok ? null : r.error.code;
    };
    expect(code(' ')).toBe('EMPTY_NAME');
    expect(code('a'.repeat(41))).toBe('EMPTY_NAME');
    expect(code('a'.repeat(40))).toBeNull();
  });

  it('rejects an unknown anchor', () => {
    const r = addBlock('x', 'nope')(newTripState());
    expect(!r.ok && r.error.code).toBe('NOT_FOUND');
  });

  it('inverse removes it again', () => {
    const s = newTripState();
    const r = expectOk(addBlock('Tea')(s));
    expect(names(expectOk(r.inverse(r.state)).state)).toEqual(names(s));
  });
});

describe('renameBlock / moveBlock', () => {
  it('renames', () => {
    const s = newTripState();
    const r = expectOk(renameBlock(blockIdByName(s, 'Late morning'), 'Brunch')(s));
    expect(names(r.state)).toContain('Brunch');
    expect(names(r.state)).not.toContain('Late morning');
    expect(renameBlock('x', ' ')(s).ok).toBe(false);
  });

  it('moves Evening above Dessert', () => {
    const s = newTripState();
    const r = expectOk(moveBlock(blockIdByName(s, 'Evening'), blockIdByName(s, 'Dessert'))(s));
    expect(names(r.state).slice(-4)).toEqual(['Dinner', 'Evening', 'Dessert', 'Night']);
    expect(r.changes).toHaveLength(1);
  });

  it('moves a block to the end when no anchor is given', () => {
    const s = newTripState();
    const r = expectOk(moveBlock(blockIdByName(s, 'Morning'))(s));
    expect(names(r.state).at(-1)).toBe('Morning');
  });

  it('moves a block to the top', () => {
    const s = newTripState();
    const r = expectOk(moveBlock(blockIdByName(s, 'Evening'), blockIdByName(s, 'Morning'))(s));
    expect(names(r.state)[0]).toBe('Evening');
  });

  it('rejects unknown ids', () => {
    const s = newTripState();
    expect(moveBlock('nope')(s).ok).toBe(false);
    expect(moveBlock(s.blocks[0].id, 'nope')(s).ok).toBe(false);
  });
});

describe('removeBlock', () => {
  function planned() {
    let s = newTripState();
    const lunch = blockIdByName(s, 'Lunch');
    s = expectOk(addTypedPlacement('2027-04-01', lunch, 'Ramen')(s)).state;
    s = expectOk(addTypedPlacement('2027-04-02', lunch, 'Soba')(s)).state;
    s = expectOk(addTypedPlacement('2027-04-02', blockIdByName(s, 'Dinner'), 'Sushi')(s)).state;
    s = expectOk(setDayWindow('2027-04-01', lunch, null)(s)).state;
    s = expectOk(setDayWindow('2027-04-04', null, lunch)(s)).state;
    s = expectOk(setDayWindow('2027-04-03', blockIdByName(s, 'Morning'), lunch)(s)).state;
    return { s, lunch };
  }

  it('deletes its placements and clears day settings that referenced it', () => {
    const { s, lunch } = planned();
    const r = expectOk(removeBlock(lunch)(s));
    expect(r.state.blocks.find((b) => b.id === lunch)).toBeUndefined();
    expect(r.state.placements.map((p) => p.name)).toEqual(['Sushi']);
    // 04-01 and 04-04 only referenced Lunch, so those settings disappear; 04-03 keeps arrival.
    expect(r.state.daySettings).toHaveLength(1);
    expect(r.state.daySettings[0]).toMatchObject({
      date: '2027-04-03',
      departureBlockId: null,
    });
    expect(r.state.daySettings[0].arrivalBlockId).toBe(blockIdByName(s, 'Morning'));
  });

  it('inverse restores blocks, placements and day settings', () => {
    const { s, lunch } = planned();
    const r = expectOk(removeBlock(lunch)(s));
    const back = expectOk(r.inverse(r.state)).state;
    const sort = <T extends { id?: string; date?: string }>(l: T[]) =>
      [...l]
        .sort((a, b) => `${a.id}${a.date}`.localeCompare(`${b.id}${b.date}`))
        .map((row) => ({ ...row, updatedAt: '' }));
    expect(sort(back.blocks)).toEqual(sort(s.blocks));
    expect(sort(back.placements)).toEqual(sort(s.placements));
    expect(sort(back.daySettings)).toEqual(sort(s.daySettings));
  });

  it('persists child deletions before the block and settings updates before deletions', () => {
    const { s, lunch } = planned();
    const r = expectOk(removeBlock(lunch)(s));
    const tables = r.changes.map((c) => `${c.op}:${c.table}`);
    expect(tables.lastIndexOf('upsert:day_settings')).toBeLessThan(tables.indexOf('delete:blocks'));
    expect(tables.indexOf('delete:placements')).toBeLessThan(tables.indexOf('delete:blocks'));
  });

  it('rejects removing the last block', () => {
    let s = newTripState();
    for (const b of s.blocks.slice(1)) s = expectOk(removeBlock(b.id)(s)).state;
    const r = removeBlock(s.blocks[0].id)(s);
    expect(!r.ok && r.error.code).toBe('LAST_BLOCK');
  });

  it('rejects an unknown id', () => {
    const r = removeBlock('nope')(newTripState());
    expect(!r.ok && r.error.code).toBe('NOT_FOUND');
  });
});

describe('impactOfRemoveBlock', () => {
  it('counts placements and day settings that would be cleared', () => {
    let s = newTripState();
    const lunch = blockIdByName(s, 'Lunch');
    s = expectOk(addTypedPlacement('2027-04-01', lunch, 'a')(s)).state;
    s = expectOk(addTypedPlacement('2027-04-02', lunch, 'b')(s)).state;
    s = expectOk(setDayWindow('2027-04-01', lunch, null)(s)).state;
    s = expectOk(setDayWindow('2027-04-02', null, lunch)(s)).state;
    expect(impactOfRemoveBlock(s, lunch)).toEqual({ placements: 2, daySettingsCleared: 2 });
    expect(impactOfRemoveBlock(s, blockIdByName(s, 'Evening'))).toEqual({
      placements: 0,
      daySettingsCleared: 0,
    });
  });
});
