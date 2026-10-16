import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  createTrip,
  type Command,
  type PlaceSearch,
  type PlaceSuggestion,
  type Result,
  type TripState,
} from '@cellar/core';
import { QuickAddLine } from '../src/components/list/QuickAddLine';
import { chelseaPlace, chelseaSuggestion, fakePlaceSearch, withPlaces } from './setup';

const created = createTrip('u', 'Tokyo', '2027-04-01', '2027-04-03');
if (!created.ok) throw new Error('fixture');
const state: TripState = created.state;

const tacos: PlaceSuggestion = {
  placeId: 'test-tacos',
  name: 'Los Tacos No. 1',
  address: '9th Avenue, New York, NY, USA',
  types: ['mexican_restaurant', 'restaurant'],
};

function setup(places: PlaceSearch = fakePlaceSearch()) {
  const commands: Command[] = [];
  const dispatch = vi.fn((c: Command): Result => {
    commands.push(c);
    return c(state);
  });
  const onFilter = vi.fn();
  render(<QuickAddLine near={{ lat: 40.74, lon: -74 }} dispatch={dispatch} onFilter={onFilter} />, {
    wrapper: withPlaces(places),
  });
  const input = screen.getByRole('combobox', { name: 'Add or filter items' });
  return { input, commands, dispatch, onFilter, user: userEvent.setup() };
}

const itemsAfter = (command: Command) => {
  const r = command(state);
  return r.ok ? r.state.items : [];
};

describe('QuickAddLine', () => {
  it('is labelled "Add or filter items" with an "Add an item…" placeholder', () => {
    const { input } = setup();
    expect(input).toHaveAttribute('placeholder', 'Add an item…');
  });

  it('reports every change of the text so the list can narrow', async () => {
    const { input, user, onFilter } = setup();
    await user.type(input, 'ram');
    expect(onFilter.mock.calls.map((c) => c[0])).toEqual(['r', 'ra', 'ram']);
  });

  it('adds a plain Activity on Enter, then clears, resets the filter and keeps focus', async () => {
    const { input, user, commands, onFilter } = setup();
    await user.type(input, '  Rest day ');
    await user.keyboard('{Enter}');
    expect(commands).toHaveLength(1);
    expect(itemsAfter(commands[0])).toEqual([
      expect.objectContaining({ name: 'Rest day', type: 'activity', placeId: null }),
    ]);
    expect(input).toHaveValue('');
    expect(onFilter).toHaveBeenLastCalledWith('');
    expect(input).toHaveFocus();
  });

  it('does nothing on Enter when empty or only spaces', async () => {
    const { input, user, dispatch } = setup();
    await user.click(input);
    await user.keyboard('{Enter}');
    await user.type(input, '   ');
    await user.keyboard('{Enter}');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('shows place suggestions and adds a linked item when one is picked', async () => {
    const { input, user, commands, onFilter } = setup(
      fakePlaceSearch({ suggestions: [chelseaSuggestion] }),
    );
    await user.type(input, 'Chelsea Mar');
    await user.click(await screen.findByRole('option', { name: /Chelsea Market/ }));
    await waitFor(() => expect(commands).toHaveLength(1));
    expect(itemsAfter(commands[0])).toEqual([
      expect.objectContaining({
        name: 'Chelsea Market',
        type: 'activity',
        placeId: chelseaPlace.id,
        placeAddress: chelseaPlace.address,
      }),
    ]);
    await waitFor(() => expect(input).toHaveValue(''));
    expect(onFilter).toHaveBeenLastCalledWith('');
    expect(input).toHaveFocus();
  });

  it('adds a Food item when the picked place is a food place', async () => {
    const { input, user, commands } = setup(
      fakePlaceSearch({
        suggestions: [tacos],
        place: { ...chelseaPlace, id: 'test-tacos', name: tacos.name },
      }),
    );
    await user.type(input, 'taco');
    await user.click(await screen.findByRole('option', { name: /Los Tacos/ }));
    await waitFor(() => expect(commands).toHaveLength(1));
    expect(itemsAfter(commands[0])[0]).toMatchObject({ name: tacos.name, type: 'food' });
  });

  it('ArrowDown then Enter picks the suggestion instead of adding plain text', async () => {
    const { input, user, commands } = setup(fakePlaceSearch({ suggestions: [chelseaSuggestion] }));
    await user.type(input, 'Chelsea Mar');
    await screen.findByRole('option', { name: /Chelsea Market/ });
    await user.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(commands).toHaveLength(1));
    expect(itemsAfter(commands[0])[0]).toMatchObject({ name: 'Chelsea Market' });
  });

  it('Enter ignores suggestions that were not chosen and adds the typed text', async () => {
    const { input, user, commands } = setup(fakePlaceSearch({ suggestions: [chelseaSuggestion] }));
    await user.type(input, 'Chelsea Mar');
    await screen.findByRole('option', { name: /Chelsea Market/ });
    await user.keyboard('{Enter}');
    expect(commands).toHaveLength(1);
    expect(itemsAfter(commands[0])[0]).toMatchObject({ name: 'Chelsea Mar', placeId: null });
  });

  it('Escape closes the suggestions and keeps the text', async () => {
    const { input, user } = setup(fakePlaceSearch({ suggestions: [chelseaSuggestion] }));
    await user.type(input, 'Chelsea Mar');
    await screen.findByRole('option', { name: /Chelsea Market/ });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option')).toBeNull();
    expect(input).toHaveValue('Chelsea Mar');
  });

  it('still adds plain text when place search is unavailable', async () => {
    const { input, user, commands } = setup(fakePlaceSearch({ fail: true }));
    await user.type(input, 'Sushi');
    expect(await screen.findByText('Place search unavailable')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(itemsAfter(commands[0])[0]).toMatchObject({ name: 'Sushi' });
  });

  it('shows the validation message and keeps the text when the item is rejected', async () => {
    const { input, user, commands } = setup();
    await user.click(input);
    await user.paste('x'.repeat(201));
    await user.keyboard('{Enter}');
    expect(commands).toHaveLength(1);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(input).toHaveValue('x'.repeat(201));
  });
});
