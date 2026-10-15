import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Location, WeatherService } from '@cellar/core';
import { LocationPicker } from '../src/components/weather/LocationPicker';

const places: Location[] = [
  { name: 'Kyoto, Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' },
  { name: 'Kyotanabe, Kyoto, Japan', lat: 34.81, lon: 135.77, tz: 'Asia/Tokyo' },
];

function setup(results: Location[] | Error = places) {
  const search = vi.fn<WeatherService['searchLocations']>(async () => {
    if (results instanceof Error) throw results;
    return results;
  });
  const service: WeatherService = {
    forecast: async () => {
      throw new Error('unused');
    },
    searchLocations: search,
  };
  const onSelect = vi.fn();
  const user = userEvent.setup();
  render(<LocationPicker service={service} onSelect={onSelect} />);
  return { user, search, onSelect, input: screen.getByRole('combobox') };
}

describe('LocationPicker', () => {
  it('does not search under 2 characters', async () => {
    const { user, search, input } = setup();
    await user.type(input, 'K');
    await new Promise((r) => setTimeout(r, 400));
    expect(search).not.toHaveBeenCalled();
  });

  it('debounces the search by 300 ms and passes the language', async () => {
    const { user, search, input } = setup();
    await user.type(input, 'Kyo');
    expect(search).not.toHaveBeenCalled();
    await screen.findAllByRole('option');
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith('Kyo', expect.any(String));
  });

  it('shows up to 5 options with full names and exposes combobox roles', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ ...places[0], name: `Place ${i}` }));
    const { user, input } = setup(six);
    await user.type(input, 'Pla');
    const options = await screen.findAllByRole('option');
    expect(options).toHaveLength(5);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
  });

  it('ArrowDown then Enter selects an option', async () => {
    const { user, onSelect, input } = setup();
    await user.type(input, 'Kyo');
    await screen.findAllByRole('option');
    await user.keyboard('{ArrowDown}');
    const first = screen.getAllByRole('option')[0];
    expect(first).toHaveTextContent('Kyoto, Kyoto, Japan');
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(places[1]);
  });

  it('clicking an option selects it', async () => {
    const { user, onSelect, input } = setup();
    await user.type(input, 'Kyo');
    await user.click(await screen.findByRole('option', { name: 'Kyoto, Kyoto, Japan' }));
    expect(onSelect).toHaveBeenCalledWith(places[0]);
  });

  it('Escape closes the list', async () => {
    const { user, input } = setup();
    await user.type(input, 'Kyo');
    await screen.findAllByRole('option');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows "No matching place found" and selects nothing for an empty result', async () => {
    const { user, onSelect, input } = setup([]);
    await user.type(input, 'zzzxqq');
    expect(await screen.findByText('No matching place found')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows an error message when the search fails', async () => {
    const { user, input } = setup(new Error('down'));
    await user.type(input, 'Kyo');
    expect(await screen.findByText("Couldn't search places right now")).toBeInTheDocument();
  });
});
