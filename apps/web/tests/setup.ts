import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import type { Place, PlaceSearch, PlaceSuggestion } from '@cellar/core';
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

/** A fake PlaceSearch; returns no suggestions unless a test passes some. */
export function fakePlaceSearch(
  opts: {
    suggestions?: PlaceSuggestion[];
    place?: Place;
    fail?: boolean;
  } = {},
): PlaceSearch & { suggest: ReturnType<typeof vi.fn>; details: ReturnType<typeof vi.fn> } {
  const { suggestions = [], place = chelseaPlace, fail = false } = opts;
  return {
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

/** Wraps a component in services that only provide place search. */
export function withPlaces(places: PlaceSearch) {
  const services = { places } as unknown as Services;
  return function PlacesWrapper({ children }: { children: ReactNode }) {
    return createElement(ServicesProvider, { services, children });
  };
}
