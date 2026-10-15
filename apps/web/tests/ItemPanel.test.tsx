import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addItem, createTrip, placeItem, type Command, type TripState } from '@cellar/core';
import { ItemPanel } from '../src/components/list/ItemPanel';

const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');

function apply(state: TripState, command: Command): TripState {
  const r = command(state);
  if (!r.ok) throw new Error('fixture');
  return r.state;
}

let seeded: TripState = created.state;
seeded = apply(seeded, addItem('Ramen', 'food'));
seeded = apply(seeded, addItem('RAMÉN Bar', 'food'));
seeded = apply(seeded, addItem('Museum', 'activity'));
const lunch = seeded.blocks.find((b) => b.name === 'Lunch')!;
const ramen = seeded.items.find((i) => i.name === 'Ramen')!;
seeded = apply(seeded, placeItem(ramen.id, '2027-04-02', lunch.id));
seeded = apply(seeded, placeItem(ramen.id, '2027-04-03', lunch.id));

function Harness({ onDispatch }: { onDispatch?: (c: Command) => void }) {
  const [state, setState] = useState(seeded);
  const dispatch = (command: Command) => {
    onDispatch?.(command);
    const r = command(state);
    if (r.ok) setState(r.state);
    return r;
  };
  return <ItemPanel state={state} dispatch={dispatch} />;
}

function setup(onDispatch?: (c: Command) => void) {
  render(<Harness onDispatch={onDispatch} />);
  return userEvent.setup();
}

const panel = () => screen.getByRole('complementary', { name: 'Activities and food' });
const names = () =>
  within(panel())
    .queryAllByTestId('item-name')
    .map((n) => n.textContent);

describe('ItemPanel', () => {
  it('lists all items and shows "placed N×" only when placed', () => {
    setup();
    expect(names()).toEqual(['Ramen', 'RAMÉN Bar', 'Museum']);
    expect(within(panel()).getByText('placed 2×')).toBeInTheDocument();
    expect(within(panel()).queryAllByText(/placed 0×/)).toHaveLength(0);
  });

  it('searches by name ignoring case and accents', async () => {
    const user = setup();
    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'ram');
    expect(names()).toEqual(['Ramen', 'RAMÉN Bar']);
  });

  it('filters by type and by not-yet-placed', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'Activities' }));
    expect(names()).toEqual(['Museum']);
    await user.click(screen.getByRole('button', { name: 'Food' }));
    expect(names()).toEqual(['Ramen', 'RAMÉN Bar']);
    await user.click(screen.getByRole('button', { name: 'Not yet placed' }));
    expect(names()).toEqual(['RAMÉN Bar']);
  });

  it('adds an item from the Add form and closes it', async () => {
    const dispatched = vi.fn();
    const user = setup(dispatched);
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.type(screen.getByLabelText('Name'), 'Sushi');
    await user.click(screen.getByRole('button', { name: 'Add to list' }));
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(names()).toContain('Sushi');
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('keeps drag, edit, delete and place actions with their names', async () => {
    const user = setup();
    expect(screen.getByRole('button', { name: 'Drag Museum' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Actions for Museum' }));
    expect(screen.getByRole('menuitem', { name: 'Edit Museum' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Delete Museum' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Place Museum in a block' })).toBeVisible();
  });
});
