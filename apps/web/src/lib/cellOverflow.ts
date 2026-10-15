/** A cell shows up to 3 chips; with 4 or more it shows 2 and a "+N more" line. */
export function visibleChips(count: number): { shown: number; more: number } {
  return count <= 3 ? { shown: count, more: 0 } : { shown: 2, more: count - 2 };
}
