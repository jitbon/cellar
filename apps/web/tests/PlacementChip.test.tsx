import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addTypedPlacement, createTrip, type Command, type TripState } from '@cellar/core';
import { chelseaPlace, withServices } from './setup';
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

  describe('linked place', () => {
    const linked = addTypedPlacement('2027-04-02', afternoon.id, 'Chelsea Market', undefined, {
      place: chelseaPlace,
    })(created.state);
    if (!linked.ok) throw new Error('fixture');
    const linkedState: TripState = linked.state;

    function setupLinked() {
      const dispatch = vi.fn((command: Command) => command(linkedState));
      const store = { get: () => null, set: vi.fn(), remove: vi.fn() };
      render(
        <TooltipProvider>
          <PlacementChip
            state={linkedState}
            placement={linkedState.placements[0]!}
            dispatch={dispatch}
          />
        </TooltipProvider>,
        { wrapper: withServices({ store }) },
      );
      return { dispatch, user: userEvent.setup() };
    }

    it('shows a pin on a linked chip but not on a plain one', () => {
      setupLinked();
      expect(screen.getByLabelText('Linked place')).toBeInTheDocument();
    });

    it('offers "Open in maps" for a linked chip', async () => {
      const { user } = setupLinked();
      await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
      expect(screen.getByText('Open in maps')).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'Google Maps' })).toBeVisible();
    });

    it('does not offer "Open in maps" or a pin for a plain chip', async () => {
      const { user } = setup();
      expect(screen.queryByLabelText('Linked place')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
      expect(screen.queryByText('Open in maps')).toBeNull();
    });
  });
});
