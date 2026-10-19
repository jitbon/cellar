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

const nyc = { name: 'New York, USA', lat: 40.7128, lon: -74.006, tz: 'America/New_York' };

const photoRef = { name: 'places/met/photos/p1', author: 'Ann Lee', authorUri: 'https://x.test/1' };

const popularPlace = (
  placeId: string,
  types: string[],
  name = `Place ${placeId}`,
  photo: unknown = null,
) => ({
  placeId,
  name,
  kind: 'Place',
  address: '1 Main St',
  lat: 40.7,
  lon: -74,
  types,
  rating: 4.5,
  ratingCount: 100,
  photo,
});

describe('popular', () => {
  function popularClient(todo: unknown[], food: unknown[], fail = false) {
    const invoke = vi.fn(async (_name: string, opts: { body: { group: string } }) =>
      fail
        ? { data: null, error: new Error('503') }
        : { data: { places: opts.body.group === 'todo' ? todo : food }, error: null },
    );
    return { client: { functions: { invoke } } as unknown as SupabaseClient, invoke };
  }

  it('requests both groups with only the city name and location', async () => {
    const met = popularPlace('met', ['museum']);
    const katz = popularPlace('katz', ['deli', 'restaurant']);
    const { client, invoke } = popularClient([met], [katz]);
    const list = await new SupabasePlaceSearch(client).popular(nyc);
    expect(invoke).toHaveBeenCalledTimes(2);
    for (const group of ['todo', 'food']) {
      expect(invoke).toHaveBeenCalledWith('places', {
        body: {
          action: 'popular',
          city: 'New York, USA',
          near: { lat: 40.7128, lon: -74.006 },
          group,
        },
      });
    }
    expect(list).toMatchObject({ city: nyc, todo: [met], food: [katz] });
    expect(Number.isNaN(Date.parse(list.fetchedAt))).toBe(false);
  });

  it('keeps a place returned by both groups once, in food when it is a food place', async () => {
    const both = popularPlace('both', ['restaurant', 'tourist_attraction']);
    const { client } = popularClient([both, popularPlace('met', ['museum'])], [both]);
    const list = await new SupabasePlaceSearch(client).popular(nyc);
    expect(list.food.map((p) => p.placeId)).toEqual(['both']);
    expect(list.todo.map((p) => p.placeId)).toEqual(['met']);
  });

  it('keeps a shared non-food place in things to do', async () => {
    const park = popularPlace('park', ['park', 'tourist_attraction']);
    const { client } = popularClient([park], [park, popularPlace('katz', ['restaurant'])]);
    const list = await new SupabasePlaceSearch(client).popular(nyc);
    expect(list.todo.map((p) => p.placeId)).toEqual(['park']);
    expect(list.food.map((p) => p.placeId)).toEqual(['katz']);
  });

  it('rejects when either call errors', async () => {
    const { client } = popularClient([], [], true);
    await expect(new SupabasePlaceSearch(client).popular(nyc)).rejects.toThrow();
  });

  it('passes each place photo through, and uses null when the function sent none', async () => {
    const withPhoto = popularPlace('met', ['museum'], 'Met', photoRef);
    const legacy: Record<string, unknown> = popularPlace('katz', ['deli', 'restaurant']);
    delete legacy.photo;
    const { client } = popularClient([withPhoto], [legacy]);
    const list = await new SupabasePlaceSearch(client).popular(nyc);
    expect(list.todo[0]!.photo).toEqual(photoRef);
    expect(list.food[0]!.photo).toBeNull();
  });
});

describe('photoUrl', () => {
  it('invokes the photo action and returns the photo URI', async () => {
    const { client, invoke } = clientWith({
      data: { photoUri: 'https://lh3.test/x' },
      error: null,
    });
    const url = await new SupabasePlaceSearch(client).photoUrl('places/met/photos/p1', 160);
    expect(invoke).toHaveBeenCalledWith('places', {
      body: { action: 'photo', name: 'places/met/photos/p1', maxWidthPx: 160 },
    });
    expect(url).toBe('https://lh3.test/x');
  });

  it('rejects when the invoke fails', async () => {
    const { client } = clientWith({ data: null, error: new Error('503') });
    await expect(
      new SupabasePlaceSearch(client).photoUrl('places/met/photos/p1', 160),
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

describe('info', () => {
  const info = {
    placeId: 'test-chelsea',
    name: 'Chelsea Market',
    kind: 'Market',
    types: ['market'],
    rating: 4.6,
    ratingCount: 31204,
    photo: null,
    hours: null,
    utcOffsetMinutes: -240,
    website: 'https://chelseamarket.com/',
  };

  it('sends only the action and place id and returns the info', async () => {
    const { client, invoke } = clientWith({ data: { info }, error: null });
    const result = await new SupabasePlaceSearch(client).info('test-chelsea');
    expect(invoke).toHaveBeenCalledWith('places', {
      body: { action: 'info', placeId: 'test-chelsea' },
    });
    expect(result).toEqual(info);
  });

  it('rejects with code not-found on a 404', async () => {
    const error = Object.assign(new Error('non-2xx'), { context: { status: 404 } });
    const { client } = clientWith({ data: null, error });
    await expect(new SupabasePlaceSearch(client).info('gone')).rejects.toMatchObject({
      code: 'not-found',
    });
  });

  it('rejects without that code on any other failure', async () => {
    const error = Object.assign(new Error('non-2xx'), { context: { status: 503 } });
    const { client } = clientWith({ data: null, error });
    const rejection = new SupabasePlaceSearch(client).info('p');
    await expect(rejection).rejects.toThrow();
    await expect(rejection).rejects.not.toMatchObject({ code: 'not-found' });
  });
});
