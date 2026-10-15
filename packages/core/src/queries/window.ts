import { comparePositioned } from '../model/ordering';
import type { TimeWindow, TripState } from '../model/types';

const h = (hour: number): number => hour * 60;

/** Windows for the ten default blocks, keyed by name (data-model.md). */
export const DEFAULT_BLOCK_WINDOWS: Record<string, TimeWindow> = {
  Morning: { startMin: h(6), endMin: h(8) },
  Breakfast: { startMin: h(8), endMin: h(10) },
  'Late morning': { startMin: h(10), endMin: h(12) },
  Lunch: { startMin: h(12), endMin: h(14) },
  Afternoon: { startMin: h(14), endMin: h(16) },
  'Late afternoon': { startMin: h(16), endMin: h(18) },
  Dinner: { startMin: h(18), endMin: h(20) },
  Dessert: { startMin: h(20), endMin: h(21) },
  Evening: { startMin: h(21), endMin: h(23) },
  Night: { startMin: h(23), endMin: h(2) },
};

const defaultByName = (name: string): TimeWindow | undefined => {
  const lower = name.trim().toLowerCase();
  const key = Object.keys(DEFAULT_BLOCK_WINDOWS).find((k) => k.toLowerCase() === lower);
  return key ? DEFAULT_BLOCK_WINDOWS[key] : undefined;
};

/** One hour starting where the previous block ended (06:00 for the first block). */
export function suggestedWindow(previousEndMin: number | null): TimeWindow {
  const startMin = previousEndMin ?? h(6);
  return { startMin, endMin: (startMin + 60) % 1440 };
}

/** Stored window, else (blocks from before windows existed) the default for the name, else a suggestion. */
export function effectiveWindows(state: TripState): Map<string, TimeWindow> {
  const out = new Map<string, TimeWindow>();
  let previousEnd: number | null = null;
  for (const b of [...state.blocks].sort(comparePositioned)) {
    const win: TimeWindow =
      b.windowStartMin !== null && b.windowEndMin !== null
        ? { startMin: b.windowStartMin, endMin: b.windowEndMin }
        : (defaultByName(b.name) ?? suggestedWindow(previousEnd));
    out.set(b.id, win);
    previousEnd = win.endMin;
  }
  return out;
}

export function effectiveWindow(state: TripState, blockId: string): TimeWindow {
  const win = effectiveWindows(state).get(blockId);
  if (!win) throw new Error('no block ' + blockId);
  return win;
}
