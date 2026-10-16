import type { Forecast, ForecastHour, ISODate, WeatherCondition } from '../model/types';
import { conditionFromWmo } from './wmo';

export interface DaySummary {
  /** At most 24 characters, e.g. "Cloudy, PM showers" (research R3). */
  phrase: string;
  highC: number;
  lowC: number;
  rainPct: number | null;
  fetchedAt: string;
}

const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const MIN_HOURS = 8;
const MAX_LENGTH = 24;
/** A rain chance at or above this makes an hour "wet" (FR-003). */
const LIKELY_PCT = 50;
/** Heavy rain codes: moderate/heavy rain and freezing rain, moderate/violent showers. */
const HEAVY_CODES = new Set([63, 65, 67, 81, 82]);

type Part = 'am' | 'pm' | 'evening';
type Kind = 'rain' | 'snow' | 'storms';

interface Hour {
  hour: number;
  part: Part;
  condition: WeatherCondition;
  wet: boolean;
  source: ForecastHour;
}

const partOf = (hour: number): Part => (hour < 12 ? 'am' : hour < 18 ? 'pm' : 'evening');

const BASE: Record<string, string> = {
  clear: 'Sunny',
  'partly-cloudy': 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The most common dry condition; ties go to the condition seen first. */
function mostCommon(hours: Hour[]): WeatherCondition | null {
  const counts = new Map<WeatherCondition, number>();
  for (const h of hours) counts.set(h.condition, (counts.get(h.condition) ?? 0) + 1);
  let best: WeatherCondition | null = null;
  for (const [condition, n] of counts) if (best === null || n > counts.get(best)!) best = condition;
  return best;
}

/** Rain, snow or storms for the wet hours, and whether rain is light ("showers"). */
function kindOf(wet: Hour[]): { kind: Kind; light: boolean } {
  if (wet.some((h) => h.condition === 'thunderstorm')) return { kind: 'storms', light: false };
  if (wet.some((h) => h.condition === 'snow')) return { kind: 'snow', light: false };
  const heavy = wet.length >= 3 || wet.some((h) => HEAVY_CODES.has(h.source.code));
  return { kind: 'rain', light: !heavy };
}

const word = ({ kind, light }: { kind: Kind; light: boolean }) =>
  kind === 'rain' && light ? 'showers' : kind;

/** Fixed phrase rules, first match wins (research R3). */
function phraseFor(hours: Hour[]): string {
  const wet = hours.filter((h) => h.wet);
  const dry = hours.filter((h) => !h.wet);
  const wetParts = new Set(wet.map((h) => h.part));
  const has = (part: Part) => wetParts.has(part);

  if (wet.length > 0) {
    const w = word(kindOf(wet));
    const kind = capitalize(w);
    if ((has('am') && has('pm') && has('evening')) || wet.length >= hours.length * 0.6) {
      return `${kind} all day`;
    }
    if (has('am') && !has('pm') && !has('evening')) return `${kind}, clearing PM`;
    if (has('am') && has('pm')) return `${kind} until evening`;
    if (has('am') && has('evening')) return `${kind} on and off`;
    const base = BASE[mostCommon(dry) ?? 'cloudy'];
    return has('pm') ? `${base}, PM ${w}` : `${base}, evening ${w}`;
  }

  const fogAm = hours.filter((h) => h.part === 'am' && h.condition === 'fog').length;
  const fogAll = hours.filter((h) => h.condition === 'fog').length;
  if (fogAm >= 2 && fogAll < hours.length / 2) {
    const later = mostCommon(hours.filter((h) => h.part !== 'am')) ?? 'cloudy';
    return `Fog early, then ${BASE[later].toLowerCase()}`;
  }

  const main = mostCommon(hours)!;
  const share = hours.filter((h) => h.condition === main).length / hours.length;
  if (share >= 0.8) return main === 'partly-cloudy' ? 'Partly cloudy' : `${BASE[main]} all day`;
  return main === 'clear' || main === 'cloudy' ? `Mostly ${BASE[main].toLowerCase()}` : BASE[main];
}

/** Keeps the phrase within 24 characters by dropping its leading "{Base}, " (research R3). */
function fit(phrase: string): string {
  if (phrase.length <= MAX_LENGTH) return phrase;
  if (phrase.startsWith('Fog early')) return 'Fog early';
  const comma = phrase.indexOf(', ');
  return comma >= 0 ? capitalize(phrase.slice(comma + 2)) : phrase.slice(0, MAX_LENGTH);
}

/**
 * The daytime (07:00-21:00) summary of a forecast for one date, or null when fewer than 8 of
 * those hours are in the forecast. Overnight hours never count.
 */
export function summarizeDay(forecast: Forecast, date: ISODate): DaySummary | null {
  const hours: Hour[] = [];
  for (const h of forecast.hours) {
    if (!h.time.startsWith(`${date}T`)) continue;
    const hour = Number(h.time.slice(11, 13));
    if (hour < FIRST_HOUR || hour > LAST_HOUR) continue;
    const condition = conditionFromWmo(h.code);
    const wet =
      condition === 'rain' ||
      condition === 'snow' ||
      condition === 'thunderstorm' ||
      (h.rainPct ?? 0) >= LIKELY_PCT;
    hours.push({ hour, part: partOf(hour), condition, wet, source: h });
  }
  if (hours.length < MIN_HOURS) return null;
  hours.sort((a, b) => a.hour - b.hour);

  const temps = hours.map((h) => h.source.tempC);
  const rain = hours.flatMap((h) => (h.source.rainPct === null ? [] : [h.source.rainPct]));
  return {
    phrase: fit(phraseFor(hours)),
    highC: Math.round(Math.max(...temps)),
    lowC: Math.round(Math.min(...temps)),
    rainPct: rain.length === 0 ? null : Math.max(...rain),
    fetchedAt: forecast.fetchedAt,
  };
}
