import { describe, expect, it } from 'vitest';
import { validatePlace } from '../src/model/validation';
import type { PopularPlace } from '../src/model/types';
import { popularToPlace } from '../src/places/popular';

const met: PopularPlace = {
  placeId: 'test-met',
  name: 'The Metropolitan Museum of Art',
  kind: 'Art museum',
  address: '1000 5th Ave, New York',
  lat: 40.7794,
  lon: -73.9632,
  types: ['art_museum', 'museum', 'tourist_attraction'],
  rating: 4.8,
  ratingCount: 104512,
};

describe('popularToPlace', () => {
  it('maps a popular place to a Place with the first type as category', () => {
    expect(popularToPlace(met)).toEqual({
      id: 'test-met',
      provider: 'google',
      name: 'The Metropolitan Museum of Art',
      address: '1000 5th Ave, New York',
      lat: 40.7794,
      lon: -73.9632,
      category: 'art_museum',
    });
  });

  it('passes validatePlace', () => {
    expect(validatePlace(popularToPlace(met))).toBeNull();
  });

  it('has a null category for empty types', () => {
    expect(popularToPlace({ ...met, types: [] }).category).toBeNull();
  });
});
