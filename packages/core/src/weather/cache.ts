import type { Forecast, Location } from '../model/types';
import type { KeyValueStore, WeatherService } from '../ports';
import { locationKey } from './status';

export interface ForecastCache {
  /** Cached forecast if any (fresh or stale); never hits the network. */
  peek(location: Location): Forecast | null;
  /** Returns cached if fresher than 3 h, else fetches, stores, and returns. One in-flight request per key. */
  get(location: Location, now: Date): Promise<Forecast>;
}

const PREFIX = 'weather:';
const INDEX_KEY = `${PREFIX}index`;
const STALE_MS = 3 * 3_600_000;
const MAX_ENTRIES = 20;

function parseForecast(raw: string | null): Forecast | null {
  if (raw === null) return null;
  try {
    const f = JSON.parse(raw) as Forecast;
    return f &&
      Array.isArray(f.hours) &&
      typeof f.fetchedAt === 'string' &&
      typeof f.tz === 'string'
      ? f
      : null;
  } catch {
    return null;
  }
}

export function createForecastCache(service: WeatherService, store: KeyValueStore): ForecastCache {
  const inFlight = new Map<string, Promise<Forecast>>();
  const storeKey = (location: Location) => PREFIX + locationKey(location);

  const readIndex = (): string[] => {
    try {
      const list = JSON.parse(store.get(INDEX_KEY) ?? '[]') as unknown;
      return Array.isArray(list) ? list.filter((k): k is string => typeof k === 'string') : [];
    } catch {
      return [];
    }
  };

  const save = (key: string, forecast: Forecast) => {
    store.set(key, JSON.stringify(forecast));
    const keys = [...readIndex().filter((k) => k !== key), key];
    while (keys.length > MAX_ENTRIES) {
      const age = (k: string) => Date.parse(parseForecast(store.get(k))?.fetchedAt ?? '') || 0;
      const oldest = keys.reduce((a, b) => (age(b) < age(a) ? b : a));
      keys.splice(keys.indexOf(oldest), 1);
      store.remove(oldest);
    }
    store.set(INDEX_KEY, JSON.stringify(keys));
  };

  return {
    peek: (location) => parseForecast(store.get(storeKey(location))),

    get(location, now) {
      const key = storeKey(location);
      const cached = parseForecast(store.get(key));
      // Forecasts saved before day/night data was fetched have no isDay; refresh them.
      const complete = cached?.hours[0]?.isDay !== undefined;
      if (cached && complete && now.getTime() - Date.parse(cached.fetchedAt) < STALE_MS) {
        return Promise.resolve(cached);
      }
      const pending = inFlight.get(key);
      if (pending) return pending;
      const request = service
        .forecast(location)
        .then((forecast) => {
          save(key, forecast);
          return forecast;
        })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, request);
      return request;
    },
  };
}
