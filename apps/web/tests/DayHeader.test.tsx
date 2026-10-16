import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createTrip,
  setDayLocation,
  setDayWindow,
  type Command,
  type DaySummary,
  type TripState,
} from '@cellar/core';
import { DayHeader } from '../src/components/grid/DayHeader';

const created = createTrip('u', 'Tokyo', '2026-10-14', '2026-10-17');
if (!created.ok) throw new Error('fixture');
const base: TripState = created.state;
const lunch = base.blocks.find((b) => b.name === 'Lunch')!;
const afternoon = base.blocks.find((b) => b.name === 'Afternoon')!;
const DATE = '2026-10-15';

function apply(state: TripState, command: Command): TripState {
  const r = command(state);
  if (!r.ok) throw new Error('fixture');
  return r.state;
}

function setup(state: TripState, summary?: DaySummary | null) {
  const dispatch = vi.fn((command: Command) => command(state));
  render(
    <DayHeader
      state={state}
      date={DATE}
      weekday="Thursday"
      dispatch={dispatch}
      summary={summary}
    />,
  );
  return { dispatch, user: userEvent.setup() };
}

const summary: DaySummary = {
  phrase: 'Cloudy, PM showers',
  highC: 24,
  lowC: 15,
  rainPct: 70,
  fetchedAt: '2026-10-15T09:00:00Z',
};

describe('DayHeader', () => {
  it('shows the weekday and short date, and no indicators when nothing is set', () => {
    setup(base);
    expect(screen.getByText('THU')).toBeInTheDocument();
    expect(screen.getByText('Oct 15')).toBeInTheDocument();
    expect(screen.queryByText(/Arrive/)).toBeNull();
    expect(screen.queryByText(/Depart/)).toBeNull();
  });

  it('shows arrival, departure and location indicators only when set', () => {
    const state = apply(
      apply(base, setDayWindow(DATE, lunch.id, afternoon.id)),
      setDayLocation(DATE, { name: 'Osaka, Japan', lat: 34.69, lon: 135.5, tz: 'Asia/Tokyo' }),
    );
    setup(state);
    expect(screen.getByText('Arrive · Lunch')).toBeInTheDocument();
    expect(screen.getByText('Depart · Afternoon')).toBeInTheDocument();
    expect(screen.getByText('Osaka')).toBeInTheDocument();
  });

  it('has a day menu with the travel and location items', async () => {
    const { user } = setup(base);
    await user.click(screen.getByRole('button', { name: `Day options for ${DATE}` }));
    expect(
      screen.getByRole('menuitem', { name: `Set arrival and departure for ${DATE}` }),
    ).toBeVisible();
    expect(screen.getByRole('menuitem', { name: `Set location for ${DATE}` })).toBeVisible();
    expect(screen.queryByRole('menuitem', { name: `Use trip location on ${DATE}` })).toBeNull();
  });

  it('offers "Use trip location" only when the day has an override, and dispatches it', async () => {
    const state = apply(
      base,
      setDayLocation(DATE, { name: 'Osaka, Japan', lat: 34.69, lon: 135.5, tz: 'Asia/Tokyo' }),
    );
    const { user, dispatch } = setup(state);
    await user.click(screen.getByRole('button', { name: `Day options for ${DATE}` }));
    await user.click(screen.getByRole('menuitem', { name: `Use trip location on ${DATE}` }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('opens the travel dialog from the menu', async () => {
    const { user } = setup(base);
    await user.click(screen.getByRole('button', { name: `Day options for ${DATE}` }));
    await user.click(
      screen.getByRole('menuitem', { name: `Set arrival and departure for ${DATE}` }),
    );
    expect(screen.getByRole('dialog', { name: `Travel on ${DATE}` })).toBeInTheDocument();
  });
});

describe('DayHeader weather summary', () => {
  const travelDay = () =>
    apply(
      apply(base, setDayWindow(DATE, lunch.id, afternoon.id)),
      setDayLocation(DATE, { name: 'Osaka, Japan', lat: 34.69, lon: 135.5, tz: 'Asia/Tokyo' }),
    );

  it('shows the phrase on the second line as a button', () => {
    setup(base, summary);
    const button = screen.getByRole('button', {
      name: 'Weather for 2026-10-15: Cloudy, PM showers',
    });
    expect(button).toHaveTextContent('Cloudy, PM showers');
    expect(button).toHaveAttribute('title', 'Cloudy, PM showers');
  });

  it('shows no weather button without a summary', () => {
    setup(base, null);
    expect(screen.queryByRole('button', { name: /^Weather for/ })).toBeNull();
  });

  it('shrinks arrival, departure and city to named icons when there is a phrase', () => {
    setup(travelDay(), summary);
    expect(screen.queryByText('Arrive · Lunch')).toBeNull();
    expect(screen.queryByText('Osaka')).toBeNull();
    const arrive = screen.getByRole('button', { name: /^Arrive · Lunch\./ });
    expect(arrive).toHaveAttribute('title', 'Arrive · Lunch');
    expect(screen.getByRole('button', { name: /^Depart · Afternoon\./ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Osaka\./ })).toBeInTheDocument();
  });

  it('keeps the full labels on a travel day without a phrase', () => {
    setup(travelDay(), null);
    expect(screen.getByText('Arrive · Lunch')).toBeInTheDocument();
    expect(screen.getByText('Osaka')).toBeInTheDocument();
  });

  it('shows high, low, rain chance and forecast time on focus or click, and closes on Escape', async () => {
    const { user } = setup(base, summary);
    await user.tab(); // the day menu button comes later; focus moves through the header
    const button = screen.getByRole('button', { name: /^Weather for/ });
    button.focus();
    expect(await screen.findByText(/^High \d+°[CF] · Low \d+°[CF]$/)).toBeInTheDocument();
    expect(screen.getByText('Rain up to 70%')).toBeInTheDocument();
    expect(screen.getByText(/^Forecast as of /)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText(/^High /)).toBeNull();
  });

  it('leaves out the rain line when there is no rain chance', async () => {
    setup(base, { ...summary, rainPct: null });
    screen.getByRole('button', { name: /^Weather for/ }).focus();
    expect(await screen.findByText(/^High /)).toBeInTheDocument();
    expect(screen.queryByText(/^Rain up to/)).toBeNull();
  });
});
