import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Location } from '@cellar/core';
import { usePopularPlaces } from '../src/state/usePopularPlaces';
import { defaultPopular, fakePlaceSearch, withPlaces } from './setup';

const nyc: Location = { name: 'New York, USA', lat: 40.7128, lon: -74.006, tz: 'America/New_York' };
const boston: Location = {
  name: 'Boston, USA',
  lat: 42.3601,
  lon: -71.0589,
  tz: 'America/New_York',
};

describe('usePopularPlaces', () => {
  it('stays idle and makes no request without a city', () => {
    const places = fakePlaceSearch();
    const { result } = renderHook(() => usePopularPlaces(null), { wrapper: withPlaces(places) });
    expect(result.current).toEqual({ list: null, status: 'idle' });
    expect(places.popular).not.toHaveBeenCalled();
  });

  it('loads, then is ready with the list', async () => {
    const places = fakePlaceSearch();
    const { result } = renderHook(() => usePopularPlaces(nyc), { wrapper: withPlaces(places) });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.list).toEqual(defaultPopular(nyc));
    expect(places.popular).toHaveBeenCalledTimes(1);
    expect(places.popular).toHaveBeenCalledWith(nyc);
  });

  it('does not ask again for the same city, even after a remount', async () => {
    const places = fakePlaceSearch();
    const wrapper = withPlaces(places);
    const first = renderHook(() => usePopularPlaces(nyc), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.rerender();
    first.unmount();
    const second = renderHook(() => usePopularPlaces({ ...nyc }), { wrapper });
    expect(second.result.current.status).toBe('ready');
    expect(second.result.current.list).toEqual(defaultPopular(nyc));
    expect(places.popular).toHaveBeenCalledTimes(1);
  });

  it('asks again when the city changes, and keeps both lists', async () => {
    const places = fakePlaceSearch();
    const { result, rerender } = renderHook(({ city }) => usePopularPlaces(city), {
      initialProps: { city: nyc },
      wrapper: withPlaces(places),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ city: boston });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.list?.city).toEqual(boston);
    expect(places.popular).toHaveBeenCalledTimes(2);
    rerender({ city: nyc });
    expect(result.current.status).toBe('ready');
    expect(places.popular).toHaveBeenCalledTimes(2);
  });

  it('is unavailable when the request fails, and tries again on the next visit', async () => {
    const places = fakePlaceSearch({ popularFail: true });
    const wrapper = withPlaces(places);
    const first = renderHook(() => usePopularPlaces(nyc), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe('unavailable'));
    expect(first.result.current.list).toBeNull();
    first.unmount();
    const second = renderHook(() => usePopularPlaces(nyc), { wrapper });
    await waitFor(() => expect(second.result.current.status).toBe('unavailable'));
    expect(places.popular).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale response after the city changed', async () => {
    let resolveNyc: (() => void) | undefined;
    const places = fakePlaceSearch();
    places.popular.mockImplementation((city: Location) =>
      city.name === nyc.name
        ? new Promise((resolve) => {
            resolveNyc = () => resolve(defaultPopular(city));
          })
        : Promise.resolve(defaultPopular(city)),
    );
    const { result, rerender } = renderHook(({ city }) => usePopularPlaces(city), {
      initialProps: { city: nyc },
      wrapper: withPlaces(places),
    });
    rerender({ city: boston });
    await waitFor(() => expect(result.current.list?.city).toEqual(boston));
    resolveNyc?.();
    await Promise.resolve();
    expect(result.current.list?.city).toEqual(boston);
  });
});
