import { describe, expect, it } from 'vitest';
import { addBlock, moveBlock, renameBlock, setBlockWindow } from '../src/commands/block';
import { History } from '../src/history';
import { orderedBlocks } from '../src/queries/cell';
import { DEFAULT_BLOCK_WINDOWS, effectiveWindow } from '../src/queries/window';
import { blockIdByName, expectOk, newTripState } from './fixtures';

const h = (hour: number) => hour * 60;

describe('default windows', () => {
  it('createTrip writes the default windows', () => {
    const s = newTripState();
    const win = (name: string) => {
      const b = s.blocks.find((x) => x.name === name)!;
      return [b.windowStartMin, b.windowEndMin];
    };
    expect(win('Morning')).toEqual([h(6), h(8)]);
    expect(win('Breakfast')).toEqual([h(8), h(10)]);
    expect(win('Late morning')).toEqual([h(10), h(12)]);
    expect(win('Lunch')).toEqual([h(12), h(14)]);
    expect(win('Afternoon')).toEqual([h(14), h(16)]);
    expect(win('Late afternoon')).toEqual([h(16), h(18)]);
    expect(win('Dinner')).toEqual([h(18), h(20)]);
    expect(win('Dessert')).toEqual([h(20), h(21)]);
    expect(win('Evening')).toEqual([h(21), h(23)]);
    expect(win('Night')).toEqual([h(23), h(2)]);
    expect(Object.keys(DEFAULT_BLOCK_WINDOWS)).toHaveLength(10);
  });
});

describe('effectiveWindow', () => {
  it('returns the stored window', () => {
    const s = newTripState();
    const id = blockIdByName(s, 'Lunch');
    expect(effectiveWindow(s, id)).toEqual({ startMin: h(12), endMin: h(14) });
  });

  it('falls back to the default for a legacy block with a default name (case-insensitive)', () => {
    const s = newTripState();
    const legacy = {
      ...s,
      blocks: s.blocks.map((b) =>
        b.name === 'Lunch' ? { ...b, name: 'lunch', windowStartMin: null, windowEndMin: null } : b,
      ),
    };
    expect(effectiveWindow(legacy, blockIdByName(legacy, 'lunch'))).toEqual({
      startMin: h(12),
      endMin: h(14),
    });
  });

  it('suggests a window after the previous block for a legacy custom block', () => {
    const s = newTripState();
    const legacy = {
      ...s,
      blocks: s.blocks.map((b) =>
        b.name === 'Afternoon'
          ? { ...b, name: 'Tea', windowStartMin: null, windowEndMin: null }
          : b,
      ),
    };
    // previous block (Late morning... Lunch) ends 14:00
    expect(effectiveWindow(legacy, blockIdByName(legacy, 'Tea'))).toEqual({
      startMin: h(14),
      endMin: h(15),
    });
  });

  it('suggests 06:00-07:00 for a legacy custom first block', () => {
    const s = newTripState();
    const legacy = {
      ...s,
      blocks: s.blocks.map((b) =>
        b.name === 'Morning' ? { ...b, name: 'Dawn', windowStartMin: null, windowEndMin: null } : b,
      ),
    };
    expect(effectiveWindow(legacy, blockIdByName(legacy, 'Dawn'))).toEqual({
      startMin: h(6),
      endMin: h(7),
    });
  });
});

describe('addBlock suggested window', () => {
  it('stores start = previous block end, end = start + 60 min', () => {
    const s = newTripState();
    const r = expectOk(addBlock('Tea', blockIdByName(s, 'Afternoon'))(s));
    const tea = r.state.blocks.find((b) => b.name === 'Tea')!;
    expect([tea.windowStartMin, tea.windowEndMin]).toEqual([h(16), h(17)]);
  });

  it('wraps past midnight and appends after the last block without an anchor', () => {
    const s = newTripState();
    const r = expectOk(addBlock('Late night')(s)); // after Night, which ends 02:00
    const b = r.state.blocks.find((x) => x.name === 'Late night')!;
    expect([b.windowStartMin, b.windowEndMin]).toEqual([h(2), h(3)]);
  });

  it('moveBlock and renameBlock do not change a stored window', () => {
    const s = newTripState();
    const tea = expectOk(addBlock('Tea', blockIdByName(s, 'Afternoon'))(s)).state;
    const id = blockIdByName(tea, 'Tea');
    const before = effectiveWindow(tea, id);
    const moved = expectOk(moveBlock(id, orderedBlocks(tea)[0].id)(tea)).state;
    const renamed = expectOk(renameBlock(id, 'Snack')(moved)).state;
    expect(effectiveWindow(renamed, id)).toEqual(before);
  });
});

describe('setBlockWindow', () => {
  it('sets the window and undo restores the previous one', () => {
    const s = newTripState();
    const id = blockIdByName(s, 'Lunch');
    const hist = new History(s);
    hist.apply(setBlockWindow(id, { startMin: h(13), endMin: h(15) }));
    expect(effectiveWindow(hist.state, id)).toEqual({ startMin: h(13), endMin: h(15) });
    hist.undo();
    expect(effectiveWindow(hist.state, id)).toEqual({ startMin: h(12), endMin: h(14) });
  });

  it('pins a legacy block on first edit', () => {
    const s = newTripState();
    const legacy = {
      ...s,
      blocks: s.blocks.map((b) => ({ ...b, windowStartMin: null, windowEndMin: null })),
    };
    const id = blockIdByName(legacy, 'Lunch');
    const r = expectOk(setBlockWindow(id, { startMin: h(13), endMin: h(15) })(legacy));
    const b = r.state.blocks.find((x) => x.id === id)!;
    expect([b.windowStartMin, b.windowEndMin]).toEqual([h(13), h(15)]);
  });

  it('rejects 1440 and start = end with INVALID_WINDOW', () => {
    const s = newTripState();
    const id = blockIdByName(s, 'Lunch');
    const a = setBlockWindow(id, { startMin: 0, endMin: 1440 })(s);
    const b = setBlockWindow(id, { startMin: 600, endMin: 600 })(s);
    expect(!a.ok && a.error.code).toBe('INVALID_WINDOW');
    expect(!b.ok && b.error.code).toBe('INVALID_WINDOW');
  });

  it('rejects an unknown block with NOT_FOUND', () => {
    const r = setBlockWindow('nope', { startMin: 0, endMin: 60 })(newTripState());
    expect(!r.ok && r.error.code).toBe('NOT_FOUND');
  });
});
