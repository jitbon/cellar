import type { CellWeather, Forecast, ISODate, TimeWindow, WeatherCondition } from '../model/types';
import { formatISODate, parseISODate } from '../model/validation';
import { conditionFromWmo } from './wmo';

const SEVERITY: WeatherCondition[] = [
  'clear',
  'partly-cloudy',
  'cloudy',
  'fog',
  'rain',
  'snow',
  'thunderstorm',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** Hour keys 'YYYY-MM-DDTHH:00' covered by the window on `date` (research R6). */
function hourKeys(date: ISODate, window: TimeWindow): string[] {
  const firstHour = Math.floor(window.startMin / 60);
  const lastHour = Math.ceil((window.endMin > window.startMin ? window.endMin : 1440) / 60) - 1;
  const keys: string[] = [];
  for (let hour = firstHour; hour <= lastHour; hour++) keys.push(`${date}T${pad(hour)}:00`);
  if (window.endMin < window.startMin) {
    const next = formatISODate(parseISODate(date) + 86_400_000);
    for (let hour = 0; hour < Math.ceil(window.endMin / 60); hour++) {
      keys.push(`${next}T${pad(hour)}:00`);
    }
  }
  return keys;
}

/**
 * One weather summary for a block's window on a date: the most severe condition, the highest
 * chance of rain, and the mean temperature. Null when none of its hours are in the forecast.
 */
export function summarizeWindow(
  forecast: Forecast,
  date: ISODate,
  window: TimeWindow,
): CellWeather | null {
  const byTime = new Map(forecast.hours.map((h) => [h.time, h]));
  const hours = hourKeys(date, window).flatMap((key) => byTime.get(key) ?? []);
  if (hours.length === 0) return null;

  const condition = hours
    .map((h) => conditionFromWmo(h.code))
    .reduce((worst, c) => (SEVERITY.indexOf(c) > SEVERITY.indexOf(worst) ? c : worst));
  const rain = hours.flatMap((h) => (h.rainPct === null ? [] : [h.rainPct]));
  return {
    condition,
    tempC: Math.round(hours.reduce((sum, h) => sum + h.tempC, 0) / hours.length),
    rainPct: rain.length === 0 ? null : Math.max(...rain),
    fetchedAt: forecast.fetchedAt,
  };
}
