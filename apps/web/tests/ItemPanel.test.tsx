import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  addItem,
  createTrip,
  placeFields,
  placeItem,
  setTripLocation,
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
  initial = seeded,
}: {
  onDispatch?: (c: Command) => void;
  onSetLocation?: () => void;
  initial?: TripState;
}) {
  const [state, setState] = useState(initial);
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
  it('lists all items; placed ones are struck through with a text equivalent, not a count', () => {
    setup();
    expect(names()).toEqual(['Ramen', 'RAMÉN Bar', 'Museum']);
    const rowOf = (name: string) =>
      within(panel())
        .getAllByRole('listitem')
        .find((li) => within(li).queryByTestId('item-name')?.textContent === name)!;
    expect(rowOf('Ramen')).toHaveTextContent('Ramen, placed');
    expect(within(rowOf('Ramen')).getByTestId('item-name').parentElement!.className).toMatch(
      /placed/,
    );
    for (const name of ['RAMÉN Bar', 'Museum']) {
      expect(rowOf(name)).not.toHaveTextContent('placed');
      expect(within(rowOf(name)).getByTestId('item-name').parentElement!.className).not.toMatch(
        /placed/,
      );
    }
    expect(within(panel()).queryAllByText(/placed \d+×/)).toHaveLength(0);
  });

  it('shows ×N beside the struck-through name when an item is placed more than once', () => {
    const museum = seeded.items.find((i) => i.name === 'Museum')!;
    render(<Harness initial={apply(seeded, placeItem(museum.id, '2027-04-01', lunch.id))} />);
    const rowOf = (name: string) =>
      within(panel())
        .getAllByRole('listitem')
        .find((li) => within(li).queryByTestId('item-name')?.textContent === name)!;
    // Ramen is placed twice, Museum once.
    expect(within(rowOf('Ramen')).getByText('×2')).toBeInTheDocument();
    expect(rowOf('Ramen')).toHaveTextContent('placed 2 times');
    expect(within(rowOf('Ramen')).getByText('×2').className).not.toMatch(/placed/);
    expect(rowOf('Museum')).toHaveTextContent('Museum, placed');
    expect(within(rowOf('Museum')).queryByText(/^×/)).toBeNull();
    expect(within(rowOf('RAMÉN Bar')).queryByText(/^×/)).toBeNull();
  });

  it('keeps a placed item draggable and its menu available', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Drag Ramen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Actions for Ramen' })).toBeInTheDocument();
  });

  it('narrows the list as you type in the quick-add line, ignoring case and accents', async () => {
    const user = setup();
    await user.type(screen.getByRole('combobox', { name: 'Add or filter items' }), 'ram');
    expect(names()).toEqual(['Ramen', 'RAMÉN Bar']);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('combines the typed text with the type and not-yet-placed filters', async () => {
    const user = setup();
    await user.type(screen.getByRole('combobox', { name: 'Add or filter items' }), 'ram');
    await user.click(screen.getByRole('button', { name: 'Not yet placed' }));
    expect(names()).toEqual(['RAMÉN Bar']);
    await user.click(screen.getByRole('button', { name: 'Activities' }));
    expect(names()).toEqual([]);
  });

  it('shows every item again after leaving the tab with text in the line', async () => {
    const user = setup();
    await user.type(screen.getByRole('combobox', { name: 'Add or filter items' }), 'ram');
    await user.click(screen.getByRole('tab', { name: 'Popular' }));
    await user.click(screen.getByRole('tab', { name: 'My list' }));
    expect(screen.getByRole('combobox', { name: 'Add or filter items' })).toHaveValue('');
    expect(names()).toEqual(['Ramen', 'RAMÉN Bar', 'Museum']);
  });

  it('adds the typed name on Enter, clears the line and shows every item again', async () => {
    const dispatched = vi.fn();
    const user = setup(dispatched);
    const line = screen.getByRole('combobox', { name: 'Add or filter items' });
    await user.type(line, 'Rest day');
    expect(names()).toEqual([]);
    await user.keyboard('{Enter}');
    expect(dispatched).toHaveBeenCalledTimes(1);
    expect(line).toHaveValue('');
    expect(line).toHaveFocus();
    expect(names()).toEqual(['Ramen', 'RAMÉN Bar', 'Museum', 'Rest day']);
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

  it('opens the edit dialog when a row is double-clicked', async () => {
    const user = setup();
    await user.dblClick(screen.getByText('Museum'));
    const dialog = screen.getByRole('dialog', { name: 'Edit item' });
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Museum');
  });

  it('closes the edit dialog with the X without saving', async () => {
    const user = setup();
    await user.dblClick(screen.getByText('Museum'));
    const dialog = screen.getByRole('dialog', { name: 'Edit item' });
    await user.clear(within(dialog).getByLabelText('Name'));
    await user.type(within(dialog).getByLabelText('Name'), 'Changed');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Edit item' })).toBeNull();
    expect(screen.getByText('Museum')).toBeInTheDocument();
    expect(screen.queryByText('Changed')).toBeNull();
  });

  describe('adding from any tab', () => {
    async function addFromForm(user: ReturnType<typeof userEvent.setup>, name: string) {
      await user.click(within(panel()).getByRole('button', { name: 'Add' }));
      await user.type(screen.getByLabelText('Name'), name);
      await user.click(screen.getByRole('button', { name: 'Add to list' }));
    }

    it('keeps the Add button on the Popular tab and adds to My list with a notice', async () => {
      const user = setup();
      await user.click(screen.getByRole('tab', { name: 'Popular' }));
      await addFromForm(user, 'Night market');
      expect(screen.getByRole('status')).toHaveTextContent('Added “Night market” to My list');
      await user.click(screen.getByRole('button', { name: 'View list' }));
      expect(screen.getByRole('tab', { name: 'My list' })).toHaveAttribute('aria-selected', 'true');
      expect(names()).toContain('Night market');
    });

    it('shows no notice when adding while My list is open', async () => {
      const user = setup();
      await addFromForm(user, 'Night market');
      expect(names()).toContain('Night market');
      expect(screen.queryByText(/to My list$/)).toBeNull();
    });

    it('shows the notice for "Add to my list" on a popular card', async () => {
      const located = apply(
        seeded,
        setTripLocation({ name: 'New York, USA', lat: 40.71, lon: -74.0, tz: 'America/New_York' }),
      );
      render(<Harness initial={located} />, { wrapper: withPlaces(fakePlaceSearch()) });
      const user = userEvent.setup();
      await user.click(screen.getByRole('tab', { name: 'Popular' }));
      await user.click(
        await screen.findByRole('button', { name: 'Actions for The Metropolitan Museum of Art' }),
      );
      await user.click(screen.getByRole('menuitem', { name: 'Add to my list' }));
      expect(screen.getByRole('status')).toHaveTextContent(
        'Added “The Metropolitan Museum of Art” to My list',
      );
    });
  });

  it('does not open the edit dialog when the actions button is double-clicked', async () => {
    const user = setup();
    await user.dblClick(screen.getByRole('button', { name: 'Actions for Museum' }));
    expect(screen.queryByRole('dialog', { name: 'Edit item' })).toBeNull();
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

describe('linked place details', () => {
  const linked = apply(seeded, addItem('Chelsea Market', 'activity', null, null, chelseaPlace));

  function setupDetails(places = fakePlaceSearch()) {
    const store = { get: () => null, set: vi.fn(), remove: vi.fn() };
    function DetailsHarness() {
      const [state, setState] = useState(linked);
      const dispatch = (command: Command) => {
        const r = command(state);
        if (r.ok) setState(r.state);
        return r;
      };
      return <ItemPanel state={state} dispatch={dispatch} onSetLocation={noop} />;
    }
    render(<DetailsHarness />, { wrapper: withServices({ store, places }) });
    return { user: userEvent.setup(), places };
  }

  it('a linked item name is a button that opens the place dialog', async () => {
    const { user, places } = setupDetails();
    await user.click(screen.getByRole('button', { name: 'Chelsea Market' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chelsea Market' });
    expect(within(dialog).getByText(/75 9th Ave, New York/)).toBeInTheDocument();
    expect(await within(dialog).findByText('4.6 (31,204 reviews)')).toBeInTheDocument();
    expect(places.info).toHaveBeenCalledWith('test-chelsea');
  });

  it('the row menu offers View details first and opens the same dialog', async () => {
    const { user } = setupDetails();
    await user.click(screen.getByRole('button', { name: 'Actions for Chelsea Market' }));
    const items = screen.getAllByRole('menuitem');
    expect(items[0]).toHaveAccessibleName('View details');
    await user.click(items[0]);
    expect(await screen.findByRole('dialog', { name: 'Chelsea Market' })).toBeInTheDocument();
  });

  it('double-clicking the row still opens Edit', async () => {
    const { user } = setupDetails();
    const row = screen.getByRole('button', { name: 'Actions for Chelsea Market' }).closest('li')!;
    await user.dblClick(within(row).getByText('75 9th Ave, New York'));
    expect(screen.getByRole('dialog', { name: 'Edit item' })).toBeInTheDocument();
  });

  it('an unlinked item has a plain name and no View details (FR-009)', async () => {
    const { user } = setupDetails();
    expect(screen.queryByRole('button', { name: 'Museum' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Actions for Museum' }));
    expect(screen.queryByRole('menuitem', { name: /View details/ })).toBeNull();
  });

  it('Place in a block in the view opens the block picker for that item', async () => {
    const { user } = setupDetails();
    await user.click(screen.getByRole('button', { name: 'Chelsea Market' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chelsea Market' });
    await user.click(within(dialog).getByRole('button', { name: 'Place in a block' }));
    expect(screen.getByRole('dialog', { name: 'Place “Chelsea Market”' })).toBeInTheDocument();
  });
});
