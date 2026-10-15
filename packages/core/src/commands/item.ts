import { validationError } from '../model/errors';
import { newId } from '../model/ids';
import type { Item, ItemType } from '../model/types';
import { validateItemName, validateLink, validateNotes } from '../model/validation';
import { placeFields } from '../places/fields';
import type { Command } from './command';
import { commit } from './diff';

const isItemType = (t: unknown): t is ItemType => t === 'activity' || t === 'food';

export function addItem(
  name: string,
  type: ItemType,
  notes: string | null = null,
  link: string | null = null,
): Command {
  return (state) => {
    const error =
      validateItemName(name) ??
      (isItemType(type) ? null : validationError('NOT_FOUND', 'Unknown item type.')) ??
      validateNotes(notes) ??
      validateLink(link);
    if (error) return { ok: false, error };
    const item: Item = {
      id: newId(),
      tripId: state.trip.id,
      name: name.trim(),
      type,
      notes: notes || null,
      link: link || null,
      ...placeFields(null),
      updatedAt: '',
    };
    return commit(state, { ...state, items: [...state.items, item] });
  };
}

export interface ItemPatch {
  name?: string;
  type?: ItemType;
  notes?: string | null;
  link?: string | null;
}

/** Edits the list item only; placements already copied from it are never touched (FR-009). */
export function updateItem(id: string, patch: ItemPatch): Command {
  return (state) => {
    const existing = state.items.find((i) => i.id === id);
    if (!existing) return { ok: false, error: validationError('NOT_FOUND', 'Item not found.') };
    const error =
      (patch.name !== undefined ? validateItemName(patch.name) : null) ??
      (patch.type !== undefined && !isItemType(patch.type)
        ? validationError('NOT_FOUND', 'Unknown item type.')
        : null) ??
      (patch.notes !== undefined ? validateNotes(patch.notes) : null) ??
      (patch.link !== undefined ? validateLink(patch.link) : null);
    if (error) return { ok: false, error };
    const next: Item = {
      ...existing,
      ...patch,
      name: patch.name !== undefined ? patch.name.trim() : existing.name,
      notes: patch.notes !== undefined ? patch.notes || null : existing.notes,
      link: patch.link !== undefined ? patch.link || null : existing.link,
    };
    return commit(state, { ...state, items: state.items.map((i) => (i.id === id ? next : i)) });
  };
}

/**
 * Removes the list item. Placements keep all their content; only their back-reference is
 * cleared, mirroring the database's `on delete set null` (FR-009).
 */
export function deleteItem(id: string): Command {
  return (state) => {
    if (!state.items.some((i) => i.id === id)) {
      return { ok: false, error: validationError('NOT_FOUND', 'Item not found.') };
    }
    return commit(state, {
      ...state,
      items: state.items.filter((i) => i.id !== id),
      placements: state.placements.map((p) =>
        p.sourceItemId === id ? { ...p, sourceItemId: null } : p,
      ),
    });
  };
}
