import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type {
  AuthService,
  AuthUser,
  KeyValueStore,
  PlaceSearch,
  TripRepository,
  WeatherService,
} from '@cellar/core';
import type { Outbox } from '../adapters/outbox';

export interface Services {
  auth: AuthService;
  repo: TripRepository;
  outbox: Outbox;
  weather: WeatherService;
  places: PlaceSearch;
  store: KeyValueStore;
  /** Resolves once the persisted session has been read. */
  ready: Promise<void>;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: Services;
  children: ReactNode;
}) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const s = useContext(ServicesContext);
  if (!s) throw new Error('ServicesProvider missing');
  return s;
}

/**
 * Place search, or null outside a ServicesProvider so name fields still render and save plain
 * text (place search is an enhancement, never a dependency).
 */
export function usePlaceSearch(): PlaceSearch | null {
  return useContext(ServicesContext)?.places ?? null;
}

/** Current user; `loading` is true until the stored session has been read. */
export function useAuthUser(): { user: AuthUser | null; loading: boolean } {
  const { auth, ready } = useServices();
  const [user, setUser] = useState<AuthUser | null>(() => auth.currentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void ready.then(() => {
      if (!active) return;
      setUser(auth.currentUser());
      setLoading(false);
    });
    const off = auth.onAuthChange((u) => active && setUser(u));
    return () => {
      active = false;
      off();
    };
  }, [auth, ready]);

  return { user, loading };
}
