import { useEffect, useState } from 'react';
import { locationKey, type Location, type PlaceSearch, type PopularList } from '@cellar/core';
import { usePlaceSearch } from './services';

export type PopularStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface PopularPlaces {
  list: PopularList | null;
  status: PopularStatus;
}

// Google's terms don't allow storing place details, so loaded lists live in memory for the
// session only (never localStorage or the database). Keyed per place search so a swapped
// service (tests, sign-out) never sees another's results.
const loaded = new WeakMap<PlaceSearch, Map<string, PopularList>>();
const pending = new WeakMap<PlaceSearch, Map<string, Promise<PopularList>>>();

const mapOf = <T>(store: WeakMap<PlaceSearch, Map<string, T>>, search: PlaceSearch) => {
  let map = store.get(search);
  if (!map) store.set(search, (map = new Map()));
  return map;
};

function load(search: PlaceSearch, city: Location): Promise<PopularList> {
  const key = locationKey(city);
  const inFlight = mapOf(pending, search);
  let request = inFlight.get(key);
  if (!request) {
    request = search.popular(city).then(
      (list) => {
        mapOf(loaded, search).set(key, list);
        inFlight.delete(key);
        return list;
      },
      (error: unknown) => {
        inFlight.delete(key);
        throw error;
      },
    );
    inFlight.set(key, request);
  }
  return request;
}

/** Popular places for a city: one request per city per session, then instant. */
export function usePopularPlaces(city: Location | null): PopularPlaces {
  const search = usePlaceSearch();
  const key = city ? locationKey(city) : null;
  const cityJson = JSON.stringify(city);
  const [outcome, setOutcome] = useState<{ key: string; list: PopularList | null } | null>(null);
  const cached = search && key ? mapOf(loaded, search).get(key) : undefined;

  useEffect(() => {
    const target = JSON.parse(cityJson) as Location | null;
    if (!search || !target || mapOf(loaded, search).has(locationKey(target))) return;
    let active = true;
    const wanted = locationKey(target);
    load(search, target).then(
      (list) => active && setOutcome({ key: wanted, list }),
      () => active && setOutcome({ key: wanted, list: null }),
    );
    return () => {
      active = false;
    };
  }, [search, cityJson]);

  if (!city || !key) return { list: null, status: 'idle' };
  if (cached) return { list: cached, status: 'ready' };
  if (!search) return { list: null, status: 'unavailable' };
  if (outcome?.key === key) {
    return outcome.list
      ? { list: outcome.list, status: 'ready' }
      : { list: null, status: 'unavailable' };
  }
  return { list: null, status: 'loading' };
}
