import type { Place, PlaceFields } from '../model/types';

export function placeFields(place: Place | null): PlaceFields {
  return {
    placeId: place ? place.id : null,
    placeProvider: place ? place.provider : null,
    placeName: place ? place.name.trim() : null,
    placeAddress: place ? place.address : null,
    placeLat: place ? place.lat : null,
    placeLon: place ? place.lon : null,
    placeCategory: place ? place.category : null,
  };
}

/** The linked place of an item or placement, or null for a plain row. */
export function placeOf(fields: PlaceFields): Place | null {
  if (
    fields.placeId === null ||
    fields.placeProvider === null ||
    fields.placeName === null ||
    fields.placeAddress === null ||
    fields.placeLat === null ||
    fields.placeLon === null
  ) {
    return null;
  }
  return {
    id: fields.placeId,
    provider: fields.placeProvider,
    name: fields.placeName,
    address: fields.placeAddress,
    lat: fields.placeLat,
    lon: fields.placeLon,
    category: fields.placeCategory,
  };
}
