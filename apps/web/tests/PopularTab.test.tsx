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
  type WeatherService,
} from '@cellar/core';
import { PopularTab } from '../src/components/list/PopularTab';
import { katzPopular, metPopular, fakePlaceSearch, withServices } from './setup';

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

const kyoto: Location = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };
const fakeWeather: WeatherService = {
  forecast: async () => {
    throw new Error('unused');
  },
  searchLocations: vi.fn(async () => [kyoto]),
};

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
  render(<Harness initial={initial} {...extra} />, {
    wrapper: withServices({ places, weather: fakeWeather }),
  });
  return userEvent.setup();
}

describe('PopularTab', () => {
  it('shows Things to do and Food as sub-tabs, Things to do first', async () => {
    const user = setup(located);
    const tablist = await screen.findByRole('tablist', { name: 'Popular groups' });
    const todoTab = within(tablist).getByRole('tab', { name: 'Things to do' });
    const foodTab = within(tablist).getByRole('tab', { name: 'Food' });
    expect(todoTab).toHaveAttribute('aria-selected', 'true');
    expect(foodTab).toHaveAttribute('aria-selected', 'false');

    const met = (await screen.findByText('The Metropolitan Museum of Art')).closest('li')!;
    expect(within(met).getByText('Museum · 1000 5th Ave, New York')).toBeVisible();
    expect(within(met).getByText('4.8 (104,512 reviews)')).toBeVisible();
    expect(screen.queryByText("Katz's Delicatessen")).toBeNull();
    expect(screen.getByText(/Popular on Google · \d{1,2}:\d{2}/)).toBeVisible();

    await user.click(foodTab);
    expect(foodTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText("Katz's Delicatessen")).toBeVisible();
    expect(screen.queryByText('The Metropolitan Museum of Art')).toBeNull();
  });

  it('switches sub-tabs with the arrow keys', async () => {
    const user = setup(located);
    const todoTab = await screen.findByRole('tab', { name: 'Things to do' });
    todoTab.focus();
    await user.keyboard('{ArrowRight}');
    const foodTab = screen.getByRole('tab', { name: 'Food' });
    expect(foodTab).toHaveFocus();
    expect(foodTab).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(todoTab).toHaveAttribute('aria-selected', 'true');
  });

  it('without a trip location, offers a city search and setting the trip location', async () => {
    const onSetLocation = vi.fn();
    const places = fakePlaceSearch();
    const user = setup(created.state, places, { onSetLocation });
    expect(
      screen.getByText('Search for a city, or set where this trip is, to see popular places'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Set trip location' }));
    expect(onSetLocation).toHaveBeenCalledTimes(1);
    expect(places.popular).not.toHaveBeenCalled();

    await user.type(screen.getByRole('combobox', { name: 'Search for a city' }), 'Kyo');
    await user.click(await screen.findByRole('option', { name: 'Kyoto, Japan' }));
    await waitFor(() => expect(places.popular).toHaveBeenCalledWith(kyoto));
  });

  it('shows the current city and searches any other city', async () => {
    const places = fakePlaceSearch();
    const user = setup(located, places);
    expect(await screen.findByText('New York, USA')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Change city' }));
    await user.type(screen.getByRole('combobox', { name: 'Search for a city' }), 'Kyo');
    await user.click(await screen.findByRole('option', { name: 'Kyoto, Japan' }));
    await waitFor(() => expect(places.popular).toHaveBeenLastCalledWith(kyoto));
    expect(screen.getByText('Kyoto, Japan')).toBeVisible();
    expect(screen.queryByRole('combobox', { name: 'Search for a city' })).toBeNull();
  });

  it('can cancel a city change', async () => {
    const user = setup(located);
    await user.click(await screen.findByRole('button', { name: 'Change city' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('combobox', { name: 'Search for a city' })).toBeNull();
    expect(screen.getByText('New York, USA')).toBeVisible();
  });

  it('says so when popular places are unavailable', async () => {
    setup(located, fakePlaceSearch({ popularFail: true }));
    expect(await screen.findByText('Popular places unavailable right now')).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Things to do' })).toBeNull();
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

  it('shows no trip-city quick picks when the trip has one city', async () => {
    const user = setup(located);
    await user.click(await screen.findByRole('button', { name: 'Change city' }));
    expect(screen.queryByRole('group', { name: 'Trip cities' })).toBeNull();
  });

  it("offers the trip's other cities as quick picks while changing city", async () => {
    const places = fakePlaceSearch();
    const user = setup(twoCities, places);
    await user.click(await screen.findByRole('button', { name: 'Change city' }));
    const picks = screen.getByRole('group', { name: 'Trip cities' });
    expect(
      within(picks)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Boston, USA']);
    expect(places.popular).toHaveBeenCalledTimes(1);
    await user.click(within(picks).getByRole('button', { name: 'Boston, USA' }));
    await waitFor(() => expect(places.popular).toHaveBeenLastCalledWith(boston));
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
    await user.click(await screen.findByRole('tab', { name: 'Food' }));
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
    const user = setup(located);
    expect(
      await screen.findByRole('button', { name: `Drag ${metPopular.name}` }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Food' }));
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
      const user = setup(metPlaced);
      await screen.findByText(metPopular.name);
      const met = screen.getByText(metPopular.name).closest('li')!;
      expect(met).toHaveTextContent(`${metPopular.name}, placed`);
      expect(nameOf(metPopular.name).className).toMatch(/placed/);
      await user.click(screen.getByRole('tab', { name: 'Food' }));
      const katz = screen.getByText(katzPopular.name).closest('li')!;
      expect(katz).not.toHaveTextContent('placed');
      expect(nameOf(katzPopular.name).className).not.toMatch(/placed/);
    });

    it('also strikes through a card whose place is in the list', async () => {
      const user = setup(katzListed);
      await user.click(await screen.findByRole('tab', { name: 'Food' }));
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
