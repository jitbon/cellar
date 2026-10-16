import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  addItem,
  createTrip,
  placePlace,
  popularToPlace,
  setDayLocation,
  setTripLocation,
  type Command,
  type Location,
  type PlaceSearch,
  type TripState,
} from '@cellar/core';
import { PopularTab } from '../src/components/list/PopularTab';
import { katzPopular, metPopular, fakePlaceSearch, withPlaces } from './setup';

const nyc: Location = { name: 'New York, USA', lat: 40.7128, lon: -74.006, tz: 'America/New_York' };
const boston: Location = {
  name: 'Boston, USA',
  lat: 42.3601,
  lon: -71.0589,
  tz: 'America/New_York',
};

const created = createTrip('u', 'NYC', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');

function apply(state: TripState, command: Command): TripState {
  const r = command(state);
  if (!r.ok) throw new Error('fixture');
  return r.state;
}

const located = apply(created.state, setTripLocation(nyc));
const twoCities = apply(located, setDayLocation('2027-04-02', boston));

function Harness({
  initial,
  onDispatch,
  onSetLocation,
}: {
  initial: TripState;
  onDispatch?: (c: Command) => void;
  onSetLocation?: () => void;
}) {
  const [state, setState] = useState(initial);
  const dispatch = (command: Command) => {
    onDispatch?.(command);
    const r = command(state);
    if (r.ok) setState(r.state);
    return r;
  };
  return (
    <PopularTab state={state} dispatch={dispatch} onSetLocation={onSetLocation ?? (() => {})} />
  );
}

function setup(
  initial: TripState,
  places: PlaceSearch = fakePlaceSearch(),
  extra: { onDispatch?: (c: Command) => void; onSetLocation?: () => void } = {},
) {
  render(<Harness initial={initial} {...extra} />, { wrapper: withPlaces(places) });
  return userEvent.setup();
}

describe('PopularTab', () => {
  it('shows both groups with name, kind, address and rating for each card', async () => {
    setup(located);
    expect(await screen.findByRole('heading', { name: 'Things to do' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Food' })).toBeVisible();
    const met = screen.getByText('The Metropolitan Museum of Art').closest('li')!;
    expect(within(met).getByText('Museum · 1000 5th Ave, New York')).toBeVisible();
    expect(within(met).getByText('4.8 (104,512 reviews)')).toBeVisible();
    expect(screen.getByText("Katz's Delicatessen")).toBeVisible();
    expect(screen.getByText(/Popular on Google · \d{1,2}:\d{2}/)).toBeVisible();
  });

  it('asks for a trip location when there is none and offers to set it', async () => {
    const onSetLocation = vi.fn();
    const places = fakePlaceSearch();
    const user = setup(created.state, places, { onSetLocation });
    expect(screen.getByText('Set where this trip is to see popular places')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Set trip location' }));
    expect(onSetLocation).toHaveBeenCalledTimes(1);
    expect(places.popular).not.toHaveBeenCalled();
  });

  it('says so when popular places are unavailable', async () => {
    setup(located, fakePlaceSearch({ popularFail: true }));
    expect(await screen.findByText('Popular places unavailable right now')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Things to do' })).toBeNull();
  });

  it('says so when nothing was found', async () => {
    setup(
      located,
      fakePlaceSearch({
        popular: (city) => ({ city, todo: [], food: [], fetchedAt: '2027-03-01T10:42:00Z' }),
      }),
    );
    expect(await screen.findByText('No popular places found')).toBeVisible();
  });

  it('shows a loading note while the request is pending', () => {
    const places = fakePlaceSearch();
    places.popular.mockReturnValue(new Promise(() => {}));
    setup(located, places);
    expect(screen.getByText('Loading popular places…')).toBeVisible();
  });

  it('shows no city selector for one city', async () => {
    setup(located);
    await screen.findByRole('heading', { name: 'Food' });
    expect(screen.queryByRole('combobox', { name: 'City' })).toBeNull();
  });

  it('switches between the trip cities and requests the new one', async () => {
    const places = fakePlaceSearch();
    const user = setup(twoCities, places);
    const select = await screen.findByRole('combobox', { name: 'City' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['New York, USA', 'Boston, USA']);
    expect(places.popular).toHaveBeenCalledTimes(1);
    await user.selectOptions(select, 'Boston, USA');
    await waitFor(() => expect(places.popular).toHaveBeenCalledTimes(2));
    expect(places.popular).toHaveBeenLastCalledWith(boston);
  });

  it('offers Place in a block, Add to my list and Open in maps in the card menu', async () => {
    const user = setup(located);
    await screen.findByText('The Metropolitan Museum of Art');
    await user.click(
      screen.getByRole('button', { name: 'Actions for The Metropolitan Museum of Art' }),
    );
    expect(screen.getByRole('menuitem', { name: 'Place in a block' })).toBeVisible();
    expect(screen.getByRole('menuitem', { name: 'Add to my list' })).toBeVisible();
    expect(screen.getByText('Open in maps')).toBeVisible();
  });

  it('adds a linked item to the list from the menu (Food for the food group)', async () => {
    const dispatched: Command[] = [];
    const user = setup(located, undefined, { onDispatch: (c) => dispatched.push(c) });
    await screen.findByText("Katz's Delicatessen");
    await user.click(screen.getByRole('button', { name: "Actions for Katz's Delicatessen" }));
    await user.click(screen.getByRole('menuitem', { name: 'Add to my list' }));
    expect(dispatched).toHaveLength(1);
    const r = dispatched[0](located);
    expect(r.ok && r.state.items).toEqual([
      expect.objectContaining({
        name: "Katz's Delicatessen",
        type: 'food',
        placeId: popularToPlace(katzPopular).id,
        placeName: "Katz's Delicatessen",
      }),
    ]);
  });

  it('adds things to do as Activity items', async () => {
    const dispatched: Command[] = [];
    const user = setup(located, undefined, { onDispatch: (c) => dispatched.push(c) });
    await screen.findByText(metPopular.name);
    await user.click(screen.getByRole('button', { name: `Actions for ${metPopular.name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Add to my list' }));
    const r = dispatched[0](located);
    expect(r.ok && r.state.items[0]).toMatchObject({ type: 'activity', placeId: 'test-met' });
  });

  it('places a card in a chosen block as an event, leaving the list alone', async () => {
    const dispatched: Command[] = [];
    const user = setup(located, undefined, { onDispatch: (c) => dispatched.push(c) });
    await screen.findByText(metPopular.name);
    await user.click(screen.getByRole('button', { name: `Actions for ${metPopular.name}` }));
    await user.click(screen.getByRole('menuitem', { name: 'Place in a block' }));
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(dispatched).toHaveLength(1);
    const r = dispatched[0](located);
    expect(r.ok && r.state.items).toEqual([]);
    expect(r.ok && r.state.placements).toEqual([
      expect.objectContaining({ name: metPopular.name, type: 'activity', sourceItemId: null }),
    ]);
  });

  it('has a drag handle for every card', async () => {
    setup(located);
    expect(
      await screen.findByRole('button', { name: `Drag ${metPopular.name}` }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Drag ${katzPopular.name}` })).toBeInTheDocument();
  });

  describe('placed state', () => {
    const metPlaced = apply(
      located,
      placePlace(popularToPlace(metPopular), 'activity', '2027-04-01', located.blocks[0].id),
    );
    const katzListed = apply(
      located,
      addItem(katzPopular.name, 'food', null, null, popularToPlace(katzPopular)),
    );
    const nameOf = (name: string) => screen.getByText(name, { selector: 'span' });

    it('strikes through a card whose place is on the schedule, with hidden text', async () => {
      setup(metPlaced);
      await screen.findByText(katzPopular.name);
      const met = screen.getByText(metPopular.name).closest('li')!;
      expect(met).toHaveTextContent(`${metPopular.name}, placed`);
      expect(nameOf(metPopular.name).className).toMatch(/placed/);
      const katz = screen.getByText(katzPopular.name).closest('li')!;
      expect(katz).not.toHaveTextContent('placed');
      expect(nameOf(katzPopular.name).className).not.toMatch(/placed/);
    });

    it('also strikes through a card whose place is in the list', async () => {
      setup(katzListed);
      await screen.findByText(katzPopular.name);
      expect(screen.getByText(katzPopular.name).closest('li')).toHaveTextContent(
        `${katzPopular.name}, placed`,
      );
    });

    it('shows no count and keeps the drag handle and menu on a struck-through card', async () => {
      const user = setup(metPlaced);
      await screen.findByText(metPopular.name);
      expect(screen.queryByText(/placed \d+×/)).toBeNull();
      expect(screen.getByRole('button', { name: `Drag ${metPopular.name}` })).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: `Actions for ${metPopular.name}` }));
      expect(screen.getByRole('menuitem', { name: 'Place in a block' })).toBeVisible();
    });
  });
});
