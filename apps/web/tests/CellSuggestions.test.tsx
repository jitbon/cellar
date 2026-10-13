import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addItem, createTrip, type Command, type TripState } from '@cellar/core';
import { Cell } from '../src/components/grid/Cell';

function fixture(): TripState {
  const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
  if (!created.ok) throw new Error('fixture');
  const withItem = addItem('Ichiran Ramen', 'food', 'tonkotsu')(created.state);
  if (!withItem.ok) throw new Error('fixture');
  return withItem.state;
}
const initial = fixture();
const lunch = initial.blocks.find((b) => b.name === 'Lunch')!;

function Harness({ onState }: { onState: (s: TripState) => void }) {
  const [state, setState] = useState<TripState>(initial);
  const dispatch = (command: Command) => {
    const r = command(state);
    if (r.ok) {
      setState(r.state);
      onState(r.state);
    }
    return r;
  };
  return (
    <Cell
      state={state}
      date="2027-04-02"
      blockId={lunch.id}
      blockName="Lunch"
      dispatch={dispatch}
    />
  );
}

async function openInput() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /add event to lunch/i }));
  return { user, input: screen.getByRole('combobox', { name: /add event/i }) };
}

describe('Cell suggestions', () => {
  it('"ichi" suggests "Ichiran Ramen"', async () => {
    render(<Harness onState={() => {}} />);
    const { user, input } = await openInput();
    await user.type(input, 'ichi');
    expect(screen.getByRole('option', { name: /Ichiran Ramen/ })).toBeInTheDocument();
  });

  it('choosing a suggestion creates a Food placement linked to the item', async () => {
    let latest = initial;
    render(<Harness onState={(s) => (latest = s)} />);
    const { user, input } = await openInput();
    await user.type(input, 'ichi');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(latest.placements).toHaveLength(1);
    expect(latest.placements[0]).toMatchObject({
      name: 'Ichiran Ramen',
      type: 'food',
      notes: 'tonkotsu',
      sourceItemId: initial.items[0].id,
    });
  });

  it('clicking a suggestion also places it', async () => {
    let latest = initial;
    render(<Harness onState={(s) => (latest = s)} />);
    const { user, input } = await openInput();
    await user.type(input, 'ichi');
    await user.click(screen.getByRole('option', { name: /Ichiran Ramen/ }));
    expect(latest.placements[0].sourceItemId).toBe(initial.items[0].id);
  });

  it('ignoring the suggestion creates a typed Activity', async () => {
    let latest = initial;
    render(<Harness onState={(s) => (latest = s)} />);
    const { user, input } = await openInput();
    await user.type(input, 'ichi{Enter}');
    expect(latest.placements).toHaveLength(1);
    expect(latest.placements[0]).toMatchObject({
      name: 'ichi',
      type: 'activity',
      sourceItemId: null,
    });
  });
});
