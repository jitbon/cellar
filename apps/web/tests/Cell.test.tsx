import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { cell, createTrip, type Command, type TripState } from '@cellar/core';
import { Cell } from '../src/components/grid/Cell';

const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');
const initial = created.state;
const afternoon = initial.blocks.find((b) => b.name === 'Afternoon')!;
const DATE = '2027-04-02';

function Harness() {
  const [state, setState] = useState<TripState>(initial);
  const dispatch = (command: Command) => {
    const r = command(state);
    if (r.ok) setState(r.state);
    return r;
  };
  return (
    <Cell
      state={state}
      date={DATE}
      blockId={afternoon.id}
      blockName="Afternoon"
      dispatch={dispatch}
    />
  );
}

describe('Cell', () => {
  it('typing + Enter creates two placements in order', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /add event to afternoon/i }));
    await user.type(
      screen.getByRole('combobox', { name: /add event/i }),
      'Walk around Shibuya{Enter}',
    );
    await user.type(screen.getByRole('combobox', { name: /add event/i }), 'Coffee{Enter}');
    const names = screen.getAllByText(/Walk around Shibuya|Coffee/).map((n) => n.textContent);
    expect(names).toEqual(['Walk around Shibuya', 'Coffee']);
  });

  it('Escape cancels without creating anything', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /add event/i }));
    await user.type(screen.getByRole('combobox', { name: /add event/i }), 'Nope{Escape}');
    expect(screen.queryByText('Nope')).toBeNull();
    expect(screen.getByRole('button', { name: /add event/i })).toBeInTheDocument();
  });

  it('type toggle switches icon and label', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /add event/i }));
    await user.type(screen.getByRole('combobox', { name: /add event/i }), 'Coffee{Enter}');
    expect(screen.getByText(/Activity/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /switch coffee to food place/i }));
    expect(screen.getByText(/Food place/)).toBeInTheDocument();
    expect(screen.queryByText(/^🎟 Activity$/)).toBeNull();
    expect(cell).toBeDefined();
  });
});
