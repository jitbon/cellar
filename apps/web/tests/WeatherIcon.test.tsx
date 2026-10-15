import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CellWeather, WeatherCondition } from '@cellar/core';
import { WeatherIcon } from '../src/components/weather/WeatherIcon';

const weather = (condition: WeatherCondition, rainPct: number | null = 60): CellWeather => ({
  condition,
  tempC: 22,
  rainPct,
  fetchedAt: '2027-04-01T09:30:00.000Z',
});

const CONDITIONS: [WeatherCondition, string][] = [
  ['clear', 'Clear'],
  ['partly-cloudy', 'Partly cloudy'],
  ['cloudy', 'Cloudy'],
  ['fog', 'Fog'],
  ['rain', 'Rain'],
  ['snow', 'Snow'],
  ['thunderstorm', 'Thunderstorm'],
];

describe('WeatherIcon', () => {
  it('renders a distinct icon and label for each condition', () => {
    const shapes = new Set<string>();
    for (const [condition, label] of CONDITIONS) {
      const { container, unmount } = render(
        <WeatherIcon blockName="Afternoon" weather={weather(condition)} />,
      );
      expect(
        screen.getByRole('button', { name: `Afternoon weather: ${label}, 60% chance of rain` }),
      ).toBeInTheDocument();
      shapes.add(container.querySelector('svg')!.innerHTML);
      unmount();
    }
    expect(shapes.size).toBe(CONDITIONS.length);
  });

  it('omits the rain text when the chance is unknown', () => {
    render(<WeatherIcon blockName="Lunch" weather={weather('cloudy', null)} />);
    expect(screen.getByRole('button', { name: 'Lunch weather: Cloudy' })).toBeInTheDocument();
  });
});
