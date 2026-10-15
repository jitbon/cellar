import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabasePlaceSearch } from '../src/adapters/supabasePlaceSearch';

const suggestion = {
  placeId: 'test-chelsea',
  name: 'Chelsea Market',
  address: '9th Avenue, New York, NY, USA',
  types: ['market', 'point_of_interest'],
};

function clientWith(result: { data: unknown; error: unknown }) {
  const invoke = vi.fn().mockResolvedValue(result);
  return { client: { functions: { invoke } } as unknown as SupabaseClient, invoke };
}

describe('suggest', () => {
  it('invokes the places function and returns its suggestions', async () => {
    const { client, invoke } = clientWith({ data: { suggestions: [suggestion] }, error: null });
    const near = { lat: 40.74, lon: -74 };
    const result = await new SupabasePlaceSearch(client).suggest('chel', {
      sessionToken: 'tok',
      near,
    });
    expect(invoke).toHaveBeenCalledWith('places', {
      body: { action: 'suggest', input: 'chel', sessionToken: 'tok', near },
    });
    expect(result).toEqual([suggestion]);
  });

  it('rejects when the invoke fails', async () => {
    const { client } = clientWith({ data: null, error: new Error('503') });
    await expect(
      new SupabasePlaceSearch(client).suggest('chel', { sessionToken: 'tok', near: null }),
    ).rejects.toThrow();
  });
});

describe('details', () => {
  it('invokes details and builds a Place from the function result and the suggestion', async () => {
    const { client, invoke } = clientWith({
      data: {
        place: { id: 'test-chelsea', lat: 40.7424, lon: -74.0061, address: '75 9th Ave, New York' },
      },
      error: null,
    });
    const place = await new SupabasePlaceSearch(client).details(suggestion, 'tok');
    expect(invoke).toHaveBeenCalledWith('places', {
      body: { action: 'details', placeId: 'test-chelsea', sessionToken: 'tok' },
    });
    expect(place).toEqual({
      id: 'test-chelsea',
      provider: 'google',
      name: 'Chelsea Market',
      address: '75 9th Ave, New York',
      lat: 40.7424,
      lon: -74.0061,
      category: 'market',
    });
  });

  it('uses a null category when the suggestion has no types', async () => {
    const { client } = clientWith({
      data: { place: { id: 'x', lat: 1, lon: 2, address: '' } },
      error: null,
    });
    const place = await new SupabasePlaceSearch(client).details(
      { ...suggestion, placeId: 'x', types: [] },
      'tok',
    );
    expect(place.category).toBeNull();
  });

  it('rejects when the invoke fails', async () => {
    const { client } = clientWith({ data: null, error: new Error('503') });
    await expect(new SupabasePlaceSearch(client).details(suggestion, 'tok')).rejects.toThrow();
  });
});
