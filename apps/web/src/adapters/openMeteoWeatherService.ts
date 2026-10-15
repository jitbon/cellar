import type { Forecast, Location, WeatherService } from '@cellar/core';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

interface GeocodeResult {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  admin1?: string;
}

interface ForecastBody {
  timezone: string;
  hourly: {
    time: string[];
    weather_code: number[];
    temperature_2m: number[];
    precipitation_probability: (number | null)[];
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo request failed (${res.status})`);
  return (await res.json()) as T;
}

export class OpenMeteoWeatherService implements WeatherService {
  async forecast(location: Location): Promise<Forecast> {
    const params = new URLSearchParams({
      latitude: String(location.lat),
      longitude: String(location.lon),
      hourly: 'weather_code,temperature_2m,precipitation_probability',
      timezone: 'auto',
      forecast_days: '16',
    });
    const body = await getJson<ForecastBody>(`${FORECAST_URL}?${params}`);
    const h = body.hourly;
    return {
      tz: body.timezone,
      hours: h.time.map((time, i) => ({
        time,
        code: h.weather_code[i],
        tempC: h.temperature_2m[i],
        rainPct: h.precipitation_probability[i] ?? null,
      })),
      fetchedAt: new Date().toISOString(),
    };
  }

  async searchLocations(query: string, language: string): Promise<Location[]> {
    const params = new URLSearchParams({
      name: query,
      count: '5',
      language,
      format: 'json',
    });
    const body = await getJson<{ results?: GeocodeResult[] }>(`${GEOCODING_URL}?${params}`);
    const results = body.results ?? [];
    const short = (r: GeocodeResult) => [r.name, r.country].filter(Boolean).join(', ');
    return results.map((r) => {
      const clash = results.filter((o) => short(o) === short(r)).length > 1;
      const name = clash ? [r.name, r.admin1, r.country].filter(Boolean).join(', ') : short(r);
      return { name, lat: r.latitude, lon: r.longitude, tz: r.timezone };
    });
  }
}
