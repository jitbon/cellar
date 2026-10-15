import { describe, expect, it, vi } from 'vitest';
import type { KeyValueStore, WeatherService } from '../src/ports';
import type { Forecast, Location } from '../src/model/types';
import { createForecastCache } from '../src/weather/cache';

const kyoto: Location = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };
const HOUR = 3_600_000;
const now = new Date('2027-04-01T12:00:00Z');

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  };
}

const forecastAt = (fetchedAt: Date): Forecast => ({
  tz: 'Asia/Tokyo',
  hours: [{ time: '2027-04-01T00:00', code: 0, tempC: 20, rainPct: null }],
  fetchedAt: fetchedAt.toISOString(),
});

function fakeService(fetchedAt = now) {
  const forecast = vi.fn<WeatherService['forecast']>(async () => forecastAt(fetchedAt));
  const service: WeatherService = { forecast, searchLocations: async () => [] };
  return { service, forecast };
}

describe('createForecastCache', () => {
  it('keys by coordinates rounded to 2 decimals plus time zone', async () => {
    const store = memoryStore();
    const { service } = fakeService();
    await createForecastCache(service, store).get(kyoto, now);
    expect([...store.map.keys()]).toContain('weather:35.02,135.75,Asia/Tokyo');
  });

  it('peek returns cached data without fetching, and null when empty', async () => {
    const store = memoryStore();
    const { service, forecast } = fakeService();
    const cache = createForecastCache(service, store);
    expect(cache.peek(kyoto)).toBeNull();
    await cache.get(kyoto, now);
    forecast.mockClear();
    expect(cache.peek(kyoto)?.tz).toBe('Asia/Tokyo');
    expect(forecast).not.toHaveBeenCalled();
  });

  it('returns the cache when under 3 hours old, otherwise fetches and stores', async () => {
    const store = memoryStore();
    const { service, forecast } = fakeService(now);
    const cache = createForecastCache(service, store);
    await cache.get(kyoto, new Date(now.getTime() - 2 * HOUR)); // fetched "2h ago" relative to now
    expect(forecast).toHaveBeenCalledTimes(1);
    await cache.get(kyoto, new Date(now.getTime() + 2 * HOUR));
    expect(forecast).toHaveBeenCalledTimes(1); // fetchedAt = now, 2h old
    await cache.get(kyoto, new Date(now.getTime() + 4 * HOUR));
    expect(forecast).toHaveBeenCalledTimes(2);
  });

  it('makes one fetch for concurrent gets of one key', async () => {
    const { service, forecast } = fakeService();
    const cache = createForecastCache(service, memoryStore());
    await Promise.all([cache.get(kyoto, now), cache.get(kyoto, now)]);
    expect(forecast).toHaveBeenCalledTimes(1);
  });

  it('keeps at most 20 entries, evicting the oldest fetchedAt', async () => {
    const store = memoryStore();
    const forecast = vi.fn(async (l: Location) =>
      forecastAt(new Date(now.getTime() + l.lat * 1000)),
    );
    const cache = createForecastCache({ forecast, searchLocations: async () => [] }, store);
    for (let i = 0; i < 21; i++) {
      await cache.get({ ...kyoto, lat: i, lon: 0 }, now);
    }
    expect(cache.peek({ ...kyoto, lat: 0, lon: 0 })).toBeNull(); // oldest evicted
    expect(cache.peek({ ...kyoto, lat: 1, lon: 0 })).not.toBeNull();
    expect(cache.peek({ ...kyoto, lat: 20, lon: 0 })).not.toBeNull();
  });

  it('treats corrupt JSON as missing', async () => {
    const store = memoryStore();
    store.set('weather:35.02,135.75,Asia/Tokyo', '{not json');
    const { service, forecast } = fakeService();
    const cache = createForecastCache(service, store);
    expect(cache.peek(kyoto)).toBeNull();
    await cache.get(kyoto, now);
    expect(forecast).toHaveBeenCalledTimes(1);
  });

  it('propagates a rejected fetch and leaves the old cache intact', async () => {
    const store = memoryStore();
    const old = forecastAt(new Date(now.getTime() - 5 * HOUR));
    store.set('weather:35.02,135.75,Asia/Tokyo', JSON.stringify(old));
    const service: WeatherService = {
      forecast: async () => {
        throw new Error('down');
      },
      searchLocations: async () => [],
    };
    const cache = createForecastCache(service, store);
    await expect(cache.get(kyoto, now)).rejects.toThrow('down');
    expect(cache.peek(kyoto)).toEqual(old);
  });
});
