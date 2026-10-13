import { positionBetween } from './ids';

export interface Positioned {
  id: string;
  position: string;
}

/** Order by position, then id, so equal positions from two devices order identically. */
export function comparePositioned(a: Positioned, b: Positioned): number {
  if (a.position !== b.position) return a.position < b.position ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * A position for a new/moved item in an already-sorted list (which must not contain the item
 * itself): before `beforeId`, else after `afterId`, else at the end.
 */
export function positionAmong(
  sorted: Positioned[],
  opts: { beforeId?: string; afterId?: string } = {},
): string {
  if (opts.beforeId !== undefined) {
    const i = sorted.findIndex((p) => p.id === opts.beforeId);
    if (i >= 0) return positionBetween(sorted[i - 1]?.position ?? null, sorted[i].position);
  } else if (opts.afterId !== undefined) {
    const i = sorted.findIndex((p) => p.id === opts.afterId);
    if (i >= 0) return positionBetween(sorted[i].position, sorted[i + 1]?.position ?? null);
  }
  return positionBetween(sorted.at(-1)?.position ?? null, null);
}
