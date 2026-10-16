import { describe, expect, it, vi } from 'vitest';
import { handlePlaces } from '../functions/places/handler';

const ORIGIN = 'http://localhost:5173';
const env = { key: 'test-key', allowedOrigins: [ORIGIN, 'http://localhost:5199'] };

const post = (body: unknown) =>
  new Request('http://localhost/places', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const prediction = (id: string, main: string, secondary: string, types: string[]) => ({
  placePrediction: {
    placeId: id,
    types,
    structuredFormat: { mainText: { text: main }, secondaryText: { text: secondary } },
  },
});

describe('handlePlaces suggest', () => {
  it('posts a shaped request to Google autocomplete and nothing else from the caller', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ suggestions: [] }));
    const res = await handlePlaces(
      post({
        action: 'suggest',
        input: 'chelsea mar',
        sessionToken: 'tok-1',
        near: { lat: 40.74, lon: -74 },
        trip: 'Secret trip name',
      }),
      env,
      fetchFn,
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(JSON.parse(init.body)).toEqual({
      input: 'chelsea mar',
      sessionToken: 'tok-1',
      locationBias: { circle: { center: { latitude: 40.74, longitude: -74 }, radius: 30000 } },
    });
  });

  it('omits locationBias without near', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ suggestions: [] }));
    await handlePlaces(
      post({ action: 'suggest', input: 'chelsea', sessionToken: 'tok-1' }),
      env,
      fetchFn,
    );
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toEqual({
      input: 'chelsea',
      sessionToken: 'tok-1',
    });
  });

  it('maps place predictions, drops query predictions and caps at 5', async () => {
    const google = {
      suggestions: [
        prediction('p1', 'Chelsea Market', '9th Avenue, New York, NY, USA', ['market']),
        { queryPrediction: { text: { text: 'chelsea market hours' } } },
        ...['p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((id) => prediction(id, id, '', [])),
      ],
    };
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(google));
    const res = await handlePlaces(
      post({ action: 'suggest', input: 'chelsea', sessionToken: 't' }),
      env,
      fetchFn,
    );
    const body = await res.json();
    expect(body.suggestions).toHaveLength(5);
    expect(body.suggestions[0]).toEqual({
      placeId: 'p1',
      name: 'Chelsea Market',
      address: '9th Avenue, New York, NY, USA',
      types: ['market'],
    });
    expect(body.suggestions[1].placeId).toBe('p2');
  });

  it('returns an empty list when Google has no suggestions key', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
    const res = await handlePlaces(
      post({ action: 'suggest', input: 'zzzxqq', sessionToken: 't' }),
      env,
      fetchFn,
    );
    expect(await res.json()).toEqual({ suggestions: [] });
  });
});

describe('handlePlaces details', () => {
  it('GETs the place with a field mask and returns the trimmed place', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        id: 'p1',
        location: { latitude: 40.7424, longitude: -74.0061 },
        shortFormattedAddress: '75 9th Ave, New York',
        displayName: { text: 'ignored' },
      }),
    );
    const res = await handlePlaces(
      post({ action: 'details', placeId: 'p1', sessionToken: 'tok-1' }),
      env,
      fetchFn,
    );
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places/p1?sessionToken=tok-1');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(init.headers['X-Goog-FieldMask']).toBe('id,location,shortFormattedAddress');
    expect(await res.json()).toEqual({
      place: { id: 'p1', lat: 40.7424, lon: -74.0061, address: '75 9th Ave, New York' },
    });
  });

  it('url-encodes the place id and token', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: 'a/b', location: { latitude: 1, longitude: 2 } }));
    await handlePlaces(
      post({ action: 'details', placeId: 'a/b', sessionToken: 'x y' }),
      env,
      fetchFn,
    );
    expect(fetchFn.mock.calls[0][0]).toBe(
      'https://places.googleapis.com/v1/places/a%2Fb?sessionToken=x%20y',
    );
  });
});

