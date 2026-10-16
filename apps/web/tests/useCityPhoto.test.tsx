import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCityPhoto } from '../src/state/useCityPhoto';
import { cityPhoto, fakeCityPhotos, withServices } from './setup';

const kyoto = { locationName: 'Kyoto, Japan', coverPhoto: null };

describe('useCityPhoto', () => {
  it('starts loading, then gives the lead photo of the trip city', async () => {
    const cityPhotos = fakeCityPhotos();
    const { result } = renderHook(() => useCityPhoto(kyoto), {
      wrapper: withServices({ cityPhotos }),
    });
    expect(result.current).toEqual({ photo: null, status: 'loading' });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.photo?.file).toBe('Kyoto_A.jpg');
    expect(cityPhotos.lead).toHaveBeenCalledWith('Kyoto, Japan');
    expect(cityPhotos.byFile).not.toHaveBeenCalled();
  });

  it('uses the chosen cover instead of the lead photo', async () => {
    const cityPhotos = fakeCityPhotos();
    const { result } = renderHook(() => useCityPhoto({ ...kyoto, coverPhoto: 'Kyoto_B.jpg' }), {
      wrapper: withServices({ cityPhotos }),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.photo?.file).toBe('Kyoto_B.jpg');
    expect(cityPhotos.lead).not.toHaveBeenCalled();
  });

  it('falls back to the lead photo when the chosen cover is gone', async () => {
    const cityPhotos = fakeCityPhotos({ photos: [cityPhoto('Kyoto_A.jpg')] });
    const { result } = renderHook(() => useCityPhoto({ ...kyoto, coverPhoto: 'Removed.jpg' }), {
      wrapper: withServices({ cityPhotos }),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.photo?.file).toBe('Kyoto_A.jpg');
  });

  it('is none, without asking, when the trip has no location', () => {
    const cityPhotos = fakeCityPhotos();
    const { result } = renderHook(() => useCityPhoto({ locationName: null, coverPhoto: null }), {
      wrapper: withServices({ cityPhotos }),
    });
    expect(result.current).toEqual({ photo: null, status: 'none' });
    expect(cityPhotos.lead).not.toHaveBeenCalled();
  });

  it('is none when the service fails or has no photo', async () => {
    const failing = renderHook(() => useCityPhoto(kyoto), {
      wrapper: withServices({ cityPhotos: fakeCityPhotos({ fail: true }) }),
    });
    await waitFor(() => expect(failing.result.current.status).toBe('none'));
    const empty = renderHook(() => useCityPhoto(kyoto), {
      wrapper: withServices({ cityPhotos: fakeCityPhotos({ photos: [] }) }),
    });
    await waitFor(() => expect(empty.result.current.status).toBe('none'));
    expect(empty.result.current.photo).toBeNull();
  });

  it('is none outside a services provider', () => {
    const { result } = renderHook(() => useCityPhoto(kyoto));
    expect(result.current).toEqual({ photo: null, status: 'none' });
  });

  it('looks again when the city changes', async () => {
    const cityPhotos = fakeCityPhotos();
    const { result, rerender } = renderHook((trip) => useCityPhoto(trip), {
      initialProps: kyoto,
      wrapper: withServices({ cityPhotos }),
    });
    await waitFor(() => expect(result.current.status).toBe('ready'));
    rerender({ locationName: 'Osaka, Japan', coverPhoto: null });
    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(cityPhotos.lead).toHaveBeenLastCalledWith('Osaka, Japan');
  });
});
