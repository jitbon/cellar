import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  createTrip,
  setTripLocation,
  todayIn,
  type Forecast,
  type KeyValueStore,
  type TripState,
  type WeatherService,
} from '@cellar/core';
import { useForecasts } from '../src/state/useForecasts';
import { withServices } from './setup';

const TZ = 'Asia/Tokyo';
const kyoto = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: TZ };
const DAY = 86_400_000;

const addDays = (date: string, n: number) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

/** Clear skies every hour for 16 days from `today` in Tokyo. */
function sunnyForecast(today: string): Forecast {
  const hours = [];
  for (let d = 0; d < 16; d++) {
    const date = addDays(today, d);
    for (let h = 0; h < 24; h++) {
      hours.push({
        time: `${date}T${String(h).padStart(2, '0')}:00`,
        code: 0,
        tempC: 20,
        rainPct: 0,
      });
    }
  }
  return { tz: TZ, hours, fetchedAt: new Date().toISOString() };
}

function tripFrom(today: string, located: boolean): TripState {
  const created = createTrip('u', 'Kyoto', today, addDays(today, 20));
  if (!created.ok) throw new Error('fixture');
  if (!located) return created.state;
  const r = setTripLocation(kyoto)(created.state);
  if (!r.ok) throw new Error('fixture');
  return r.state;
}

function setup(state: TripState) {
  const today = todayIn(TZ, new Date());
  const weather: WeatherService = {
    forecast: vi.fn(async () => sunnyForecast(today)),
    searchLocations: vi.fn(async () => []),
  };
  return renderHook(() => useForecasts(state), {
    wrapper: withServices({ weather, store: memoryStore() }),
  });
}

describe('useForecasts daySummary', () => {
  it('gives in-range days a summary and days beyond the range none', async () => {
    const today = todayIn(TZ, new Date());
    const { result } = setup(tripFrom(today, true));
    await waitFor(() => expect(result.current.daySummary(today)).not.toBeNull());
    expect(result.current.daySummary(today)!.phrase).toBe('Sunny all day');
    expect(result.current.daySummary(addDays(today, 18))).toBeNull();
  });

  it('gives no summary to a trip without a location', () => {
    const today = todayIn(TZ, new Date());
    const { result } = setup(tripFrom(today, false));
    expect(result.current.daySummary(today)).toBeNull();
  });
});
