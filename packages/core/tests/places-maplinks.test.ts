import { describe, expect, it } from 'vitest';
import { mapLinks, orderMapApps } from '../src/places/mapLinks';
import type { Place } from '../src/model/types';

const chelsea: Place = {
  id: 'ChIJ-chelsea/1',
  provider: 'google',
  name: 'Chelsea Market',
  address: '75 9th Ave, New York',
  lat: 40.7424,
  lon: -74.0061,
  category: 'market',
};

describe('mapLinks', () => {
  it('builds the three universal links with encoded values', () => {
    expect(mapLinks(chelsea)).toEqual({
      google:
        'https://www.google.com/maps/search/?api=1&query=Chelsea%20Market%2C%2075%209th%20Ave%2C%20New%20York&query_place_id=ChIJ-chelsea%2F1',
      apple: 'https://maps.apple.com/?q=Chelsea%20Market&ll=40.7424,-74.0061',
      waze: 'https://waze.com/ul?ll=40.7424,-74.0061&navigate=yes',
    });
  });

  it('encodes characters that would break a query string', () => {
    const links = mapLinks({ ...chelsea, name: "Ben & Jerry's #1", address: '' });
    expect(links.google).toContain("query=Ben%20%26%20Jerry's%20%231&");
    expect(links.apple).toContain("q=Ben%20%26%20Jerry's%20%231&");
  });

  it('uses the name alone in the Google query when there is no address', () => {
    expect(mapLinks({ ...chelsea, address: '' }).google).toContain('query=Chelsea%20Market&');
  });
});

describe('orderMapApps', () => {
  it('lists Google, Apple, Waze by default', () => {
    expect(orderMapApps(null)).toEqual(['google', 'apple', 'waze']);
  });

  it('puts the preferred app first', () => {
    expect(orderMapApps('waze')).toEqual(['waze', 'google', 'apple']);
    expect(orderMapApps('apple')).toEqual(['apple', 'google', 'waze']);
    expect(orderMapApps('google')).toEqual(['google', 'apple', 'waze']);
  });
});
