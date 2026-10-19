import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import type {
  CityPhoto,
  CityPhotoService,
  Location,
  Place,
  PlaceInfo,
  PlaceSearch,
  PlaceSuggestion,
  PopularList,
  PopularPlace,
} from '@cellar/core';
import { afterEach, vi } from 'vitest';
import { ServicesProvider, type Services } from '../src/state/services';

afterEach(cleanup);

// Newer Node versions ship an experimental global `localStorage` that shadows jsdom's and is
// unusable without flags; install a plain in-memory Storage so tests behave like a browser.
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, String(v)),
  };
}

let usable = false;
try {
  localStorage.setItem('__t', '1');
  localStorage.removeItem('__t');
  usable = true;
} catch {
  usable = false;
}
if (!usable) {
  const storage = memoryStorage();
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}

// Radix (menus, tooltips) relies on a few browser APIs jsdom lacks.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

export const chelseaSuggestion: PlaceSuggestion = {
  placeId: 'test-chelsea',
  name: 'Chelsea Market',
  address: '9th Avenue, New York, NY, USA',
  types: ['market', 'point_of_interest'],
};

export const chelseaPlace: Place = {
  id: 'test-chelsea',
  provider: 'google',
  name: 'Chelsea Market',
  address: '75 9th Ave, New York',
  lat: 40.7424,
  lon: -74.0061,
  category: 'market',
};

export const popularPlace = (
  placeId: string,
  name: string,
  types: string[],
  kind = 'Museum',
  photo: PopularPlace['photo'] = null,
): PopularPlace => ({
  placeId,
  name,
  kind,
  address: '1000 5th Ave, New York',
  lat: 40.7794,
  lon: -73.9632,
  types,
  rating: 4.8,
  ratingCount: 104512,
  photo,
});

export const metPopular = popularPlace(
  'test-met',
  'The Metropolitan Museum of Art',
  ['art_museum', 'museum'],
  'Museum',
  {
    name: 'places/test-met/photos/p1',
    author: 'Ann Lee',
    authorUri: 'https://maps.google.com/contrib/1',
  },
);
export const katzPopular = popularPlace(
  'test-katz',
  "Katz's Delicatessen",
  ['deli', 'restaurant', 'food'],
  'Deli',
);

/** Two things to do and two food places, for whichever city is asked. */
export const defaultPopular = (city: Location): PopularList => ({
  city,
  todo: [metPopular, popularPlace('test-park', 'Central Park', ['park'], 'Park')],
  food: [katzPopular, popularPlace('test-pizza', "Joe's Pizza", ['pizza_restaurant'], 'Pizza')],
  fetchedAt: '2027-03-01T10:42:00.000Z',
});

/** Chelsea Market's details: open 09:00-21:00 every day, rated, with a website. */
export const chelseaInfo: PlaceInfo = {
  placeId: 'test-chelsea',
  name: 'Chelsea Market',
  kind: 'Market',
  types: ['market', 'point_of_interest'],
  rating: 4.6,
  ratingCount: 31204,
  photo: {
    name: 'places/test-chelsea/photos/p1',
    author: 'Ann Lee',
    authorUri: 'https://maps.google.com/contrib/1',
  },
  hours: {
    periods: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      open: { day, hour: 9, minute: 0 },
      close: { day, hour: 21, minute: 0 },
    })),
  },
  utcOffsetMinutes: -240,
  website: 'https://chelseamarket.com/',
};

/** A fake PlaceSearch; returns no suggestions unless a test passes some. */
export function fakePlaceSearch(
  opts: {
    suggestions?: PlaceSuggestion[];
    place?: Place;
    fail?: boolean;
    /** What `popular` resolves with (default: two todo and two food places). */
    popular?: (city: Location) => PopularList;
    /** Makes `popular` reject. */
    popularFail?: boolean;
    /** Makes `photoUrl` reject. */
    photoFail?: boolean;
    /** What `info` resolves with (default: Chelsea Market's details). */
    info?: (placeId: string) => PlaceInfo;
    /** Makes `info` reject as unavailable. */
    infoFail?: boolean;
    /** Makes `info` reject with code 'not-found'. */
    infoNotFound?: boolean;
  } = {},
): PlaceSearch & {
  suggest: ReturnType<typeof vi.fn>;
  details: ReturnType<typeof vi.fn>;
  popular: ReturnType<typeof vi.fn>;
  photoUrl: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
} {
  const {
    suggestions = [],
    place = chelseaPlace,
    fail = false,
    popular = defaultPopular,
    popularFail = false,
    photoFail = false,
    info = (placeId: string) => ({ ...chelseaInfo, placeId }),
    infoFail = false,
    infoNotFound = false,
  } = opts;
  return {
    info: vi.fn(async (placeId: string) => {
      if (infoNotFound) throw Object.assign(new Error('not-found'), { code: 'not-found' });
      if (infoFail) throw new Error('unavailable');
      return info(placeId);
    }),
    photoUrl: vi.fn(async (name: string, maxWidthPx: number) => {
      if (photoFail) throw new Error('unavailable');
      return `https://photos.test/${name}?w=${maxWidthPx}`;
    }),
    popular: vi.fn(async (city: Location) => {
      if (popularFail) throw new Error('unavailable');
      return popular(city);
    }),
    suggest: vi.fn(async () => {
      if (fail) throw new Error('unavailable');
      return suggestions;
    }),
    details: vi.fn(async () => {
      if (fail) throw new Error('unavailable');
      return place;
    }),
  };
}

/** A city photo with a credit; `file` also decides the image URL. */
export const cityPhoto = (file: string, credit = 'Jane Doe'): CityPhoto => ({
  file,
  url: `https://photos.test/city/${file}`,
  width: 1280,
  height: 720,
  credit,
  license: 'CC BY-SA 4.0',
  sourceUrl: `https://commons.wikimedia.org/wiki/File:${file}`,
});

/** A fake CityPhotoService: `lead` is the first photo, `more` all of them. */
export function fakeCityPhotos(
  opts: { photos?: CityPhoto[]; fail?: boolean } = {},
): CityPhotoService & {
  lead: ReturnType<typeof vi.fn>;
  more: ReturnType<typeof vi.fn>;
  byFile: ReturnType<typeof vi.fn>;
} {
  const {
    photos = ['Kyoto_A.jpg', 'Kyoto_B.jpg', 'Kyoto_C.jpg'].map((f) => cityPhoto(f)),
    fail = false,
  } = opts;
  const guard = () => {
    if (fail) throw new Error('unavailable');
  };
  return {
    lead: vi.fn(async () => {
      guard();
      return photos[0] ?? null;
    }),
    more: vi.fn(async (_city: string, limit: number) => {
      guard();
      return photos.slice(0, limit);
    }),
    byFile: vi.fn(async (file: string) => {
      guard();
      return photos.find((p) => p.file === file) ?? null;
    }),
  };
}

/** Wraps a component in services where only the given ones exist. */
export function withServices(partial: Partial<Services>) {
  const services = partial as Services;
  return function ServicesWrapper({ children }: { children: ReactNode }) {
    return createElement(ServicesProvider, { services, children });
  };
}

/** Wraps a component in services that only provide place search. */
export const withPlaces = (places: PlaceSearch) => withServices({ places });
