import { describe, expect, it } from 'vitest';
import { placeQueryFromTitle } from '../src/queries/location';

describe('placeQueryFromTitle', () => {
  it('keeps a plain place name', () => {
    expect(placeQueryFromTitle('Tokyo')).toBe('Tokyo');
    expect(placeQueryFromTitle('New York')).toBe('New York');
  });

  it('drops years, numbers and trip words', () => {
    expect(placeQueryFromTitle('Tokyo 2027')).toBe('Tokyo');
    expect(placeQueryFromTitle('Lisbon trip')).toBe('Lisbon');
    expect(placeQueryFromTitle('Summer vacation in Rome!')).toBe('Rome');
    expect(placeQueryFromTitle('Kyoto Spring Break 2028')).toBe('Kyoto');
  });

  it('returns an empty string when nothing place-like is left', () => {
    expect(placeQueryFromTitle('2027 trip')).toBe('');
    expect(placeQueryFromTitle('  ')).toBe('');
  });
});
