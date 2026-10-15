import { describe, expect, it, vi } from 'vitest';
import { handlePlaces } from '../functions/places/handler';

const env = { key: 'test-key' };

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

  it('answers OPTIONS with 204 and CORS headers', async () => {
    const res = await handlePlaces(
      new Request('http://localhost/places', { method: 'OPTIONS' }),
      env,
      vi.fn(),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-headers')).toContain('authorization');
  });
});
