import type { MapApp, Place } from '../model/types';

const APPS: MapApp[] = ['google', 'apple', 'waze'];

/**
 * Universal web links: each opens the native app when installed and the provider's website
 * otherwise, so no app detection is needed. Built from the saved snapshot only.
 */
export function mapLinks(place: Place): Record<MapApp, string> {
  const e = encodeURIComponent;
  const query = place.address ? `${place.name}, ${place.address}` : place.name;
  const ll = `${place.lat},${place.lon}`;
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${e(query)}&query_place_id=${e(place.id)}`,
    apple: `https://maps.apple.com/?q=${e(place.name)}&ll=${ll}`,
    waze: `https://waze.com/ul?ll=${ll}&navigate=yes`,
  };
}

/** The preferred app first, then the rest in the default order. */
export function orderMapApps(preferred: MapApp | null): MapApp[] {
  return preferred ? [preferred, ...APPS.filter((a) => a !== preferred)] : [...APPS];
}
