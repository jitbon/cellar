import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { addTypedPlacement, createTrip, type Command, type TripState } from '@cellar/core';
import { chelseaPlace, chelseaSuggestion, fakePlaceSearch, withServices } from './setup';
import { PlacementChip } from '../src/components/grid/PlacementChip';
import { TooltipProvider } from '../src/components/ui/Tooltip';

const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');
const afternoon = created.state.blocks.find((b) => b.name === 'Afternoon')!;
const added = addTypedPlacement('2027-04-02', afternoon.id, 'Coffee')(created.state);
if (!added.ok) throw new Error('fixture');
const state = added.state;
const emptyState = created.state;
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

  describe('link, change and remove a place', () => {
    function Stateful({ initial }: { initial: TripState }) {
      const [current, setCurrent] = useState(initial);
      const dispatch = (command: Command) => {
        const r = command(current);
        if (r.ok) setCurrent(r.state);
        return r;
      };
      return (
        <TooltipProvider>
          <PlacementChip state={current} placement={current.placements[0]!} dispatch={dispatch} />
        </TooltipProvider>
      );
    }

    const services = () => ({
      places: fakePlaceSearch({ suggestions: [chelseaSuggestion] }),
      store: { get: () => null, set: vi.fn(), remove: vi.fn() },
    });

    it('editing a plain chip and picking a place links it', async () => {
      render(<Stateful initial={state} />, { wrapper: withServices(services()) });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
      await user.click(screen.getByRole('menuitem', { name: 'Edit Coffee' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit event' });
      const name = within(dialog).getByRole('combobox', { name: 'Name' });
      await user.clear(name);
      await user.type(name, 'Chelsea Mar');
      await user.click(await screen.findByRole('option', { name: /Chelsea Market/ }));
      expect(name).toHaveValue('Chelsea Market');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(screen.getByText('Chelsea Market')).toBeInTheDocument();
      expect(screen.getByLabelText('Linked place')).toBeInTheDocument();
    });

    it('Remove place clears the link and keeps the name', async () => {
      const linkedChip = linkedChipState();
      render(<Stateful initial={linkedChip} />, { wrapper: withServices(services()) });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
      await user.click(screen.getByRole('menuitem', { name: 'Remove place from Chelsea Market' }));
      expect(screen.queryByLabelText('Linked place')).toBeNull();
      expect(screen.getByText('Chelsea Market')).toBeInTheDocument();
    });

    it('renaming a linked chip keeps the link', async () => {
      render(<Stateful initial={linkedChipState()} />, { wrapper: withServices(services()) });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
      await user.click(screen.getByRole('menuitem', { name: 'Edit Chelsea Market' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit event' });
      const name = within(dialog).getByRole('combobox', { name: 'Name' });
      await user.clear(name);
      await user.type(name, 'Lunch');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(screen.getByText('Lunch')).toBeInTheDocument();
      expect(screen.getByLabelText('Linked place')).toBeInTheDocument();
    });

    it('Remove place in the edit dialog drops the held place before saving', async () => {
      render(<Stateful initial={linkedChipState()} />, { wrapper: withServices(services()) });
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
      await user.click(screen.getByRole('menuitem', { name: 'Edit Chelsea Market' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit event' });
      await user.click(within(dialog).getByRole('button', { name: 'Remove place' }));
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(screen.queryByLabelText('Linked place')).toBeNull();
    });

    function linkedChipState(): TripState {
      const r = addTypedPlacement('2027-04-02', afternoon.id, 'Chelsea Market', undefined, {
        place: chelseaPlace,
      })(emptyState);
      if (!r.ok) throw new Error('fixture');
      return r.state;
    }
  });
});

describe('linked place details', () => {
  const linked = addTypedPlacement('2027-04-02', afternoon.id, 'Chelsea Market', undefined, {
    place: chelseaPlace,
  })(created.state);
  if (!linked.ok) throw new Error('fixture');
  const linkedState: TripState = linked.state;

  function setupDetails(chipState: TripState = linkedState) {
    const dispatch = vi.fn((command: Command) => command(chipState));
    const places = fakePlaceSearch();
    render(
      <TooltipProvider>
        <PlacementChip state={chipState} placement={chipState.placements[0]!} dispatch={dispatch} />
      </TooltipProvider>,
      { wrapper: withServices({ places }) },
    );
    return { user: userEvent.setup(), places };
  }

  it('offers View details first for a linked event and opens the place dialog', async () => {
    const { user, places } = setupDetails();
    await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveAccessibleName('View details');
    await user.click(items[0]);
    const dialog = await screen.findByRole('dialog', { name: 'Chelsea Market' });
    expect(await within(dialog).findByText('4.6 (31,204 reviews)')).toBeInTheDocument();
    expect(places.info).toHaveBeenCalledWith('test-chelsea');
    expect(within(dialog).getByRole('button', { name: 'Edit event' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Open in maps' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Place in a block' })).toBeNull();
  });

  it('Edit event closes the view and opens the edit dialog', async () => {
    const { user } = setupDetails();
    await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
    await user.click(screen.getByRole('menuitem', { name: 'View details' }));
    await user.click(await screen.findByRole('button', { name: 'Edit event' }));
    expect(screen.queryByRole('dialog', { name: 'Chelsea Market' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeInTheDocument();
  });

  it('clicking the chip still opens edit', async () => {
    const { user } = setupDetails();
    await user.click(screen.getByText('Chelsea Market'));
    expect(screen.getByRole('dialog', { name: 'Edit event' })).toBeInTheDocument();
  });

  it('an unlinked event has no View details', async () => {
    const { user } = setupDetails(state);
    await user.click(screen.getByRole('button', { name: 'Actions for Coffee' }));
    expect(screen.queryByRole('menuitem', { name: 'View details' })).toBeNull();
  });
});
