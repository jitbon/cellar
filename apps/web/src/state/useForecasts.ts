import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createForecastCache,
  dayForecastStatus,
  days,
  dayLocation,
  effectiveWindows,
  forecastLocations,
  locationKey,
  summarizeWindow,
  todayIn,
  type CellWeather,
  type DayForecastStatus,
  type Forecast,
  type ISODate,
  type TripState,
} from '@cellar/core';
import { useServices } from './services';

export interface Forecasts {
  cellWeather(date: ISODate, blockId: string): CellWeather | null;
  dayStatus(date: ISODate): DayForecastStatus;
  /** An in-range location has no forecast at all (no cache and the fetch failed). */
  unavailable: boolean;
}

const NONE: Forecasts = {
  cellWeather: () => null,
  dayStatus: () => ({ kind: 'no-location' }),
  unavailable: false,
};

const RECHECK_MS = 15 * 60_000;

/**
 * Forecasts for the trip's locations. Cached data shows immediately; fetching and refreshing
 * happen in the background and never block an edit.
 */
export function useForecasts(state: TripState | null): Forecasts {
  const { weather, store } = useServices();
  const cache = useMemo(() => createForecastCache(weather, store), [weather, store]);
  const [forecasts, setForecasts] = useState<ReadonlyMap<string, Forecast>>(new Map());
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [round, setRound] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setRound((r) => r + 1), RECHECK_MS);
    return () => clearInterval(id);
  }, []);

  const todayFor = useCallback((tz: string) => todayIn(tz, new Date()), []);
  const locations = state ? forecastLocations(state, todayFor) : [];
  const locationsJson = JSON.stringify(locations);

  useEffect(() => {
    let active = true;
    const wanted = JSON.parse(locationsJson) as typeof locations;
    const put = (key: string, f: Forecast) =>
      setForecasts((prev) => (prev.get(key) === f ? prev : new Map(prev).set(key, f)));
    for (const location of wanted) {
      const key = locationKey(location);
      const cached = cache.peek(location);
      if (cached) put(key, cached);
      cache.get(location, new Date()).then(
        (f) => {
          if (!active) return;
          put(key, f);
          setFailed((prev) => {
            if (!prev.has(key)) return prev;
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        },
        () => active && setFailed((prev) => new Set(prev).add(key)),
      );
    }
    return () => {
      active = false;
    };
  }, [cache, locationsJson, round]);

  const windows = useMemo(() => (state ? effectiveWindows(state) : new Map()), [state]);

  return useMemo(() => {
    if (!state) return NONE;
    const byDate = new Map<ISODate, { status: DayForecastStatus; forecast: Forecast | null }>();
    for (const { date } of days(state.trip)) {
      const location = dayLocation(state, date);
      const status = location
        ? dayForecastStatus(state, date, todayIn(location.tz, new Date()))
        : ({ kind: 'no-location' } as const);
      byDate.set(date, {
        status,
        forecast: location ? (forecasts.get(locationKey(location)) ?? null) : null,
      });
    }
    return {
      cellWeather(date, blockId) {
        const day = byDate.get(date);
        const window = windows.get(blockId);
        if (!day?.forecast || day.status.kind !== 'in-range' || !window) return null;
        return summarizeWindow(day.forecast, date, window);
      },
      dayStatus: (date) => byDate.get(date)?.status ?? { kind: 'no-location' },
      unavailable: locations.some(
        (l) => !forecasts.has(locationKey(l)) && failed.has(locationKey(l)),
      ),
    };
  }, [state, forecasts, failed, windows, locationsJson]);
}
