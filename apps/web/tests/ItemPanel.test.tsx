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
        return <ItemPanel state={state} dispatch={dispatch} />;
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
});
