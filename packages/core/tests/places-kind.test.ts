import { describe, expect, it } from 'vitest';
import { kindLabel } from '../src/places/kind';

describe('kindLabel', () => {
  it.each([
    [null, ''],
    ['', ''],
    ['art_museum', 'Art museum'],
    ['restaurant', 'Restaurant'],
  ])('turns %j into %j', (category, label) => {
    expect(kindLabel(category)).toBe(label);
  });
});
