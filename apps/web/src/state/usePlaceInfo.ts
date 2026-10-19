import { useEffect, useState } from 'react';
import type { PlaceInfo, PlaceSearch } from '@cellar/core';
import { usePlaceSearch } from './services';

export type PlaceInfoState =
  | { status: 'idle' | 'loading' | 'unavailable' | 'not-found' }
  | { status: 'ready'; info: PlaceInfo };

type Outcome = { id: string; state: PlaceInfoState };

// Google's terms don't allow storing place details, so they live in memory for the session only
// (never localStorage or the database). Keyed per place search so a swapped service (tests,
// sign-out) never sees another's results. Failures are not kept, so a later opening retries.
const loaded = new WeakMap<PlaceSearch, Map<string, PlaceInfo | 'not-found'>>();
const pending = new WeakMap<PlaceSearch, Map<string, Promise<PlaceInfo | 'not-found'>>>();

const mapOf = <T>(store: WeakMap<PlaceSearch, Map<string, T>>, search: PlaceSearch) => {
  let map = store.get(search);
  if (!map) store.set(search, (map = new Map()));
  return map;
};

function load(search: PlaceSearch, placeId: string): Promise<PlaceInfo | 'not-found'> {
  const inFlight = mapOf(pending, search);
  let request = inFlight.get(placeId);
  if (!request) {
    request = search.info(placeId).then(
      (info) => {
        mapOf(loaded, search).set(placeId, info);
        inFlight.delete(placeId);
        return info;
      },
      (error: unknown) => {
        inFlight.delete(placeId);
        if ((error as { code?: string } | null)?.code === 'not-found') {
          mapOf(loaded, search).set(placeId, 'not-found');
          return 'not-found' as const;
        }
        throw error;
      },
    );
    inFlight.set(placeId, request);
  }
  return request;
}

const stateOf = (value: PlaceInfo | 'not-found'): PlaceInfoState =>
  value === 'not-found' ? { status: 'not-found' } : { status: 'ready', info: value };

/** What the provider knows about a place: one request per place per session, then instant. */
export function usePlaceInfo(placeId: string | null): PlaceInfoState {
  const search = usePlaceSearch();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const cached = search && placeId ? mapOf(loaded, search).get(placeId) : undefined;

  useEffect(() => {
    if (!search || !placeId || mapOf(loaded, search).has(placeId)) return;
    let active = true;
    load(search, placeId).then(
      (value) => active && setOutcome({ id: placeId, state: stateOf(value) }),
      () => active && setOutcome({ id: placeId, state: { status: 'unavailable' } }),
    );
    return () => {
      active = false;
    };
  }, [search, placeId]);

  if (!placeId) return { status: 'idle' };
  if (cached) return stateOf(cached);
  if (!search) return { status: 'unavailable' };
  if (outcome?.id === placeId) return outcome.state;
  return { status: 'loading' };
}