describe('handlePlaces errors', () => {
  const bad = async (body: unknown) => {
    const fetchFn = vi.fn();
    const res = await handlePlaces(post(body), env, fetchFn);
    expect(fetchFn).not.toHaveBeenCalled();
    return res;
  };

  it('answers 400 for invalid requests', async () => {
    for (const body of [
      { action: 'suggest', input: 'ab', sessionToken: 't' },
      { action: 'suggest', input: 'x'.repeat(101), sessionToken: 't' },
      { action: 'suggest', input: 'chelsea' },
      { action: 'details', sessionToken: 't' },
      { action: 'delete' },
      'not json',
    ]) {
      const res = await bad(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad_request' });
    }
  });

  it('answers 503 without a key', async () => {
    const fetchFn = vi.fn();
    const res = await handlePlaces(
      post({ action: 'suggest', input: 'chelsea', sessionToken: 't' }),
      {},
      fetchFn,
    );
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'unavailable' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('answers 503 when Google is not 2xx or fetch rejects', async () => {
    const body = { action: 'suggest', input: 'chelsea', sessionToken: 't' };
    const non2xx = await handlePlaces(
      post(body),
      env,
      vi.fn().mockResolvedValue(jsonResponse({}, 429)),
    );
    expect(non2xx.status).toBe(503);
    const rejected = await handlePlaces(post(body), env, vi.fn().mockRejectedValue(new Error('x')));
    expect(rejected.status).toBe(503);
    expect(await rejected.json()).toEqual({ error: 'unavailable' });
  });

  it('answers OPTIONS with 204 and CORS headers for an allowed origin', async () => {
    const res = await handlePlaces(
      new Request('http://localhost/places', { method: 'OPTIONS', headers: { origin: ORIGIN } }),
      env,
      vi.fn(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res.headers.get('vary')).toBe('origin');
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('echoes any origin in the allow-list on normal responses', async () => {
    const res = await handlePlaces(
      new Request('http://localhost/places', {
        method: 'POST',
        headers: { origin: 'http://localhost:5199' },
        body: JSON.stringify({ action: 'nope' }),
      }),
      env,
      vi.fn(),
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5199');
    expect(res.headers.get('vary')).toBe('origin');
  });

  it('omits the allow-origin header for a disallowed or missing origin', async () => {
    const bad = await handlePlaces(
      new Request('http://localhost/places', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      }),
      env,
      vi.fn(),
    );
    expect(bad.headers.get('access-control-allow-origin')).toBeNull();
    expect(bad.headers.get('vary')).toBe('origin');
    const none = await handlePlaces(post({ action: 'nope' }), env, vi.fn());
    expect(none.headers.get('access-control-allow-origin')).toBeNull();
  });
});

const FIELD_MASK =
  'places.id,places.displayName,places.shortFormattedAddress,places.location,places.types,places.primaryType,places.primaryTypeDisplayName,places.rating,places.userRatingCount';

const popularBody = { action: 'popular', city: 'New York, USA', near: { lat: 40.7, lon: -74 } };

const googlePlace = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  displayName: { text: `Place ${id}` },
  shortFormattedAddress: `${id} Main St`,
  location: { latitude: 40.1, longitude: -73.9 },
  types: ['museum'],
  primaryTypeDisplayName: { text: 'Museum' },
  rating: 4.6,
  userRatingCount: 1234,
  ...extra,
});

describe('handlePlaces popular', () => {
  it('posts a shaped text search for things to do and sends nothing else from the caller', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ places: [] }));
    const res = await handlePlaces(
      post({ ...popularBody, group: 'todo', trip: 'Secret trip name' }),
      env,
      fetchFn,
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(init.method).toBe('POST');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(init.headers['X-Goog-FieldMask']).toBe(FIELD_MASK);
    expect(JSON.parse(init.body)).toEqual({
      textQuery: 'top tourist attractions in New York, USA',
      locationBias: { circle: { center: { latitude: 40.7, longitude: -74 }, radius: 15000 } },
      pageSize: 20,
      rankPreference: 'RELEVANCE',
    });
  });

  it('asks for the best restaurants for the food group', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ places: [] }));
    await handlePlaces(post({ ...popularBody, group: 'food' }), env, fetchFn);
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).textQuery).toBe(
      'best restaurants in New York, USA',
    );
  });

  it('maps places, defaulting missing optional fields', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        places: [
          googlePlace('p1'),
          googlePlace('p2', {
            shortFormattedAddress: undefined,
            primaryTypeDisplayName: undefined,
            types: undefined,
            rating: undefined,
            userRatingCount: undefined,
          }),
        ],
      }),
    );
    const res = await handlePlaces(post({ ...popularBody, group: 'todo' }), env, fetchFn);
    expect(await res.json()).toEqual({
      places: [
        {
          placeId: 'p1',
          name: 'Place p1',
          kind: 'Museum',
          address: 'p1 Main St',
          lat: 40.1,
          lon: -73.9,
          types: ['museum'],
          rating: 4.6,
          ratingCount: 1234,
        },
        {
          placeId: 'p2',
          name: 'Place p2',
          kind: '',
          address: '',
          lat: 40.1,
          lon: -73.9,
          types: [],
          rating: null,
          ratingCount: null,
        },
      ],
    });
  });

  it('drops places missing an id, a name or a location and caps at 20', async () => {
    const many = Array.from({ length: 25 }, (_, i) => googlePlace(`m${i}`));
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({
        places: [
          googlePlace('x', { id: undefined }),
          googlePlace('nn', { displayName: undefined }),
          googlePlace('nl', { location: undefined }),
          ...many,
        ],
      }),
    );
    const res = await handlePlaces(post({ ...popularBody, group: 'todo' }), env, fetchFn);
    const body = await res.json();
    expect(body.places).toHaveLength(20);
    expect(body.places[0].placeId).toBe('m0');
  });

  it('returns an empty list when Google has no places key', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
    const res = await handlePlaces(post({ ...popularBody, group: 'food' }), env, fetchFn);
    expect(await res.json()).toEqual({ places: [] });
  });

  it('answers 400 for invalid requests without calling Google', async () => {
    for (const body of [
      { ...popularBody, group: 'todo', city: '' },
      { ...popularBody, group: 'todo', city: 'x'.repeat(121) },
      { ...popularBody, group: 'todo', city: 42 },
      { action: 'popular', city: 'New York', group: 'todo' },
      { ...popularBody, group: 'todo', near: { lat: 100, lon: 0 } },
      { ...popularBody, group: 'todo', near: { lat: 'x', lon: 0 } },
      { ...popularBody },
      { ...popularBody, group: 'bars' },
    ]) {
      const fetchFn = vi.fn();
      const res = await handlePlaces(post(body), env, fetchFn);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'bad_request' });
      expect(fetchFn).not.toHaveBeenCalled();
    }
  });

  it('answers 503 without a key, on a Google error and when fetch rejects', async () => {
    const body = { ...popularBody, group: 'todo' };
    const noKey = await handlePlaces(post(body), {}, vi.fn());
    expect(noKey.status).toBe(503);
    const non2xx = await handlePlaces(
      post(body),
      env,
      vi.fn().mockResolvedValue(jsonResponse({}, 429)),
    );
    expect(non2xx.status).toBe(503);
    const rejected = await handlePlaces(post(body), env, vi.fn().mockRejectedValue(new Error('x')));
    expect(rejected.status).toBe(503);
    expect(await rejected.json()).toEqual({ error: 'unavailable' });
  });
});
