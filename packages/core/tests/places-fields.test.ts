import { describe, expect, it } from 'vitest';
import { placeFields, placeOf, validatePlace, type Place } from '../src';

const chelsea: Place = {
  id: 'test-chelsea',
  provider: 'google',
  name: 'Chelsea Market',
  address: '75 9th Ave, New York',
  lat: 40.7424,
  lon: -74.0061,
  category: 'market',
};

describe('placeFields / placeOf', () => {
  it('maps every Place field to its flat field', () => {
    expect(placeFields(chelsea)).toEqual({
      placeId: 'test-chelsea',
      placeProvider: 'google',
      placeName: 'Chelsea Market',
      placeAddress: '75 9th Ave, New York',
      placeLat: 40.7424,
      placeLon: -74.0061,
      placeCategory: 'market',
    });
  });

  it('maps null to all-null fields', () => {
    expect(placeFields(null)).toEqual({
      placeId: null,
      placeProvider: null,
      placeName: null,
      placeAddress: null,
      placeLat: null,
      placeLon: null,
      placeCategory: null,
    });
  });

  it('round-trips a place', () => {
    expect(placeOf(placeFields(chelsea))).toEqual(chelsea);
    expect(placeOf(placeFields({ ...chelsea, category: null }))).toEqual({
      ...chelsea,
      category: null,
    });
  });

  it('returns null for a plain row', () => {
    expect(placeOf(placeFields(null))).toBeNull();
  });
});

describe('validatePlace', () => {
  it('accepts a valid place and null', () => {
    expect(validatePlace(chelsea)).toBeNull();
    expect(validatePlace(null)).toBeNull();
    expect(validatePlace({ ...chelsea, address: '', category: null })).toBeNull();
  });

  it('rejects invalid places with INVALID_PLACE', () => {
    const bad: Place[] = [
      { ...chelsea, name: '   ' },
      { ...chelsea, name: 'x'.repeat(201) },
      { ...chelsea, id: '' },
      { ...chelsea, address: 'x'.repeat(301) },
      { ...chelsea, lat: 100 },
      { ...chelsea, lon: 200 },
      { ...chelsea, provider: 'apple' as unknown as 'google' },
      { ...chelsea, category: 'x'.repeat(101) },
    ];
    for (const place of bad) expect(validatePlace(place)?.code).toBe('INVALID_PLACE');
  });
});
