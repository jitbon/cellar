import { validationError, type ValidationError } from '../model/errors';
import { newId } from '../model/ids';
import { comparePositioned, positionAmong } from '../model/ordering';
import type { ISODate, ItemType, Place, Placement, TripState } from '../model/types';
import { validateItemName, validateLink, validateNotes, validatePlace } from '../model/validation';
import { placeFields, placeOf } from '../places/fields';
import type { Command } from './command';
import { commit } from './diff';
import { isGreyed } from '../queries/greyed';

const notFound = (what: string) => validationError('NOT_FOUND', `${what} not found.`);

/**
 * Checks the target cell exists in this trip and is inside the day's travel window: cells before
 * arrival or after departure take nothing new (events already there stay, and can move out).
 */
export function validateCell(
  state: TripState,
  date: ISODate,
  blockId: string,
): ValidationError | null {
  if (!state.blocks.some((b) => b.id === blockId)) return notFound('Block');
  if (date < state.trip.startDate || date > state.trip.endDate) {
    return validationError('DATE_OUT_OF_RANGE', 'That date is outside the trip.');
  }
  if (isGreyed(state, date, blockId)) {
    return validationError(
      'OUTSIDE_TRAVEL_WINDOW',
      'That time is outside the travel window for that day.',
    );
  }
  return null;
}

/** Placements of a cell in display order, optionally leaving one out (the one being moved). */
export function cellPlacements(
  state: TripState,
  date: ISODate,
  blockId: string,
  exceptId?: string,
): Placement[] {
  return state.placements
    .filter((p) => p.date === date && p.blockId === blockId && p.id !== exceptId)
    .sort(comparePositioned);
}

export function addTypedPlacement(
  date: ISODate,
  blockId: string,
  name: string,
  afterPlacementId?: string,
  opts: { place?: Place | null; type?: ItemType } = {},
): Command {
  const { place = null, type = 'activity' } = opts;
  return (state) => {
    const error =
      validateItemName(name) ?? validatePlace(place) ?? validateCell(state, date, blockId);
    if (error) return { ok: false, error };
    const placement: Placement = {
      id: newId(),
      tripId: state.trip.id,
      date,
      blockId,
      position: positionAmong(cellPlacements(state, date, blockId), { afterId: afterPlacementId }),
      name: name.trim(),
      type,
      notes: null,
      link: null,
      ...placeFields(place),
      sourceItemId: null,
      updatedAt: '',
    };
    return commit(state, { ...state, placements: [...state.placements, placement] });
  };
}

export interface PlacementPatch {
  name?: string;
  type?: ItemType;
  notes?: string | null;
  link?: string | null;
  /** A place links the placement; null removes the link (the name stays). */
  place?: Place | null;
}

export function updatePlacement(id: string, patch: PlacementPatch): Command {
  return (state) => {
    const existing = state.placements.find((p) => p.id === id);
    if (!existing) return { ok: false, error: notFound('Placement') };
    const error =
      (patch.name !== undefined ? validateItemName(patch.name) : null) ??
      (patch.notes !== undefined ? validateNotes(patch.notes) : null) ??
      (patch.link !== undefined ? validateLink(patch.link) : null) ??
      (patch.place !== undefined ? validatePlace(patch.place) : null);
    if (error) return { ok: false, error };
    const { place, ...fields } = patch;
    const next: Placement = {
      ...existing,
      ...fields,
      ...(place !== undefined ? placeFields(place) : {}),
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      link: patch.link === '' ? null : patch.link !== undefined ? patch.link : existing.link,
      notes: patch.notes === '' ? null : patch.notes !== undefined ? patch.notes : existing.notes,
    };
    return commit(state, {
      ...state,
      placements: state.placements.map((p) => (p.id === id ? next : p)),
    });
  };
}

export function removePlacement(id: string): Command {
  return (state) => {
    if (!state.placements.some((p) => p.id === id)) {
      return { ok: false, error: notFound('Placement') };
    }
    return commit(state, { ...state, placements: state.placements.filter((p) => p.id !== id) });
  };
}

/** Places an independent copy of a list item into a cell (FR-011, FR-012). */
export function placeItem(
  itemId: string,
  date: ISODate,
  blockId: string,
  beforePlacementId?: string,
): Command {
  return (state) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, error: notFound('Item') };
    const error = validateCell(state, date, blockId);
    if (error) return { ok: false, error };
    const placement: Placement = {
      id: newId(),
      tripId: state.trip.id,
      date,
      blockId,
      position: positionAmong(cellPlacements(state, date, blockId), {
        beforeId: beforePlacementId,
      }),
      name: item.name,
      type: item.type,
      notes: item.notes,
      link: item.link,
      ...placeFields(placeOf(item)),
      sourceItemId: item.id,
      updatedAt: '',
    };
    return commit(state, { ...state, placements: [...state.placements, placement] });
  };
}

/**
 * Places a real place straight into a cell as a linked event, without touching the list
 * (a popular place the traveler has not saved).
 */
export function placePlace(
  place: Place,
  type: ItemType,
  date: ISODate,
  blockId: string,
  beforePlacementId?: string,
): Command {
  return (state) => {
    const error = validatePlace(place) ?? validateCell(state, date, blockId);
    if (error) return { ok: false, error };
    const placement: Placement = {
      id: newId(),
      tripId: state.trip.id,
      date,
      blockId,
      position: positionAmong(cellPlacements(state, date, blockId), {
        beforeId: beforePlacementId,
      }),
      name: place.name.trim(),
      type,
      notes: null,
      link: null,
      ...placeFields(place),
      sourceItemId: null,
      updatedAt: '',
    };
    return commit(state, { ...state, placements: [...state.placements, placement] });
  };
}

export function movePlacement(
  id: string,
  date: ISODate,
  blockId: string,
  beforePlacementId?: string,
): Command {
  return (state) => {
    const existing = state.placements.find((p) => p.id === id);
    if (!existing) return { ok: false, error: notFound('Placement') };
    // Reordering inside its own cell is always allowed, even in a greyed cell.
    const sameCell = existing.date === date && existing.blockId === blockId;
    const error = sameCell ? null : validateCell(state, date, blockId);
    if (error) return { ok: false, error };
    const position = positionAmong(cellPlacements(state, date, blockId, id), {
      beforeId: beforePlacementId,
    });
    return commit(state, {
      ...state,
      placements: state.placements.map((p) =>
        p.id === id ? { ...p, date, blockId, position } : p,
      ),
    });
  };
}
