import type { Place, PopularPlace } from '../model/types';

/** The linkable snapshot of a popular place, as feature 004 stores it. */
export function popularToPlace(p: PopularPlace): Place {
  return {
    id: p.placeId,
    provider: 'google',
    name: p.name,
    address: p.address,
    lat: p.lat,
    lon: p.lon,
    category: p.types[0] ?? null,
  };
}
