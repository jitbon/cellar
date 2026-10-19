import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePlaceInfo } from '../src/state/usePlaceInfo';
import { chelseaInfo, fakePlaceSearch, withPlaces } from './setup';

describe('usePlaceInfo', () => {
  it('stays idle and makes no request without a place id', () => {
    const places = fakePlaceSearch();
    const { result } = renderHook(() => usePlaceInfo(null), { wrapper: withPlaces(places) });
    expect(result.current).toEqual({ status: 'idle' });
    expect(places.info).not.toHaveBeenCalled();
  });

  it('loads, then is ready with the info', async () => {
    const places = fakePlaceSearch();
    const { result } = renderHook(() => usePlaceInfo('test-chelsea'), {
      wrapper: withPlaces(places),
    });
    expect(result.current).toEqual({ status: 'loading' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current).toEqual({ status: 'ready', info: chelseaInfo });
    expect(places.info).toHaveBeenCalledWith('test-chelsea');
  });

  it('does not ask again for the same place, even after a remount (SC-003)', async () => {
    const places = fakePlaceSearch();
    const wrapper = withPlaces(places);
    const first = renderHook(() => usePlaceInfo('test-chelsea'), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe('ready'));
    first.unmount();
    const second = renderHook(() => usePlaceInfo('test-chelsea'), { wrapper });
    expect(second.result.current.status).toBe('ready');
    expect(places.info).toHaveBeenCalledTimes(1);
  });

  it('shares one request between hooks mounted together', async () => {
    const places = fakePlaceSearch();
    const wrapper = withPlaces(places);
    const a = renderHook(() => usePlaceInfo('test-chelsea'), { wrapper });
    const b = renderHook(() => usePlaceInfo('test-chelsea'), { wrapper });
    await waitFor(() => expect(a.result.current.status).toBe('ready'));
    await waitFor(() => expect(b.result.current.status).toBe('ready'));
    expect(places.info).toHaveBeenCalledTimes(1);
  });

  it('is unavailable on failure and retries on a later mount', async () => {
    const places = fakePlaceSearch({ infoFail: true });
    const wrapper = withPlaces(places);
    const first = renderHook(() => usePlaceInfo('test-chelsea'), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe('unavailable'));
    first.unmount();
    const second = renderHook(() => usePlaceInfo('test-chelsea'), { wrapper });
    await waitFor(() => expect(second.result.current.status).toBe('unavailable'));
    expect(places.info).toHaveBeenCalledTimes(2);
  });

  it('is not-found and is not retried in the session', async () => {
    const places = fakePlaceSearch({ infoNotFound: true });
    const wrapper = withPlaces(places);
    const first = renderHook(() => usePlaceInfo('gone'), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe('not-found'));
    first.unmount();
    const second = renderHook(() => usePlaceInfo('gone'), { wrapper });
    expect(second.result.current.status).toBe('not-found');
    expect(places.info).toHaveBeenCalledTimes(1);
  });

  it('asks again when the place changes', async () => {
    const places = fakePlaceSearch();
    const { result, rerender } = renderHook(({ id }) => usePlaceInfo(id), {
      initialProps: { id: 'a' },
      wrapper: withPlaces(places),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ id: 'b' });
    await waitFor(() => expect(places.info).toHaveBeenCalledWith('b'));
    await waitFor(() =>
      expect(result.current).toMatchObject({ status: 'ready', info: { placeId: 'b' } }),
    );
    expect(places.info).toHaveBeenCalledTimes(2);
  });
});
