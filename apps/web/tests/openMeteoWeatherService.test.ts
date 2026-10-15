import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenMeteoWeatherService } from '../src/adapters/openMeteoWeatherService';

const kyoto = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe('forecast', () => {
  const body = {
    timezone: 'Asia/Tokyo',
    hourly: {
      time: ['2027-04-01T00:00', '2027-04-01T01:00'],
      weather_code: [0, 61],
      temperature_2m: [12.5, 11],
      precipitation_probability: [null, 70],
    },
  };

  it('requests only coordinates and fixed parameters', async () => {
    const fetchMock = mockFetch(body);
    await new OpenMeteoWeatherService().forecast(kyoto);
    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: '35.0211',
      longitude: '135.7538',
      hourly: 'weather_code,temperature_2m,precipitation_probability',
      timezone: 'auto',
      forecast_days: '16',
    });
  });

  it('maps the response to a Forecast', async () => {
    mockFetch(body);
    const before = Date.now();
    const f = await new OpenMeteoWeatherService().forecast(kyoto);
    expect(f.tz).toBe('Asia/Tokyo');
    expect(f.hours).toEqual([
      { time: '2027-04-01T00:00', code: 0, tempC: 12.5, rainPct: null },
      { time: '2027-04-01T01:00', code: 61, tempC: 11, rainPct: 70 },
    ]);
    expect(new Date(f.fetchedAt).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('rejects on a non-2xx response', async () => {
    mockFetch({}, false, 503);
    await expect(new OpenMeteoWeatherService().forecast(kyoto)).rejects.toThrow();
  });
});

describe('searchLocations', () => {
  it('requests the geocoder with the query and language', async () => {
    const fetchMock = mockFetch({});
    await new OpenMeteoWeatherService().searchLocations('Kyo', 'en');
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://geocoding-api.open-meteo.com/v1/search?name=Kyo&count=5&language=en&format=json',
    );
  });

  it('maps results to "Name, Country"', async () => {
    mockFetch({
      results: [
        {
          name: 'Kyoto',
          latitude: 35.0211,
          longitude: 135.7538,
          timezone: 'Asia/Tokyo',
          country: 'Japan',
          admin1: 'Kyoto',
        },
      ],
    });
    expect(await new OpenMeteoWeatherService().searchLocations('Kyo', 'en')).toEqual([kyoto]);
  });

  it('adds the region only when two results would look the same', async () => {
    const entry = (admin1: string) => ({
      name: 'Springfield',
      latitude: 1,
      longitude: 2,
      timezone: 'America/Chicago',
      country: 'United States',
      admin1,
    });
    mockFetch({
      results: [
        entry('Illinois'),
        entry('Missouri'),
        { ...entry('x'), name: 'Spring', admin1: 'Texas' },
      ],
    });
    const names = (await new OpenMeteoWeatherService().searchLocations('Spring', 'en')).map(
      (l) => l.name,
    );
    expect(names).toEqual([
      'Springfield, Illinois, United States',
      'Springfield, Missouri, United States',
      'Spring, United States',
    ]);
  });

  it('returns [] when there are no results and rejects on failure', async () => {
    mockFetch({});
    expect(await new OpenMeteoWeatherService().searchLocations('zzzxqq', 'en')).toEqual([]);
    mockFetch({}, false, 500);
    await expect(new OpenMeteoWeatherService().searchLocations('x', 'en')).rejects.toThrow();
  });
});
