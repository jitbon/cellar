import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addTypedPlacement, createTrip, type Command } from '@cellar/core';
import { PlacementChip } from '../src/components/grid/PlacementChip';
import { TooltipProvider } from '../src/components/ui/Tooltip';

const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');
const afternoon = created.state.blocks.find((b) => b.name === 'Afternoon')!;
const added = addTypedPlacement('2027-04-02', afternoon.id, 'Coffee')(created.state);
if (!added.ok) throw new Error('fixture');
const state = added.state;
const placement = state.placements[0]!;

function setup() {
  const dispatch = vi.fn((command: Command) => command(state));
  render(
    <TooltipProvider>
      <PlacementChip state={state} placement={placement} dispatch={dispatch} />
    </TooltipProvider>,
  );
  return { dispatch, user: userEvent.setup() };
}

describe('PlacementChip', () => {
  it('renders the name on one line with a hidden drag handle', () => {
    setup();
    expect(screen.getByText('Coffee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drag Coffee' })).toBeInTheDocument();
  });

  it('opens an actions menu with the four actions', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
    expect(screen.getByRole('menuitem', { name: 'Switch Coffee to Food place' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Move Coffee to another block' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Edit Coffee' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Remove Coffee' })).toBeVisible();
  });

  it('dispatches a type switch from the menu', async () => {
    const { user, dispatch } = setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
    await user.click(screen.getByRole('menuitem', { name: 'Switch Coffee to Food place' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('dispatches removal from the menu', async () => {
    const { user, dispatch } = setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove Coffee' }));
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('opens the edit dialog from the menu and on a plain click', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
    await user.click(screen.getByRole('menuitem', { name: 'Edit Coffee' }));
    expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByText('Coffee'));
    expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeInTheDocument();
  });

  it('opens the move dialog from the menu', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move Coffee to another block' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
