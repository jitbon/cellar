import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('WeatherIcon popover', () => {
  const details = weather('rain', 70);

  function setup() {
    const user = userEvent.setup();
    render(
      <>
        <WeatherIcon blockName="Afternoon" weather={details} />
        <button type="button">elsewhere</button>
      </>,
    );
    return { user, icon: screen.getByRole('button', { name: /Afternoon weather/ }) };
  }

  function expectDetails() {
    expect(screen.getByText('Rain')).toBeInTheDocument();
    expect(screen.getByText(/°[CF]$/)).toBeInTheDocument();
    expect(screen.getByText('70% chance of rain')).toBeInTheDocument();
    expect(screen.getByText(/^Forecast as of \d{1,2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Weather data by Open-Meteo.com' })).toHaveAttribute(
      'href',
      'https://open-meteo.com/',
    );
  }

  it('opens on mouse hover after a short delay and closes on leave', async () => {
    const { user, icon } = setup();
    await user.hover(icon);
    expect(screen.queryByText('70% chance of rain')).not.toBeInTheDocument();
    expect(await screen.findByText('70% chance of rain')).toBeInTheDocument();
    expectDetails();
    expect(icon).toHaveAttribute('aria-describedby', screen.getByText('Rain').parentElement!.id);
    await user.unhover(icon);
    expect(screen.queryByText('70% chance of rain')).not.toBeInTheDocument();
  });

  it('opens on keyboard focus and closes on Escape and blur', async () => {
    const { user } = setup();
    await user.tab();
    expectDetails();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('70% chance of rain')).not.toBeInTheDocument();
    await user.tab({ shift: true });
    await user.tab();
    expect(screen.getByText('70% chance of rain')).toBeInTheDocument();
    await user.tab(); // moves to the Open-Meteo link, still inside
    expect(screen.getByText('70% chance of rain')).toBeInTheDocument();
    await user.tab(); // out to the next button
    expect(screen.queryByText('70% chance of rain')).not.toBeInTheDocument();
  });

  it('opens on tap and closes on an outside tap', async () => {
    const { user, icon } = setup();
    await user.pointer([{ keys: '[TouchA>]', target: icon }, { keys: '[/TouchA]' }]);
    expectDetails();
    await user.pointer([
      { keys: '[TouchA>]', target: screen.getByRole('button', { name: 'elsewhere' }) },
      { keys: '[/TouchA]' },
    ]);
    expect(screen.queryByText('70% chance of rain')).not.toBeInTheDocument();
  });
});
