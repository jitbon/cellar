import { describe, expect, it } from 'vitest';
import { visibleChips } from '../src/lib/cellOverflow';

describe('visibleChips', () => {
  it.each([
    [0, { shown: 0, more: 0 }],
    [1, { shown: 1, more: 0 }],
    [2, { shown: 2, more: 0 }],
    [3, { shown: 3, more: 0 }],
    [4, { shown: 2, more: 2 }],
    [9, { shown: 2, more: 7 }],
  ])('count %i', (count, expected) => {
    expect(visibleChips(count)).toEqual(expected);
  });
});
