export type TemperatureUnit = 'C' | 'F';

/** Regions that use Fahrenheit (research R9). */
const FAHRENHEIT_REGIONS = new Set(['US', 'LR', 'MM', 'PR', 'GU', 'VI', 'AS', 'MP']);

export function temperatureUnit(locale: string): TemperatureUnit {
  try {
    const region = new Intl.Locale(locale).region;
    return region && FAHRENHEIT_REGIONS.has(region) ? 'F' : 'C';
  } catch {
    return 'C';
  }
}

export function formatTemp(tempC: number, unit: TemperatureUnit): string {
  const value = unit === 'F' ? (tempC * 9) / 5 + 32 : tempC;
  return `${Math.round(value)}°${unit}`;
}
