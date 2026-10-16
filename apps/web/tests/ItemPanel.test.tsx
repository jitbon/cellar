import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  addItem,
  createTrip,
  placeFields,
  placeItem,
  type Command,
  type PlaceSearch,
  type PlaceSuggestion,
  type TripState,
} from '@cellar/core';
import { ItemPanel } from '../src/components/list/ItemPanel';
import {
  chelseaPlace,
  chelseaSuggestion,
  fakePlaceSearch,
  withPlaces,
  withServices,
} from './setup';

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

const noop = () => {};

function Harness({
  onDispatch,
  onSetLocation = noop,
}: {
  onDispatch?: (c: Command) => void;
  onSetLocation?: () => void;
}) {
  const [state, setState] = useState(seeded);
  const dispatch = (command: Command) => {
    onDispatch?.(command);
    const r = command(state);
    if (r.ok) setState(r.state);
    return r;
  };
  return <ItemPanel state={state} dispatch={dispatch} onSetLocation={onSetLocation} />;
}

function setup(onDispatch?: (c: Command) => void, places?: PlaceSearch) {
  render(<Harness onDispatch={onDispatch} />, places ? { wrapper: withPlaces(places) } : undefined);
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

  describe('tabs', () => {
    const memoryStore = (initial: Record<string, string> = {}) => {
      const data = { ...initial };
      return {
        data,
        get: (k: string) => data[k] ?? null,
        set: (k: string, v: string) => void (data[k] = v),
        remove: (k: string) => void delete data[k],
      };
    };

    it('has My list and Popular tabs, with My list selected first', () => {
      setup();
      expect(screen.getByRole('tablist', { name: 'List views' })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: 'My list' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: 'Popular' })).toHaveAttribute(
        'aria-selected',
        'false',
      );
      expect(screen.getByRole('tabpanel', { name: 'My list' })).toBeInTheDocument();
    });

    it('switches to the Popular panel and back', async () => {
      const user = setup();
      await user.click(screen.getByRole('tab', { name: 'Popular' }));
      expect(screen.getByRole('tab', { name: 'Popular' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tabpanel', { name: 'Popular' })).toBeInTheDocument();
      expect(names()).toEqual([]);
      await user.click(screen.getByRole('tab', { name: 'My list' }));
      expect(names()).toEqual(['Ramen', 'RAMÉN Bar', 'Museum']);
    });

    it('moves between tabs with the arrow keys, Home and End', async () => {
      const user = setup();
      screen.getByRole('tab', { name: 'My list' }).focus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'Popular' })).toHaveFocus();
      expect(screen.getByRole('tab', { name: 'Popular' })).toHaveAttribute('aria-selected', 'true');
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: 'My list' })).toHaveFocus();
      await user.keyboard('{End}');
      expect(screen.getByRole('tab', { name: 'Popular' })).toHaveFocus();
      await user.keyboard('{Home}');
      expect(screen.getByRole('tab', { name: 'My list' })).toHaveAttribute('aria-selected', 'true');
    });

    it('only the selected tab is in the tab order', () => {
      setup();
      expect(screen.getByRole('tab', { name: 'My list' })).toHaveAttribute('tabindex', '0');
      expect(screen.getByRole('tab', { name: 'Popular' })).toHaveAttribute('tabindex', '-1');
    });

    it('remembers the selected tab per device', async () => {
      const store = memoryStore();
      render(<Harness />, { wrapper: withServices({ store }) });
      await userEvent.setup().click(screen.getByRole('tab', { name: 'Popular' }));
      expect(store.data['cellar.panelTab']).toBe('popular');
    });

    it('opens on the remembered tab', () => {
      render(<Harness />, {
        wrapper: withServices({ store: memoryStore({ 'cellar.panelTab': 'popular' }) }),
      });
      expect(screen.getByRole('tab', { name: 'Popular' })).toHaveAttribute('aria-selected', 'true');
    });

    it('passes the set-location request through from the Popular tab', async () => {
      const onSetLocation = vi.fn();
      render(<Harness onSetLocation={onSetLocation} />, {
        wrapper: withPlaces(fakePlaceSearch()),
      });
      const user = userEvent.setup();
      await user.click(screen.getByRole('tab', { name: 'Popular' }));
      await user.click(screen.getByRole('button', { name: 'Set trip location' }));
      expect(onSetLocation).toHaveBeenCalledTimes(1);
    });
  });

  describe('place suggestions', () => {
    const tacos: PlaceSuggestion = {
      placeId: 'test-tacos',
      name: 'Los Tacos No. 1',
      address: '9th Avenue, New York, NY, USA',
      types: ['mexican_restaurant', 'restaurant'],
    };

    async function openAdd(places: PlaceSearch, onDispatch?: (c: Command) => void) {
      const user = setup(onDispatch, places);
      await user.click(screen.getByRole('button', { name: 'Add' }));
      return user;
    }

    it('shows options while typing; picking one fills the name and shows the address', async () => {
      const user = await openAdd(fakePlaceSearch({ suggestions: [chelseaSuggestion] }));
      await user.type(screen.getByLabelText('Name'), 'Chelsea Mar');
      await user.click(await screen.findByRole('option', { name: /Chelsea Market/ }));
      expect(screen.getByLabelText('Name')).toHaveValue('Chelsea Market');
      expect(screen.getByText('75 9th Ave, New York')).toBeInTheDocument();
    });

    it('saving after a pick adds a linked item', async () => {
      const dispatched: Command[] = [];
      const user = await openAdd(fakePlaceSearch({ suggestions: [chelseaSuggestion] }), (c) =>
        dispatched.push(c),
      );
      await user.type(screen.getByLabelText('Name'), 'Chelsea Mar');
      await user.click(await screen.findByRole('option', { name: /Chelsea Market/ }));
      await user.click(screen.getByRole('button', { name: 'Add to list' }));
      expect(names()).toContain('Chelsea Market');
      const result = dispatched.at(-1)!(seeded);
      expect(result.ok && result.state.items.at(-1)).toMatchObject(placeFields(chelseaPlace));
      expect(within(panel()).getByLabelText('Linked place')).toBeInTheDocument();
    });

    it('ArrowDown then Enter picks an option instead of submitting', async () => {
      const user = await openAdd(fakePlaceSearch({ suggestions: [chelseaSuggestion] }));
      await user.type(screen.getByLabelText('Name'), 'Chelsea Mar');
      await screen.findByRole('option', { name: /Chelsea Market/ });
      await user.keyboard('{ArrowDown}{Enter}');
      await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Chelsea Market'));
      expect(screen.getByRole('button', { name: 'Add to list' })).toBeInTheDocument();
    });

    it('picking a food place sets the type to Food', async () => {
      const user = await openAdd(
        fakePlaceSearch({
          suggestions: [tacos],
          place: { ...chelseaPlace, id: 'test-tacos', name: tacos.name },
        }),
      );
      await user.type(screen.getByLabelText('Name'), 'taco');
      await user.click(await screen.findByRole('option', { name: /Los Tacos/ }));
      expect(screen.getByLabelText('Type')).toHaveValue('food');
    });

    it('saves plain text when nothing is picked', async () => {
      const dispatched: Command[] = [];
      const user = await openAdd(fakePlaceSearch({ suggestions: [chelseaSuggestion] }), (c) =>
        dispatched.push(c),
      );
      await user.type(screen.getByLabelText('Name'), 'Rest day');
      await user.click(screen.getByRole('button', { name: 'Add to list' }));
      const result = dispatched.at(-1)!(seeded);
      expect(result.ok && result.state.items.at(-1)).toMatchObject({
        name: 'Rest day',
        ...placeFields(null),
      });
    });

    it('shows "Place search unavailable" and still saves', async () => {
      const user = await openAdd(fakePlaceSearch({ fail: true }));
      await user.type(screen.getByLabelText('Name'), 'Sushi');
      expect(await screen.findByText('Place search unavailable')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Add to list' }));
      expect(names()).toContain('Sushi');
    });
  });

  describe('open in maps', () => {
    it('shows the group for linked items only', async () => {
      const linked = apply(seeded, addItem('Chelsea Market', 'activity', null, null, chelseaPlace));
      const store = { get: () => null, set: vi.fn(), remove: vi.fn() };
      function LinkedHarness() {
        const [state, setState] = useState(linked);
        const dispatch = (command: Command) => {
          const r = command(state);
          if (r.ok) setState(r.state);
          return r;
        };
        return <ItemPanel state={state} dispatch={dispatch} onSetLocation={noop} />;
      }
      render(<LinkedHarness />, { wrapper: withServices({ store }) });
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
      expect(screen.getByText('Open in maps')).toBeVisible();
      expect(screen.getByRole('menuitem', { name: 'Waze' })).toBeVisible();
      await user.keyboard('{Escape}');

      await user.click(screen.getByRole('button', { name: 'Actions for Museum' }));
      expect(screen.queryByText('Open in maps')).toBeNull();
    });
  });

  describe('link, change and remove a place', () => {
    const linked = apply(seeded, addItem('Chelsea Market', 'activity', null, null, chelseaPlace));

    function setupLinked(
      places: PlaceSearch = fakePlaceSearch({ suggestions: [chelseaSuggestion] }),
    ) {
      const store = { get: () => null, set: vi.fn(), remove: vi.fn() };
      function LinkedHarness() {
        const [state, setState] = useState(linked);
        const dispatch = (command: Command) => {
          const r = command(state);
          if (r.ok) setState(r.state);
          return r;
        };
        return <ItemPanel state={state} dispatch={dispatch} onSetLocation={noop} />;
      }
      render(<LinkedHarness />, { wrapper: withServices({ store, places }) });
      return userEvent.setup();
    }

    it('editing a plain item and picking a place links it', async () => {
      const user = setupLinked();
      await user.click(screen.getByRole('button', { name: 'Actions for Museum' }));
      await user.click(screen.getByRole('menuitem', { name: 'Edit Museum' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit item' });
      const name = within(dialog).getByLabelText('Name');
      await user.clear(name);
      await user.type(name, 'Chelsea Mar');
      await user.click(await screen.findByRole('option', { name: /Chelsea Market/ }));
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      const row = within(panel())
        .getAllByRole('listitem')
        .find((li) => li.textContent?.includes('75 9th Ave'));
      expect(row).toBeDefined();
    });

    it('Remove place in the row menu clears the link and keeps the name', async () => {
      const user = setupLinked();
      await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
      await user.click(screen.getByRole('menuitem', { name: 'Remove place from Chelsea Market' }));
      expect(within(panel()).queryByLabelText('Linked place')).toBeNull();
      expect(names()).toContain('Chelsea Market');
    });

    it('renaming a linked item keeps its place', async () => {
      const user = setupLinked();
      await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
      await user.click(screen.getByRole('menuitem', { name: 'Edit Chelsea Market' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit item' });
      const name = within(dialog).getByLabelText('Name');
      await user.clear(name);
      await user.type(name, 'Chelsea Market lunch');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(names()).toContain('Chelsea Market lunch');
      expect(within(panel()).getByLabelText('Linked place')).toBeInTheDocument();
    });

    it('the edit dialog has a Remove place button for a linked item', async () => {
      const user = setupLinked();
      await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
      await user.click(screen.getByRole('menuitem', { name: 'Edit Chelsea Market' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit item' });
      await user.click(within(dialog).getByRole('button', { name: 'Remove place' }));
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(within(panel()).queryByLabelText('Linked place')).toBeNull();
      expect(names()).toContain('Chelsea Market');
    });
  });
});
