import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaceSuggestion } from '@cellar/core';
import { usePlaceSuggestions } from '../src/state/usePlaceSuggestions';
import { chelseaPlace, chelseaSuggestion, fakePlaceSearch, withPlaces } from './setup';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const near = { lat: 40.74, lon: -74 };

function setup(search = fakePlaceSearch({ suggestions: [chelseaSuggestion] })) {
  const hook = renderHook(
    ({ text, quiet }: { text: string; quiet?: string | null }) =>
      usePlaceSuggestions(text, near, { quiet }),
    {
      initialProps: { text: '' } as { text: string; quiet?: string | null },
      wrapper: withPlaces(search),
    },
  );
  return { search, ...hook };
}

const settle = (ms = 300) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('usePlaceSuggestions', () => {
  it('does not search under 3 characters', async () => {
    const { search, rerender, result } = setup();
    rerender({ text: 'ch' });
    await settle(1000);
    expect(search.suggest).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.suggestions).toEqual([]);
  });

  it('searches once, 300 ms after the last keystroke', async () => {
    const { search, rerender, result } = setup();
    rerender({ text: 'che' });
    await settle(200);
    rerender({ text: 'chel' });
    await settle(200);
    expect(search.suggest).not.toHaveBeenCalled();
    await settle(100);
    expect(search.suggest).toHaveBeenCalledTimes(1);
    expect(search.suggest.mock.calls[0][0]).toBe('chel');
    expect(search.suggest.mock.calls[0][1]).toMatchObject({ near });
    expect(result.current.status).toBe('ready');
    expect(result.current.suggestions).toEqual([chelseaSuggestion]);
  });

  it('does not search for the quiet text', async () => {
    const { search, rerender } = setup();
    rerender({ text: 'Chelsea Market', quiet: 'Chelsea Market' });
    await settle(1000);
    expect(search.suggest).not.toHaveBeenCalled();
  });

  it('ignores a stale response from an earlier input', async () => {
    const slow = new Promise<PlaceSuggestion[]>((resolve) =>
      setTimeout(() => resolve([{ ...chelseaSuggestion, name: 'Stale' }]), 500),
    );
    const search = fakePlaceSearch({ suggestions: [chelseaSuggestion] });
    search.suggest.mockImplementationOnce(() => slow);
    const { rerender, result } = setup(search);
    rerender({ text: 'che' });
    await settle(300);
    rerender({ text: 'chelsea' });
    await settle(300);
    await settle(500);
    expect(result.current.suggestions.map((s) => s.name)).toEqual(['Chelsea Market']);
  });

  it('reuses the session token until pick resolves, then makes a new one', async () => {
    const { search, rerender, result } = setup();
    rerender({ text: 'che' });
    await settle();
    rerender({ text: 'chel' });
    await settle();
    const [first, second] = search.suggest.mock.calls.map((c) => c[1].sessionToken);
    expect(first).toBeTruthy();
    expect(second).toBe(first);

    let place;
    await act(async () => {
      place = await result.current.pick(chelseaSuggestion);
    });
    expect(place).toEqual(chelseaPlace);
    expect(search.details).toHaveBeenCalledWith(chelseaSuggestion, first);

    rerender({ text: 'chels' });
    await settle();
    expect(search.suggest.mock.calls[2][1].sessionToken).not.toBe(first);
  });

  it('sets unavailable and clears suggestions when suggest rejects', async () => {
    const { rerender, result } = setup(fakePlaceSearch({ fail: true }));
    rerender({ text: 'chel' });
    await settle();
    expect(result.current.status).toBe('unavailable');
    expect(result.current.suggestions).toEqual([]);
  });

  it('stays idle without any place search service', async () => {
    const { result, rerender } = renderHook(({ text }) => usePlaceSuggestions(text, null), {
      initialProps: { text: '' },
    });
    rerender({ text: 'chelsea' });
    await settle(1000);
    expect(result.current.status).toBe('idle');
  });
});
