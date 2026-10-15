import { validationError } from '../model/errors';
import { newId } from '../model/ids';
import { comparePositioned, positionAmong } from '../model/ordering';
import type { Block, DaySetting, TripState } from '../model/types';
import { validateBlockName } from '../model/validation';
import type { Command } from './command';
import { commit } from './diff';

const notFound = () => validationError('NOT_FOUND', 'Block not found.');

function sortedBlocks(state: TripState, exceptId?: string): Block[] {
  return state.blocks.filter((b) => b.id !== exceptId).sort(comparePositioned);
}

export function addBlock(name: string, afterBlockId?: string): Command {
  return (state) => {
    const error = validateBlockName(name);
    if (error) return { ok: false, error };
    if (afterBlockId !== undefined && !state.blocks.some((b) => b.id === afterBlockId)) {
      return { ok: false, error: notFound() };
    }
    const block: Block = {
      id: newId(),
      tripId: state.trip.id,
      name: name.trim(),
      position: positionAmong(sortedBlocks(state), { afterId: afterBlockId }),
      windowStartMin: null,
      windowEndMin: null,
      updatedAt: '',
    };
    return commit(state, { ...state, blocks: [...state.blocks, block] });
  };
}

export function renameBlock(id: string, name: string): Command {
  return (state) => {
    if (!state.blocks.some((b) => b.id === id)) return { ok: false, error: notFound() };
    const error = validateBlockName(name);
    if (error) return { ok: false, error };
    return commit(state, {
      ...state,
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, name: name.trim() } : b)),
    });
  };
}

/** Moves a block before `beforeId`, or to the end when omitted. */
export function moveBlock(id: string, beforeId?: string): Command {
  return (state) => {
    if (!state.blocks.some((b) => b.id === id)) return { ok: false, error: notFound() };
    if (beforeId !== undefined && !state.blocks.some((b) => b.id === beforeId)) {
      return { ok: false, error: notFound() };
    }
    const position = positionAmong(sortedBlocks(state, id), { beforeId });
    return commit(state, {
      ...state,
      blocks: state.blocks.map((b) => (b.id === id ? { ...b, position } : b)),
    });
  };
}

function clearBlockFromSettings(settings: DaySetting[], blockId: string): DaySetting[] {
  return settings
    .map((d) => ({
      ...d,
      arrivalBlockId: d.arrivalBlockId === blockId ? null : d.arrivalBlockId,
      departureBlockId: d.departureBlockId === blockId ? null : d.departureBlockId,
    }))
    .filter((d) => d.arrivalBlockId !== null || d.departureBlockId !== null);
}

/** Deletes the block and its placements, and clears day settings that referenced it. */
export function removeBlock(id: string): Command {
  return (state) => {
    if (!state.blocks.some((b) => b.id === id)) return { ok: false, error: notFound() };
    if (state.blocks.length === 1) {
      return {
        ok: false,
        error: validationError('LAST_BLOCK', 'A trip needs at least one time block.'),
      };
    }
    return commit(state, {
      ...state,
      blocks: state.blocks.filter((b) => b.id !== id),
      placements: state.placements.filter((p) => p.blockId !== id),
      daySettings: clearBlockFromSettings(state.daySettings, id),
    });
  };
}

/** What removing the block would take with it, for the confirmation message. */
export function impactOfRemoveBlock(
  state: TripState,
  blockId: string,
): { placements: number; daySettingsCleared: number } {
  return {
    placements: state.placements.filter((p) => p.blockId === blockId).length,
    daySettingsCleared: state.daySettings.filter(
      (d) => d.arrivalBlockId === blockId || d.departureBlockId === blockId,
    ).length,
  };
}
