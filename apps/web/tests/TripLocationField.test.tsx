import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Location, WeatherService } from '@cellar/core';
import { TripLocationField } from '../src/components/weather/TripLocationField';

const kyoto: Location = { name: 'Kyoto, Japan', lat: 35.0211, lon: 135.7538, tz: 'Asia/Tokyo' };

function setup(title: string, results: Location[] | Error = [kyoto]) {
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
  const onChange = vi.fn();
  function Harness() {
    const [value, setValue] = useState<Location | null>(null);
    return (
      <TripLocationField
        title={title}
        service={service}
        value={value}
        onChange={(loc) => {
          onChange(loc);
          setValue(loc);
        }}
      />
    );
  }
  render(<Harness />);
  return { user: userEvent.setup(), search, onChange };
}

describe('TripLocationField', () => {
  it('suggests a location from the trip title', async () => {
    const { user, search, onChange } = setup('Kyoto Spring Break 2028');
    const suggestion = await screen.findByRole('button', { name: 'Use Kyoto, Japan' });
    expect(search).toHaveBeenCalledWith('Kyoto', expect.any(String));
    await user.click(suggestion);
    expect(onChange).toHaveBeenCalledWith(kyoto);
    expect(screen.getByText('Kyoto, Japan')).toBeInTheDocument();
  });

  it('does not search when the title has nothing place-like', async () => {
    const { search } = setup('2027 trip');
    await new Promise((r) => setTimeout(r, 600));
    expect(search).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /^Use / })).not.toBeInTheDocument();
  });

  it('stays quiet when the title search fails', async () => {
    const { search } = setup('Kyoto', new Error('offline'));
    await vi.waitFor(() => expect(search).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /^Use / })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('offers an optional location search', () => {
    setup('');
    expect(screen.getByRole('combobox', { name: 'Location (optional)' })).toBeInTheDocument();
  });

  it('can change a chosen location', async () => {
    const { user, onChange } = setup('Kyoto');
    await user.click(await screen.findByRole('button', { name: 'Use Kyoto, Japan' }));
    await user.click(screen.getByRole('button', { name: 'Change location' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole('combobox', { name: 'Location (optional)' })).toBeInTheDocument();
  });
});
