import { generateKeyBetween } from 'fractional-indexing';
import { v4 } from 'uuid';

export function newId(): string {
  return v4();
}

/**
 * Fractional-index key between a and b (null = open end). Positions are not unique, so two
 * devices can produce equal neighbours; in that case fall back to a key after `a`.
 */
export function positionBetween(a: string | null, b: string | null): string {
  if (a !== null && b !== null && a >= b) return generateKeyBetween(a, null);
  return generateKeyBetween(a, b);
}
