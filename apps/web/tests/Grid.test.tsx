import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTrip, setTripLocation, type TripState } from '@cellar/core';
import { Grid } from '../src/components/grid/Grid';
import { TooltipProvider } from '../src/components/ui/Tooltip';
import type { Forecasts } from '../src/state/useForecasts';
import { fakePlaceSearch, withPlaces } from './setup';

const noForecasts: Forecasts = {
  cellWeather: () => null,
  daySummary: () => null,
  dayStatus: () => ({ kind: 'no-location' }),
  unavailable: false,
};

const created = createTrip('u', 'Japan', '2027-04-10', '2027-04-12');
if (!created.ok) throw new Error('fixture');
const base: TripState = created.state;
const tokyo = { name: 'Tokyo, Japan', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo' };

function renderGrid(state: TripState) {
  render(
    <TooltipProvider>
      <Grid state={state} dispatch={vi.fn()} forecasts={noForecasts} />
    </TooltipProvider>,
    { wrapper: withPlaces(fakePlaceSearch()) },
  );
}

const header = (day: string) => screen.getByText(day).closest('[data-testid="day-header"]')!;

afterEach(() => vi.useRealTimers());

describe('Grid today highlight', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  it('labels and highlights only the header of today', () => {
    vi.setSystemTime(new Date('2027-04-11T12:00:00Z'));
    renderGrid(base);
    const headers = screen.getAllByTestId('day-header');
    expect(headers).toHaveLength(3);
    const today = headers.filter((h) => within(h as HTMLElement).queryByText('Today'));
    expect(today).toHaveLength(1);
    expect(today[0]).toBe(header('Apr 11'));
    expect(today[0]!.parentElement!.className).toMatch(/today/);
    expect(header('Apr 10').parentElement!.className).not.toMatch(/today/);
    expect(header('Apr 12').parentElement!.className).not.toMatch(/today/);
  });

  it("uses the trip location's time zone to decide which day is today", () => {
    // 16:00 UTC on Apr 10 is already Apr 11 in Tokyo.
    vi.setSystemTime(new Date('2027-04-10T16:00:00Z'));
    const located = setTripLocation(tokyo)(base);
    if (!located.ok) throw new Error('fixture');
    renderGrid(located.state);
    expect(within(header('Apr 11') as HTMLElement).getByText('Today')).toBeInTheDocument();
    expect(within(header('Apr 10') as HTMLElement).queryByText('Today')).toBeNull();
  });

  it('shows no "Today" label when today is outside the trip', () => {
    vi.setSystemTime(new Date('2027-05-01T12:00:00Z'));
    renderGrid(base);
    expect(screen.queryByText('Today')).toBeNull();
  });
});
