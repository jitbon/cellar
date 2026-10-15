import { describe, expect, it } from 'vitest';
import { formatTemp, temperatureUnit } from '../src/weather/units';

describe('temperatureUnit', () => {
  it.each(['en-US', 'es-US', 'en-PR', 'en-GU', 'en-VI', 'en-AS', 'en-MP', 'en-LR', 'my-MM'])(
    'uses Fahrenheit for %s',
    (locale) => {
      expect(temperatureUnit(locale)).toBe('F');
    },
  );

  it.each(['en-GB', 'ja-JP', 'en', 'fr-CA'])('uses Celsius for %s', (locale) => {
    expect(temperatureUnit(locale)).toBe('C');
  });

  it('falls back to Celsius for an invalid locale', () => {
    expect(temperatureUnit('')).toBe('C');
    expect(temperatureUnit('not a locale!')).toBe('C');
  });
});

describe('formatTemp', () => {
  it('formats Celsius and Fahrenheit rounded', () => {
    expect(formatTemp(22, 'C')).toBe('22°C');
    expect(formatTemp(22, 'F')).toBe('72°F');
    expect(formatTemp(-3.4, 'C')).toBe('-3°C');
  });
});
