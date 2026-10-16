import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createTrip, setDayWindow, type TripState } from '@cellar/core';
import { CellPickerDialog } from '../src/components/CellPickerDialog';

function state(): TripState {
  const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
  if (!created.ok) throw new Error('fixture');
  const lunch = created.state.blocks.find((b) => b.name === 'Lunch')!;
  // Arrive at Lunch on the first day: Morning, Breakfast and Late morning are greyed there.
  const r = setDayWindow('2027-04-01', lunch.id, null)(created.state);
  if (!r.ok) throw new Error('fixture');
  return r.state;
}

function setup() {
  const onPick = vi.fn();
  render(
    <CellPickerDialog
      title="Place in a block"
      confirmLabel="Place"
      state={state()}
      onPick={onPick}
      onClose={vi.fn()}
    />,
  );
  return { onPick, user: userEvent.setup() };
}

describe('CellPickerDialog and the travel window', () => {
  it('disables blocks outside the travel window for the chosen day and starts on an allowed one', () => {
    setup();
    const block = screen.getByLabelText('Time block');
    const option = (name: string) =>
      screen.getAllByRole('option').find((o) => o.textContent?.startsWith(name))!;
    expect(option('Morning')).toBeDisabled();
    expect(option('Late morning')).toBeDisabled();
    expect(option('Lunch')).not.toBeDisabled();
    expect(block).toHaveDisplayValue('Lunch');
  });

  it('enables every block on a day without a window', async () => {
    const { user, onPick } = setup();
    await user.selectOptions(screen.getByLabelText('Day'), '2027-04-02');
    const morning = screen.getAllByRole('option').find((o) => o.textContent === 'Morning')!;
    expect(morning).not.toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Time block'), morning);
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(onPick).toHaveBeenCalledWith('2027-04-02', expect.any(String));
  });
});
