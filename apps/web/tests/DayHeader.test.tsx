import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createTrip,
  setDayLocation,
  setDayWindow,
  type Command,
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

function setup(state: TripState) {
  const dispatch = vi.fn((command: Command) => command(state));
  render(<DayHeader state={state} date={DATE} weekday="Thursday" dispatch={dispatch} />);
  return { dispatch, user: userEvent.setup() };
}

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
